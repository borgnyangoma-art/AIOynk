import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
  port: int = int(os.getenv("PORT", "3006"))
  confidence_threshold: float = float(os.getenv("NLP_CONFIDENCE_THRESHOLD", "0.7"))
  max_history: int = int(os.getenv("NLP_MAX_HISTORY", "10"))
  suggestion_limit: int = int(os.getenv("NLP_SUGGESTION_LIMIT", "3"))
  model_name: str = os.getenv("NLP_MODEL", "en_core_web_sm")


settings = Settings()
