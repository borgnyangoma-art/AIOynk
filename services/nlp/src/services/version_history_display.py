"""
Version History Display Service
Handles frontend display of version history
"""

from typing import Dict, Any, List, Optional
import logging
from datetime import datetime, timedelta

from .version_manager import VersionManager
from .google_drive import GoogleDriveService

logger = logging.getLogger(__name__)


class VersionHistoryDisplay:
    """
    Service for displaying version history in the frontend
    """

    def __init__(
        self, version_manager: VersionManager, drive_service: GoogleDriveService
    ):
        self.version_manager = version_manager
        self.drive_service = drive_service

    async def get_frontend_version_history(
        self, access_token: str, file_id: str
    ) -> Dict[str, Any]:
        """
        Get version history formatted for frontend display

        Args:
            access_token: Google Drive access token
            file_id: ID of the file

        Returns:
            Formatted version history for frontend
        """
        try:
            # Get raw version history
            history = await self.version_manager.get_version_history(
                access_token, file_id, include_details=True
            )

            # Format for frontend
            formatted_versions = []

            for version in history["versions"]:
                # Calculate relative time
                relative_time = self._format_relative_time(version["modified_time"])

                # Format version description
                description = self._format_version_description(version)

                # Determine version type
                version_type = self._determine_version_type(version)

                # Create formatted version entry
                formatted_version = {
                    "version_number": version["version"],
                    "version_id": version["id"],
                    "modified_time": version["modified_time"],
                    "modified_time_formatted": version["created_date"],
                    "relative_time": relative_time,
                    "modified_by": version["last_modifying_user"] or "Unknown",
                    "description": description,
                    "version_type": version_type,
                    "is_current": version["version"] == history["total_versions"],
                    "can_revert": True,
                    "size_info": await self._get_version_size_info(
                        access_token, version["id"]
                    ),
                }

                formatted_versions.append(formatted_version)

            return {
                "success": True,
                "file_id": file_id,
                "total_versions": history["total_versions"],
                "max_versions": history["max_versions"],
                "versions": formatted_versions,
                "summary": {
                    "oldest_version": formatted_versions[0]
                    if formatted_versions
                    else None,
                    "newest_version": formatted_versions[-1]
                    if formatted_versions
                    else None,
                    "versions_this_week": self._count_versions_this_week(
                        formatted_versions
                    ),
                    "versions_this_month": self._count_versions_this_month(
                        formatted_versions
                    ),
                },
            }

        except Exception as e:
            logger.error(f"Error getting frontend version history: {str(e)}")
            return {"success": False, "error": str(e), "file_id": file_id}

    async def get_version_comparison_data(
        self, access_token: str, file_id: str, version1_id: str, version2_id: str
    ) -> Dict[str, Any]:
        """
        Get data for comparing two versions

        Args:
            access_token: Google Drive access token
            file_id: ID of the file
            version1_id: ID of first version
            version2_id: ID of second version

        Returns:
            Comparison data for frontend
        """
        try:
            # Get comparison data
            comparison = await self.version_manager.compare_versions(
                access_token, file_id, version1_id, version2_id
            )

            # Format for frontend
            return {
                "success": True,
                "file_id": file_id,
                "version1": {
                    "id": version1_id,
                    "modified_time": comparison["version1"]["modified_time"],
                    "modified_by": comparison["version1"]["modified_by"],
                    "size": comparison["version1"]["size"],
                    "size_formatted": self._format_size(
                        int(comparison["version1"]["size"])
                        if comparison["version1"]["size"]
                        else 0
                    ),
                },
                "version2": {
                    "id": version2_id,
                    "modified_time": comparison["version2"]["modified_time"],
                    "modified_by": comparison["version2"]["modified_by"],
                    "size": comparison["version2"]["size"],
                    "size_formatted": self._format_size(
                        int(comparison["version2"]["size"])
                        if comparison["version2"]["size"]
                        else 0
                    ),
                },
                "differences": {
                    "time_difference": comparison["time_difference"],
                    "size_difference": comparison["size_difference"],
                    "size_change_bytes": self._calculate_size_change(
                        comparison["version1"]["size"], comparison["version2"]["size"]
                    ),
                },
                "formatted_dates": {
                    "version1_date": self._format_datetime(
                        comparison["version1"]["modified_time"]
                    ),
                    "version2_date": self._format_datetime(
                        comparison["version2"]["modified_time"]
                    ),
                    "relative_difference": self._format_relative_time_difference(
                        comparison["version1"]["modified_time"],
                        comparison["version2"]["modified_time"],
                    ),
                },
            }

        except Exception as e:
            logger.error(f"Error getting version comparison data: {str(e)}")
            return {"success": False, "error": str(e), "file_id": file_id}

    async def generate_version_timeline(
        self, access_token: str, file_id: str
    ) -> Dict[str, Any]:
        """
        Generate timeline view of all versions

        Args:
            access_token: Google Drive access token
            file_id: ID of the file

        Returns:
            Timeline data for frontend
        """
        try:
            history = await self.get_frontend_version_history(access_token, file_id)

            if not history["success"]:
                return history

            # Group versions by day
            timeline = {}
            versions = history["versions"]

            for version in versions:
                # Get date (without time)
                date_str = version["modified_time"][:10]  # YYYY-MM-DD

                if date_str not in timeline:
                    timeline[date_str] = {
                        "date": date_str,
                        "formatted_date": self._format_date(date_str),
                        "versions": [],
                        "version_count": 0,
                    }

                timeline[date_str]["versions"].append(version)
                timeline[date_str]["version_count"] += 1

            # Convert to list and sort by date
            timeline_list = sorted(
                timeline.values(), key=lambda x: x["date"], reverse=True
            )

            return {
                "success": True,
                "file_id": file_id,
                "timeline": timeline_list,
                "total_days": len(timeline_list),
                "first_version_date": timeline_list[-1]["date"]
                if timeline_list
                else None,
                "last_version_date": timeline_list[0]["date"]
                if timeline_list
                else None,
            }

        except Exception as e:
            logger.error(f"Error generating version timeline: {str(e)}")
            return {"success": False, "error": str(e), "file_id": file_id}

    async def get_version_statistics(
        self, access_token: str, file_id: str
    ) -> Dict[str, Any]:
        """
        Get version statistics for analytics

        Args:
            access_token: Google Drive access token
            file_id: ID of the file

        Returns:
            Version statistics
        """
        try:
            history = await self.get_frontend_version_history(access_token, file_id)

            if not history["success"]:
                return history

            versions = history["versions"]

            # Calculate statistics
            stats = {
                "total_versions": len(versions),
                "average_versions_per_day": 0,
                "most_active_day": None,
                "least_active_day": None,
                "version_type_breakdown": self._get_version_type_breakdown(versions),
                "size_history": [],
                "activity_heatmap": self._generate_activity_heatmap(versions),
            }

            if versions:
                # Calculate activity by day
                activity_by_day = {}
                for version in versions:
                    day = version["modified_time"][:10]
                    if day not in activity_by_day:
                        activity_by_day[day] = 0
                    activity_by_day[day] += 1

                if activity_by_day:
                    most_active = max(activity_by_day.items(), key=lambda x: x[1])
                    least_active = min(activity_by_day.items(), key=lambda x: x[1])

                    stats["most_active_day"] = {
                        "date": most_active[0],
                        "versions": most_active[1],
                    }

                    stats["least_active_day"] = {
                        "date": least_active[0],
                        "versions": least_active[1],
                    }

                # Calculate size history
                for version in versions:
                    if version.get("size_info", {}).get("size"):
                        stats["size_history"].append(
                            {
                                "version": version["version_number"],
                                "size": version["size_info"]["size"],
                                "size_formatted": version["size_info"][
                                    "size_formatted"
                                ],
                                "date": version["modified_time"],
                            }
                        )

            return {"success": True, "file_id": file_id, "statistics": stats}

        except Exception as e:
            logger.error(f"Error getting version statistics: {str(e)}")
            return {"success": False, "error": str(e), "file_id": file_id}

    def _format_relative_time(self, timestamp: str) -> str:
        """Format timestamp as relative time (e.g., '2 hours ago')"""
        try:
            dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            now = datetime.now(dt.tzinfo)
            diff = now - dt

            if diff < timedelta(minutes=1):
                return "just now"
            elif diff < timedelta(hours=1):
                minutes = int(diff.total_seconds() / 60)
                return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
            elif diff < timedelta(days=1):
                hours = int(diff.total_seconds() / 3600)
                return f"{hours} hour{'s' if hours != 1 else ''} ago"
            elif diff < timedelta(days=7):
                days = int(diff.total_seconds() / 86400)
                return f"{days} day{'s' if days != 1 else ''} ago"
            else:
                return dt.strftime("%Y-%m-%d")

        except Exception:
            return "unknown"

    def _format_version_description(self, version: Dict[str, Any]) -> str:
        """Format version description for display"""
        desc = version.get("description", "")

        if not desc:
            return "Version created"

        if desc.startswith("Version -"):
            # Parse AIO auto-generated version description
            return desc

        return desc

    def _determine_version_type(self, version: Dict[str, Any]) -> str:
        """Determine the type of version based on description"""
        desc = version.get("description", "").lower()

        if "reverted" in desc:
            return "revert"
        elif "auto-save" in desc or "automatic" in desc:
            return "auto-save"
        elif "manual" in desc:
            return "manual"
        elif "import" in desc:
            return "import"
        else:
            return "manual"

    async def _get_version_size_info(
        self, access_token: str, version_id: str
    ) -> Dict[str, Any]:
        """Get size information for a version"""
        try:
            version = await self.version_manager._get_version_metadata(
                access_token, version_id
            )
            size = int(version.get("size", 0))

            return {"size": size, "size_formatted": self._format_size(size)}
        except Exception:
            return {"size": 0, "size_formatted": "Unknown"}

    def _format_size(self, size_bytes: int) -> str:
        """Format size in bytes to human-readable format"""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024:
                return f"{size_bytes:.2f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.2f} PB"

    def _count_versions_this_week(self, versions: List[Dict[str, Any]]) -> int:
        """Count versions created this week"""
        try:
            one_week_ago = datetime.now() - timedelta(days=7)
            count = 0

            for version in versions:
                version_date = datetime.fromisoformat(
                    version["modified_time"].replace("Z", "+00:00")
                )
                if version_date > one_week_ago:
                    count += 1

            return count
        except Exception:
            return 0

    def _count_versions_this_month(self, versions: List[Dict[str, Any]]) -> int:
        """Count versions created this month"""
        try:
            one_month_ago = datetime.now() - timedelta(days=30)
            count = 0

            for version in versions:
                version_date = datetime.fromisoformat(
                    version["modified_time"].replace("Z", "+00:00")
                )
                if version_date > one_month_ago:
                    count += 1

            return count
        except Exception:
            return 0

    def _format_datetime(self, timestamp: str) -> str:
        """Format timestamp for display"""
        try:
            dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            return timestamp

    def _format_date(self, date_str: str) -> str:
        """Format date string for display"""
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            return dt.strftime("%B %d, %Y")
        except Exception:
            return date_str

    def _calculate_size_change(self, size1: str, size2: str) -> int:
        """Calculate size change between two versions"""
        try:
            s1 = int(size1) if size1 else 0
            s2 = int(size2) if size2 else 0
            return s2 - s1
        except Exception:
            return 0

    def _format_relative_time_difference(self, time1: str, time2: str) -> str:
        """Format the time difference between two timestamps"""
        try:
            dt1 = datetime.fromisoformat(time1.replace("Z", "+00:00"))
            dt2 = datetime.fromisoformat(time2.replace("Z", "+00:00"))
            diff = abs(dt1 - dt2)

            if diff < timedelta(hours=1):
                minutes = int(diff.total_seconds() / 60)
                return f"{minutes} minutes"
            elif diff < timedelta(days=1):
                hours = int(diff.total_seconds() / 3600)
                return f"{hours} hours"
            else:
                days = int(diff.total_seconds() / 86400)
                return f"{days} days"
        except Exception:
            return "Unknown"

    def _get_version_type_breakdown(
        self, versions: List[Dict[str, Any]]
    ) -> Dict[str, int]:
        """Get breakdown of version types"""
        breakdown = {}
        for version in versions:
            vtype = version.get("version_type", "unknown")
            if vtype not in breakdown:
                breakdown[vtype] = 0
            breakdown[vtype] += 1
        return breakdown

    def _generate_activity_heatmap(
        self, versions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate activity heatmap data"""
        # This would create a week-by-week activity visualization
        # Simplified version for now
        activity = []
        current_date = datetime.now()

        for i in range(52):  # Last 52 weeks
            week_start = current_date - timedelta(weeks=i)
            week_end = week_start + timedelta(days=7)

            count = 0
            for version in versions:
                try:
                    version_date = datetime.fromisoformat(
                        version["modified_time"].replace("Z", "+00:00")
                    )
                    if week_start <= version_date < week_end:
                        count += 1
                except Exception:
                    continue

            activity.append(
                {
                    "week": i,
                    "start_date": week_start.strftime("%Y-%m-%d"),
                    "version_count": count,
                }
            )

        return activity
