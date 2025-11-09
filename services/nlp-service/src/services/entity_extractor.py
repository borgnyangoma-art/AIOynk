import re
from typing import Dict, List

from spacy.matcher import Matcher
from spacy.language import Language
from spacy.tokens import Doc


COLOR_TERMS = [
  "red",
  "blue",
  "green",
  "yellow",
  "purple",
  "orange",
  "black",
  "white",
  "gray",
  "teal",
  "pink",
]

FORMAT_TERMS = ["png", "jpg", "jpeg", "svg", "webp", "mp4", "mov", "avi", "webm"]
TOOL_TERMS = ["graphics", "canvas", "logo", "website", "code", "model", "video", "timeline"]
DIMENSION_PATTERN = re.compile(r"(\d{2,5})\s*[x×]\s*(\d{2,5})")


class EntityExtractor:
  def __init__(self, nlp: Language) -> None:
    self.nlp = nlp
    self.matcher = Matcher(self.nlp.vocab)
    color_patterns = [[{"LOWER": term}] for term in COLOR_TERMS]
    format_patterns = [[{"LOWER": term}] for term in FORMAT_TERMS]
    tool_patterns = [[{"LOWER": term}] for term in TOOL_TERMS]
    self.matcher.add("COLOR", color_patterns)
    self.matcher.add("FORMAT", format_patterns)
    self.matcher.add("TOOL", tool_patterns)

  def extract(self, doc: Doc) -> Dict[str, str]:
    entities: Dict[str, str] = {}
    matches = self.matcher(doc)

    for match_id, start, end in matches:
      label = self.nlp.vocab.strings[match_id]
      token_text = doc[start:end].text.lower()
      if label == "COLOR":
        entities.setdefault("color", token_text)
      elif label == "FORMAT":
        entities.setdefault("format", token_text)
      elif label == "TOOL":
        entities.setdefault("toolHint", token_text)

    text = doc.text.lower()
    dimension_match = DIMENSION_PATTERN.search(text)
    if dimension_match:
      width, height = dimension_match.groups()
      entities["dimensions"] = f"{width}x{height}"

    for token in doc:
      next_token = doc[token.i + 1] if token.i + 1 < len(doc) else None
      if token.like_num and next_token and next_token.lower_ in {"px", "pixels"}:
        entities["sizePx"] = f"{token.text}{next_token.text}"
      if token.text.isdigit() and next_token and next_token.lower_ in {"minutes", "seconds", "fps"}:
        entities["timeHint"] = f"{token.text} {next_token.text}"

    return entities
