"""
Application-Level Cache Service
Caches computed results and API responses
"""

from typing import Any, Optional, Dict, Callable, Awaitable
import json
import logging
import asyncio
import hashlib
import time
from datetime import datetime, timedelta
from functools import wraps
import weakref

from .redis_cache import RedisCacheService

logger = logging.getLogger(__name__)


class ApplicationCache:
    """
    Application-level cache with Redis and in-memory fallback
    """

    def __init__(self, redis_service: Optional[RedisCacheService] = None):
        self.redis = redis_service
        self.memory_cache: Dict[str, Dict[str, Any]] = {}
        self.max_memory_items = 1000
        self.default_ttl = 3600  # 1 hour

        # LRU tracking
        self.access_order = []
        self.access_order_refs = weakref.WeakValueDictionary()

        # Statistics
        self.stats = {
            "redis_hits": 0,
            "memory_hits": 0,
            "misses": 0,
            "sets": 0,
            "evictions": 0,
        }

    def _make_key(self, namespace: str, key: str) -> str:
        """Create cache key"""
        key_hash = hashlib.md5(key.encode()).hexdigest()[:16]
        return f"{namespace}:{key_hash}"

    def _make_cache_key(self, func: Callable, *args, **kwargs) -> str:
        """Create cache key from function and arguments"""
        func_name = f"{func.__module__}.{func.__name__}"
        args_str = json.dumps(
            {"args": args, "kwargs": kwargs}, sort_keys=True, default=str
        )
        args_hash = hashlib.md5(args_str.encode()).hexdigest()[:16]
        return f"func:{func_name}:{args_hash}"

    async def get(self, namespace: str, key: str) -> Any:
        """
        Get value from cache (tries Redis first, then memory)

        Args:
            namespace: Cache namespace
            key: Cache key

        Returns:
            Cached value or None
        """
        cache_key = self._make_key(namespace, key)

        # Try Redis first
        if self.redis:
            value = await self.redis.get("app", cache_key, use_hash=True)
            if value is not None:
                self.stats["redis_hits"] += 1
                return value

        # Try memory cache
        if cache_key in self.memory_cache:
            entry = self.memory_cache[cache_key]

            # Check if expired
            if entry["expires_at"] > time.time():
                self._update_access_order(cache_key)
                self.stats["memory_hits"] += 1
                return entry["value"]
            else:
                # Remove expired entry
                del self.memory_cache[cache_key]

        self.stats["misses"] += 1
        return None

    async def set(
        self, namespace: str, key: str, value: Any, ttl: Optional[int] = None
    ) -> bool:
        """
        Set value in cache (both Redis and memory)

        Args:
            namespace: Cache namespace
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds

        Returns:
            True if successful
        """
        cache_key = self._make_key(namespace, key)
        actual_ttl = ttl if ttl is not None else self.default_ttl
        expires_at = time.time() + actual_ttl

        # Store in Redis
        if self.redis:
            await self.redis.set("app", cache_key, value, ttl=actual_ttl, use_hash=True)

        # Store in memory with LRU management
        self._add_to_memory_cache(cache_key, value, expires_at)

        self.stats["sets"] += 1
        return True

    async def delete(self, namespace: str, key: str) -> bool:
        """
        Delete value from cache

        Args:
            namespace: Cache namespace
            key: Cache key

        Returns:
            True if successful
        """
        cache_key = self._make_key(namespace, key)

        # Delete from Redis
        if self.redis:
            await self.redis.delete("app", cache_key, use_hash=True)

        # Delete from memory
        if cache_key in self.memory_cache:
            del self.memory_cache[cache_key]
            self._remove_from_access_order(cache_key)

        return True

    async def clear_namespace(self, namespace: str) -> int:
        """
        Clear all keys in a namespace

        Args:
            namespace: Cache namespace

        Returns:
            Number of keys cleared
        """
        count = 0

        # Clear from Redis
        if self.redis:
            count += await self.redis.delete_pattern("app", f"{namespace}:*")

        # Clear from memory
        keys_to_delete = [
            k for k in self.memory_cache.keys() if k.startswith(f"{namespace}:")
        ]
        for key in keys_to_delete:
            del self.memory_cache[key]
            self._remove_from_access_order(key)

        count += len(keys_to_delete)
        return count

    def _add_to_memory_cache(self, key: str, value: Any, expires_at: float):
        """Add item to memory cache with LRU management"""
        # Check if we need to evict items
        if (
            len(self.memory_cache) >= self.max_memory_items
            and key not in self.memory_cache
        ):
            self._evict_lru()

        self.memory_cache[key] = {
            "value": value,
            "expires_at": expires_at,
            "created_at": time.time(),
        }

        self._update_access_order(key)

    def _evict_lru(self):
        """Evict least recently used item"""
        if not self.access_order:
            # Remove random item if no access order
            key = next(iter(self.memory_cache))
            del self.memory_cache[key]
            self.stats["evictions"] += 1
            return

        # Remove from end (least recently used)
        lru_key = self.access_order.pop(0)
        if lru_key in self.memory_cache:
            del self.memory_cache[lru_key]
            self.stats["evictions"] += 1

    def _update_access_order(self, key: str):
        """Update access order for LRU"""
        # Remove if already exists
        self._remove_from_access_order(key)

        # Add to end (most recently used)
        self.access_order.append(key)

        # Keep only last 1000 items
        if len(self.access_order) > 1000:
            old_key = self.access_order.pop(0)
            if old_key in self.memory_cache:
                # Keep it in cache but remove from order
                pass

    def _remove_from_access_order(self, key: str):
        """Remove key from access order"""
        try:
            self.access_order.remove(key)
        except ValueError:
            pass

    def cached(
        self,
        namespace: str,
        ttl: Optional[int] = None,
        key_func: Optional[Callable] = None,
    ):
        """
        Decorator for caching function results

        Args:
            namespace: Cache namespace
            ttl: Time to live in seconds
            key_func: Custom key function (func, *args, **kwargs) -> str

        Returns:
            Decorated function
        """

        def decorator(func: Callable):
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                # Create cache key
                if key_func:
                    cache_key = key_func(func, *args, **kwargs)
                else:
                    cache_key = self._make_cache_key(func, *args, **kwargs)

                # Try to get from cache
                cached_result = await self.get(namespace, cache_key)
                if cached_result is not None:
                    return cached_result

                # Execute function
                start_time = time.time()
                result = (
                    await func(*args, **kwargs)
                    if asyncio.iscoroutinefunction(func)
                    else func(*args, **kwargs)
                )
                execution_time = time.time() - start_time

                # Cache result
                await self.set(namespace, cache_key, result, ttl)

                logger.debug(
                    f"Cached function {func.__name__} "
                    f"(execution: {execution_time:.3f}s, ttl: {ttl}s)"
                )

                return result

            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                # For sync functions, create event loop
                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)

                return loop.run_until_complete(async_wrapper(*args, **kwargs))

            # Mark function as cached
            wrapper = (
                async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
            )
            wrapper._is_cached = True
            wrapper._cache_namespace = namespace
            wrapper._cache_ttl = ttl

            return wrapper

        return decorator

    async def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics

        Returns:
            Cache statistics
        """
        redis_stats = await self.redis.get_stats() if self.redis else {}

        # Calculate hit rate
        total_hits = self.stats["redis_hits"] + self.stats["memory_hits"]
        total_requests = total_hits + self.stats["misses"]
        hit_rate = (total_hits / total_requests * 100) if total_requests > 0 else 0

        # Memory cache stats
        memory_items = len(self.memory_cache)
        memory_usage_percent = (memory_items / self.max_memory_items) * 100

        # Expired items count
        now = time.time()
        expired_items = sum(
            1 for entry in self.memory_cache.values() if entry["expires_at"] <= now
        )

        return {
            "redis": {
                "available": self.redis is not None,
                "hits": self.stats["redis_hits"],
                "hit_rate": round(redis_stats.get("hit_rate", 0), 2),
            },
            "memory": {
                "hits": self.stats["memory_hits"],
                "items": memory_items,
                "max_items": self.max_memory_items,
                "usage_percent": round(memory_usage_percent, 2),
                "expired_items": expired_items,
                "evictions": self.stats["evictions"],
            },
            "overall": {
                "total_hits": total_hits,
                "misses": self.stats["misses"],
                "sets": self.stats["sets"],
                "total_requests": total_requests,
                "hit_rate": round(hit_rate, 2),
            },
        }

    async def warmup_cache(self, items: list):
        """
        Warm up cache with predefined items

        Args:
            items: List of dicts with 'namespace', 'key', 'value', 'ttl'
        """
        logger.info(f"Warming up cache with {len(items)} items")

        for item in items:
            await self.set(
                item["namespace"], item["key"], item["value"], item.get("ttl")
            )

        logger.info("Cache warmup complete")

    async def cleanup_expired(self) -> int:
        """
        Remove expired items from memory cache

        Returns:
            Number of items cleaned
        """
        now = time.time()
        expired_keys = [
            key
            for key, entry in self.memory_cache.items()
            if entry["expires_at"] <= now
        ]

        for key in expired_keys:
            del self.memory_cache[key]
            self._remove_from_access_order(key)

        return len(expired_keys)


# Global cache instance
app_cache: Optional[ApplicationCache] = None


def get_cache() -> ApplicationCache:
    """Get global cache instance"""
    global app_cache
    if app_cache is None:
        raise RuntimeError("Cache not initialized. Call init_cache() first.")
    return app_cache


def init_cache(redis_service: Optional[RedisCacheService] = None):
    """Initialize global cache"""
    global app_cache
    app_cache = ApplicationCache(redis_service)
    logger.info("Application cache initialized")
