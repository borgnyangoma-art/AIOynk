"""
Local Storage Fallback Service
Handles offline mode and local storage when cloud storage is unavailable
"""

from typing import Dict, Any, List, Optional, Union
import json
import logging
import hashlib
import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
import pickle
import gzip
import uuid

logger = logging.getLogger(__name__)


class LocalStorageFallback:
    """
    Service for local storage fallback during offline mode
    """

    def __init__(self, storage_path: str = "./local_storage"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)

        self.db_path = self.storage_path / "local_storage.db"
        self.max_storage_size = 5 * 1024 * 1024 * 1024  # 5GB
        self.compression_threshold = 1024  # 1KB

        self._init_database()

    def _init_database(self):
        """Initialize SQLite database for metadata tracking"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT,
                size_bytes INTEGER,
                created_at TEXT,
                last_accessed TEXT,
                access_count INTEGER DEFAULT 0,
                is_compressed BOOLEAN DEFAULT 0,
                metadata TEXT
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sync_queue (
                id TEXT PRIMARY KEY,
                operation TEXT,
                file_id TEXT,
                status TEXT,
                created_at TEXT,
                retry_count INTEGER DEFAULT 0,
                data TEXT
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TEXT
            )
        """)

        conn.commit()
        conn.close()

    async def save_offline(
        self,
        data: Union[Dict[str, Any], bytes, str],
        file_name: str,
        file_type: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Save data locally for offline access

        Args:
            data: Data to save
            file_name: File name
            file_type: Type of file
            metadata: Additional metadata

        Returns:
            Save result
        """
        try:
            # Convert data to bytes
            if isinstance(data, dict):
                data_bytes = json.dumps(data, indent=2).encode("utf-8")
            elif isinstance(data, str):
                data_bytes = data.encode("utf-8")
            else:
                data_bytes = data

            # Check storage quota
            if await self._check_storage_quota(len(data_bytes)):
                return {"success": False, "error": "Storage quota exceeded"}

            # Compress if beneficial
            is_compressed = False
            if len(data_bytes) > self.compression_threshold:
                compressed_data = gzip.compress(data_bytes)
                if len(compressed_data) < len(data_bytes) * 0.9:
                    data_bytes = compressed_data
                    is_compressed = True
                    if file_name and not file_name.endswith(".gz"):
                        file_name = f"{file_name}.gz"

            # Generate file ID
            file_id = str(uuid.uuid4())

            # Create file path
            file_path = self.storage_path / f"{file_id}_{file_name}"

            # Write file
            with open(file_path, "wb") as f:
                f.write(data_bytes)

            # Save metadata
            await self._save_metadata(
                file_id,
                file_name,
                str(file_path),
                file_type,
                len(data_bytes),
                is_compressed,
                metadata,
            )

            logger.info(f"Saved offline file: {file_id}")

            return {
                "success": True,
                "file_id": file_id,
                "file_name": file_name,
                "file_path": str(file_path),
                "size_bytes": len(data_bytes),
                "is_compressed": is_compressed,
                "storage_location": "local",
                "offline_available": True,
            }

        except Exception as e:
            logger.error(f"Error saving offline: {str(e)}")
            return {"success": False, "error": str(e)}

    async def load_offline(self, file_id: str) -> Optional[Dict[str, Any]]:
        """
        Load data from local storage

        Args:
            file_id: File identifier

        Returns:
            File data and metadata
        """
        try:
            # Get metadata
            metadata = await self._get_metadata(file_id)

            if not metadata:
                logger.warning(f"File not found: {file_id}")
                return None

            file_path = metadata["file_path"]

            # Read file
            with open(file_path, "rb") as f:
                data_bytes = f.read()

            # Decompress if necessary
            if metadata["is_compressed"]:
                data_bytes = gzip.decompress(data_bytes)

            # Update access info
            await self._update_access_info(file_id)

            # Return data
            if metadata["file_type"] == "json":
                try:
                    data = json.loads(data_bytes.decode("utf-8"))
                except:
                    data = data_bytes
            else:
                data = data_bytes.decode("utf-8")

            return {"data": data, "metadata": metadata}

        except Exception as e:
            logger.error(f"Error loading offline file: {str(e)}")
            return None

    async def list_offline_files(
        self, file_type: Optional[str] = None, limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        List all offline files

        Args:
            file_type: Filter by type
            limit: Maximum number of files

        Returns:
            List of files with metadata
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            query = "SELECT * FROM files"
            params = []

            if file_type:
                query += " WHERE file_type = ?"
                params.append(file_type)

            query += " ORDER BY last_accessed DESC LIMIT ?"
            params.append(limit)

            cursor.execute(query, params)
            rows = cursor.fetchall()

            conn.close()

            files = []
            for row in rows:
                files.append(
                    {
                        "id": row[0],
                        "file_name": row[1],
                        "file_path": row[2],
                        "file_type": row[3],
                        "size_bytes": row[4],
                        "created_at": row[5],
                        "last_accessed": row[6],
                        "access_count": row[7],
                        "is_compressed": bool(row[8]),
                        "metadata": json.loads(row[9]) if row[9] else {},
                    }
                )

            return files

        except Exception as e:
            logger.error(f"Error listing offline files: {str(e)}")
            return []

    async def delete_offline(self, file_id: str) -> Dict[str, Any]:
        """
        Delete offline file

        Args:
            file_id: File identifier

        Returns:
            Deletion result
        """
        try:
            # Get metadata
            metadata = await self._get_metadata(file_id)

            if not metadata:
                return {"success": False, "error": "File not found"}

            # Delete file
            file_path = metadata["file_path"]
            if os.path.exists(file_path):
                os.remove(file_path)

            # Delete metadata
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM files WHERE id = ?", (file_id,))
            conn.commit()
            conn.close()

            logger.info(f"Deleted offline file: {file_id}")

            return {"success": True, "file_id": file_id}

        except Exception as e:
            logger.error(f"Error deleting offline file: {str(e)}")
            return {"success": False, "error": str(e)}

    async def cleanup_old_files(self, days_old: int = 30) -> Dict[str, Any]:
        """
        Clean up old offline files

        Args:
            days_old: Delete files older than this many days

        Returns:
            Cleanup result
        """
        try:
            cutoff_date = datetime.now() - timedelta(days=days_old)

            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute(
                "SELECT id, file_path FROM files WHERE created_at < ?",
                (cutoff_date.isoformat(),),
            )
            old_files = cursor.fetchall()

            deleted_count = 0
            freed_bytes = 0

            for file_id, file_path in old_files:
                # Delete file
                if os.path.exists(file_path):
                    size = os.path.getsize(file_path)
                    os.remove(file_path)
                    freed_bytes += size

                # Delete metadata
                cursor.execute("DELETE FROM files WHERE id = ?", (file_id,))
                deleted_count += 1

            conn.commit()
            conn.close()

            logger.info(
                f"Cleaned up {deleted_count} old files, freed {freed_bytes} bytes"
            )

            return {
                "success": True,
                "deleted_count": deleted_count,
                "freed_bytes": freed_bytes,
                "cutoff_date": cutoff_date.isoformat(),
            }

        except Exception as e:
            logger.error(f"Error cleaning up old files: {str(e)}")
            return {"success": False, "error": str(e)}

    async def get_storage_stats(self) -> Dict[str, Any]:
        """
        Get local storage statistics

        Returns:
            Storage statistics
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("SELECT COUNT(*) FROM files")
            total_files = cursor.fetchone()[0]

            cursor.execute("SELECT SUM(size_bytes) FROM files")
            total_size = cursor.fetchone()[0] or 0

            cursor.execute("SELECT COUNT(*) FROM sync_queue WHERE status = 'pending'")
            pending_syncs = cursor.fetchone()[0]

            conn.close()

            # Calculate storage usage
            usage_percentage = (total_size / self.max_storage_size) * 100

            return {
                "total_files": total_files,
                "total_size_bytes": total_size,
                "total_size_formatted": self._format_size(total_size),
                "max_storage_bytes": self.max_storage_size,
                "usage_percentage": usage_percentage,
                "pending_syncs": pending_syncs,
                "storage_path": str(self.storage_path),
            }

        except Exception as e:
            logger.error(f"Error getting storage stats: {str(e)}")
            return {"success": False, "error": str(e)}

    async def add_to_sync_queue(
        self, operation: str, file_id: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Add operation to sync queue for later synchronization

        Args:
            operation: Operation type (create, update, delete)
            file_id: File identifier
            data: Operation data

        Returns:
            Queue addition result
        """
        try:
            queue_id = str(uuid.uuid4())

            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute(
                "INSERT INTO sync_queue (id, operation, file_id, status, created_at, data) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    queue_id,
                    operation,
                    file_id,
                    "pending",
                    datetime.now().isoformat(),
                    json.dumps(data),
                ),
            )

            conn.commit()
            conn.close()

            logger.info(f"Added to sync queue: {queue_id}")

            return {"success": True, "queue_id": queue_id}

        except Exception as e:
            logger.error(f"Error adding to sync queue: {str(e)}")
            return {"success": False, "error": str(e)}

    async def get_pending_syncs(self) -> List[Dict[str, Any]]:
        """
        Get all pending sync operations

        Returns:
            List of pending syncs
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute(
                "SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC"
            )
            rows = cursor.fetchall()

            conn.close()

            syncs = []
            for row in rows:
                syncs.append(
                    {
                        "id": row[0],
                        "operation": row[1],
                        "file_id": row[2],
                        "status": row[3],
                        "created_at": row[4],
                        "retry_count": row[5],
                        "data": json.loads(row[6]),
                    }
                )

            return syncs

        except Exception as e:
            logger.error(f"Error getting pending syncs: {str(e)}")
            return []

    async def mark_sync_complete(self, queue_id: str) -> Dict[str, Any]:
        """
        Mark sync operation as complete

        Args:
            queue_id: Queue operation ID

        Returns:
            Mark result
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute(
                "UPDATE sync_queue SET status = 'completed' WHERE id = ?", (queue_id,)
            )

            conn.commit()
            conn.close()

            return {"success": True, "queue_id": queue_id}

        except Exception as e:
            logger.error(f"Error marking sync complete: {str(e)}")
            return {"success": False, "error": str(e)}

    async def _check_storage_quota(self, additional_bytes: int) -> bool:
        """Check if adding data would exceed storage quota"""
        try:
            stats = await self.get_storage_stats()
            current_size = stats.get("total_size_bytes", 0)

            return (current_size + additional_bytes) > self.max_storage_size

        except Exception:
            return True  # Fail safe

    async def _save_metadata(
        self,
        file_id: str,
        file_name: str,
        file_path: str,
        file_type: Optional[str],
        size_bytes: int,
        is_compressed: bool,
        metadata: Optional[Dict[str, Any]],
    ):
        """Save file metadata to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        now = datetime.now().isoformat()

        cursor.execute(
            """INSERT INTO files
               (id, file_name, file_path, file_type, size_bytes, created_at,
                last_accessed, access_count, is_compressed, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                file_id,
                file_name,
                file_path,
                file_type,
                size_bytes,
                now,
                now,
                0,
                is_compressed,
                json.dumps(metadata) if metadata else None,
            ),
        )

        conn.commit()
        conn.close()

    async def _get_metadata(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get file metadata from database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,))
        row = cursor.fetchone()

        conn.close()

        if not row:
            return None

        return {
            "id": row[0],
            "file_name": row[1],
            "file_path": row[2],
            "file_type": row[3],
            "size_bytes": row[4],
            "created_at": row[5],
            "last_accessed": row[6],
            "access_count": row[7],
            "is_compressed": bool(row[8]),
            "metadata": json.loads(row[9]) if row[9] else {},
        }

    async def _update_access_info(self, file_id: str):
        """Update file access information"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        now = datetime.now().isoformat()

        cursor.execute(
            "UPDATE files SET last_accessed = ?, access_count = access_count + 1 WHERE id = ?",
            (now, file_id),
        )

        conn.commit()
        conn.close()

    def _format_size(self, size_bytes: int) -> str:
        """Format size in bytes to human-readable format"""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024:
                return f"{size_bytes:.2f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.2f} PB"
