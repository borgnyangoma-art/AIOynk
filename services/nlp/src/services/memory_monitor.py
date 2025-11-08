"""
Memory Usage Monitoring Service
Monitors and manages memory usage across the application
"""

from typing import Dict, Any, List, Optional, Callable
import logging
import psutil
import gc
import time
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class AlertLevel(Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


@dataclass
class MemoryAlert:
    level: AlertLevel
    message: str
    current_usage: float
    threshold: float
    timestamp: datetime
    component: str


class MemoryMonitor:
    """
    Monitors memory usage and triggers alerts
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.max_memory_mb = config.get("max_memory_mb", 4096)  # 4GB
        self.warning_threshold = config.get("warning_threshold", 0.70)  # 70%
        self.critical_threshold = config.get("critical_threshold", 0.85)  # 85%
        self.emergency_threshold = config.get("emergency_threshold", 0.95)  # 95%

        self.check_interval = config.get("check_interval", 30)  # seconds
        self.alert_callbacks: List[Callable[[MemoryAlert], None]] = []

        # Tracking
        self.alerts_history: List[MemoryAlert] = []
        self.max_history_size = config.get("max_alert_history", 100)

        # Statistics
        self.stats = {
            "checks_performed": 0,
            "alerts_raised": 0,
            "max_memory_used": 0,
            "avg_memory_usage": 0,
            "gc_runs": 0,
        }

        # Process
        self.process = psutil.Process()

    def register_alert_callback(self, callback: Callable[[MemoryAlert], None]):
        """
        Register callback for memory alerts

        Args:
            callback: Function to call when alert is raised
        """
        self.alert_callbacks.append(callback)
        logger.debug("Registered memory alert callback")

    async def get_memory_info(self) -> Dict[str, Any]:
        """
        Get current memory information

        Returns:
            Memory information
        """
        try:
            # System memory
            system_memory = psutil.virtual_memory()

            # Process memory
            process_memory = self.process.memory_info()
            process_memory_percent = self.process.memory_percent()

            # Calculate usage
            current_mb = process_memory.rss / 1024 / 1024
            usage_percent = current_mb / self.max_memory_mb

            memory_info = {
                "timestamp": datetime.now().isoformat(),
                "process": {
                    "rss_mb": round(current_mb, 2),
                    "vms_mb": round(process_memory.vms / 1024 / 1024, 2),
                    "percent": round(process_memory_percent, 2),
                    "max_limit_mb": self.max_memory_mb,
                },
                "system": {
                    "total_gb": round(system_memory.total / 1024 / 1024 / 1024, 2),
                    "available_gb": round(
                        system_memory.available / 1024 / 1024 / 1024, 2
                    ),
                    "used_gb": round(system_memory.used / 1024 / 1024 / 1024, 2),
                    "percent": round(system_memory.percent, 2),
                },
                "usage_percent": round(usage_percent * 100, 2),
                "threshold_status": self._get_threshold_status(usage_percent),
            }

            self.stats["checks_performed"] += 1

            # Update max memory used
            if current_mb > self.stats["max_memory_used"]:
                self.stats["max_memory_used"] = current_mb

            # Update average memory usage
            if self.stats["avg_memory_usage"] == 0:
                self.stats["avg_memory_usage"] = usage_percent
            else:
                alpha = 0.1
                self.stats["avg_memory_usage"] = (
                    alpha * usage_percent + (1 - alpha) * self.stats["avg_memory_usage"]
                )

            return memory_info

        except Exception as e:
            logger.error(f"Error getting memory info: {str(e)}")
            return {"error": str(e), "timestamp": datetime.now().isoformat()}

    async def check_memory(self) -> Dict[str, Any]:
        """
        Check memory usage and raise alerts if necessary

        Returns:
            Check result
        """
        try:
            memory_info = await self.get_memory_info()

            if "error" in memory_info:
                return memory_info

            usage_percent = memory_info["usage_percent"] / 100
            current_mb = memory_info["process"]["rss_mb"]

            # Check thresholds
            alert_level = None
            if usage_percent >= self.emergency_threshold:
                alert_level = AlertLevel.EMERGENCY
            elif usage_percent >= self.critical_threshold:
                alert_level = AlertLevel.CRITICAL
            elif usage_percent >= self.warning_threshold:
                alert_level = AlertLevel.WARNING

            # Raise alert if threshold exceeded
            if alert_level:
                alert = MemoryAlert(
                    level=alert_level,
                    message=self._generate_alert_message(
                        alert_level, current_mb, usage_percent
                    ),
                    current_usage=current_mb,
                    threshold=self.max_memory_mb
                    * (
                        self.warning_threshold
                        if alert_level == AlertLevel.WARNING
                        else self.critical_threshold
                        if alert_level == AlertLevel.CRITICAL
                        else self.emergency_threshold
                    ),
                    timestamp=datetime.now(),
                    component="memory_monitor",
                )

                await self._raise_alert(alert)

                # Auto-cleanup on high usage
                if alert_level in [AlertLevel.CRITICAL, AlertLevel.EMERGENCY]:
                    await self._emergency_cleanup()

            return {
                "success": True,
                "memory_info": memory_info,
                "alert_raised": alert_level is not None,
                "alert_level": alert_level.value if alert_level else None,
            }

        except Exception as e:
            logger.error(f"Error during memory check: {str(e)}")
            return {"success": False, "error": str(e)}

    async def _raise_alert(self, alert: MemoryAlert):
        """
        Raise memory alert

        Args:
            alert: Memory alert
        """
        self.alerts_history.append(alert)
        self.stats["alerts_raised"] += 1

        # Trim history if too long
        if len(self.alerts_history) > self.max_history_size:
            self.alerts_history.pop(0)

        # Log alert
        log_level = {
            AlertLevel.INFO: logging.INFO,
            AlertLevel.WARNING: logging.WARNING,
            AlertLevel.CRITICAL: logging.CRITICAL,
            AlertLevel.EMERGENCY: logging.CRITICAL,
        }[alert.level]

        logger.log(
            log_level,
            f"Memory Alert [{alert.level.value.upper()}]: {alert.message} "
            f"(Usage: {alert.current_usage:.2f}MB / {alert.threshold:.2f}MB)",
        )

        # Call registered callbacks
        for callback in self.alert_callbacks:
            try:
                callback(alert)
            except Exception as e:
                logger.error(f"Error in alert callback: {str(e)}")

    def _get_threshold_status(self, usage_percent: float) -> str:
        """
        Get threshold status based on usage

        Args:
            usage_percent: Usage as percentage (0-1)

        Returns:
            Status string
        """
        if usage_percent >= self.emergency_threshold:
            return "emergency"
        elif usage_percent >= self.critical_threshold:
            return "critical"
        elif usage_percent >= self.warning_threshold:
            return "warning"
        else:
            return "normal"

    def _generate_alert_message(
        self, level: AlertLevel, current_mb: float, usage_percent: float
    ) -> str:
        """
        Generate alert message

        Args:
            alert_level: Alert level
            current_mb: Current memory in MB
            usage_percent: Usage percentage

        Returns:
            Alert message
        """
        threshold_mb = self.max_memory_mb * (
            self.warning_threshold
            if level == AlertLevel.WARNING
            else self.critical_threshold
            if level == AlertLevel.CRITICAL
            else self.emergency_threshold
        )

        return (
            f"Memory usage {current_mb:.2f}MB ({usage_percent * 100:.1f}%) "
            f"exceeds {level.value} threshold of {threshold_mb:.2f}MB"
        )

    async def _emergency_cleanup(self):
        """
        Perform emergency memory cleanup
        """
        try:
            logger.warning("Performing emergency memory cleanup")

            # Run garbage collection
            collected = gc.collect()
            self.stats["gc_runs"] += 1

            # Clear caches if available
            try:
                from .application_cache import get_cache

                cache = get_cache()
                if hasattr(cache, "cleanup_expired"):
                    cleaned = await cache.cleanup_expired()
                    logger.info(f"Cleaned {cleaned} expired cache items")
            except Exception as e:
                logger.error(f"Error cleaning cache: {str(e)}")

            # Force garbage collection again
            collected_2 = gc.collect()

            logger.info(
                f"Emergency cleanup complete: {collected + collected_2} objects collected"
            )

        except Exception as e:
            logger.error(f"Error during emergency cleanup: {str(e)}")

    async def get_alerts_history(
        self, level: Optional[AlertLevel] = None, hours: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get alert history

        Args:
            level: Filter by alert level
            hours: Filter by hours (e.g., last 24 hours)

        Returns:
            List of alerts
        """
        alerts = self.alerts_history.copy()

        # Filter by level
        if level:
            alerts = [a for a in alerts if a.level == level]

        # Filter by time
        if hours:
            cutoff = datetime.now() - timedelta(hours=hours)
            alerts = [a for a in alerts if a.timestamp >= cutoff]

        return [
            {
                "level": alert.level.value,
                "message": alert.message,
                "current_usage": alert.current_usage,
                "threshold": alert.threshold,
                "timestamp": alert.timestamp.isoformat(),
                "component": alert.component,
            }
            for alert in alerts
        ]

    async def get_stats(self) -> Dict[str, Any]:
        """
        Get memory monitoring statistics

        Returns:
            Statistics
        """
        return {
            "checks_performed": self.stats["checks_performed"],
            "alerts_raised": self.stats["alerts_raised"],
            "max_memory_used_mb": round(self.stats["max_memory_used"], 2),
            "avg_memory_usage_percent": round(self.stats["avg_memory_usage"] * 100, 2),
            "gc_runs": self.stats["gc_runs"],
            "config": {
                "max_memory_mb": self.max_memory_mb,
                "warning_threshold": self.warning_threshold,
                "critical_threshold": self.critical_threshold,
                "emergency_threshold": self.emergency_threshold,
            },
        }

    async def force_garbage_collection(self) -> Dict[str, Any]:
        """
        Force garbage collection

        Returns:
            GC result
        """
        try:
            start_objects = len(gc.get_objects())

            collected = gc.collect()

            end_objects = len(gc.get_objects())
            freed_objects = start_objects - end_objects

            self.stats["gc_runs"] += 1

            return {
                "success": True,
                "collected": collected,
                "freed_objects": freed_objects,
                "start_objects": start_objects,
                "end_objects": end_objects,
            }

        except Exception as e:
            logger.error(f"Error during garbage collection: {str(e)}")
            return {"success": False, "error": str(e)}


# Global memory monitor instance
memory_monitor: Optional[MemoryMonitor] = None


def get_memory_monitor() -> MemoryMonitor:
    """Get global memory monitor instance"""
    global memory_monitor
    if memory_monitor is None:
        raise RuntimeError("Memory monitor not initialized")
    return memory_monitor


def init_memory_monitor(config: Dict[str, Any]):
    """Initialize global memory monitor"""
    global memory_monitor
    memory_monitor = MemoryMonitor(config)
    logger.info("Memory monitor initialized")
