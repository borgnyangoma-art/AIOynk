"""
FastAPI Main Application
Entry point for the NLP service with Phase 5 integration
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import uvicorn
from contextlib import asynccontextmanager

from .api.phase5_endpoints import router as phase5_router, integration_service
from .services.integration_service import Phase5IntegrationService

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Configuration
config = {
    # Google OAuth
    "google_client_id": "your-google-client-id",
    "google_client_secret": "your-google-client-secret",
    "google_redirect_uri": "http://localhost:8000/api/phase5/auth/callback",
    # CDN Configuration
    "cloudflare_api_token": "your-cloudflare-token",
    "cloudflare_zone_id": "your-zone-id",
    "aws_access_key_id": "your-aws-key",
    "aws_secret_access_key": "your-aws-secret",
    "aws_distribution_id": "your-distribution-id",
    "vercel_token": "your-vercel-token",
    "vercel_project_id": "your-project-id",
    "default_cdn": "cloudflare",
    # Local Storage
    "local_storage_path": "./local_storage",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting AIO Creative Hub NLP Service with Phase 5 Integration")

    # Initialize Phase 5 Integration Service
    global integration_service
    integration_service = Phase5IntegrationService(config)
    logger.info("Phase 5 Integration Service initialized")

    # Get service status
    status = await integration_service.get_service_status()
    logger.info(f"Service status: {status}")

    yield

    # Shutdown
    logger.info("Shutting down AIO Creative Hub NLP Service")


# Create FastAPI application
app = FastAPI(
    title="AIO Creative Hub - NLP Service",
    description="Creative Hub NLP Service with Phase 5 Google Drive & CDN Integration",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "detail": str(exc) if app.debug else "An error occurred",
        },
    )


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "aio-nlp",
        "version": "1.0.0",
        "phase5_enabled": True,
    }


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "AIO Creative Hub NLP Service",
        "version": "1.0.0",
        "phase5_integration": "active",
        "docs": "/docs",
    }


# Register Phase 5 routers
app.include_router(phase5_router)


# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("AIO Creative Hub NLP Service started successfully")
    logger.info(
        "Phase 5 Integration: Google Drive, CDN, Version Management, Local Storage"
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
