from dataclasses import asdict, dataclass
from typing import Any, Dict


@dataclass(frozen=True)
class PredictionResult:
    timeframe: str
    prediction: float
    confidence: float
    direction: str
    current_price: float
    target_price: float
    processing_time_ms: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
