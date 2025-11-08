"""
Session Timeout Management Service
Manages session timeouts, user activity tracking, and automatic cleanup
"""

from typing import Dict, Any, List, Optional, Callable
import asyncio
import logging
import json
import time
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import uuid

from .redis_cache import RedisCacheService

logger = logging.getLogger(__name__)


class SessionStatus(Enum):
    ACTIVE = "active"
    IDLE = "idle"
    EXPIRED = "expired"
    TERMINATED = "terminated"


@dataclass
class Session:
    session_id: str
    user_id: str
    created_at: datetime
    last_activity: datetime
    expires_at: datetime
    status: SessionStatus = SessionStatus.ACTIVE
    metadata: Dict[str, Any] = field(default_factory=dict)
    activity_events: List[Dict[str, Any]] = field(default_factory=list)
    access_count: int = 0


class SessionManager:
    """
    Manages user sessions with timeout handling
    """

    def __init__(
        self, config: Dict[str, Any], redis_service: Optional[RedisCacheService] = None
    ):
        self.config = config
        self.redis = redis_service

        # Timeout configuration
        self.default_timeout = config.get("default_session_timeout", 3600)  # 1 hour
        self.idle_timeout = config.get("idle_timeout", 1800)  # 30 minutes
        self.max_session_age = config.get("max_session_age", 86400)  # 24 hours
        self.activity_check_interval = config.get(
            "activity_check_interval", 60
        )  # 1 minute

        # Session tracking
        self.sessions: Dict[str, Session] = {}
        self.user_sessions: Dict[str, List[str]] = {}  # user_id -> list of session_ids
        self.activity_callbacks: List[Callable] = []

        # Statistics
        self.stats = {
            "total_sessions": 0,
            "active_sessions": 0,
            "expired_sessions": 0,
            "avg_session_duration": 0.0,
            "total_activity_events": 0,
        }

        # Background tasks
        self.is_running = False
        self.cleanup_task: Optional[asyncio.Task] = None

    def register_activity_callback(self, callback: Callable):
        """
        Register callback for session activity events

        Args:
            callback: Function to call on activity
        """
        self.activity_callbacks.append(callback)
        logger.debug("Registered session activity callback")

    async def create_session(
        self,
        user_id: str,
        custom_timeout: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Create new session

        Args:
            user_id: User identifier
            custom_timeout: Custom timeout in seconds
            metadata: Additional session metadata

        Returns:
            Session ID
        """
        session_id = str(uuid.uuid4())
        now = datetime.now()

        timeout = custom_timeout or self.default_timeout
        expires_at = now + timedelta(seconds=timeout)

        session = Session(
            session_id=session_id,
            user_id=user_id,
            created_at=now,
            last_activity=now,
            expires_at=expires_at,
            metadata=metadata or {},
        )

        # Store session
        self.sessions[session_id] = session

        if user_id not in self.user_sessions:
            self.user_sessions[user_id] = []
        self.user_sessions[user_id].append(session_id)

        # Store in Redis if available
        if self.redis:
            await self.redis.set("sessions", session_id, session.__dict__, ttl=timeout)

        self.stats["total_sessions"] += 1
        self.stats["active_sessions"] += 1

        logger.info(f"Created session: {session_id} for user: {user_id}")

        return session_id

    async def get_session(self, session_id: str) -> Optional[Session]:
        """
        Get session by ID

        Args:
            session_id: Session ID

        Returns:
            Session or None
        """
        # Check in-memory cache first
        if session_id in self.sessions:
            session = self.sessions[session_id]

            # Check if expired
            if datetime.now() > session.expires_at:
                await self.expire_session(session_id)
                return None

            return session

        # Try to load from Redis
        if self.redis:
            session_data = await self.redis.get("sessions", session_id)
            if session_data:
                # Recreate session object
                session = Session(**session_data)
                session.created_at = datetime.fromisoformat(session.created_at)
                session.last_activity = datetime.fromisoformat(session.last_activity)
                session.expires_at = datetime.fromisoformat(session.expires_at)

                # Store in memory cache
                self.sessions[session_id] = session

                return session

        return None

    async def update_activity(
        self,
        session_id: str,
        activity_type: str = "generic",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Update session activity

        Args:
            session_id: Session ID
            activity_type: Type of activity
            metadata: Additional activity metadata

        Returns:
            True if successful
        """
        session = await self.get_session(session_id)

        if not session:
            logger.warning(f"Cannot update activity: session {session_id} not found")
            return False

        # Update activity
        now = datetime.now()
        session.last_activity = now
        session.access_count += 1

        # Check if session is now idle
        idle_duration = (now - session.last_activity).total_seconds()
        if (
            idle_duration >= self.idle_timeout
            and session.status == SessionStatus.ACTIVE
        ):
            session.status = SessionStatus.IDLE
            logger.info(f"Session {session_id} is now IDLE")

        # Add activity event
        activity_event = {
            "timestamp": now.isoformat(),
            "type": activity_type,
            "metadata": metadata or {},
        }
        session.activity_events.append(activity_event)

        # Update in Redis
        if self.redis:
            timeout = int((session.expires_at - now).total_seconds())
            if timeout > 0:
                await self.redis.set(
                    "sessions", session_id, self._session_to_dict(session), ttl=timeout
                )

        # Notify callbacks
        for callback in self.activity_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    asyncio.create_task(callback(session_id, activity_type, metadata))
                else:
                    callback(session_id, activity_type, metadata)
            except Exception as e:
                logger.error(f"Error in activity callback: {str(e)}")

        self.stats["total_activity_events"] += 1

        return True

    async def extend_session(
        self, session_id: str, additional_time: Optional[int] = None
    ) -> bool:
        """
        Extend session timeout

        Args:
            session_id: Session ID
            additional_time: Additional time in seconds

        Returns:
            True if successful
        """
        session = await self.get_session(session_id)

        if not session:
            return False

        # Calculate extension
        extension = additional_time or self.default_timeout
        now = datetime.now()

        # Extend expires_at
        session.expires_at = now + timedelta(seconds=extension)
        session.status = SessionStatus.ACTIVE

        # Update in Redis
        if self.redis:
            await self.redis.set(
                "sessions", session_id, self._session_to_dict(session), ttl=extension
            )

        logger.info(f"Extended session {session_id} by {extension} seconds")

        return True

    async def terminate_session(self, session_id: str) -> bool:
        """
        Terminate session

        Args:
            session_id: Session ID

        Returns:
            True if successful
        """
        session = await self.get_session(session_id)

        if not session:
            return False

        # Update status
        session.status = SessionStatus.TERMINATED
        session.metadata["terminated_at"] = datetime.now().isoformat()

        # Remove from active sessions
        if session_id in self.sessions:
            del self.sessions[session_id]

        # Remove from Redis
        if self.redis:
            await self.redis.delete("sessions", session_id)

        # Update user sessions list
        if session.user_id in self.user_sessions:
            if session_id in self.user_sessions[session.user_id]:
                self.user_sessions[session.user_id].remove(session_id)

        self.stats["active_sessions"] -= 1

        logger.info(f"Terminated session: {session_id}")

        return True

    async def expire_session(self, session_id: str) -> bool:
        """
        Expire session due to timeout

        Args:
            session_id: Session ID

        Returns:
            True if successful
        """
        session = self.sessions.get(session_id)

        if not session:
            return False

        # Update status
        session.status = SessionStatus.EXPIRED
        session.metadata["expired_at"] = datetime.now().isoformat()

        # Remove from active sessions
        del self.sessions[session_id]

        # Remove from Redis
        if self.redis:
            await self.redis.delete("sessions", session_id)

        # Update user sessions list
        if session.user_id in self.user_sessions:
            if session_id in self.user_sessions[session.user_id]:
                self.user_sessions[session.user_id].remove(session_id)

        self.stats["active_sessions"] -= 1
        self.stats["expired_sessions"] += 1

        # Update average session duration
        duration = (datetime.now() - session.created_at).total_seconds()
        alpha = 0.1
        if self.stats["avg_session_duration"] == 0:
            self.stats["avg_session_duration"] = duration
        else:
            self.stats["avg_session_duration"] = (
                alpha * duration + (1 - alpha) * self.stats["avg_session_duration"]
            )

        logger.info(f"Expired session: {session_id} (duration: {duration:.0f}s)")

        return True

    async def get_user_sessions(self, user_id: str) -> List[Session]:
        """
        Get all active sessions for a user

        Args:
            user_id: User identifier

        Returns:
            List of sessions
        """
        session_ids = self.user_sessions.get(user_id, [])
        sessions = []

        for session_id in session_ids:
            session = await self.get_session(session_id)
            if session and session.status == SessionStatus.ACTIVE:
                sessions.append(session)

        return sessions

    async def terminate_user_sessions(self, user_id: str) -> int:
        """
        Terminate all sessions for a user

        Args:
            user_id: User identifier

        Returns:
            Number of sessions terminated
        """
        session_ids = self.user_sessions.get(user_id, [])
        count = 0

        for session_id in session_ids:
            if await self.terminate_session(session_id):
                count += 1

        if user_id in self.user_sessions:
            del self.user_sessions[user_id]

        logger.info(f"Terminated {count} sessions for user: {user_id}")

        return count

    async def start_cleanup_service(self):
        """Start session cleanup service"""
        if self.is_running:
            logger.warning("Session cleanup service is already running")
            return

        self.is_running = True
        logger.info("Starting session cleanup service")

        self.cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop_cleanup_service(self):
        """Stop session cleanup service"""
        if not self.is_running:
            return

        self.is_running = False
        logger.info("Stopping session cleanup service")

        if self.cleanup_task:
            self.cleanup_task.cancel()
            try:
                await self.cleanup_task
            except asyncio.CancelledError:
                pass

    async def _cleanup_loop(self):
        """Background cleanup loop"""
        while self.is_running:
            try:
                await self._cleanup_expired_sessions()
                await self._cleanup_idle_sessions()
                await self._check_memory_usage()

                await asyncio.sleep(self.activity_check_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in session cleanup loop: {str(e)}")
                await asyncio.sleep(60)  # Wait 1 minute before retrying

    async def _cleanup_expired_sessions(self):
        """Clean up expired sessions"""
        now = datetime.now()
        expired_ids = []

        for session_id, session in self.sessions.items():
            if now > session.expires_at:
                expired_ids.append(session_id)

        for session_id in expired_ids:
            await self.expire_session(session_id)

        if expired_ids:
            logger.debug(f"Cleaned up {len(expired_ids)} expired sessions")

    async def _cleanup_idle_sessions(self):
        """Clean up idle sessions based on idle timeout"""
        now = datetime.now()
        idle_threshold = now - timedelta(seconds=self.idle_timeout)
        idle_ids = []

        for session_id, session in self.sessions.items():
            if (
                session.last_activity < idle_threshold
                and session.status == SessionStatus.IDLE
            ):
                idle_ids.append(session_id)

        for session_id in idle_ids:
            await self.terminate_session(session_id)

        if idle_ids:
            logger.debug(f"Terminated {len(idle_ids)} idle sessions")

    async def _check_memory_usage(self):
        """Check memory usage and cleanup if needed"""
        try:
            from .memory_monitor import get_memory_monitor

            memory_monitor = get_memory_monitor()

            memory_info = await memory_monitor.get_memory_info()
            usage_percent = memory_info.get("usage_percent", 0)

            if usage_percent > 90:  # 90% memory usage
                # Force aggressive cleanup
                logger.warning(f"High memory usage ({usage_percent}%), forcing cleanup")

                # Clear old activity events
                for session in self.sessions.values():
                    if len(session.activity_events) > 100:
                        session.activity_events = session.activity_events[-50:]

                # Run garbage collection
                await memory_monitor.force_garbage_collection()

        except Exception as e:
            logger.error(f"Error checking memory usage: {str(e)}")

    def _session_to_dict(self, session: Session) -> dict:
        """Convert session to dictionary for storage"""
        return {
            "session_id": session.session_id,
            "user_id": session.user_id,
            "created_at": session.created_at.isoformat(),
            "last_activity": session.last_activity.isoformat(),
            "expires_at": session.expires_at.isoformat(),
            "status": session.status.value,
            "metadata": session.metadata,
            "activity_events": session.activity_events,
            "access_count": session.access_count,
        }

    async def get_session_stats(self) -> Dict[str, Any]:
        """
        Get session statistics

        Returns:
            Statistics
        """
        return {
            "total_sessions": self.stats["total_sessions"],
            "active_sessions": len(self.sessions),
            "expired_sessions": self.stats["expired_sessions"],
            "avg_session_duration": round(self.stats["avg_session_duration"], 2),
            "total_activity_events": self.stats["total_activity_events"],
            "config": {
                "default_timeout": self.default_timeout,
                "idle_timeout": self.idle_timeout,
                "max_session_age": self.max_session_age,
            },
            "user_count": len(self.user_sessions),
        }


# Global session manager instance
session_manager: Optional[SessionManager] = None


def get_session_manager() -> SessionManager:
    """Get global session manager instance"""
    global session_manager
    if session_manager is None:
        raise RuntimeError("Session manager not initialized")
    return session_manager


def init_session_manager(
    config: Dict[str, Any], redis_service: Optional[RedisCacheService] = None
):
    """Initialize global session manager"""
    global session_manager
    session_manager = SessionManager(config, redis_service)
    logger.info("Session manager initialized")
