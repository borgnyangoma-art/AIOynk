"""
Integration Service - Main orchestrator for Phase 5 services
Coordinates Google Drive, CDN, and local storage operations
"""

from typing import Dict, Any, List, Optional
import logging
from datetime import datetime

from .google_oauth import GoogleOAuthService
from .google_drive import GoogleDriveService
from .auto_save import AutoSaveService
from .version_manager import VersionManager
from .version_history_display import VersionHistoryDisplay
from .storage_quota import StorageQuotaManager
from .artifact_storage import ArtifactStorageService
from .file_upload import FileUploadService
from .cdn_integration import CDNIntegrationService
from .local_storage_fallback import LocalStorageFallback

logger = logging.getLogger(__name__)


class Phase5IntegrationService:
    """
    Main integration service for Phase 5 features
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config

        # Initialize OAuth service
        self.oauth_service = GoogleOAuthService(config)

        # Initialize Drive service
        self.drive_service = GoogleDriveService(self.oauth_service)

        # Initialize Auto-save service
        self.auto_save_service = AutoSaveService(self.oauth_service, self.drive_service)

        # Initialize Version Manager
        self.version_manager = VersionManager(self.drive_service)
        self.version_history_display = VersionHistoryDisplay(
            self.version_manager, self.drive_service
        )

        # Initialize Storage Quota Manager
        self.storage_quota_manager = StorageQuotaManager(self.drive_service)

        # Initialize Artifact Storage
        self.artifact_storage = ArtifactStorageService(
            self.drive_service, self.auto_save_service
        )

        # Initialize File Upload
        self.file_upload = FileUploadService(self.drive_service, self.artifact_storage)

        # Initialize CDN Integration
        self.cdn_integration = CDNIntegrationService(config)

        # Initialize Local Storage Fallback
        self.local_storage = LocalStorageFallback(
            config.get("local_storage_path", "./local_storage")
        )

    # =============================================================================
    # Authentication & OAuth Methods
    # =============================================================================

    async def get_authorization_url(
        self, user_id: str, access_type: str = "offline"
    ) -> str:
        """Generate Google OAuth authorization URL"""
        return self.oauth_service.generate_auth_url(
            state=user_id, access_type=access_type
        )

    async def handle_oauth_callback(self, code: str, state: str) -> Dict[str, Any]:
        """Handle OAuth callback and exchange code for tokens"""
        try:
            tokens = await self.oauth_service.exchange_code_for_tokens(code)

            return {
                "success": True,
                "user_id": state,
                "access_token": tokens["access_token"],
                "refresh_token": tokens.get("refresh_token"),
                "user_info": tokens["user_info"],
                "expires_in": tokens.get("expires_in"),
            }
        except Exception as e:
            logger.error(f"Error handling OAuth callback: {str(e)}")
            return {"success": False, "error": str(e)}

    # =============================================================================
    # Storage Operations
    # =============================================================================

    async def save_artifact_with_versioning(
        self,
        access_token: str,
        user_id: str,
        artifact_type: str,
        artifact_data: Dict[str, Any],
        auto_save: bool = True,
        create_version: bool = True,
    ) -> Dict[str, Any]:
        """
        Save artifact with automatic versioning

        Args:
            access_token: Google Drive access token
            user_id: User identifier
            artifact_type: Type of artifact
            artifact_data: Artifact content
            auto_save: Whether to enable auto-save
            create_version: Whether to create a version entry

        Returns:
            Save result with metadata
        """
        try:
            # Save to Google Drive
            result = await self.auto_save_service.save_artifact(
                access_token,
                user_id,
                artifact_type,
                artifact_data,
                description=f"Auto-saved at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            )

            if not result["success"]:
                return result

            # Save locally for offline access
            local_result = await self.local_storage.save_offline(
                artifact_data,
                f"{artifact_type}_{user_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                artifact_type,
                {"user_id": user_id, "drive_file_id": result["file_id"]},
            )

            # Add to sync queue if offline save failed
            if not local_result["success"]:
                await self.local_storage.add_to_sync_queue(
                    "create",
                    result["file_id"],
                    {
                        "user_id": user_id,
                        "artifact_type": artifact_type,
                        "artifact_data": artifact_data,
                        "drive_file_id": result["file_id"],
                    },
                )

            return {
                "success": True,
                "drive_result": result,
                "local_result": local_result,
                "has_local_backup": local_result["success"],
                "sync_needed": not local_result["success"],
            }

        except Exception as e:
            logger.error(f"Error saving artifact with versioning: {str(e)}")
            return {"success": False, "error": str(e)}

    async def get_storage_overview(
        self, access_token: str, user_id: str
    ) -> Dict[str, Any]:
        """
        Get comprehensive storage overview

        Args:
            access_token: Google Drive access token
            user_id: User identifier

        Returns:
            Storage overview
        """
        try:
            # Get Google Drive info
            drive_info = await self.drive_service.get_drive_info(access_token)
            quota_info = await self.storage_quota_manager.check_storage_quota(
                access_token
            )

            # Get local storage stats
            local_stats = await self.local_storage.get_storage_stats()

            # Get user artifacts
            artifacts = await self.artifact_storage.list_user_artifacts(user_id)

            # Get pending syncs
            pending_syncs = await self.local_storage.get_pending_syncs()

            return {
                "success": True,
                "google_drive": {"info": drive_info, "quota": quota_info},
                "local_storage": local_stats,
                "artifacts_count": len(artifacts),
                "pending_syncs": len(pending_syncs),
                "sync_queue": pending_syncs,
                "last_updated": datetime.now().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error getting storage overview: {str(e)}")
            return {"success": False, "error": str(e)}

    # =============================================================================
    # File Upload & Processing
    # =============================================================================

    async def upload_file_with_processing(
        self,
        access_token: str,
        user_id: str,
        file_data: bytes,
        file_name: str,
        auto_compress: bool = True,
        upload_to_cdn: bool = False,
        cdn_provider: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Upload file with full processing pipeline

        Args:
            access_token: Google Drive access token
            user_id: User identifier
            file_data: File content
            file_name: File name
            auto_compress: Whether to compress
            upload_to_cdn: Whether to upload to CDN
            cdn_provider: CDN provider

        Returns:
            Upload result
        """
        try:
            # Upload to Google Drive
            upload_result = await self.file_upload.upload_file(
                access_token,
                user_id,
                file_data,
                file_name,
                auto_compress=auto_compress,
                storage_location="google_drive",
            )

            if not upload_result["success"]:
                return upload_result

            results = {"google_drive": upload_result, "cdn": None, "local_backup": None}

            # Upload to CDN if requested
            if upload_to_cdn:
                cdn_result = await self.cdn_integration.upload_to_cdn(
                    file_data, file_name, cdn_provider
                )
                results["cdn"] = cdn_result

            # Create local backup
            local_result = await self.local_storage.save_offline(
                file_data,
                file_name,
                upload_result.get("metadata", {}).get("file_type"),
                {
                    "user_id": user_id,
                    "drive_file_id": upload_result.get("file_id"),
                    "cdn_url": results["cdn"]["cdn_url"] if results["cdn"] else None,
                },
            )
            results["local_backup"] = local_result

            return {
                "success": True,
                "file_id": upload_result.get("file_id"),
                "file_name": file_name,
                "results": results,
            }

        except Exception as e:
            logger.error(f"Error in upload processing: {str(e)}")
            return {"success": False, "error": str(e)}

    # =============================================================================
    # Version Management
    # =============================================================================

    async def get_version_history_frontend(
        self, access_token: str, file_id: str
    ) -> Dict[str, Any]:
        """
        Get version history formatted for frontend

        Args:
            access_token: Google Drive access token
            file_id: File identifier

        Returns:
            Frontend-formatted version history
        """
        return await self.version_history_display.get_frontend_version_history(
            access_token, file_id
        )

    async def compare_file_versions(
        self, access_token: str, file_id: str, version1_id: str, version2_id: str
    ) -> Dict[str, Any]:
        """
        Compare two file versions

        Args:
            access_token: Google Drive access token
            file_id: File identifier
            version1_id: First version ID
            version2_id: Second version ID

        Returns:
            Version comparison
        """
        return await self.version_history_display.get_version_comparison_data(
            access_token, file_id, version1_id, version2_id
        )

    async def revert_to_version(
        self, access_token: str, file_id: str, target_version_id: str
    ) -> Dict[str, Any]:
        """
        Revert file to specific version

        Args:
            access_token: Google Drive access token
            file_id: File identifier
            target_version_id: Version to revert to

        Returns:
            Revert result
        """
        return await self.version_manager.revert_to_version(
            access_token, file_id, target_version_id
        )

    # =============================================================================
    # Storage Quota & Cleanup
    # =============================================================================

    async def get_storage_recommendations(self, access_token: str) -> Dict[str, Any]:
        """
        Get storage cleanup recommendations

        Args:
            access_token: Google Drive access token

        Returns:
            Recommendations
        """
        try:
            quota_info = await self.storage_quota_manager.check_storage_quota(
                access_token
            )
            cleanup_suggestions = (
                await self.storage_quota_manager.suggest_cleanup_actions(access_token)
            )
            local_stats = await self.local_storage.get_storage_stats()

            return {
                "success": True,
                "quota": quota_info,
                "suggestions": cleanup_suggestions,
                "local_storage": local_stats,
                "recommendations": self._generate_recommendations(
                    quota_info, cleanup_suggestions
                ),
            }

        except Exception as e:
            logger.error(f"Error getting storage recommendations: {str(e)}")
            return {"success": False, "error": str(e)}

    async def cleanup_storage(self, access_token: str, user_id: str) -> Dict[str, Any]:
        """
        Perform comprehensive storage cleanup

        Args:
            access_token: Google Drive access token
            user_id: User identifier

        Returns:
            Cleanup results
        """
        try:
            # Clean up local storage
            local_cleanup = await self.local_storage.cleanup_old_files(days_old=30)

            # Get Drive cleanup suggestions
            cleanup_suggestions = (
                await self.storage_quota_manager.suggest_cleanup_actions(access_token)
            )

            return {
                "success": True,
                "local_cleanup": local_cleanup,
                "drive_suggestions": cleanup_suggestions,
                "cleanup_at": datetime.now().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error during storage cleanup: {str(e)}")
            return {"success": False, "error": str(e)}

    # =============================================================================
    # Sync Operations
    # =============================================================================

    async def sync_offline_data(self, access_token: str) -> Dict[str, Any]:
        """
        Sync offline data to cloud storage

        Args:
            access_token: Google Drive access token

        Returns:
            Sync results
        """
        try:
            pending_syncs = await self.local_storage.get_pending_syncs()
            sync_results = []

            for sync in pending_syncs:
                try:
                    if sync["operation"] == "create":
                        # Upload to Google Drive
                        result = await self.auto_save_service.save_artifact(
                            access_token,
                            sync["data"]["user_id"],
                            sync["data"]["artifact_type"],
                            sync["data"]["artifact_data"],
                        )

                        if result["success"]:
                            await self.local_storage.mark_sync_complete(sync["id"])
                            sync_results.append(
                                {
                                    "sync_id": sync["id"],
                                    "status": "completed",
                                    "file_id": result["file_id"],
                                }
                            )
                        else:
                            sync_results.append(
                                {
                                    "sync_id": sync["id"],
                                    "status": "failed",
                                    "error": result.get("error"),
                                }
                            )

                except Exception as e:
                    sync_results.append(
                        {"sync_id": sync["id"], "status": "failed", "error": str(e)}
                    )

            return {
                "success": True,
                "total_syncs": len(pending_syncs),
                "results": sync_results,
            }

        except Exception as e:
            logger.error(f"Error syncing offline data: {str(e)}")
            return {"success": False, "error": str(e)}

    # =============================================================================
    # Utility Methods
    # =============================================================================

    def _generate_recommendations(
        self, quota_info: Dict[str, Any], cleanup_suggestions: List[Dict[str, Any]]
    ) -> List[str]:
        """Generate high-level recommendations"""
        recommendations = []

        if quota_info.get("usage_percentage", 0) > 80:
            recommendations.append("Consider upgrading your storage plan")
            recommendations.append("Enable automatic file compression")

        if any(s["type"] == "old_files" for s in cleanup_suggestions):
            recommendations.append("Review and delete old files")

        if any(s["type"] == "duplicates" for s in cleanup_suggestions):
            recommendations.append("Remove duplicate files to save space")

        if any(s["type"] == "large_files" for s in cleanup_suggestions):
            recommendations.append("Consider compressing large files")

        return recommendations

    async def get_service_status(self) -> Dict[str, Any]:
        """
        Get status of all Phase 5 services

        Returns:
            Service status
        """
        return {
            "success": True,
            "services": {
                "google_oauth": "active",
                "google_drive": "active",
                "auto_save": "active",
                "version_manager": "active",
                "storage_quota": "active",
                "artifact_storage": "active",
                "file_upload": "active",
                "cdn_integration": "active",
                "local_storage": "active",
            },
            "version": "1.0.0",
            "status": "operational",
            "last_check": datetime.now().isoformat(),
        }
