"""
Automatic Cleanup Service
Manages automatic cleanup of unused resources, cache, and temporary files
"""

from typing import Dict, Any, List, Optional, Callable
import asyncio
import logging
import gc
import time
import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path
import json

from .application_cache import get_cache
from .redis_cache import RedisCacheService
from .memory_monitor import get_memory_monitor

logger = logging.getLogger(__name__)


class CleanupManager:
    """
    Manages automatic cleanup of resources
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config

        # Cleanup configuration
        self.cleanup_interval = config.get("cleanup_interval", 3600)  # 1 hour
        self.max_cache_age = config.get("max_cache_age", 86400)  # 24 hours
        self.max_temp_files_age = config.get("max_temp_files_age", 3600)  # 1 hour
        self.max_logs_age = config.get("max_logs_age", 604800)  # 7 days
        self.max_memory_percent = config.get("max_memory_percent", 85)
        self.auto_cleanup_enabled = config.get("auto_cleanup_enabled", True)

        # Paths
        self.temp_dir = Path(config.get("temp_dir", "./tmp"))
        self.logs_dir = Path(config.get("logs_dir", "./logs"))
        self.cache_dir = Path(config.get("cache_dir", "./cache"))

        # Statistics
        self.stats = {
            "cleanup_runs": 0,
            "total_cleaned": 0,
            "cache_cleaned": 0,
            "temp_files_cleaned": 0,
            "logs_cleaned": 0,
            "memory_freed_mb": 0,
            "disk_space_freed_mb": 0,
            "last_cleanup": None,
        }

        # Cleanup tasks tracking
        self.cleanup_tasks: List[asyncio.Task] = []
        self.is_running = False

    async def start(self):
        """Start automatic cleanup service"""
        if self.is_running:
            logger.warning("Cleanup service is already running")
            return

        self.is_running = True
        logger.info("Starting automatic cleanup service")

        # Create cleanup task
        cleanup_task = asyncio.create_task(self._cleanup_loop())
        self.cleanup_tasks.append(cleanup_task)

        # Run initial cleanup
        await self.run_cleanup()

    async def stop(self):
        """Stop automatic cleanup service"""
        if not self.is_running:
            return

        self.is_running = False
        logger.info("Stopping automatic cleanup service")

        # Cancel cleanup tasks
        for task in self.cleanup_tasks:
            task.cancel()

        # Wait for tasks to complete
        await asyncio.gather(*self.cleanup_tasks, return_exceptions=True)
        self.cleanup_tasks.clear()

    async def _cleanup_loop(self):
        """Main cleanup loop"""
        while self.is_running:
            try:
                if self.auto_cleanup_enabled:
                    await self.run_cleanup()

                # Wait for next interval
                await asyncio.sleep(self.cleanup_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {str(e)}")
                await asyncio.sleep(60)  # Wait 1 minute before retrying

    async def run_cleanup(self) -> Dict[str, Any]:
        """
        Run complete cleanup

        Returns:
            Cleanup result
        """
        start_time = time.time()
        logger.info("Starting cleanup process")

        cleanup_result = {
            "start_time": datetime.now().isoformat(),
            "tasks": {},
            "total_items_cleaned": 0,
            "total_space_freed_mb": 0,
            "errors": [],
        }

        try:
            # 1. Clean expired cache
            cache_result = await self._cleanup_cache()
            cleanup_result["tasks"]["cache"] = cache_result
            cleanup_result["total_items_cleaned"] += cache_result.get(
                "items_cleaned", 0
            )
            cleanup_result["total_space_freed_mb"] += cache_result.get(
                "space_freed_mb", 0
            )

            # 2. Clean temporary files
            temp_result = await self._cleanup_temp_files()
            cleanup_result["tasks"]["temp_files"] = temp_result
            cleanup_result["total_items_cleaned"] += temp_result.get("files_cleaned", 0)
            cleanup_result["total_space_freed_mb"] += temp_result.get(
                "space_freed_mb", 0
            )

            # 3. Clean old logs
            logs_result = await self._cleanup_logs()
            cleanup_result["tasks"]["logs"] = logs_result
            cleanup_result["total_items_cleaned"] += logs_result.get("files_cleaned", 0)
            cleanup_result["total_space_freed_mb"] += logs_result.get(
                "space_freed_mb", 0
            )

            # 4. Clean application cache directory
            app_cache_result = await self._cleanup_app_cache()
            cleanup_result["tasks"]["app_cache"] = app_cache_result
            cleanup_result["total_items_cleaned"] += app_cache_result.get(
                "files_cleaned", 0
            )
            cleanup_result["total_space_freed_mb"] += app_cache_result.get(
                "space_freed_mb", 0
            )

            # 5. Run garbage collection
            gc_result = await self._cleanup_memory()
            cleanup_result["tasks"]["memory"] = gc_result
            cleanup_result["total_space_freed_mb"] += gc_result.get(
                "memory_freed_mb", 0
            )

            # 6. Clean old completed jobs (if job queue is available)
            try:
                from .background_job_queue import get_job_queue

                job_queue = get_job_queue()
                jobs_cleaned = await job_queue.cleanup_completed_jobs(max_age_hours=24)
                cleanup_result["tasks"]["jobs"] = {
                    "success": True,
                    "jobs_cleaned": jobs_cleaned,
                }
                cleanup_result["total_items_cleaned"] += jobs_cleaned
            except Exception as e:
                cleanup_result["tasks"]["jobs"] = {"success": False, "error": str(e)}

            elapsed = time.time() - start_time
            cleanup_result["elapsed_seconds"] = round(elapsed, 2)
            cleanup_result["end_time"] = datetime.now().isoformat()

            # Update stats
            self.stats["cleanup_runs"] += 1
            self.stats["total_cleaned"] += cleanup_result["total_items_cleaned"]
            self.stats["cache_cleaned"] += cache_result.get("items_cleaned", 0)
            self.stats["temp_files_cleaned"] += temp_result.get("files_cleaned", 0)
            self.stats["logs_cleaned"] += logs_result.get("files_cleaned", 0)
            self.stats["memory_freed_mb"] += gc_result.get("memory_freed_mb", 0)
            self.stats["disk_space_freed_mb"] += cleanup_result["total_space_freed_mb"]
            self.stats["last_cleanup"] = datetime.now().isoformat()

            logger.info(
                f"Cleanup complete: {cleanup_result['total_items_cleaned']} items cleaned, "
                f"{cleanup_result['total_space_freed_mb']:.2f}MB freed, "
                f"took {elapsed:.2f}s"
            )

            return cleanup_result

        except Exception as e:
            logger.error(f"Error during cleanup: {str(e)}")
            cleanup_result["error"] = str(e)
            return cleanup_result

    async def _cleanup_cache(self) -> Dict[str, Any]:
        """
        Clean expired cache entries

        Returns:
            Cache cleanup result
        """
        try:
            cache = get_cache()
            cleaned = await cache.cleanup_expired()

            return {
                "success": True,
                "items_cleaned": cleaned,
                "space_freed_mb": 0,  # Cannot accurately estimate
            }

        except Exception as e:
            logger.error(f"Error cleaning cache: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "items_cleaned": 0,
                "space_freed_mb": 0,
            }

    async def _cleanup_temp_files(self) -> Dict[str, Any]:
        """
        Clean old temporary files

        Returns:
            Temp files cleanup result
        """
        cleaned = 0
        space_freed = 0

        try:
            if not self.temp_dir.exists():
                return {"success": True, "files_cleaned": 0, "space_freed_mb": 0}

            cutoff = datetime.now() - timedelta(seconds=self.max_temp_files_age)

            for file_path in self.temp_dir.rglob("*"):
                if file_path.is_file():
                    file_time = datetime.fromtimestamp(file_path.stat().st_mtime)

                    if file_time < cutoff:
                        size_mb = file_path.stat().st_size / 1024 / 1024
                        file_path.unlink()
                        cleaned += 1
                        space_freed += size_mb

            logger.debug(f"Cleaned {cleaned} temp files, freed {space_freed:.2f}MB")

            return {
                "success": True,
                "files_cleaned": cleaned,
                "space_freed_mb": round(space_freed, 2),
            }

        except Exception as e:
            logger.error(f"Error cleaning temp files: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "files_cleaned": cleaned,
                "space_freed_mb": round(space_freed, 2),
            }

    async def _cleanup_logs(self) -> Dict[str, Any]:
        """
        Clean old log files

        Returns:
            Logs cleanup result
        """
        cleaned = 0
        space_freed = 0

        try:
            if not self.logs_dir.exists():
                return {"success": True, "files_cleaned": 0, "space_freed_mb": 0}

            cutoff = datetime.now() - timedelta(seconds=self.max_logs_age)

            for file_path in self.logs_dir.rglob("*.log*"):
                if file_path.is_file():
                    file_time = datetime.fromtimestamp(file_path.stat().st_mtime)

                    if file_time < cutoff:
                        size_mb = file_path.stat().st_size / 1024 / 1024
                        file_path.unlink()
                        cleaned += 1
                        space_freed += size_mb

            logger.debug(f"Cleaned {cleaned} log files, freed {space_freed:.2f}MB")

            return {
                "success": True,
                "files_cleaned": cleaned,
                "space_freed_mb": round(space_freed, 2),
            }

        except Exception as e:
            logger.error(f"Error cleaning log files: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "files_cleaned": cleaned,
                "space_freed_mb": round(space_freed, 2),
            }

    async def _cleanup_app_cache(self) -> Dict[str, Any]:
        """
        Clean application cache directory

        Returns:
            App cache cleanup result
        """
        cleaned = 0
        space_freed = 0

        try:
            if not self.cache_dir.exists():
                return {"success": True, "files_cleaned": 0, "space_freed_mb": 0}

            cutoff = datetime.now() - timedelta(seconds=self.max_cache_age)

            for file_path in self.cache_dir.rglob("*"):
                if file_path.is_file():
                    file_time = datetime.fromtimestamp(file_path.stat().st_mtime)

                    if file_time < cutoff:
                        size_mb = file_path.stat().st_size / 1024 / 1024
                        file_path.unlink()
                        cleaned += 1
                        space_freed += size_mb

            logger.debug(f"Cleaned {cleaned} cache files, freed {space_freed:.2f}MB")

            return {
                "success": True,
                "files_cleaned": cleaned,
                "space_freed_mb": round(space_freed, 2),
            }

        except Exception as e:
            logger.error(f"Error cleaning app cache: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "files_cleaned": cleaned,
                "space_freed_mb": round(space_freed, 2),
            }

    async def _cleanup_memory(self) -> Dict[str, Any]:
        """
        Clean up memory (garbage collection)

        Returns:
            Memory cleanup result
        """
        try:
            memory_monitor = get_memory_monitor()
            result = await memory_monitor.force_garbage_collection()

            if result["success"]:
                # Estimate memory freed (in MB)
                # This is an approximation
                memory_freed_mb = result["freed_objects"] * 0.001  # Rough estimate

                return {
                    "success": True,
                    "objects_collected": result["collected"],
                    "memory_freed_mb": round(memory_freed_mb, 2),
                }
            else:
                return result

        except Exception as e:
            logger.error(f"Error cleaning memory: {str(e)}")
            return {"success": False, "error": str(e), "memory_freed_mb": 0}

    async def force_cleanup(
        self, target: Optional[str] = None, aggressive: bool = False
    ) -> Dict[str, Any]:
        """
        Force immediate cleanup

        Args:
            target: Specific target to clean (cache, temp, logs, memory)
            aggressive: Whether to use aggressive cleanup

        Returns:
            Cleanup result
        """
        logger.info(
            f"Force cleanup triggered: target={target}, aggressive={aggressive}"
        )

        if target:
            if target == "cache":
                return await self._cleanup_cache()
            elif target == "temp":
                return await self._cleanup_temp_files()
            elif target == "logs":
                return await self._cleanup_logs()
            elif target == "memory":
                return await self._cleanup_memory()
            else:
                return {"success": False, "error": f"Unknown cleanup target: {target}"}
        else:
            return await self.run_cleanup()

    async def get_cleanup_status(self) -> Dict[str, Any]:
        """
        Get cleanup service status

        Returns:
            Status
        """
        return {
            "is_running": self.is_running,
            "auto_cleanup_enabled": self.auto_cleanup_enabled,
            "cleanup_interval_seconds": self.cleanup_interval,
            "last_cleanup": self.stats["last_cleanup"],
            "stats": self.stats,
        }

    async def get_cleanup_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get cleanup history (simplified - in production would use database)

        Args:
            limit: Number of history entries to return

        Returns:
            Cleanup history
        """
        # In a production system, this would query a database
        # For now, return recent stats
        return [
            {
                "timestamp": self.stats.get("last_cleanup"),
                "items_cleaned": self.stats.get("total_cleaned", 0),
                "space_freed_mb": self.stats.get("disk_space_freed_mb", 0),
            }
        ]

    def update_config(self, new_config: Dict[str, Any]):
        """
        Update cleanup configuration

        Args:
            new_config: New configuration
        """
        self.config.update(new_config)
        self.cleanup_interval = self.config.get(
            "cleanup_interval", self.cleanup_interval
        )
        self.max_cache_age = self.config.get("max_cache_age", self.max_cache_age)
        self.max_temp_files_age = self.config.get(
            "max_temp_files_age", self.max_temp_files_age
        )
        self.auto_cleanup_enabled = self.config.get(
            "auto_cleanup_enabled", self.auto_cleanup_enabled
        )

        logger.info("Cleanup configuration updated")


# Global cleanup manager instance
cleanup_manager: Optional[CleanupManager] = None


def get_cleanup_manager() -> CleanupManager:
    """Get global cleanup manager instance"""
    global cleanup_manager
    if cleanup_manager is None:
        raise RuntimeError("Cleanup manager not initialized")
    return cleanup_manager


def init_cleanup_manager(config: Dict[str, Any]):
    """Initialize global cleanup manager"""
    global cleanup_manager
    cleanup_manager = CleanupManager(config)
    logger.info("Cleanup manager initialized")
