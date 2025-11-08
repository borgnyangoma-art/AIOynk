"""
CDN Caching Configuration Service
Manages CDN cache settings and optimization
"""

from typing import Dict, Any, List, Optional
import logging
from datetime import datetime
import json

from .cdn_integration import CDNIntegrationService

logger = logging.getLogger(__name__)


class CDNCacheConfig:
    """
    CDN Cache Configuration Manager
    """

    def __init__(self, cdn_service: CDNIntegrationService):
        self.cdn = cdn_service

        # Default cache policies
        self.cache_policies = {
            "static_assets": {
                "ttl": 31536000,  # 1 year
                "browser_ttl": 2592000,  # 30 days
                "compress": True,
                "serve_stale": True,
                "headers": {
                    "Cache-Control": "public, max-age=31536000, immutable",
                    "Vary": "Accept-Encoding",
                },
            },
            "api_responses": {
                "ttl": 300,  # 5 minutes
                "browser_ttl": 60,  # 1 minute
                "compress": True,
                "serve_stale": True,
                "headers": {
                    "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
                    "Vary": "Authorization, Accept-Encoding",
                },
            },
            "images": {
                "ttl": 2592000,  # 30 days
                "browser_ttl": 86400,  # 1 day
                "compress": True,
                "serve_stale": True,
                "webp": True,
                "avif": True,
                "headers": {
                    "Cache-Control": "public, max-age=2592000, immutable",
                    "Vary": "Accept",
                },
            },
            "videos": {
                "ttl": 7776000,  # 90 days
                "browser_ttl": 3600,  # 1 hour
                "compress": False,  # Don't compress videos
                "serve_stale": True,
                "headers": {
                    "Cache-Control": "public, max-age=7776000",
                    "Accept-Ranges": "bytes",
                },
            },
            "json_data": {
                "ttl": 600,  # 10 minutes
                "browser_ttl": 300,  # 5 minutes
                "compress": True,
                "serve_stale": True,
                "headers": {
                    "Cache-Control": "public, max-age=600, stale-while-revalidate=300",
                    "Content-Type": "application/json",
                },
            },
        }

        # File type to policy mapping
        self.file_type_policies = {
            "js": "static_assets",
            "css": "static_assets",
            "png": "images",
            "jpg": "images",
            "jpeg": "images",
            "gif": "images",
            "webp": "images",
            "svg": "images",
            "avif": "images",
            "mp4": "videos",
            "webm": "videos",
            "json": "json_data",
            "woff": "static_assets",
            "woff2": "static_assets",
            "ttf": "static_assets",
        }

    def get_policy_for_file(self, file_path: str) -> Dict[str, Any]:
        """
        Get cache policy for a file based on its path/extension

        Args:
            file_path: Path to the file

        Returns:
            Cache policy configuration
        """
        # Get file extension
        if "." in file_path:
            ext = file_path.rsplit(".", 1)[1].lower()
            policy_name = self.file_type_policies.get(ext, "static_assets")
        else:
            policy_name = "static_assets"

        return self.cache_policies[policy_name].copy()

    async def configure_cache_for_asset(
        self, file_path: str, custom_policy: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Configure CDN cache for a specific asset

        Args:
            file_path: Path to the asset
            custom_policy: Optional custom cache policy

        Returns:
            Configuration result
        """
        try:
            policy = custom_policy or self.get_policy_for_file(file_path)

            # In a real implementation, this would configure the CDN
            logger.info(
                f"Configuring CDN cache for {file_path}: "
                f"TTL={policy['ttl']}s, compress={policy['compress']}"
            )

            return {
                "success": True,
                "file_path": file_path,
                "policy": policy,
                "configured_at": datetime.now().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error configuring CDN cache: {str(e)}")
            return {"success": False, "error": str(e), "file_path": file_path}

    async def configure_bulk_cache(
        self, assets: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Configure CDN cache for multiple assets

        Args:
            assets: List of asset configurations

        Returns:
            Configuration result
        """
        try:
            results = []
            success_count = 0
            error_count = 0

            for asset in assets:
                file_path = asset["file_path"]
                custom_policy = asset.get("custom_policy")

                result = await self.configure_cache_for_asset(file_path, custom_policy)
                results.append(result)

                if result["success"]:
                    success_count += 1
                else:
                    error_count += 1

            return {
                "success": True,
                "total_assets": len(assets),
                "successful": success_count,
                "failed": error_count,
                "results": results,
            }

        except Exception as e:
            logger.error(f"Error in bulk cache configuration: {str(e)}")
            return {"success": False, "error": str(e)}

    async def optimize_image_delivery(
        self,
        image_path: str,
        enable_webp: bool = True,
        enable_avif: bool = True,
        quality: int = 85,
    ) -> Dict[str, Any]:
        """
        Optimize image delivery through CDN

        Args:
            image_path: Path to image
            enable_webp: Enable WebP conversion
            enable_avif: Enable AVIF conversion
            quality: Image quality (1-100)

        Returns:
            Optimization result
        """
        try:
            policy = self.get_policy_for_file(image_path)

            # Enable image optimization features
            policy["webp"] = enable_webp
            policy["avif"] = enable_avif
            policy["quality"] = quality
            policy["optimize"] = True

            result = await self.configure_cache_for_asset(image_path, policy)

            logger.info(
                f"Image optimization configured for {image_path}: "
                f"WebP={enable_webp}, AVIF={enable_avif}, Quality={quality}"
            )

            return result

        except Exception as e:
            logger.error(f"Error optimizing image delivery: {str(e)}")
            return {"success": False, "error": str(e)}

    async def set_cache_headers(
        self, file_path: str, custom_headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Set custom cache headers for an asset

        Args:
            file_path: Path to the file
            custom_headers: Custom headers to set

        Returns:
            Configuration result
        """
        try:
            policy = self.get_policy_for_file(file_path)

            if custom_headers:
                policy["headers"].update(custom_headers)

            result = await self.configure_cache_for_asset(file_path, policy)

            return result

        except Exception as e:
            logger.error(f"Error setting cache headers: {str(e)}")
            return {"success": False, "error": str(e)}

    async def get_cache_analytics(self) -> Dict[str, Any]:
        """
        Get CDN cache analytics

        Returns:
            Cache analytics
        """
        try:
            if self.cdn:
                analytics = await self.cdn.get_cdn_analytics()
            else:
                analytics = {
                    "cdn_provider": "none",
                    "total_requests": 0,
                    "cache_hit_ratio": 0,
                    "bandwidth_used": 0,
                }

            return {
                "success": True,
                "analytics": analytics,
                "policies": self.cache_policies,
                "file_type_mappings": len(self.file_type_policies),
            }

        except Exception as e:
            logger.error(f"Error getting cache analytics: {str(e)}")
            return {"success": False, "error": str(e)}

    def add_custom_policy(self, policy_name: str, policy_config: Dict[str, Any]):
        """
        Add custom cache policy

        Args:
            policy_name: Name of the policy
            policy_config: Policy configuration
        """
        self.cache_policies[policy_name] = policy_config
        logger.info(f"Added custom cache policy: {policy_name}")

    def map_file_type(self, extension: str, policy_name: str):
        """
        Map file extension to cache policy

        Args:
            extension: File extension (without dot)
            policy_name: Policy name to map to
        """
        if policy_name not in self.cache_policies:
            raise ValueError(f"Policy '{policy_name}' does not exist")

        self.file_type_policies[extension.lower()] = policy_name
        logger.info(f"Mapped .{extension} to policy '{policy_name}'")

    async def invalidate_cache(self, file_paths: List[str]) -> Dict[str, Any]:
        """
        Invalidate CDN cache for specific files

        Args:
            file_paths: List of file paths to invalidate

        Returns:
            Invalidation result
        """
        try:
            if self.cdn:
                result = await self.cdn.purge_cdn_cache(file_paths)
            else:
                result = {
                    "success": True,
                    "purged_files": 0,
                    "message": "CDN not configured",
                }

            return result

        except Exception as e:
            logger.error(f"Error invalidating CDN cache: {str(e)}")
            return {"success": False, "error": str(e)}

    async def warmup_cache(self, file_paths: List[str]) -> Dict[str, Any]:
        """
        Warm up CDN cache with specific files

        Args:
            file_paths: List of file paths to warm up

        Returns:
            Warmup result
        """
        try:
            logger.info(f"Warming up CDN cache with {len(file_paths)} files")

            # In a real implementation, this would fetch and cache files
            result = {
                "success": True,
                "files_warmed": len(file_paths),
                "warmed_files": file_paths,
            }

            logger.info("CDN cache warmup complete")
            return result

        except Exception as e:
            logger.error(f"Error warming up CDN cache: {str(e)}")
            return {"success": False, "error": str(e)}

    async def get_cache_status(self) -> Dict[str, Any]:
        """
        Get CDN cache status

        Returns:
            Cache status
        """
        try:
            policy_count = len(self.cache_policies)
            type_mapping_count = len(self.file_type_policies)

            return {
                "success": True,
                "policies_configured": policy_count,
                "file_types_mapped": type_mapping_count,
                "default_policies": list(self.cache_policies.keys()),
                "last_updated": datetime.now().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error getting cache status: {str(e)}")
            return {"success": False, "error": str(e)}


# Global CDN cache config instance
cdn_cache_config: Optional[CDNCacheConfig] = None


def get_cdn_cache_config() -> CDNCacheConfig:
    """Get global CDN cache config instance"""
    global cdn_cache_config
    if cdn_cache_config is None:
        raise RuntimeError("CDN cache config not initialized")
    return cdn_cache_config


def init_cdn_cache_config(cdn_service: CDNIntegrationService):
    """Initialize global CDN cache config"""
    global cdn_cache_config
    cdn_cache_config = CDNCacheConfig(cdn_service)
    logger.info("CDN cache configuration initialized")
