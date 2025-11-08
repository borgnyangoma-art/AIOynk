"""
Google Drive API Service
Handles file operations, versioning, and storage management
"""

from typing import Optional, Dict, Any, List, BinaryIO
import json
import logging
import io
from datetime import datetime
import hashlib
import gzip
import httpx
import asyncio
from pathlib import Path

logger = logging.getLogger(__name__)


class GoogleDriveService:
    """
    Service for Google Drive operations
    """

    def __init__(self, oauth_service):
        self.oauth_service = oauth_service
        self.base_url = "https://www.googleapis.com/drive/v3"
        self.upload_url = "https://www.googleapis.com/upload/drive/v3"

    async def get_drive_info(self, access_token: str) -> Dict[str, Any]:
        """
        Get Google Drive information including storage quota

        Args:
            access_token: Valid access token

        Returns:
            Drive information including quota
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/about",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={
                        "fields": "user,storageQuota,importFormats,exportFormats,maxImportSizes,maxUploadSizes,appInstalled,folderColorPalette"
                    },
                )

                if response.status_code != 200:
                    logger.error(f"Failed to get drive info: {response.text}")
                    raise Exception("Failed to get drive information")

                return response.json()

        except Exception as e:
            logger.error(f"Error getting drive info: {str(e)}")
            raise

    async def create_aio_folder(
        self, access_token: str, user_id: str
    ) -> Dict[str, Any]:
        """
        Create AIO folder in user's Google Drive

        Args:
            access_token: Valid access token
            user_id: User identifier for folder naming

        Returns:
            Created folder metadata
        """
        try:
            folder_metadata = {
                "name": f"AIO Creative Hub - {user_id}",
                "mimeType": "application/vnd.google-apps.folder",
                "description": "AIO Creative Hub - My Projects",
                "appProperties": {
                    "aio_user_id": user_id,
                    "aio_folder": "true",
                    "created_by": "aio-creative-hub",
                },
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/files",
                    headers={"Authorization": f"Bearer {access_token}"},
                    json=folder_metadata,
                )

                if response.status_code != 200:
                    logger.error(f"Failed to create folder: {response.text}")
                    raise Exception("Failed to create AIO folder")

                return response.json()

        except Exception as e:
            logger.error(f"Error creating AIO folder: {str(e)}")
            raise

    async def get_aio_folder(
        self, access_token: str, user_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get existing AIO folder

        Args:
            access_token: Valid access token
            user_id: User identifier

        Returns:
            Folder metadata or None if not found
        """
        try:
            query = (
                f"mimeType='application/vnd.google-apps.folder' and "
                f"appProperties has {{ key='aio_user_id' and value='{user_id}' }}"
            )

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/files",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={
                        "q": query,
                        "fields": "files(id,name,createdTime,modifiedTime)",
                    },
                )

                if response.status_code != 200:
                    logger.error(f"Failed to query AIO folder: {response.text}")
                    return None

                files = response.json().get("files", [])
                return files[0] if files else None

        except Exception as e:
            logger.error(f"Error getting AIO folder: {str(e)}")
            return None

    async def upload_file(
        self,
        access_token: str,
        folder_id: str,
        file_name: str,
        file_data: bytes,
        mime_type: str,
        description: str = "",
    ) -> Dict[str, Any]:
        """
        Upload file to Google Drive

        Args:
            access_token: Valid access token
            folder_id: Target folder ID
            file_name: Name of the file
            file_data: File content as bytes
            mime_type: MIME type of the file
            description: File description

        Returns:
            Uploaded file metadata
        """
        try:
            file_metadata = {
                "name": file_name,
                "parents": [folder_id],
                "description": description,
                "appProperties": {
                    "uploaded_by": "aio-creative-hub",
                    "upload_timestamp": datetime.now().isoformat(),
                },
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.upload_url}/files?uploadType=multipart",
                    headers={"Authorization": f"Bearer {access_token}"},
                    files={
                        "metadata": (
                            "metadata.json",
                            json.dumps(file_metadata),
                            "application/json",
                        ),
                        "file": (file_name, io.BytesIO(file_data), mime_type),
                    },
                )

                if response.status_code != 200:
                    logger.error(f"Failed to upload file: {response.text}")
                    raise Exception("Failed to upload file")

                return response.json()

        except Exception as e:
            logger.error(f"Error uploading file: {str(e)}")
            raise

    async def create_file_version(
        self,
        access_token: str,
        file_id: str,
        file_data: bytes,
        mime_type: str,
        description: str = "",
    ) -> Dict[str, Any]:
        """
        Create a new version of an existing file

        Args:
            access_token: Valid access token
            file_id: ID of the file to update
            file_data: New file content
            mime_type: MIME type of the file
            description: Version description

        Returns:
            Updated file metadata
        """
        try:
            version_metadata = {
                "description": f"Version - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {description}",
                "keepForever": False,
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.upload_url}/files/{file_id}",
                    headers={"Authorization": f"Bearer {access_token}"},
                    files={
                        "metadata": (
                            "metadata.json",
                            json.dumps(version_metadata),
                            "application/json",
                        ),
                        "file": ("file", io.BytesIO(file_data), mime_type),
                    },
                    params={"uploadType": "multipart"},
                )

                if response.status_code != 200:
                    logger.error(f"Failed to create version: {response.text}")
                    raise Exception("Failed to create file version")

                return response.json()

        except Exception as e:
            logger.error(f"Error creating version: {str(e)}")
            raise

    async def list_file_revisions(
        self, access_token: str, file_id: str, max_revisions: int = 30
    ) -> List[Dict[str, Any]]:
        """
        List file revisions (version history)

        Args:
            access_token: Valid access token
            file_id: ID of the file
            max_revisions: Maximum number of revisions to return (default: 30)

        Returns:
            List of revision metadata
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/files/{file_id}/revisions",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={
                        "fields": "revisions(id,modifiedTime,lastModifyingUser,description,keepForever)",
                        "pageSize": max_revisions,
                    },
                )

                if response.status_code != 200:
                    logger.error(f"Failed to list revisions: {response.text}")
                    raise Exception("Failed to list file revisions")

                return response.json().get("revisions", [])

        except Exception as e:
            logger.error(f"Error listing revisions: {str(e)}")
            raise

    async def download_file(self, access_token: str, file_id: str) -> bytes:
        """
        Download file from Google Drive

        Args:
            access_token: Valid access token
            file_id: ID of the file to download

        Returns:
            File content as bytes
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/files/{file_id}",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={"alt": "media"},
                )

                if response.status_code != 200:
                    logger.error(f"Failed to download file: {response.text}")
                    raise Exception("Failed to download file")

                return response.content

        except Exception as e:
            logger.error(f"Error downloading file: {str(e)}")
            raise

    async def delete_file(self, access_token: str, file_id: str) -> bool:
        """
        Delete file from Google Drive

        Args:
            access_token: Valid access token
            file_id: ID of the file to delete

        Returns:
            True if successful
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"{self.base_url}/files/{file_id}",
                    headers={"Authorization": f"Bearer {access_token}"},
                )

                return response.status_code == 204

        except Exception as e:
            logger.error(f"Error deleting file: {str(e)}")
            return False

    async def compress_and_upload(
        self,
        access_token: str,
        folder_id: str,
        file_name: str,
        file_data: bytes,
        mime_type: str,
        compress_threshold: int = 10240,  # 10KB
    ) -> Dict[str, Any]:
        """
        Compress and upload file if size exceeds threshold

        Args:
            access_token: Valid access token
            folder_id: Target folder ID
            file_name: Name of the file
            file_data: File content as bytes
            mime_type: MIME type of the file
            compress_threshold: Size threshold for compression in bytes

        Returns:
            Uploaded file metadata
        """
        try:
            if len(file_data) > compress_threshold:
                logger.info(
                    f"Compressing file {file_name} (size: {len(file_data)} bytes)"
                )
                compressed_data = gzip.compress(file_data)
                file_name = f"{file_name}.gz"
            else:
                compressed_data = file_data

            return await self.upload_file(
                access_token,
                folder_id,
                file_name,
                compressed_data,
                mime_type,
                "Automatically compressed for storage optimization",
            )

        except Exception as e:
            logger.error(f"Error in compress and upload: {str(e)}")
            raise

    async def get_storage_quota(self, access_token: str) -> Dict[str, Any]:
        """
        Get user's storage quota information

        Args:
            access_token: Valid access token

        Returns:
            Storage quota information
        """
        try:
            drive_info = await self.get_drive_info(access_token)
            quota = drive_info.get("storageQuota", {})

            return {
                "limit": int(quota.get("limit", 0)),
                "usage": int(quota.get("usage", 0)),
                "usageInDrive": int(quota.get("usageInDrive", 0)),
                "usageInTrash": int(quota.get("usageInTrash", 0)),
                "percentage_used": (
                    int(quota.get("usage", 0)) / int(quota.get("limit", 1))
                )
                * 100,
            }

        except Exception as e:
            logger.error(f"Error getting storage quota: {str(e)}")
            raise
