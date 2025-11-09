import logging
from typing import Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from .config import settings
from .models import HealthResponse, IntentRequest, IntentResponse
from .services.context_manager import ContextManager
from .services.intent_classifier import IntentClassifier


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aio-nlp-service")

app = FastAPI(
  title="AIO Creative Hub - NLP Service",
  version="1.0.0",
  description="Intent classification and routing service for AIO tools",
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

classifier = IntentClassifier()
context_manager = ContextManager(max_history=settings.max_history)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
  return HealthResponse(
    status="ok",
    service="aiocreativehub-nlp",
    version=app.version or "1.0.0",
    confidence_threshold=settings.confidence_threshold,
    suggestion_limit=settings.suggestion_limit,
  )


@app.post("/api/v1/nlp/intent", response_model=IntentResponse)
async def classify_intent(payload: IntentRequest) -> IntentResponse:
  if not payload.message.strip():
    raise HTTPException(status_code=400, detail="message is required")

  context_snapshot = context_manager.summarize(payload)
  result = classifier.classify(payload.message, context_snapshot)
  return IntentResponse(success=True, data=result)


def main() -> None:
  uvicorn.run(
    "src.main:app",
    host="0.0.0.0",
    port=settings.port,
    reload=False,
  )


if __name__ == "__main__":
  main()
