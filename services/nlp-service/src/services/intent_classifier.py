import time
from typing import Any, Dict, List, Tuple

import spacy
from spacy.language import Language

from ..config import settings
from ..models import FallbackInfo, IntentData, RouteInfo
from .context_manager import ContextSnapshot
from .entity_extractor import EntityExtractor


SERVICE_ROUTES: Dict[str, RouteInfo] = {
  "graphics": RouteInfo(service="graphics-service", endpoint="/canvas"),
  "web_designer": RouteInfo(service="web-designer-service", endpoint="/project"),
  "ide": RouteInfo(service="ide-service", endpoint="/project"),
  "cad": RouteInfo(service="cad-service", endpoint="/model"),
  "video": RouteInfo(service="video-service", endpoint="/project"),
  "chat": RouteInfo(service="chat-service", endpoint="/message"),
}


INTENT_KEYWORDS: Dict[str, List[str]] = {
  "graphics": ["draw", "design", "logo", "canvas", "layer", "color", "shape"],
  "web_designer": ["website", "landing page", "hero", "responsive", "section", "navbar"],
  "ide": ["code", "function", "bug", "compile", "script", "execute"],
  "cad": ["3d", "model", "extrude", "mesh", "render", "primitive"],
  "video": ["video", "clip", "timeline", "transition", "render video", "export video"],
}


class IntentClassifier:
  def __init__(self) -> None:
    self.nlp: Language = self._load_model(settings.model_name)
    self.entity_extractor = EntityExtractor(self.nlp)
    self.threshold = settings.confidence_threshold
    self.suggestion_limit = settings.suggestion_limit

  def _load_model(self, model_name: str) -> Language:
    try:
      return spacy.load(model_name)  # type: ignore[arg-type]
    except Exception:
      return spacy.blank("en")

  def classify(self, message: str, context: ContextSnapshot) -> IntentData:
    started = time.perf_counter()
    doc = self.nlp(message)
    lowered = doc.text.lower()
    ranking = self._rank_intents(lowered)
    best_intent, score, keywords = ranking[0] if ranking else ("chat", 0.0, [])

    entities = self.entity_extractor.extract(doc)
    entity_bonus = min(0.25, 0.05 * len(entities))
    context_bonus = self._context_bonus(best_intent, context)
    initial = 0.25 + (score * 0.6)
    confidence = float(min(1.0, initial + entity_bonus + context_bonus))
    fallback = confidence < self.threshold

    if fallback:
      fallback_info = FallbackInfo(
        active=True,
        reason="LOW_CONFIDENCE",
        threshold=self.threshold,
        suggestions=[intent for intent, _, _ in ranking[: self.suggestion_limit]],
      )
      route = self._route_for_intent("chat")
      intent = "chat"
    else:
      fallback_info = None
      route = self._route_for_intent(best_intent)
      intent = best_intent

    duration_ms = round((time.perf_counter() - started) * 1000, 3)

    metadata: Dict[str, Any] = {
      "processingTimeMs": duration_ms,
      "entityBonus": round(entity_bonus, 3),
      "contextBonus": round(context_bonus, 3),
      "appliedArtifacts": len(context.artifacts),
    }

    return IntentData(
      intent=intent,
      confidence=confidence,
      keywords=keywords,
      entities=entities,
      fallback=fallback,
      fallback_info=fallback_info,
      route=route,
      metadata=metadata,
    )

  def _rank_intents(self, text: str) -> List[Tuple[str, float, List[str]]]:
    ranking: List[Tuple[str, float, List[str]]] = []
    for intent, keywords in INTENT_KEYWORDS.items():
      matches = [kw for kw in keywords if kw in text]
      score = len(matches) / len(keywords) if keywords else 0
      ranking.append((intent, score, matches))
    ranking.sort(key=lambda entry: entry[1], reverse=True)
    if not ranking:
      ranking.append(("chat", 0.0, []))
    return ranking

  def _context_bonus(self, intent: str, context: ContextSnapshot) -> float:
    bonus = 0.0
    if intent in context.intent_counts:
      bonus += min(0.2, context.intent_counts[intent] * 0.04)
    if context.active_tool and context.active_tool == intent:
      bonus += 0.05
    if context.artifacts and any(item.get("tool") == intent for item in context.artifacts):
      bonus += 0.05
    return bonus

  def _route_for_intent(self, intent: str) -> RouteInfo:
    base_route = SERVICE_ROUTES.get(intent, SERVICE_ROUTES["chat"])
    return RouteInfo(service=base_route.service, endpoint=base_route.endpoint)
