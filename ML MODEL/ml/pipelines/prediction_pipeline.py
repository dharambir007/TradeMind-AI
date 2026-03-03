import time
from typing import Any, Dict, Mapping, Optional, Sequence, Tuple

import numpy as np
import pandas as pd

from ml.feature_engineering import BaseFeatureEngineer, TechnicalFeatureEngineer
from ml.models import ModelRegistry
from ml.pipelines.future_candle_generator import FutureCandleGenerator
from ml.utils.logging_utils import get_logger
from ml.utils.timeframe_config import (
    TimeframePredictionSettings,
    TimeframeStrategy,
)

logger = get_logger(__name__)


class PredictionPipeline:
    """
    Reusable and modular prediction pipeline.

    Public methods:
    - preprocess_data()
    - select_model()
    - predict()
    - postprocess_result()
    """

    SCALE_NORMALIZERS = {
        "fraction": lambda value: value,
        "percent": lambda value: value / 100.0,
    }

    def __init__(
        self,
        model_registry: Optional[ModelRegistry] = None,
        feature_engineer: Optional[BaseFeatureEngineer] = None,
        future_candle_generator: Optional[FutureCandleGenerator] = None,
    ) -> None:
        self.model_registry = model_registry or ModelRegistry()
        self.feature_engineer = feature_engineer or TechnicalFeatureEngineer()
        self.future_candle_generator = future_candle_generator or FutureCandleGenerator()

    def select_model(self, timeframe: str) -> Tuple[TimeframeStrategy, Any]:
        """
        Resolve timeframe strategy and corresponding cached model.
        """
        strategy = self.model_registry.get_strategy(timeframe)
        model = self.model_registry.get_model(strategy.timeframe)
        return strategy, model

    def preprocess_data(
        self,
        timeframe: str,
        market_data: Sequence[Mapping[str, Any]],
        model: Optional[Any] = None,
        strategy: Optional[TimeframeStrategy] = None,
    ) -> Dict[str, Any]:
        """
        Build model-ready input by delegating feature logic to feature_engineering module.
        """
        active_strategy = strategy or self.model_registry.get_strategy(timeframe)
        active_model = model or self.model_registry.get_model(active_strategy.timeframe)

        historical_data = self._standardize_historical_data(market_data)
        candles_df = pd.DataFrame(historical_data).copy()
        feature_frame = self.feature_engineer.transform(
            market_data=market_data,
            timeframe=active_strategy.timeframe,
            feature_config=active_strategy.feature_config,
        )
        model_input = self.feature_engineer.align_for_model(feature_frame, active_model)

        return {
            "strategy": active_strategy,
            "model": active_model,
            "candles_df": candles_df,
            "historical_data": historical_data,
            "feature_frame": feature_frame,
            "model_input": model_input,
        }

    def postprocess_result(
        self,
        timeframe: str,
        predicted_return: float,
        confidence: float,
    ) -> Dict[str, Any]:
        """
        Return normalized API response format.
        """
        prediction_label = "UP" if predicted_return >= 0 else "DOWN"
        confidence_pct = int(round(float(confidence) * 100))
        return {
            "prediction": prediction_label,
            "confidence": confidence_pct,
            "timeframe": timeframe,
        }

    def predict(
        self,
        timeframe: str,
        market_data: Sequence[Mapping[str, Any]],
        include_future_candles: bool = True,
        future_steps: Optional[int] = None,
        include_metadata: bool = False,
    ) -> Dict[str, Any]:
        """
        Execute complete pipeline:
        1) select_model
        2) preprocess_data
        3) model.predict
        4) postprocess_result
        """
        started_at = time.perf_counter()
        strategy, model = self.select_model(timeframe)
        preprocessed = self.preprocess_data(
            timeframe=timeframe,
            market_data=market_data,
            model=model,
            strategy=strategy,
        )

        raw_prediction = float(model.predict(preprocessed["model_input"])[0])
        predicted_return = self._normalize_prediction(
            raw_prediction, strategy.prediction_settings
        )
        predicted_return = self._apply_prediction_clamp(
            predicted_return, strategy.prediction_settings
        )

        candles_df = preprocessed["candles_df"]
        close_series = pd.to_numeric(candles_df["close"], errors="coerce")
        confidence = self._compute_confidence(
            predicted_return,
            close_series,
            strategy.prediction_settings,
        )
        response = self.postprocess_result(
            timeframe=strategy.timeframe,
            predicted_return=predicted_return,
            confidence=confidence,
        )
        response["historicalData"] = preprocessed["historical_data"]
        response["predictedData"] = []

        elapsed_ms = (time.perf_counter() - started_at) * 1000.0
        if include_metadata:
            response["latency_ms"] = round(elapsed_ms, 2)

        if include_future_candles and preprocessed["historical_data"]:
            steps = future_steps or strategy.prediction_settings.default_future_steps
            response["predictedData"] = self.future_candle_generator.generate(
                historical_candles=preprocessed["historical_data"],
                predicted_direction=response["prediction"],
                predicted_value=predicted_return,
                timeframe=strategy.timeframe,
                steps=steps,
                value_type="return",
                prediction_scale="fraction",
                spread_factor=strategy.prediction_settings.future_spread_factor,
                atr_period=strategy.prediction_settings.future_atr_period,
                smooth_transition=strategy.prediction_settings.smooth_transition,
                transition_tension=strategy.prediction_settings.transition_tension,
            )

        logger.info(
            "Prediction complete | timeframe=%s prediction=%s confidence=%s latency=%.2fms",
            strategy.timeframe,
            response["prediction"],
            response["confidence"],
            elapsed_ms,
        )
        return response

    @staticmethod
    def _standardize_historical_data(
        market_data: Sequence[Mapping[str, Any]]
    ) -> list[dict[str, Any]]:
        standardized = []
        for candle in market_data:
            row = dict(candle)
            normalized = {str(k).lower().strip(): v for k, v in row.items()}

            candle_time = PredictionPipeline._extract_time_seconds(normalized)
            open_ = PredictionPipeline._safe_float(normalized.get("open"))
            high = PredictionPipeline._safe_float(normalized.get("high"))
            low = PredictionPipeline._safe_float(normalized.get("low"))
            close = PredictionPipeline._safe_float(normalized.get("close"))
            volume = PredictionPipeline._safe_float(normalized.get("volume"))

            if candle_time is None or None in (open_, high, low, close):
                continue

            point = {
                "time": int(candle_time),
                "open": open_,
                "high": high,
                "low": low,
                "close": close,
            }
            if volume is not None:
                point["volume"] = volume
            standardized.append(point)

        return standardized

    @staticmethod
    def _extract_time_seconds(candle: Mapping[str, Any]) -> Optional[int]:
        time_value = candle.get("time", candle.get("date"))
        if time_value is None:
            return None

        if isinstance(time_value, (int, float, np.integer, np.floating)):
            numeric = int(time_value)
            return numeric // 1000 if numeric > 10**11 else numeric

        try:
            return int(pd.Timestamp(time_value).timestamp())
        except Exception:
            return None

    @staticmethod
    def _safe_float(value: Any) -> Optional[float]:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def _normalize_prediction(
        self,
        raw_prediction: float,
        settings: TimeframePredictionSettings,
    ) -> float:
        normalizer = self.SCALE_NORMALIZERS.get(
            settings.prediction_scale, self.SCALE_NORMALIZERS["fraction"]
        )
        return float(normalizer(raw_prediction))

    @staticmethod
    def _apply_prediction_clamp(
        predicted_return: float,
        settings: TimeframePredictionSettings,
    ) -> float:
        if settings.clamp_max_abs_return is None:
            return predicted_return
        return float(
            np.clip(
                predicted_return,
                -settings.clamp_max_abs_return,
                settings.clamp_max_abs_return,
            )
        )

    @staticmethod
    def _compute_confidence(
        predicted_return: float,
        close_series: pd.Series,
        settings: TimeframePredictionSettings,
    ) -> float:
        close = pd.to_numeric(close_series, errors="coerce").dropna()
        if len(close) < settings.confidence_lookback:
            return settings.confidence_baseline

        returns = close.pct_change().dropna().tail(settings.confidence_lookback)
        if len(returns) < settings.min_confidence_points:
            return settings.confidence_baseline

        vol = float(returns.std())
        if vol <= 0 or np.isnan(vol):
            return settings.confidence_baseline

        snr = abs(predicted_return) / vol
        confidence = settings.confidence_baseline + settings.confidence_gain * (
            1 - np.exp(-snr * settings.confidence_decay)
        )
        return float(
            np.clip(
                confidence,
                settings.confidence_floor,
                settings.confidence_ceiling,
            )
        )
