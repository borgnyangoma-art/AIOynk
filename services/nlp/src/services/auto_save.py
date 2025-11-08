"""
Automatic File Saving Service
Handles automatic saving of artifacts to Google Drive
"""

from typing import Dict, Any, Optional, List
import json
import logging
import asyncio
from datetime import datetime
import uuid
import base64

from .google_drive import GoogleDriveService
from .google_oauth import GoogleOAuthService

logger = logging.getLogger(__name__)


class AutoSaveService:
    """
    Service for automatic file saving to Google Drive
    """

    def __init__(
        self, oauth_service: GoogleOAuthService, drive_service: GoogleDriveService
    ):
        self.oauth_service = oauth_service
        self.drive_service = drive_service
        self.pending_uploads = {}  # Track pending uploads

    async def save_artifact(
        self,
        access_token: str,
        user_id: str,
        artifact_type: str,
        artifact_data: Dict[str, Any],
        file_name: str = None,
        description: str = "",
    ) -> Dict[str, Any]:
        """
        Save artifact to user's AIO folder

        Args:
            access_token: Google Drive access token
            user_id: User identifier
            artifact_type: Type of artifact (graphics, web, ide, cad, video, chat)
            artifact_data: Artifact content and metadata
            file_name: Optional custom file name
            description: Optional description

        Returns:
            Save result with file metadata
        """
        try:
            # Get or create AIO folder
            aio_folder = await self.drive_service.get_aio_folder(access_token, user_id)

            if not aio_folder:
                aio_folder = await self.drive_service.create_aio_folder(
                    access_token, user_id
                )
                logger.info(f"Created AIO folder: {aio_folder['id']}")

            # Generate file name if not provided
            if not file_name:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                file_name = f"{artifact_type}_{timestamp}"

            # Add appropriate extension
            file_name = self._add_file_extension(
                file_name, artifact_type, artifact_data
            )

            # Prepare file data
            file_data, mime_type = self._prepare_artifact_data(
                artifact_type, artifact_data
            )

            # Compress if necessary
            upload_result = await self.drive_service.compress_and_upload(
                access_token, aio_folder["id"], file_name, file_data, mime_type
            )

            # Log the save operation
            logger.info(
                f"Saved {artifact_type} artifact for user {user_id}: {file_name}"
            )

            return {
                "success": True,
                "file_id": upload_result.get("id"),
                "file_name": upload_result.get("name"),
                "web_view_link": upload_result.get("webViewLink"),
                "created_time": upload_result.get("createdTime"),
                "size": upload_result.get("size"),
                "artifact_type": artifact_type,
            }

        except Exception as e:
            logger.error(f"Error saving artifact: {str(e)}")
            return {"success": False, "error": str(e), "artifact_type": artifact_type}

    async def update_artifact(
        self,
        access_token: str,
        file_id: str,
        artifact_data: Dict[str, Any],
        artifact_type: str,
        description: str = "",
    ) -> Dict[str, Any]:
        """
        Update existing artifact (creates new version)

        Args:
            access_token: Google Drive access token
            file_id: ID of existing file
            artifact_data: New artifact data
            artifact_type: Type of artifact
            description: Version description

        Returns:
            Update result
        """
        try:
            file_data, mime_type = self._prepare_artifact_data(
                artifact_type, artifact_data
            )

            # Get current file info for versioning
            current_versions = await self.drive_service.list_file_revisions(
                access_token, file_id
            )

            if len(current_versions) >= 30:
                logger.warning(
                    f"File {file_id} already has 30 versions, oldest will be kept"
                )

            # Create new version
            update_result = await self.drive_service.create_file_version(
                access_token, file_id, file_data, mime_type, description
            )

            logger.info(
                f"Updated artifact {file_id}, created version {len(current_versions) + 1}"
            )

            return {
                "success": True,
                "file_id": update_result.get("id"),
                "version_number": len(current_versions) + 1,
                "last_modified": update_result.get("modifiedTime"),
            }

        except Exception as e:
            logger.error(f"Error updating artifact: {str(e)}")
            return {"success": False, "error": str(e)}

    async def save_chat_session(
        self,
        access_token: str,
        user_id: str,
        messages: List[Dict[str, Any]],
        session_id: str = None,
    ) -> Dict[str, Any]:
        """
        Save chat session to Google Drive

        Args:
            access_token: Google Drive access token
            user_id: User identifier
            messages: List of chat messages
            session_id: Optional session identifier

        Returns:
            Save result
        """
        if not session_id:
            session_id = str(uuid.uuid4())

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_name = f"chat_session_{timestamp}.json"

        chat_data = {
            "session_id": session_id,
            "created_at": datetime.now().isoformat(),
            "message_count": len(messages),
            "messages": messages,
        }

        return await self.save_artifact(
            access_token,
            user_id,
            "chat",
            chat_data,
            file_name,
            f"Chat session with {len(messages)} messages",
        )

    async def batch_save_artifacts(
        self, access_token: str, user_id: str, artifacts: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Save multiple artifacts in batch

        Args:
            access_token: Google Drive access token
            user_id: User identifier
            artifacts: List of artifact dictionaries

        Returns:
            List of save results
        """
        results = []

        for artifact in artifacts:
            try:
                result = await self.save_artifact(
                    access_token,
                    user_id,
                    artifact["type"],
                    artifact["data"],
                    artifact.get("file_name"),
                    artifact.get("description", ""),
                )
                results.append(result)

                # Add small delay to avoid rate limiting
                await asyncio.sleep(0.1)

            except Exception as e:
                logger.error(f"Error in batch save: {str(e)}")
                results.append(
                    {
                        "success": False,
                        "error": str(e),
                        "artifact_type": artifact.get("type", "unknown"),
                    }
                )

        return results

    def _add_file_extension(
        self, file_name: str, artifact_type: str, artifact_data: Dict[str, Any]
    ) -> str:
        """Add appropriate file extension based on artifact type"""
        extensions = {
            "graphics": ".json",
            "web": ".html",
            "ide": ".txt",
            "cad": ".json",
            "video": ".json",
            "chat": ".json",
            "export": ".zip",
        }

        ext = extensions.get(artifact_type, ".json")

        if not file_name.endswith(ext):
            file_name += ext

        return file_name

    def _prepare_artifact_data(
        self, artifact_type: str, artifact_data: Dict[str, Any]
    ) -> tuple[bytes, str]:
        """Prepare artifact data for upload based on type"""
        if artifact_type == "graphics":
            # Graphics artifacts are JSON with canvas data
            data = json.dumps(artifact_data, indent=2)
            return data.encode("utf-8"), "application/json"

        elif artifact_type == "web":
            # Web artifacts include HTML and CSS
            if "html" in artifact_data:
                data = artifact_data["html"]
                if "css" in artifact_data:
                    data += f"\n\n<style>\n{artifact_data['css']}\n</style>\n"
                return data.encode("utf-8"), "text/html"
            else:
                return json.dumps(artifact_data, indent=2).encode(
                    "utf-8"
                ), "application/json"

        elif artifact_type == "ide":
            # IDE artifacts are code files
            if "code" in artifact_data:
                code = artifact_data["code"]
                language = artifact_data.get("language", "javascript")
                language_map = {
                    "javascript": ".js",
                    "python": ".py",
                    "java": ".java",
                    "cpp": ".cpp",
                    "typescript": ".ts",
                }
                ext = language_map.get(language.lower(), ".txt")
                return code.encode("utf-8"), "text/plain"
            else:
                return json.dumps(artifact_data, indent=2).encode(
                    "utf-8"
                ), "application/json"

        elif artifact_type == "cad":
            # CAD artifacts are JSON with 3D model data
            return json.dumps(artifact_data, indent=2).encode(
                "utf-8"
            ), "application/json"

        elif artifact_type == "video":
            # Video artifacts are JSON with timeline data
            return json.dumps(artifact_data, indent=2).encode(
                "utf-8"
            ), "application/json"

        elif artifact_type == "chat":
            # Chat artifacts are JSON with message history
            return json.dumps(artifact_data, indent=2).encode(
                "utf-8"
            ), "application/json"

        else:
            # Default to JSON
            return json.dumps(artifact_data, indent=2).encode(
                "utf-8"
            ), "application/json"
