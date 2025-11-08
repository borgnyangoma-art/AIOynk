"""
Phase 5 API Endpoints
FastAPI routes for Google Drive, CDN, and storage operations
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import Dict, Any, List, Optional
import logging

from ..services.integration_service import Phase5IntegrationService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/phase5", tags=["Phase 5 Integration"])

# This would be initialized in main.py
integration_service: Optional[Phase5IntegrationService] = None


def get_integration_service() -> Phase5IntegrationService:
    """Dependency to get integration service instance"""
    if integration_service is None:
        raise HTTPException(
            status_code=500, detail="Integration service not initialized"
        )
    return integration_service


# =============================================================================
# Authentication Endpoints
# =============================================================================


@router.post("/auth/authorize")
async def get_authorization_url(
    user_id: str,
    access_type: str = "offline",
    service: Phase5IntegrationService = Depends(get_integration_service),
):
    """Get Google OAuth authorization URL"""
    try:
        auth_url = await service.get_authorization_url(user_id, access_type)
        return {"success": True, "auth_url": auth_url}
    except Exception as e:
        logger.error(f"Error generating auth URL: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/auth/callback")
async def handle_oauth_callback(
    code: str = Form(...),
    state: str = Form(...),
    service: Phase5IntegrationService = Depends(get_integration_service),
):
    """Handle OAuth callback"""
    try:
        result = await service.handle_oauth_callback(code, state)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])

        return result
    except Exception as e:
        logger.error(f"Error handling OAuth callback: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Storage Operations
# =============================================================================


@router.post("/storage/save-artifact")
async def save_artifact(
    user_id: str,
    artifact_type: str,
    artifact_data: Dict[str, Any],
    access_token: str = Form(...),
    auto_save: bool = True,
    create_version: bool = True,
    service: Phase5IntegrationService = Depends(get_integration_service),
):
    """Save artifact with versioning"""
    try:
        result = await service.save_artifact_with_versioning(
            access_token,
            user_id,
            artifact_type,
            artifact_data,
            auto_save,
            create_version,
        )

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])

        return result
    except Exception as e:
        logger.error(f"Error saving artifact: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/storage/overview")
async def get_storage_overview(
    user_id: str,
    access_token: str,
    service: Phase5IntegrationService = Depends(get_integration_service),
):
    """Get comprehensive storage overview"""
    try:
        result = await service.get_storage_overview(access_token, user_id)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])

        return result
    except Exception as e:
        logger.error(f"Error getting storage overview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# File Upload Endpoints
# =============================================================================


@router.post("/storage/upload")
async def upload_file(
    user_id: str = Form(...),
    access_token: str = Form(...),
    file: UploadFile = File(...),
    auto_compress: bool = True,
    upload_to_cdn: bool = False,
    cdn_provider: Optional[str] = Form(None),
    service: Phase5IntegrationService = Depends(get_integration_service),
):
    """Upload file with processing"""
    try:
        file_data = await file.read()

        result = await service.upload_file_with_processing(
            access_token,
            user_id,
            file_data,
            file.filename,
            auto_compress,
            upload_to_cdn,
            cdn_provider,
        )

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])

        return result
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Version Management Endpoints
# =============================================================================


@router.get("/versions/history/{file_id}")
async def get_version_history(
    file_id: str,
    access_token: str,
    service: Phase5IntegrationService = Depends(get_integration_service),
):
    """Get version history for a file"""
    try:
        result = await service.get_version_history_frontend(access_token, file_id)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])

        return result
    except Exception as e:
        logger.error(f"Error getting version history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/versions/compare")
async def compare_versions(
    file_id: str,
    version1_id: str,
    version2_id: str,
    access_token: str,
    service: Phase5IntegrationService = Depends(get_integration_service),
):
    """Compare two file versions"""
    try:
        result = await service.compare_file_versions(
            access_token, file_id, version1_id, version2_id
        )

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])

        return result
    except Exception as e:
        logger.error(f"Error comparing versions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/versions/revert")
async def revert_to_version(
    file_id: str,
    target_version_id: str,
    access_token: str = Form(...),
    service: Phase5IntegrationService = Depends(get_integration_service),
):
    """Revert file to specific version"""
    try:
        result = await service.revert_to_version(
            access_token, file_id, target_version_id
        )

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])

        return result
    except Exception as e:
        logger.error(f"Error reverting version: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Storage Quota & Cleanup Endpoints
# =============================================================================


@router.get("/storage/recommendations")
async def get_storage_recommendations(
    access_token: str,
    service: Phase5IntegrationService = Depends(get_integration_service),
):
    """Get storage cleanup recommendations"""
    try:
        result = await service.get_storage_recommendations(access_token)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])

        return result
    except Exception as e:
        logger.error(f"Error getting recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/storage/cleanup")
async def cleanup_storage(
    user_id: str,
    access_token: str = Form(...),
    service: Phase5IntegrationService = Depends(get_integration_service),
):
    """Perform storage cleanup"""
    try:
        result = await service.cleanup_storage(access_token, user_id)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])

        return result
    except Exception as e:
        logger.error(f"Error during cleanup: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Sync Operations
# =============================================================================


@router.post("/storage/sync")
async def sync_offline_data(
    access_token: str = Form(...),
    service: Phase5IntegrationService = Depends(get_integration_service),
):
    """Sync offline data to cloud"""
    try:
        result = await service.sync_offline_data(access_token)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])

        return result
    except Exception as e:
        logger.error(f"Error syncing data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Status & Health Check
# =============================================================================


@router.get("/status")
async def get_service_status(
    service: Phase5IntegrationService = Depends(get_integration_service),
):
    """Get Phase 5 services status"""
    try:
        return await service.get_service_status()
    except Exception as e:
        logger.error(f"Error getting service status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
