"""
File Upload Service
Handles file uploads with size limits and validation
"""

from typing import Dict, Any, Optional, List
import json
import logging
import hashlib
import mimetypes
from datetime import datetime
import io
import gzip
import zipfile

from .google_drive import GoogleDriveService
from .artifact_storage import ArtifactStorageService

logger = logging.getLogger(__name__)


class FileUploadService:
    """
    Service for handling file uploads with validation and processing
    """

    def __init__(
        self,
        drive_service: GoogleDriveService,
        artifact_storage: ArtifactStorageService,
    ):
        self.drive_service = drive_service
        self.artifact_storage = artifact_storage
        self.max_file_size = 100 * 1024 * 1024  # 100MB
        self.allowed_extensions = {
            "image": [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg"],
            "video": [".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm", ".mkv"],
            "audio": [".mp3", ".wav", ".flac", ".aac", ".ogg", ".wma"],
            "document": [".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt"],
            "code": [
                ".js",
                ".ts",
                ".py",
                ".java",
                ".cpp",
                ".c",
                ".cs",
                ".php",
                ".rb",
                ".go",
                ".rs",
            ],
            "archive": [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2"],
            "data": [".json", ".xml", ".csv", ".xlsx", ".xls", ".sql", ".db"],
        }
        self.compression_threshold = 10 * 1024 * 1024  # 10MB

    async def upload_file(
        self,
        access_token: str,
        user_id: str,
        file_data: bytes,
        file_name: str,
        file_type: Optional[str] = None,
        auto_compress: bool = True,
        storage_location: str = "auto",
    ) -> Dict[str, Any]:
        """
        Handle file upload with validation and processing

        Args:
            access_token: Google Drive access token
            user_id: User identifier
            file_data: File content as bytes
            file_name: Original file name
            file_type: Detected or specified file type
            auto_compress: Whether to automatically compress large files
            storage_location: Where to store the file

        Returns:
            Upload result with metadata
        """
        try:
            # Validate file
            validation_result = await self._validate_file(
                file_data, file_name, file_type
            )
            if not validation_result["valid"]:
                return {"success": False, "error": validation_result["error"]}

            file_type = validation_result["file_type"]
            mime_type = validation_result["mime_type"]

            # Check file size
            if len(file_data) > self.max_file_size:
                return {
                    "success": False,
                    "error": f"File size ({self._format_size(len(file_data))}) exceeds limit of {self._format_size(self.max_file_size)}",
                }

            # Calculate file hash
            file_hash = hashlib.sha256(file_data).hexdigest()

            # Compress if necessary
            if auto_compress and len(file_data) > self.compression_threshold:
                compressed_data, is_compressed = await self._compress_file(
                    file_data, file_name
                )
                if is_compressed:
                    file_data = compressed_data
                    file_name = f"{file_name}.gz"
                    mime_type = "application/gzip"

            # Prepare metadata
            metadata = {
                "original_name": file_name,
                "file_type": file_type,
                "mime_type": mime_type,
                "size_bytes": len(file_data),
                "size_formatted": self._format_size(len(file_data)),
                "hash_sha256": file_hash,
                "upload_timestamp": datetime.now().isoformat(),
                "auto_compressed": auto_compress
                and len(file_data) > self.compression_threshold,
                "original_size": validation_result.get("original_size"),
            }

            # Store file
            if storage_location == "google_drive" or (
                storage_location == "auto" and len(file_data) > 50 * 1024 * 1024
            ):
                return await self._upload_to_google_drive(
                    access_token, user_id, file_data, file_name, mime_type, metadata
                )
            else:
                return await self._store_locally(
                    user_id, file_data, file_name, metadata
                )

        except Exception as e:
            logger.error(f"Error uploading file: {str(e)}")
            return {"success": False, "error": str(e)}

    async def batch_upload(
        self,
        access_token: str,
        user_id: str,
        files: List[Dict[str, Any]],
        auto_compress: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Upload multiple files in batch

        Args:
            access_token: Google Drive access token
            user_id: User identifier
            files: List of file dictionaries with data and metadata
            auto_compress: Whether to automatically compress files

        Returns:
            List of upload results
        """
        results = []

        for file_info in files:
            try:
                result = await self.upload_file(
                    access_token,
                    user_id,
                    file_info["data"],
                    file_info["name"],
                    file_info.get("type"),
                    auto_compress,
                    "auto",
                )
                results.append(result)

                # Add small delay to avoid rate limiting
                await asyncio.sleep(0.1)

            except Exception as e:
                logger.error(
                    f"Error in batch upload for {file_info.get('name')}: {str(e)}"
                )
                results.append(
                    {
                        "success": False,
                        "error": str(e),
                        "file_name": file_info.get("name"),
                    }
                )

        return results

    async def get_upload_status(self, upload_id: str) -> Optional[Dict[str, Any]]:
        """
        Get status of an upload operation

        Args:
            upload_id: Upload operation identifier

        Returns:
            Upload status or None
        """
        try:
            # In a real implementation, this would check a database or cache
            logger.info(f"Getting status for upload {upload_id}")
            return None

        except Exception as e:
            logger.error(f"Error getting upload status: {str(e)}")
            return None

    async def cancel_upload(self, upload_id: str) -> Dict[str, Any]:
        """
        Cancel an ongoing upload operation

        Args:
            upload_id: Upload operation identifier

        Returns:
            Cancellation result
        """
        try:
            # In a real implementation, this would cancel the operation
            logger.info(f"Cancelling upload {upload_id}")
            return {"success": True, "upload_id": upload_id}

        except Exception as e:
            logger.error(f"Error cancelling upload: {str(e)}")
            return {"success": False, "error": str(e)}

    async def _validate_file(
        self, file_data: bytes, file_name: str, file_type: Optional[str]
    ) -> Dict[str, Any]:
        """Validate file before upload"""
        try:
            # Get file extension
            _, ext = file_name.rsplit(".", 1) if "." in file_name else ("", "")
            ext = ext.lower()

            # Determine file type
            if file_type:
                detected_type = file_type
            else:
                detected_type = self._detect_file_type(ext)

            if not detected_type:
                return {"valid": False, "error": f"Unsupported file type: {ext}"}

            # Get MIME type
            mime_type, _ = mimetypes.guess_type(file_name)
            if not mime_type:
                mime_type = "application/octet-stream"

            # Additional validation based on file type
            if detected_type == "image":
                validation_result = await self._validate_image(file_data)
                if not validation_result["valid"]:
                    return validation_result
            elif detected_type == "video":
                validation_result = await self._validate_video(file_data)
                if not validation_result["valid"]:
                    return validation_result

            return {
                "valid": True,
                "file_type": detected_type,
                "mime_type": mime_type,
                "original_size": len(file_data),
            }

        except Exception as e:
            logger.error(f"Error validating file: {str(e)}")
            return {"valid": False, "error": f"Validation error: {str(e)}"}

    def _detect_file_type(self, ext: str) -> Optional[str]:
        """Detect file type from extension"""
        for file_type, extensions in self.allowed_extensions.items():
            if ext in extensions:
                return file_type
        return None

    async def _validate_image(self, file_data: bytes) -> Dict[str, Any]:
        """Validate image file"""
        try:
            # Basic image validation (check for valid headers)
            if len(file_data) < 4:
                return {"valid": False, "error": "File too small to be a valid image"}

            # Check common image headers
            image_headers = {
                b"\x89PNG": "png",
                b"\xff\xd8\xff": "jpg",
                b"GIF8": "gif",
                b"RIFF": "webp",  # WebP starts with RIFF
            }

            header = file_data[:4]
            is_valid = any(header.startswith(h) for h in image_headers.keys())

            if not is_valid:
                return {"valid": False, "error": "Invalid image file"}

            return {"valid": True}

        except Exception as e:
            return {"valid": False, "error": f"Image validation error: {str(e)}"}

    async def _validate_video(self, file_data: bytes) -> Dict[str, Any]:
        """Validate video file"""
        try:
            if len(file_data) < 8:
                return {"valid": False, "error": "File too small to be a valid video"}

            # Basic video validation (check for common headers/signatures)
            # This is a simplified check - in production, use proper video validation
            video_signatures = [
                b"\x00\x00\x00\x20ftypmp4",  # MP4
                b"\x00\x00\x00\x18ftyp",  # MP4
                b"RIFF",  # AVI, WMV
                b"FLV",  # FLV
            ]

            header = file_data[:12]
            is_valid = any(header.startswith(sig) for sig in video_signatures)

            if not is_valid:
                return {"valid": False, "error": "Invalid video file format"}

            return {"valid": True}

        except Exception as e:
            return {"valid": False, "error": f"Video validation error: {str(e)}"}

    async def _compress_file(
        self, file_data: bytes, file_name: str
    ) -> tuple[bytes, bool]:
        """
        Compress file data if beneficial

        Returns:
            Tuple of (compressed_data, was_compressed)
        """
        try:
            # Don't compress already compressed formats
            compressed_exts = [
                ".zip",
                ".gz",
                ".bz2",
                ".rar",
                ".7z",
                ".mp4",
                ".jpg",
                ".png",
            ]
            if any(file_name.lower().endswith(ext) for ext in compressed_exts):
                return file_data, False

            # Compress using gzip
            compressed_data = gzip.compress(file_data, compresslevel=6)

            # Only use compression if it saves at least 5% space
            if len(compressed_data) < len(file_data) * 0.95:
                logger.info(
                    f"Compressed {file_name}: {len(file_data)} -> {len(compressed_data)} bytes"
                )
                return compressed_data, True
            else:
                return file_data, False

        except Exception as e:
            logger.error(f"Error compressing file: {str(e)}")
            return file_data, False

    async def _upload_to_google_drive(
        self,
        access_token: str,
        user_id: str,
        file_data: bytes,
        file_name: str,
        mime_type: str,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Upload file to Google Drive"""
        try:
            # Get or create AIO folder
            aio_folder = await self.drive_service.get_aio_folder(access_token, user_id)

            if not aio_folder:
                aio_folder = await self.drive_service.create_aio_folder(
                    access_token, user_id
                )

            # Upload file
            upload_result = await self.drive_service.upload_file(
                access_token,
                aio_folder["id"],
                file_name,
                file_data,
                mime_type,
                f"Uploaded via AIO Creative Hub - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            )

            return {
                "success": True,
                "file_id": upload_result.get("id"),
                "file_name": upload_result.get("name"),
                "web_view_link": upload_result.get("webViewLink"),
                "metadata": {
                    **metadata,
                    "storage_location": "google_drive",
                    "upload_id": upload_result.get("id"),
                },
            }

        except Exception as e:
            logger.error(f"Error uploading to Google Drive: {str(e)}")
            return {"success": False, "error": str(e)}

    async def _store_locally(
        self, user_id: str, file_data: bytes, file_name: str, metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Store file locally"""
        try:
            # In a real implementation, this would save to local storage
            local_path = (
                f"/storage/uploads/{user_id}/{metadata['hash_sha256']}/{file_name}"
            )

            logger.info(f"Storing file locally at {local_path}")

            return {
                "success": True,
                "file_name": file_name,
                "local_path": local_path,
                "metadata": {**metadata, "storage_location": "local"},
            }

        except Exception as e:
            logger.error(f"Error storing locally: {str(e)}")
            return {"success": False, "error": str(e)}

    def _format_size(self, size_bytes: int) -> str:
        """Format size in bytes to human-readable format"""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024:
                return f"{size_bytes:.2f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.2f} PB"
