from collections import Counter, deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Optional

from ..models import IntentRequest


@dataclass
class ContextSnapshot:
  recent_messages: Deque[str] = field(default_factory=deque)
  intent_counts: Dict[str, int] = field(default_factory=dict)
  active_tool: Optional[str] = None
  artifacts: List[Dict[str, str]] = field(default_factory=list)


class ContextManager:
  def __init__(self, max_history: int) -> None:
    self.max_history = max_history

  def summarize(self, payload: IntentRequest) -> ContextSnapshot:
    snapshot = ContextSnapshot()
    if payload.history:
      intent_counter: Counter = Counter()
      for turn in payload.history[-self.max_history :]:
        snapshot.recent_messages.append(turn.message)
        if turn.intent:
          intent_counter[turn.intent] += 1
      snapshot.intent_counts = dict(intent_counter)
    if payload.active_tool:
      snapshot.active_tool = payload.active_tool
    if payload.artifacts:
      snapshot.artifacts = [
        {
          "id": artifact.id,
          "tool": artifact.tool or "unknown",
          "name": artifact.name or "",
        }
        for artifact in payload.artifacts[-5:]
      ]
    return snapshot
