"""
Cache Invalidation Service
Manages cache invalidation across Redis, application, and CDN layers
"""

from typing import Dict, List, Any, Optional, Set
import logging
import asyncio
from datetime import datetime
import json

from .redis_cache import RedisCacheService
from .application_cache import ApplicationCache
from .cdn_integration import CDNIntegrationService

logger = logging.getLogger(__name__)


class CacheInvalidationService:
    """
    Service for managing cache invalidation across multiple layers
    """

    def __init__(
        self,
        redis_service: Optional[RedisCacheService] = None,
        app_cache: Optional[ApplicationCache] = None,
        cdn_service: Optional[CDNIntegrationService] = None,
    ):
        self.redis = redis_service
        self.app_cache = app_cache
        self.cdn = cdn_service

        # Track cache dependencies
        self.dependencies: Dict[str, Set[str]] = {}

        # Invalidation patterns
        self.patterns = {
            "user_data": "user:*",
            "project_data": "project:*",
            "artifact_data": "artifact:*",
            "version_data": "version:*",
            "storage_data": "storage:*",
            "tool_data": "tool:*",
        }

    def register_dependency(self, parent_key: str, child_keys: List[str]):
        """
        Register cache key dependencies

        Args:
            parent_key: Parent cache key
            child_keys: Child cache keys that depend on parent
        """
        if parent_key not in self.dependencies:
            self.dependencies[parent_key] = set()

        self.dependencies[parent_key].update(child_keys)
        logger.debug(f"Registered dependency: {parent_key} -> {child_keys}")

    async def invalidate(
        self,
        namespace: str,
        key: str,
        invalidate_dependencies: bool = True,
        invalidate_cdn: bool = False,
    ) -> Dict[str, Any]:
        """
        Invalidate cache entry and its dependencies

        Args:
            namespace: Cache namespace
            key: Cache key to invalidate
            invalidate_dependencies: Whether to invalidate dependencies
            invalidate_cdn: Whether to invalidate CDN

        Returns:
            Invalidation result
        """
        start_time = datetime.now()
        result = {
            "namespace": namespace,
            "key": key,
            "success": True,
            "invalidated": {"redis": 0, "app_cache": 0, "dependencies": 0},
            "cdn": None,
            "errors": [],
        }

        try:
            # Create cache key
            cache_key = f"{namespace}:{key}"

            # Invalidate Redis cache
            if self.redis:
                deleted = await self.redis.delete("app", key, use_hash=True)
                result["invalidated"]["redis"] = deleted

            # Invalidate application cache
            if self.app_cache:
                await self.app_cache.delete(namespace, key)
                result["invalidated"]["app_cache"] = 1

            # Invalidate dependencies
            if invalidate_dependencies and cache_key in self.dependencies:
                dep_count = await self._invalidate_dependencies(cache_key)
                result["invalidated"]["dependencies"] = dep_count

            # Invalidate CDN if requested
            if invalidate_cdn and self.cdn:
                cdn_result = await self.cdn.purge_cdn_cache([f"/assets/{key}"])
                result["cdn"] = cdn_result

            elapsed = (datetime.now() - start_time).total_seconds()
            logger.info(
                f"Invalidated cache: {cache_key} "
                f"(took {elapsed:.3f}s, "
                f"redis: {result['invalidated']['redis']}, "
                f"app: {result['invalidated']['app_cache']})"
            )

        except Exception as e:
            logger.error(f"Error invalidating cache: {str(e)}")
            result["success"] = False
            result["errors"].append(str(e))

        result["elapsed_seconds"] = (datetime.now() - start_time).total_seconds()
        return result

    async def invalidate_pattern(
        self,
        namespace: str,
        pattern: str,
        invalidate_dependencies: bool = False,
        invalidate_cdn: bool = False,
    ) -> Dict[str, Any]:
        """
        Invalidate all cache keys matching pattern

        Args:
            namespace: Cache namespace
            pattern: Key pattern (supports wildcards)
            invalidate_dependencies: Whether to invalidate dependencies
            invalidate_cdn: Whether to invalidate CDN

        Returns:
            Invalidation result
        """
        start_time = datetime.now()
        result = {
            "namespace": namespace,
            "pattern": pattern,
            "success": True,
            "invalidated": {"redis": 0, "app_cache": 0, "dependencies": 0},
            "cdn": None,
            "errors": [],
        }

        try:
            # Invalidate from Redis
            if self.redis:
                deleted = await self.redis.delete_pattern("app", pattern)
                result["invalidated"]["redis"] = deleted

            # Invalidate from application cache
            if self.app_cache:
                # Note: Application cache doesn't support pattern deletion yet
                # In a real implementation, we would iterate through keys
                pass

            # Invalidate CDN if requested
            if invalidate_cdn and self.cdn:
                # Generate asset paths for CDN invalidation
                asset_paths = [f"/assets/{pattern.replace('*', '.*')}.*"]
                cdn_result = await self.cdn.purge_cdn_cache(asset_paths)
                result["cdn"] = cdn_result

            elapsed = (datetime.now() - start_time).total_seconds()
            logger.info(
                f"Invalidated cache pattern: {namespace}:{pattern} "
                f"(took {elapsed:.3f}s, redis: {result['invalidated']['redis']})"
            )

        except Exception as e:
            logger.error(f"Error invalidating cache pattern: {str(e)}")
            result["success"] = False
            result["errors"].append(str(e))

        result["elapsed_seconds"] = (datetime.now() - start_time).total_seconds()
        return result

    async def invalidate_namespace(self, namespace: str) -> Dict[str, Any]:
        """
        Invalidate entire namespace

        Args:
            namespace: Cache namespace to clear

        Returns:
            Invalidation result
        """
        start_time = datetime.now()
        result = {
            "namespace": namespace,
            "success": True,
            "invalidated": {"redis": 0, "app_cache": 0, "dependencies": 0},
            "errors": [],
        }

        try:
            # Clear from Redis
            if self.redis:
                deleted = await self.redis.clear_namespace("app")
                result["invalidated"]["redis"] = deleted

            # Clear from application cache
            if self.app_cache:
                cleared = await self.app_cache.clear_namespace(namespace)
                result["invalidated"]["app_cache"] = cleared

            # Remove from dependencies
            keys_to_remove = [
                k for k in self.dependencies.keys() if k.startswith(f"{namespace}:")
            ]
            for key in keys_to_remove:
                del self.dependencies[key]

            result["invalidated"]["dependencies"] = len(keys_to_remove)

            elapsed = (datetime.now() - start_time).total_seconds()
            logger.info(
                f"Invalidated namespace: {namespace} "
                f"(took {elapsed:.3f}s, "
                f"redis: {result['invalidated']['redis']}, "
                f"app: {result['invalidated']['app_cache']})"
            )

        except Exception as e:
            logger.error(f"Error invalidating namespace: {str(e)}")
            result["success"] = False
            result["errors"].append(str(e))

        result["elapsed_seconds"] = (datetime.now() - start_time).total_seconds()
        return result

    async def smart_invalidate(self, affected_keys: List[str]) -> Dict[str, Any]:
        """
        Smart invalidation based on affected keys

        Args:
            affected_keys: List of keys that changed

        Returns:
            Invalidation result
        """
        start_time = datetime.now()
        result = {
            "affected_keys": affected_keys,
            "success": True,
            "invalidated_keys": [],
            "total_invalidated": 0,
            "errors": [],
        }

        try:
            invalidated_count = 0

            for key in affected_keys:
                # Parse namespace from key
                parts = key.split(":", 1)
                if len(parts) == 2:
                    namespace, actual_key = parts

                    # Invalidate the key
                    inv_result = await self.invalidate(
                        namespace, actual_key, invalidate_dependencies=True
                    )

                    if inv_result["success"]:
                        invalidated_count += (
                            inv_result["invalidated"]["redis"]
                            + inv_result["invalidated"]["app_cache"]
                            + inv_result["invalidated"]["dependencies"]
                        )
                        result["invalidated_keys"].append(key)

            result["total_invalidated"] = invalidated_count
            elapsed = (datetime.now() - start_time).total_seconds()

            logger.info(
                f"Smart invalidation complete: {len(affected_keys)} keys affected, "
                f"{invalidated_count} items invalidated (took {elapsed:.3f}s)"
            )

        except Exception as e:
            logger.error(f"Error during smart invalidation: {str(e)}")
            result["success"] = False
            result["errors"].append(str(e))

        result["elapsed_seconds"] = (datetime.now() - start_time).total_seconds()
        return result

    async def _invalidate_dependencies(self, parent_key: str) -> int:
        """
        Invalidate cache dependencies

        Args:
            parent_key: Parent cache key

        Returns:
            Number of dependent keys invalidated
        """
        if parent_key not in self.dependencies:
            return 0

        count = 0
        child_keys = self.dependencies[parent_key].copy()

        for child_key in child_keys:
            # Parse namespace from key
            parts = child_key.split(":", 1)
            if len(parts) == 2:
                namespace, actual_key = parts

                # Invalidate child
                if self.redis:
                    await self.redis.delete("app", child_key, use_hash=True)

                if self.app_cache:
                    await self.app_cache.delete(namespace, actual_key)

                count += 1

        return count

    async def get_invalidation_stats(self) -> Dict[str, Any]:
        """
        Get cache invalidation statistics

        Returns:
            Invalidation statistics
        """
        return {
            "registered_dependencies": len(self.dependencies),
            "namespaces": list(
                set(k.split(":", 1)[0] for k in self.dependencies.keys())
            ),
            "patterns": list(self.patterns.keys()),
        }

    async def prewarm_cache(self, items: List[Dict[str, Any]]):
        """
        Pre-warm cache after invalidation

        Args:
            items: List of items to cache
        """
        logger.info(f"Pre-warming cache with {len(items)} items")

        for item in items:
            namespace = item["namespace"]
            key = item["key"]
            value = item["value"]
            ttl = item.get("ttl", 3600)

            await self.app_cache.set(namespace, key, value, ttl)

        logger.info("Cache pre-warming complete")


# Global invalidation service instance
invalidation_service: Optional[CacheInvalidationService] = None


def get_invalidation_service() -> CacheInvalidationService:
    """Get global invalidation service instance"""
    global invalidation_service
    if invalidation_service is None:
        raise RuntimeError("Invalidation service not initialized")
    return invalidation_service


def init_invalidation_service(
    redis_service: Optional[RedisCacheService] = None,
    app_cache: Optional[ApplicationCache] = None,
    cdn_service: Optional[CDNIntegrationService] = None,
):
    """Initialize global invalidation service"""
    global invalidation_service
    invalidation_service = CacheInvalidationService(
        redis_service, app_cache, cdn_service
    )
    logger.info("Cache invalidation service initialized")
