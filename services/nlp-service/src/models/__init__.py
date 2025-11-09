from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ConversationTurn(BaseModel):
  role: str
  message: str
  intent: Optional[str] = None


class ArtifactReference(BaseModel):
  id: str
  tool: Optional[str] = None
  name: Optional[str] = None
  url: Optional[str] = None
  metadata: Optional[Dict[str, Any]] = None


class IntentRequest(BaseModel):
  message: str
  session_id: Optional[str] = Field(default=None, alias="sessionId")
  history: Optional[List[ConversationTurn]] = None
  active_tool: Optional[str] = Field(default=None, alias="activeTool")
  artifacts: Optional[List[ArtifactReference]] = None
  metadata: Optional[Dict[str, Any]] = None

  class Config:
    allow_population_by_field_name = True


class RouteInfo(BaseModel):
  service: str
  endpoint: str


class FallbackInfo(BaseModel):
  active: bool = False
  reason: Optional[str] = None
  threshold: float = 0.7
  suggestions: List[str] = []


class IntentData(BaseModel):
  intent: str
  confidence: float
  keywords: List[str] = []
  entities: Dict[str, Any] = {}
  fallback: bool = False
  fallback_info: Optional[FallbackInfo] = Field(default=None, alias="fallbackInfo")
  route: RouteInfo
  metadata: Dict[str, Any] = {}

  class Config:
    allow_population_by_field_name = True


class IntentResponse(BaseModel):
  success: bool = True
  data: IntentData


class HealthResponse(BaseModel):
  status: str
  service: str
  version: str
  confidence_threshold: float
  suggestion_limit: int
