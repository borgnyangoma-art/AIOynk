"""
Artifact Storage Service
Handles storage and metadata tracking for all artifacts
"""

from typing import Dict, Any, List, Optional, Union
import json
import logging
import hashlib
import uuid
from datetime import datetime
from pathlib import Path

from .google_drive import GoogleDriveService
from .auto_save import AutoSaveService

logger = logging.getLogger(__name__)


class ArtifactStorageService:
    """
    Service for storing and managing artifacts with comprehensive metadata
    """

    def __init__(
        self, drive_service: GoogleDriveService, auto_save_service: AutoSaveService
    ):
        self.drive_service = drive_service
        self.auto_save_service = auto_save_service
        self.max_file_size = 100 * 1024 * 1024  # 100MB
        self.supported_types = {
            "graphics": [".json", ".png", ".jpg", ".svg", ".webp"],
            "web": [".html", ".css", ".js", ".json"],
            "ide": [".js", ".py", ".java", ".cpp", ".ts", ".txt", ".md"],
            "cad": [".json", ".obj", ".stl", ".gltf"],
            "video": [".json", ".mp4", ".avi", ".mov", ".webm"],
            "chat": [".json"],
            "export": [".zip", ".tar.gz"],
        }

    async def store_artifact(
        self,
        access_token: str,
        user_id: str,
        artifact_type: str,
        artifact_data: Union[Dict[str, Any], bytes, str],
        metadata: Optional[Dict[str, Any]] = None,
        file_name: Optional[str] = None,
        storage_location: str = "auto",  # 'local', 'google_drive', 'auto'
    ) -> Dict[str, Any]:
        """
        Store artifact with comprehensive metadata tracking

        Args:
            access_token: Google Drive access token
            user_id: User identifier
            artifact_type: Type of artifact (graphics, web, ide, cad, video, chat)
            artifact_data: Artifact content
            metadata: Additional metadata
            file_name: Optional custom file name
            storage_location: Where to store ('local', 'google_drive', 'auto')

        Returns:
            Storage result with metadata
        """
        try:
            # Validate artifact type
            if artifact_type not in self.supported_types:
                raise ValueError(f"Unsupported artifact type: {artifact_type}")

            # Generate file name if not provided
            if not file_name:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                file_name = f"{artifact_type}_{timestamp}"

            # Prepare metadata
            artifact_metadata = self._prepare_metadata(
                user_id, artifact_type, artifact_data, metadata
            )

            # Check file size
            if isinstance(artifact_data, (dict, str)):
                data_bytes = (
                    json.dumps(artifact_data).encode("utf-8")
                    if isinstance(artifact_data, dict)
                    else artifact_data.encode("utf-8")
                )
            else:
                data_bytes = artifact_data

            if len(data_bytes) > self.max_file_size:
                return {
                    "success": False,
                    "error": f"File size ({len(data_bytes)} bytes) exceeds limit of {self.max_file_size} bytes",
                }

            # Store based on location preference
            if storage_location == "auto":
                storage_location = self._determine_storage_location(len(data_bytes))

            if storage_location == "google_drive":
                return await self._store_in_google_drive(
                    access_token,
                    user_id,
                    artifact_type,
                    artifact_data,
                    artifact_metadata,
                    file_name,
                )
            else:
                return await self._store_locally(
                    artifact_type, artifact_data, artifact_metadata, file_name
                )

        except Exception as e:
            logger.error(f"Error storing artifact: {str(e)}")
            return {"success": False, "error": str(e)}

    async def get_artifact_metadata(
        self, artifact_id: str, storage_location: str = "auto"
    ) -> Optional[Dict[str, Any]]:
        """
        Get artifact metadata by ID

        Args:
            artifact_id: Unique artifact identifier
            storage_location: Where the artifact is stored

        Returns:
            Artifact metadata or None
        """
        try:
            # In a real implementation, this would query a database
            # For now, return placeholder
            logger.info(f"Getting metadata for artifact {artifact_id}")
            return None

        except Exception as e:
            logger.error(f"Error getting artifact metadata: {str(e)}")
            return None

    async def list_user_artifacts(
        self,
        user_id: str,
        artifact_type: Optional[str] = None,
        storage_location: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        List all artifacts for a user

        Args:
            user_id: User identifier
            artifact_type: Filter by type
            storage_location: Filter by storage location
            limit: Maximum number of artifacts to return

        Returns:
            List of artifacts with metadata
        """
        try:
            # In a real implementation, this would query a database
            # For now, return placeholder
            logger.info(f"Listing artifacts for user {user_id}")
            return []

        except Exception as e:
            logger.error(f"Error listing artifacts: {str(e)}")
            return []

    async def update_artifact_metadata(
        self, artifact_id: str, updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update artifact metadata

        Args:
            artifact_id: Unique artifact identifier
            updates: Metadata updates

        Returns:
            Update result
        """
        try:
            # In a real implementation, this would update a database
            logger.info(f"Updating metadata for artifact {artifact_id}")
            return {"success": True, "updated_fields": list(updates.keys())}

        except Exception as e:
            logger.error(f"Error updating artifact metadata: {str(e)}")
            return {"success": False, "error": str(e)}

    async def delete_artifact(
        self, artifact_id: str, access_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Delete artifact and its metadata

        Args:
            artifact_id: Unique artifact identifier
            access_token: Google Drive access token (if stored in Drive)

        Returns:
            Deletion result
        """
        try:
            # Get metadata first
            metadata = await self.get_artifact_metadata(artifact_id)

            if not metadata:
                return {"success": False, "error": "Artifact not found"}

            # Delete from storage
            if metadata.get("storage_location") == "google_drive" and access_token:
                file_id = metadata.get("file_id")
                if file_id:
                    success = await self.drive_service.delete_file(
                        access_token, file_id
                    )
                    if not success:
                        logger.warning(
                            f"Failed to delete file {file_id} from Google Drive"
                        )

            # In a real implementation, delete from database
            logger.info(f"Deleted artifact {artifact_id}")

            return {"success": True, "artifact_id": artifact_id}

        except Exception as e:
            logger.error(f"Error deleting artifact: {str(e)}")
            return {"success": False, "error": str(e)}

    async def search_artifacts(
        self, user_id: str, query: str, filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Search artifacts by name, content, or metadata

        Args:
            user_id: User identifier
            query: Search query
            filters: Additional filters

        Returns:
            List of matching artifacts
        """
        try:
            # In a real implementation, this would use a search engine
            # For now, return placeholder
            logger.info(f"Searching artifacts for user {user_id} with query '{query}'")
            return []

        except Exception as e:
            logger.error(f"Error searching artifacts: {str(e)}")
            return []

    async def export_artifact(
        self, artifact_id: str, export_format: str, access_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Export artifact in specified format

        Args:
            artifact_id: Unique artifact identifier
            export_format: Target format (json, zip, etc.)
            access_token: Google Drive access token

        Returns:
            Export result
        """
        try:
            # Get artifact metadata
            metadata = await self.get_artifact_metadata(artifact_id)

            if not metadata:
                return {"success": False, "error": "Artifact not found"}

            # Export based on format
            if export_format == "json":
                return await self._export_as_json(artifact_id, metadata)
            elif export_format == "zip":
                return await self._export_as_zip(artifact_id, metadata, access_token)
            else:
                return {
                    "success": False,
                    "error": f"Unsupported export format: {export_format}",
                }

        except Exception as e:
            logger.error(f"Error exporting artifact: {str(e)}")
            return {"success": False, "error": str(e)}

    def _prepare_metadata(
        self,
        user_id: str,
        artifact_type: str,
        artifact_data: Union[Dict[str, Any], bytes, str],
        additional_metadata: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Prepare comprehensive metadata for artifact"""
        metadata = {
            "artifact_id": str(uuid.uuid4()),
            "user_id": user_id,
            "artifact_type": artifact_type,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "version": "1.0",
            "tags": [],
            "custom_fields": {},
        }

        # Add size information
        if isinstance(artifact_data, (dict, str)):
            data_bytes = (
                json.dumps(artifact_data).encode("utf-8")
                if isinstance(artifact_data, dict)
                else artifact_data.encode("utf-8")
            )
        else:
            data_bytes = artifact_data

        metadata["size_bytes"] = len(data_bytes)
        metadata["size_formatted"] = self._format_size(len(data_bytes))

        # Calculate checksum
        metadata["checksum"] = hashlib.sha256(data_bytes).hexdigest()

        # Add additional metadata
        if additional_metadata:
            metadata.update(additional_metadata)

        # Add type-specific metadata
        if artifact_type == "graphics":
            metadata["canvas_width"] = (
                additional_metadata.get("canvas_width") if additional_metadata else None
            )
            metadata["canvas_height"] = (
                additional_metadata.get("canvas_height")
                if additional_metadata
                else None
            )
            metadata["layer_count"] = (
                additional_metadata.get("layer_count") if additional_metadata else None
            )

        elif artifact_type == "web":
            metadata["html_size"] = (
                len(artifact_data.get("html", ""))
                if isinstance(artifact_data, dict)
                else 0
            )
            metadata["css_size"] = (
                len(artifact_data.get("css", ""))
                if isinstance(artifact_data, dict)
                else 0
            )
            metadata["has_responsive"] = (
                additional_metadata.get("has_responsive", False)
                if additional_metadata
                else False
            )

        elif artifact_type == "ide":
            metadata["language"] = (
                additional_metadata.get("language", "text")
                if additional_metadata
                else "text"
            )
            metadata["line_count"] = (
                len(artifact_data.split("\n")) if isinstance(artifact_data, str) else 0
            )

        elif artifact_type == "video":
            metadata["duration"] = (
                additional_metadata.get("duration") if additional_metadata else None
            )
            metadata["fps"] = (
                additional_metadata.get("fps") if additional_metadata else None
            )
            metadata["resolution"] = (
                additional_metadata.get("resolution") if additional_metadata else None
            )

        return metadata

    def _determine_storage_location(self, file_size: int) -> str:
        """Determine optimal storage location based on file size"""
        if file_size > 50 * 1024 * 1024:  # 50MB
            return "google_drive"  # Better for large files
        else:
            return "local"  # Faster for small files

    async def _store_in_google_drive(
        self,
        access_token: str,
        user_id: str,
        artifact_type: str,
        artifact_data: Union[Dict[str, Any], bytes, str],
        metadata: Dict[str, Any],
        file_name: str,
    ) -> Dict[str, Any]:
        """Store artifact in Google Drive"""
        try:
            # Save using auto-save service
            result = await self.auto_save_service.save_artifact(
                access_token,
                user_id,
                artifact_type,
                artifact_data,
                file_name,
                f"Auto-saved at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            )

            if result["success"]:
                # Add Google Drive specific metadata
                result["metadata"] = {
                    **metadata,
                    "storage_location": "google_drive",
                    "file_id": result["file_id"],
                    "web_view_link": result["web_view_link"],
                }

            return result

        except Exception as e:
            logger.error(f"Error storing in Google Drive: {str(e)}")
            return {"success": False, "error": str(e)}

    async def _store_locally(
        self,
        artifact_type: str,
        artifact_data: Union[Dict[str, Any], bytes, str],
        metadata: Dict[str, Any],
        file_name: str,
    ) -> Dict[str, Any]:
        """Store artifact locally"""
        try:
            # In a real implementation, this would save to local storage
            # For now, return a mock result
            local_path = f"/storage/artifacts/{metadata['artifact_id']}/{file_name}"

            logger.info(f"Storing artifact locally at {local_path}")

            return {
                "success": True,
                "artifact_id": metadata["artifact_id"],
                "local_path": local_path,
                "metadata": {**metadata, "storage_location": "local"},
            }

        except Exception as e:
            logger.error(f"Error storing locally: {str(e)}")
            return {"success": False, "error": str(e)}

    async def _export_as_json(
        self, artifact_id: str, metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Export artifact as JSON"""
        try:
            # In a real implementation, this would fetch and export the artifact
            logger.info(f"Exporting artifact {artifact_id} as JSON")

            return {
                "success": True,
                "artifact_id": artifact_id,
                "format": "json",
                "download_url": f"/api/artifacts/{artifact_id}/export/json",
            }

        except Exception as e:
            logger.error(f"Error exporting as JSON: {str(e)}")
            return {"success": False, "error": str(e)}

    async def _export_as_zip(
        self, artifact_id: str, metadata: Dict[str, Any], access_token: Optional[str]
    ) -> Dict[str, Any]:
        """Export artifact as ZIP"""
        try:
            # In a real implementation, this would create a ZIP file
            logger.info(f"Exporting artifact {artifact_id} as ZIP")

            return {
                "success": True,
                "artifact_id": artifact_id,
                "format": "zip",
                "download_url": f"/api/artifacts/{artifact_id}/export/zip",
            }

        except Exception as e:
            logger.error(f"Error exporting as ZIP: {str(e)}")
            return {"success": False, "error": str(e)}

    def _format_size(self, size_bytes: int) -> str:
        """Format size in bytes to human-readable format"""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024:
                return f"{size_bytes:.2f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.2f} PB"
