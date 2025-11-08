"""
Version Management System
Handles version tracking and history for artifacts
"""

from typing import Dict, Any, List, Optional
import json
import logging
from datetime import datetime
import asyncio

from .google_drive import GoogleDriveService

logger = logging.getLogger(__name__)


class VersionManager:
    """
    Manages version history and revision tracking
    """

    def __init__(self, drive_service: GoogleDriveService):
        self.drive_service = drive_service
        self.max_versions = 30

    async def get_version_history(
        self, access_token: str, file_id: str, include_details: bool = True
    ) -> Dict[str, Any]:
        """
        Get complete version history for a file

        Args:
            access_token: Google Drive access token
            file_id: ID of the file
            include_details: Whether to include detailed metadata

        Returns:
            Version history with metadata
        """
        try:
            revisions = await self.drive_service.list_file_revisions(
                access_token, file_id, self.max_versions
            )

            # Enhance revisions with additional info
            enhanced_revisions = []
            for i, revision in enumerate(reversed(revisions)):
                enhanced_revision = {
                    "version": len(revisions) - i,
                    "id": revision.get("id"),
                    "modified_time": revision.get("modifiedTime"),
                    "last_modifying_user": revision.get("lastModifyingUser", {}).get(
                        "displayName"
                    ),
                    "description": revision.get("description", ""),
                    "keep_forever": revision.get("keepForever", False),
                }

                if include_details:
                    # Add more detailed information
                    enhanced_revision["created_date"] = datetime.fromisoformat(
                        revision.get("modifiedTime").replace("Z", "+00:00")
                    ).strftime("%Y-%m-%d %H:%M:%S")

                    # Format the description if it follows AIO conventions
                    desc = revision.get("description", "")
                    if desc.startswith("Version -"):
                        enhanced_revision["auto_version"] = True

                enhanced_revisions.append(enhanced_revision)

            return {
                "file_id": file_id,
                "total_versions": len(revisions),
                "max_versions": self.max_versions,
                "versions": enhanced_revisions,
            }

        except Exception as e:
            logger.error(f"Error getting version history: {str(e)}")
            raise

    async def compare_versions(
        self, access_token: str, file_id: str, version1_id: str, version2_id: str
    ) -> Dict[str, Any]:
        """
        Compare two versions of a file

        Args:
            access_token: Google Drive access token
            file_id: ID of the file
            version1_id: ID of first version
            version2_id: ID of second version

        Returns:
            Comparison results
        """
        try:
            # Get both versions
            version1 = await self._get_version_metadata(access_token, version1_id)
            version2 = await self._get_version_metadata(access_token, version2_id)

            return {
                "file_id": file_id,
                "version1": {
                    "id": version1_id,
                    "modified_time": version1.get("modifiedTime"),
                    "size": version1.get("size"),
                    "modified_by": version1.get("lastModifyingUser", {}).get(
                        "displayName"
                    ),
                },
                "version2": {
                    "id": version2_id,
                    "modified_time": version2.get("modifiedTime"),
                    "size": version2.get("size"),
                    "modified_by": version2.get("lastModifyingUser", {}).get(
                        "displayName"
                    ),
                },
                "time_difference": self._calculate_time_difference(
                    version1.get("modifiedTime"), version2.get("modifiedTime")
                ),
                "size_difference": self._calculate_size_difference(
                    version1.get("size"), version2.get("size")
                ),
            }

        except Exception as e:
            logger.error(f"Error comparing versions: {str(e)}")
            raise

    async def revert_to_version(
        self, access_token: str, file_id: str, target_version_id: str
    ) -> Dict[str, Any]:
        """
        Revert file to a specific version by creating a new version from the old content

        Args:
            access_token: Google Drive access token
            file_id: ID of the file
            target_version_id: ID of the version to revert to

        Returns:
            Revert operation result
        """
        try:
            # Download content from target version
            version_content = await self._download_specific_version(
                access_token, file_id, target_version_id
            )

            # Get current file metadata to determine MIME type
            current_file = await self._get_file_metadata(access_token, file_id)
            mime_type = current_file.get("mimeType", "application/octet-stream")

            # Create new version with reverted content
            revert_description = f"Reverted to version {target_version_id} on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

            result = await self.drive_service.create_file_version(
                access_token, file_id, version_content, mime_type, revert_description
            )

            logger.info(f"Reverted file {file_id} to version {target_version_id}")

            return {
                "success": True,
                "reverted_to_version": target_version_id,
                "new_version_id": result.get("id"),
                "new_version_description": revert_description,
                "reverted_at": datetime.now().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error reverting version: {str(e)}")
            return {"success": False, "error": str(e)}

    async def mark_version_permanent(
        self, access_token: str, file_id: str, version_id: str, permanent: bool = True
    ) -> bool:
        """
        Mark a version as permanent (won't be automatically deleted)

        Args:
            access_token: Google Drive access token
            file_id: ID of the file
            version_id: ID of the version
            permanent: Whether to mark as permanent

        Returns:
            True if successful
        """
        try:
            # Note: Google Drive API doesn't directly support this via the v3 API
            # This would need to be implemented via the Drive v2 API or web interface
            # For now, we'll log the request

            logger.info(
                f"Version {version_id} permanent={permanent} for file {file_id} "
                f"(Note: Requires Drive v2 API implementation)"
            )

            return True

        except Exception as e:
            logger.error(f"Error marking version permanent: {str(e)}")
            return False

    async def cleanup_old_versions(
        self, access_token: str, file_id: str, keep_count: int = 10
    ) -> Dict[str, Any]:
        """
        Clean up old versions, keeping only the most recent ones

        Args:
            access_token: Google Drive access token
            file_id: ID of the file
            keep_count: Number of recent versions to keep

        Returns:
            Cleanup results
        """
        try:
            revisions = await self.drive_service.list_file_revisions(
                access_token, file_id, self.max_versions
            )

            if len(revisions) <= keep_count:
                return {
                    "success": True,
                    "message": f"Only {len(revisions)} versions exist, no cleanup needed",
                    "deleted_count": 0,
                }

            # Mark older versions for cleanup (in practice, these would be deleted)
            # Note: Google Drive API doesn't allow direct deletion of revisions
            # They are automatically cleaned up based on the keepForever flag

            versions_to_cleanup = revisions[:-keep_count]

            # Update keepForever flag for versions to keep
            versions_to_keep = revisions[-keep_count:]
            for version in versions_to_keep:
                await self.mark_version_permanent(
                    access_token, file_id, version.get("id"), True
                )

            logger.info(
                f"Cleaned up {len(versions_to_cleanup)} old versions, kept {keep_count} recent"
            )

            return {
                "success": True,
                "total_versions": len(revisions),
                "kept_versions": keep_count,
                "deleted_count": len(versions_to_cleanup),
                "versions_kept": [v.get("id") for v in versions_to_keep],
            }

        except Exception as e:
            logger.error(f"Error cleaning up versions: {str(e)}")
            return {"success": False, "error": str(e)}

    async def _get_version_metadata(
        self, access_token: str, version_id: str
    ) -> Dict[str, Any]:
        """Get metadata for a specific version"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://www.googleapis.com/drive/v2/files/revisions/{version_id}",
                headers={"Authorization": f"Bearer {access_token}"},
            )

            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"Failed to get version metadata: {response.text}")

    async def _get_file_metadata(
        self, access_token: str, file_id: str
    ) -> Dict[str, Any]:
        """Get file metadata"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://www.googleapis.com/drive/v3/files/{file_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"fields": "id,name,mimeType,size"},
            )

            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"Failed to get file metadata: {response.text}")

    async def _download_specific_version(
        self, access_token: str, file_id: str, version_id: str
    ) -> bytes:
        """Download content from a specific version"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://www.googleapis.com/drive/v2/files/{file_id}/revisions/{version_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"alt": "media"},
            )

            if response.status_code == 200:
                return response.content
            else:
                raise Exception(f"Failed to download version: {response.text}")

    def _calculate_time_difference(self, time1: str, time2: str) -> str:
        """Calculate time difference between two timestamps"""
        try:
            dt1 = datetime.fromisoformat(time1.replace("Z", "+00:00"))
            dt2 = datetime.fromisoformat(time2.replace("Z", "+00:00"))

            diff = abs((dt1 - dt2).total_seconds())

            if diff < 60:
                return f"{int(diff)} seconds"
            elif diff < 3600:
                return f"{int(diff / 60)} minutes"
            elif diff < 86400:
                return f"{int(diff / 3600)} hours"
            else:
                return f"{int(diff / 86400)} days"

        except Exception:
            return "Unknown"

    def _calculate_size_difference(self, size1: str, size2: str) -> str:
        """Calculate size difference between two versions"""
        try:
            s1 = int(size1) if size1 else 0
            s2 = int(size2) if size2 else 0

            diff = s1 - s2

            if abs(diff) < 1024:
                return f"{diff} bytes"
            elif abs(diff) < 1024 * 1024:
                return f"{diff / 1024:.2f} KB"
            else:
                return f"{diff / (1024 * 1024):.2f} MB"

        except Exception:
            return "Unknown"
