"""
Storage Quota Management Service
Monitors and manages Google Drive storage quota
"""

from typing import Dict, Any, List, Optional
import logging
from datetime import datetime
import json
import asyncio

from .google_drive import GoogleDriveService

logger = logging.getLogger(__name__)


class StorageQuotaManager:
    """
    Manages storage quota monitoring and notifications
    """

    def __init__(self, drive_service: GoogleDriveService):
        self.drive_service = drive_service
        self.warning_thresholds = {
            "warning": 0.80,  # 80%
            "critical": 0.90,  # 90%
            "emergency": 0.95,  # 95%
        }

    async def check_storage_quota(self, access_token: str) -> Dict[str, Any]:
        """
        Check current storage quota and usage

        Args:
            access_token: Google Drive access token

        Returns:
            Storage quota information with recommendations
        """
        try:
            quota_info = await self.drive_service.get_storage_quota(access_token)

            # Calculate usage percentage
            if quota_info["limit"] > 0:
                usage_percentage = (quota_info["usage"] / quota_info["limit"]) * 100
            else:
                usage_percentage = 0

            # Determine status
            status = self._get_quota_status(usage_percentage)

            # Get recommendations
            recommendations = self._get_recommendations(quota_info, usage_percentage)

            # Calculate days until quota (assuming current usage rate)
            days_until_quota = self._estimate_days_until_quota(quota_info)

            return {
                "quota_info": quota_info,
                "usage_percentage": round(usage_percentage, 2),
                "status": status,
                "status_level": self._get_status_level(usage_percentage),
                "recommendations": recommendations,
                "days_until_quota": days_until_quota,
                "last_checked": datetime.now().isoformat(),
                "alerts_enabled": True,
            }

        except Exception as e:
            logger.error(f"Error checking storage quota: {str(e)}")
            raise

    async def get_storage_breakdown(self, access_token: str) -> Dict[str, Any]:
        """
        Get detailed storage usage breakdown

        Args:
            access_token: Google Drive access token

        Returns:
            Storage breakdown by file type and size
        """
        try:
            async with httpx.AsyncClient() as client:
                # Get all files with size information
                response = await client.get(
                    "https://www.googleapis.com/drive/v3/files",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={
                        "fields": "files(id,name,size,mimeType,modifiedTime,parents)",
                        "pageSize": 1000,
                        "q": "trashed=false",
                    },
                )

                if response.status_code != 200:
                    raise Exception("Failed to fetch files")

                files = response.json().get("files", [])

                # Group by file type
                type_breakdown = {}
                total_size = 0

                for file in files:
                    size = int(file.get("size", 0))
                    mime_type = file.get("mimeType", "unknown")

                    if mime_type not in type_breakdown:
                        type_breakdown[mime_type] = {
                            "count": 0,
                            "total_size": 0,
                            "files": [],
                        }

                    type_breakdown[mime_type]["count"] += 1
                    type_breakdown[mime_type]["total_size"] += size
                    total_size += size

                    type_breakdown[mime_type]["files"].append(
                        {
                            "id": file.get("id"),
                            "name": file.get("name"),
                            "size": size,
                            "modified": file.get("modifiedTime"),
                        }
                    )

                # Sort by total size
                sorted_breakdown = sorted(
                    type_breakdown.items(),
                    key=lambda x: x[1]["total_size"],
                    reverse=True,
                )

                return {
                    "total_files": len(files),
                    "total_size": total_size,
                    "breakdown_by_type": dict(sorted_breakdown),
                    "top_10_largest_files": sorted(
                        [{"name": f["name"], "size": f["size"]} for f in files],
                        key=lambda x: x["size"],
                        reverse=True,
                    )[:10],
                }

        except Exception as e:
            logger.error(f"Error getting storage breakdown: {str(e)}")
            raise

    async def suggest_cleanup_actions(self, access_token: str) -> List[Dict[str, Any]]:
        """
        Suggest cleanup actions based on storage usage

        Args:
            access_token: Google Drive access token

        Returns:
            List of cleanup suggestions
        """
        try:
            quota_info = await self.check_storage_quota(access_token)
            breakdown = await self.get_storage_breakdown(access_token)

            suggestions = []

            # Check usage percentage
            usage_pct = quota_info["usage_percentage"]

            if usage_pct > self.warning_thresholds["warning"]:
                suggestions.append(
                    {
                        "type": "storage_warning",
                        "priority": "high"
                        if usage_pct > self.warning_thresholds["critical"]
                        else "medium",
                        "title": "Storage Space Running Low",
                        "description": f"Using {usage_pct:.1f}% of available storage",
                        "action": "Consider deleting old files or upgrading storage plan",
                    }
                )

            # Check for old files
            old_files = self._find_old_files(breakdown)
            if old_files:
                suggestions.append(
                    {
                        "type": "old_files",
                        "priority": "medium",
                        "title": "Old Files Found",
                        "description": f"Found {len(old_files)} files older than 6 months",
                        "action": "Review and delete unnecessary old files",
                        "files": old_files[:5],  # Show first 5
                    }
                )

            # Check for duplicate files
            duplicates = self._find_duplicate_files(breakdown)
            if duplicates:
                suggestions.append(
                    {
                        "type": "duplicates",
                        "priority": "medium",
                        "title": "Potential Duplicate Files",
                        "description": f"Found {len(duplicates)} groups of potentially duplicate files",
                        "action": "Review and remove duplicate files",
                        "groups": duplicates[:3],  # Show first 3 groups
                    }
                )

            # Check for large files
            large_files = self._find_large_files(breakdown)
            if large_files:
                total_large_size = sum(f["size"] for f in large_files)
                suggestions.append(
                    {
                        "type": "large_files",
                        "priority": "low",
                        "title": "Large Files Detected",
                        "description": f"Found {len(large_files)} files over 10MB, totaling {self._format_size(total_large_size)}",
                        "action": "Consider compressing or moving large files",
                        "files": large_files[:5],
                    }
                )

            # Check for trashed files
            trashed_info = await self._get_trashed_files_info(access_token)
            if trashed_info["count"] > 0:
                suggestions.append(
                    {
                        "type": "trash_cleanup",
                        "priority": "low",
                        "title": "Trash Not Emptied",
                        "description": f"{trashed_info['count']} files in trash, totaling {self._format_size(trashed_info['size'])}",
                        "action": "Empty trash to free up space",
                        "recovery_possible": True,
                    }
                )

            return suggestions

        except Exception as e:
            logger.error(f"Error suggesting cleanup actions: {str(e)}")
            raise

    async def get_quota_alerts_config(self) -> Dict[str, Any]:
        """
        Get current quota alert configuration

        Returns:
            Alert configuration
        """
        return {
            "warning_threshold": self.warning_thresholds["warning"] * 100,
            "critical_threshold": self.warning_thresholds["critical"] * 100,
            "emergency_threshold": self.warning_thresholds["emergency"] * 100,
            "alerts_enabled": True,
            "last_updated": datetime.now().isoformat(),
        }

    async def set_quota_alerts(
        self,
        warning_threshold: float = 0.80,
        critical_threshold: float = 0.90,
        emergency_threshold: float = 0.95,
    ) -> Dict[str, Any]:
        """
        Update quota alert thresholds

        Args:
            warning_threshold: Warning threshold (0-1)
            critical_threshold: Critical threshold (0-1)
            emergency_threshold: Emergency threshold (0-1)

        Returns:
            Updated configuration
        """
        self.warning_thresholds = {
            "warning": warning_threshold,
            "critical": critical_threshold,
            "emergency": emergency_threshold,
        }

        logger.info(f"Updated quota thresholds: {self.warning_thresholds}")

        return {
            "success": True,
            "warning_threshold": warning_threshold * 100,
            "critical_threshold": critical_threshold * 100,
            "emergency_threshold": emergency_threshold * 100,
            "updated_at": datetime.now().isoformat(),
        }

    def _get_quota_status(self, usage_percentage: float) -> str:
        """Get quota status based on usage percentage"""
        if usage_percentage >= self.warning_thresholds["emergency"]:
            return "emergency"
        elif usage_percentage >= self.warning_thresholds["critical"]:
            return "critical"
        elif usage_percentage >= self.warning_thresholds["warning"]:
            return "warning"
        else:
            return "normal"

    def _get_status_level(self, usage_percentage: float) -> int:
        """Get numeric status level (0-3)"""
        if usage_percentage >= self.warning_thresholds["emergency"]:
            return 3
        elif usage_percentage >= self.warning_thresholds["critical"]:
            return 2
        elif usage_percentage >= self.warning_thresholds["warning"]:
            return 1
        else:
            return 0

    def _get_recommendations(
        self, quota_info: Dict[str, Any], usage_percentage: float
    ) -> List[str]:
        """Get recommendations based on usage"""
        recommendations = []

        if usage_percentage > self.warning_thresholds["warning"]:
            recommendations.append("Consider upgrading your Google Drive storage plan")

        if usage_percentage > self.warning_thresholds["critical"]:
            recommendations.append("Urgent: Delete unnecessary files to free up space")
            recommendations.append("Enable automatic cleanup for old versions")

        if quota_info.get("usageInTrash", 0) > 0:
            recommendations.append("Empty trash to immediately free up space")

        if len(recommendations) == 0:
            recommendations.append("Storage usage is healthy")

        return recommendations

    def _estimate_days_until_quota(self, quota_info: Dict[str, Any]) -> Optional[int]:
        """Estimate days until quota is full (simplified calculation)"""
        # This would need historical usage data for accurate estimation
        # For now, return None
        return None

    def _find_old_files(self, breakdown: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Find files older than 6 months"""
        old_files = []
        cutoff_date = datetime.now().timestamp() - (6 * 30 * 24 * 3600)  # 6 months ago

        for mime_type, info in breakdown["breakdown_by_type"].items():
            for file in info["files"]:
                try:
                    modified_time = datetime.fromisoformat(
                        file["modified"].replace("Z", "+00:00")
                    ).timestamp()

                    if modified_time < cutoff_date:
                        old_files.append(
                            {
                                "name": file["name"],
                                "size": file["size"],
                                "modified": file["modified"],
                            }
                        )
                except Exception:
                    continue

        return sorted(old_files, key=lambda x: x["modified"])

    def _find_duplicate_files(self, breakdown: Dict[str, Any]) -> List[List[str]]:
        """Find potential duplicate files based on name and size"""
        file_map = {}

        for mime_type, info in breakdown["breakdown_by_type"].items():
            for file in info["files"]:
                key = f"{file['size']}:{file['name']}"
                if key not in file_map:
                    file_map[key] = []
                file_map[key].append(file["name"])

        duplicates = [files for files in file_map.values() if len(files) > 1]
        return duplicates

    def _find_large_files(self, breakdown: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Find files larger than 10MB"""
        large_files = []
        threshold = 10 * 1024 * 1024  # 10MB

        for mime_type, info in breakdown["breakdown_by_type"].items():
            for file in info["files"]:
                if file["size"] > threshold:
                    large_files.append({"name": file["name"], "size": file["size"]})

        return sorted(large_files, key=lambda x: x["size"], reverse=True)

    def _format_size(self, size_bytes: int) -> str:
        """Format size in bytes to human-readable format"""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024:
                return f"{size_bytes:.2f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.2f} PB"

    async def _get_trashed_files_info(self, access_token: str) -> Dict[str, Any]:
        """Get information about files in trash"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://www.googleapis.com/drive/v3/files",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={
                        "fields": "files(id,size)",
                        "q": "trashed=true",
                        "pageSize": 1000,
                    },
                )

                if response.status_code == 200:
                    files = response.json().get("files", [])
                    total_size = sum(int(f.get("size", 0)) for f in files)
                    return {"count": len(files), "size": total_size}
                else:
                    return {"count": 0, "size": 0}

        except Exception as e:
            logger.error(f"Error getting trashed files info: {str(e)}")
            return {"count": 0, "size": 0}
