"""
Redis Cache Service
Implements Redis-based caching for frequently accessed data
"""

from typing import Any, Optional, Dict, List
import json
import logging
import asyncio
import hashlib
from datetime import datetime, timedelta
import redis.asyncio as redis
from redis.exceptions import ConnectionError, TimeoutError

logger = logging.getLogger(__name__)


class RedisCacheService:
    """
    Redis-based caching service for high-performance data access
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.redis_host = config.get("redis_host", "localhost")
        self.redis_port = config.get("redis_port", 6379)
        self.redis_db = config.get("redis_db", 0)
        self.redis_password = config.get("redis_password")
        self.max_connections = config.get("max_redis_connections", 20)
        self.socket_timeout = config.get("redis_socket_timeout", 5)
        self.socket_connect_timeout = config.get("redis_connect_timeout", 5)

        self.redis_client: Optional[redis.Redis] = None
        self.default_ttl = config.get("default_cache_ttl", 3600)  # 1 hour

        # Cache statistics
        self.stats = {"hits": 0, "misses": 0, "sets": 0, "deletes": 0, "errors": 0}

    async def connect(self):
        """Establish connection to Redis"""
        try:
            self.redis_client = redis.Redis(
                host=self.redis_host,
                port=self.redis_port,
                db=self.redis_db,
                password=self.redis_password,
                max_connections=self.max_connections,
                socket_timeout=self.socket_timeout,
                socket_connect_timeout=self.socket_connect_timeout,
                decode_responses=True,
                retry_on_timeout=True,
                health_check_interval=30,
            )

            # Test connection
            await self.redis_client.ping()
            logger.info("Connected to Redis successfully")

        except ConnectionError as e:
            logger.error(f"Failed to connect to Redis: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error connecting to Redis: {str(e)}")
            raise

    async def disconnect(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()
            logger.info("Disconnected from Redis")

    def _make_key(self, namespace: str, key: str) -> str:
        """Create namespaced cache key"""
        return f"aio:{namespace}:{key}"

    def _make_hash_key(self, namespace: str, key: str) -> str:
        """Create hash key for complex data"""
        key_hash = hashlib.md5(key.encode()).hexdigest()
        return f"aio:{namespace}:hash:{key_hash}"

    async def get(
        self, namespace: str, key: str, default: Any = None, use_hash: bool = False
    ) -> Any:
        """
        Get value from cache

        Args:
            namespace: Cache namespace
            key: Cache key
            default: Default value if not found
            use_hash: Whether to use hash storage

        Returns:
            Cached value or default
        """
        try:
            if not self.redis_client:
                return default

            cache_key = (
                self._make_hash_key(namespace, key)
                if use_hash
                else self._make_key(namespace, key)
            )
            value = await self.redis_client.get(cache_key)

            if value is None:
                self.stats["misses"] += 1
                return default

            self.stats["hits"] += 1
            return json.loads(value)

        except (ConnectionError, TimeoutError) as e:
            logger.warning(f"Redis connection error during get: {str(e)}")
            self.stats["errors"] += 1
            return default
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error for key {key}: {str(e)}")
            self.stats["errors"] += 1
            return default
        except Exception as e:
            logger.error(f"Unexpected error during cache get: {str(e)}")
            self.stats["errors"] += 1
            return default

    async def set(
        self,
        namespace: str,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        use_hash: bool = False,
    ) -> bool:
        """
        Set value in cache

        Args:
            namespace: Cache namespace
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
            use_hash: Whether to use hash storage

        Returns:
            True if successful
        """
        try:
            if not self.redis_client:
                return False

            cache_key = (
                self._make_hash_key(namespace, key)
                if use_hash
                else self._make_key(namespace, key)
            )
            serialized_value = json.dumps(value, default=str)

            actual_ttl = ttl if ttl is not None else self.default_ttl

            await self.redis_client.setex(cache_key, actual_ttl, serialized_value)
            self.stats["sets"] += 1
            return True

        except (ConnectionError, TimeoutError) as e:
            logger.warning(f"Redis connection error during set: {str(e)}")
            self.stats["errors"] += 1
            return False
        except Exception as e:
            logger.error(f"Unexpected error during cache set: {str(e)}")
            self.stats["errors"] += 1
            return False

    async def delete(self, namespace: str, key: str, use_hash: bool = False) -> bool:
        """
        Delete value from cache

        Args:
            namespace: Cache namespace
            key: Cache key
            use_hash: Whether to use hash storage

        Returns:
            True if successful
        """
        try:
            if not self.redis_client:
                return False

            cache_key = (
                self._make_hash_key(namespace, key)
                if use_hash
                else self._make_key(namespace, key)
            )

            await self.redis_client.delete(cache_key)
            self.stats["deletes"] += 1
            return True

        except (ConnectionError, TimeoutError) as e:
            logger.warning(f"Redis connection error during delete: {str(e)}")
            self.stats["errors"] += 1
            return False
        except Exception as e:
            logger.error(f"Unexpected error during cache delete: {str(e)}")
            self.stats["errors"] += 1
            return False

    async def delete_pattern(self, namespace: str, pattern: str) -> int:
        """
        Delete all keys matching pattern in namespace

        Args:
            namespace: Cache namespace
            pattern: Key pattern (supports wildcards)

        Returns:
            Number of keys deleted
        """
        try:
            if not self.redis_client:
                return 0

            pattern_key = f"aio:{namespace}:{pattern}"
            keys = await self.redis_client.keys(pattern_key)

            if keys:
                deleted = await self.redis_client.delete(*keys)
                self.stats["deletes"] += deleted
                return deleted

            return 0

        except (ConnectionError, TimeoutError) as e:
            logger.warning(f"Redis connection error during pattern delete: {str(e)}")
            self.stats["errors"] += 1
            return 0
        except Exception as e:
            logger.error(f"Unexpected error during pattern delete: {str(e)}")
            self.stats["errors"] += 1
            return 0

    async def exists(self, namespace: str, key: str, use_hash: bool = False) -> bool:
        """
        Check if key exists in cache

        Args:
            namespace: Cache namespace
            key: Cache key
            use_hash: Whether to use hash storage

        Returns:
            True if key exists
        """
        try:
            if not self.redis_client:
                return False

            cache_key = (
                self._make_hash_key(namespace, key)
                if use_hash
                else self._make_key(namespace, key)
            )
            result = await self.redis_client.exists(cache_key)
            return bool(result)

        except (ConnectionError, TimeoutError) as e:
            logger.warning(f"Redis connection error during exists: {str(e)}")
            self.stats["errors"] += 1
            return False
        except Exception as e:
            logger.error(f"Unexpected error during cache exists: {str(e)}")
            self.stats["errors"] += 1
            return False

    async def get_ttl(self, namespace: str, key: str, use_hash: bool = False) -> int:
        """
        Get TTL for cached key

        Args:
            namespace: Cache namespace
            key: Cache key
            use_hash: Whether to use hash storage

        Returns:
            TTL in seconds, -1 if no TTL, -2 if key doesn't exist
        """
        try:
            if not self.redis_client:
                return -2

            cache_key = (
                self._make_hash_key(namespace, key)
                if use_hash
                else self._make_key(namespace, key)
            )
            ttl = await self.redis_client.ttl(cache_key)
            return ttl

        except (ConnectionError, TimeoutError) as e:
            logger.warning(f"Redis connection error during TTL check: {str(e)}")
            self.stats["errors"] += 1
            return -2
        except Exception as e:
            logger.error(f"Unexpected error during TTL check: {str(e)}")
            self.stats["errors"] += 1
            return -2

    async def increment(
        self, namespace: str, key: str, amount: int = 1, ttl: Optional[int] = None
    ) -> Optional[int]:
        """
        Increment numeric value in cache

        Args:
            namespace: Cache namespace
            key: Cache key
            amount: Increment amount
            ttl: Optional TTL

        Returns:
            New value after increment
        """
        try:
            if not self.redis_client:
                return None

            cache_key = self._make_key(namespace, key)

            # Use Redis INCR command
            if amount == 1:
                result = await self.redis_client.incr(cache_key)
            else:
                result = await self.redis_client.incrby(cache_key, amount)

            # Set TTL if provided
            if ttl is not None:
                await self.redis_client.expire(cache_key, ttl)

            self.stats["sets"] += 1
            return result

        except (ConnectionError, TimeoutError) as e:
            logger.warning(f"Redis connection error during increment: {str(e)}")
            self.stats["errors"] += 1
            return None
        except Exception as e:
            logger.error(f"Unexpected error during increment: {str(e)}")
            self.stats["errors"] += 1
            return None

    async def expire(self, namespace: str, key: str, ttl: int) -> bool:
        """
        Set TTL for existing key

        Args:
            namespace: Cache namespace
            key: Cache key
            ttl: TTL in seconds

        Returns:
            True if successful
        """
        try:
            if not self.redis_client:
                return False

            cache_key = self._make_key(namespace, key)
            result = await self.redis_client.expire(cache_key, ttl)
            return result

        except (ConnectionError, TimeoutError) as e:
            logger.warning(f"Redis connection error during expire: {str(e)}")
            self.stats["errors"] += 1
            return False
        except Exception as e:
            logger.error(f"Unexpected error during expire: {str(e)}")
            self.stats["errors"] += 1
            return False

    async def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics

        Returns:
            Cache statistics
        """
        try:
            if not self.redis_client:
                return self.stats

            # Get Redis info
            info = await self.redis_client.info()

            # Calculate hit rate
            total_requests = self.stats["hits"] + self.stats["misses"]
            hit_rate = (
                (self.stats["hits"] / total_requests * 100) if total_requests > 0 else 0
            )

            return {
                "hits": self.stats["hits"],
                "misses": self.stats["misses"],
                "sets": self.stats["sets"],
                "deletes": self.stats["deletes"],
                "errors": self.stats["errors"],
                "hit_rate": round(hit_rate, 2),
                "total_requests": total_requests,
                "redis_info": {
                    "used_memory": info.get("used_memory"),
                    "used_memory_human": info.get("used_memory_human"),
                    "connected_clients": info.get("connected_clients"),
                    "total_commands_processed": info.get("total_commands_processed"),
                    "keyspace_hits": info.get("keyspace_hits"),
                    "keyspace_misses": info.get("keyspace_misses"),
                },
            }

        except Exception as e:
            logger.error(f"Error getting cache stats: {str(e)}")
            return self.stats

    async def clear_namespace(self, namespace: str) -> int:
        """
        Clear all keys in a namespace

        Args:
            namespace: Cache namespace

        Returns:
            Number of keys cleared
        """
        try:
            if not self.redis_client:
                return 0

            pattern = f"aio:{namespace}:*"
            keys = await self.redis_client.keys(pattern)

            if keys:
                deleted = await self.redis_client.delete(*keys)
                self.stats["deletes"] += deleted
                return deleted

            return 0

        except (ConnectionError, TimeoutError) as e:
            logger.warning(f"Redis connection error during clear: {str(e)}")
            self.stats["errors"] += 1
            return 0
        except Exception as e:
            logger.error(f"Unexpected error during clear: {str(e)}")
            self.stats["errors"] += 1
            return 0

    async def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on Redis connection

        Returns:
            Health check result
        """
        try:
            if not self.redis_client:
                return {
                    "status": "disconnected",
                    "message": "Redis client not initialized",
                }

            # Test ping
            start_time = asyncio.get_event_loop().time()
            await self.redis_client.ping()
            latency = (asyncio.get_event_loop().time() - start_time) * 1000

            # Get Redis info
            info = await self.redis_client.info("server")

            return {
                "status": "healthy",
                "latency_ms": round(latency, 2),
                "redis_version": info.get("redis_version"),
                "uptime_seconds": info.get("uptime_in_seconds"),
                "connected_clients": info.get("connected_clients"),
                "used_memory": info.get("used_memory_human"),
            }

        except ConnectionError as e:
            return {
                "status": "unhealthy",
                "error": "Connection failed",
                "message": str(e),
            }
        except Exception as e:
            return {"status": "error", "error": "Unknown error", "message": str(e)}

    # Context manager support
    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.disconnect()
