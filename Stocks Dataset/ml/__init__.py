"""
Production ML package for multi-timeframe inference.

This package is intentionally isolated from existing project logic.
"""

from .pipelines.prediction_pipeline import PredictionPipeline
from .pipelines.future_candle_generator import FutureCandleGenerator
from .models.model_registry import ModelRegistry
from .utils.timeframe_config import (
    DEFAULT_TIMEFRAME_STRATEGIES,
    TimeframeFeatureConfig,
    TimeframePredictionSettings,
    TimeframeStrategy,
)

__all__ = [
    "DEFAULT_TIMEFRAME_STRATEGIES",
    "ModelRegistry",
    "PredictionPipeline",
    "FutureCandleGenerator",
    "TimeframeFeatureConfig",
    "TimeframePredictionSettings",
    "TimeframeStrategy",
]
