from pathlib import Path
from typing import Any, Callable, Dict, Mapping, Optional, Tuple

import joblib

from ml.utils.exceptions import (
    ModelLoadError,
    ModelNotFoundError,
    TimeframeNotSupportedError,
)
from ml.utils.logging_utils import get_logger
from ml.utils.timeframe_config import (
    DEFAULT_TIMEFRAME_STRATEGIES,
    TimeframeFeatureConfig,
    TimeframePredictionSettings,
    TimeframeStrategy,
)

logger = get_logger(__name__)


class ModelRegistry:
    """
    Central model manager for multi-timeframe inference.

    Features:
    - Timeframe strategy mapping (model path + feature config + prediction settings)
    - Lazy loading with in-memory cache
    - Optional eager loading
    - Timeframe normalization for stable API input
    """

    def __init__(
        self,
        model_dir: Optional[Path] = None,
        strategies: Optional[Mapping[str, Any]] = None,
        timeframe_to_model: Optional[Mapping[str, str]] = None,
        loader: Optional[Callable[[Path], Any]] = None,
        eager_load: bool = False,
    ) -> None:
        self.model_dir = Path(model_dir or Path(__file__).resolve().parent)
        self._loader = loader or joblib.load
        self._models: Dict[str, Any] = {}
        self._strategies: Dict[str, TimeframeStrategy] = {}
        self._alias_to_timeframe: Dict[str, str] = {}

        strategy_source = self._resolve_strategy_source(strategies, timeframe_to_model)
        for strategy in strategy_source.values():
            self.register_strategy(strategy, clear_cache=False)

        if eager_load:
            self.load_all()

    @property
    def supported_timeframes(self) -> Tuple[str, ...]:
        return tuple(sorted(self._strategies.keys(), key=self._timeframe_sort_key))

    def register_strategy(self, strategy: TimeframeStrategy, clear_cache: bool = True) -> None:
        """
        Register or replace a full timeframe strategy.
        """
        canonical = self._normalize_timeframe(strategy.timeframe)
        normalized_strategy = TimeframeStrategy(
            timeframe=canonical,
            model_file=strategy.model_file,
            feature_config=strategy.feature_config,
            prediction_settings=strategy.prediction_settings,
            aliases=tuple(strategy.aliases),
        )

        self._strategies[canonical] = normalized_strategy
        self._alias_to_timeframe[canonical] = canonical
        for alias in normalized_strategy.aliases:
            self._alias_to_timeframe[self._normalize_timeframe(alias)] = canonical

        if clear_cache:
            self._models.pop(canonical, None)

        logger.info(
            "Registered strategy for timeframe '%s' -> model '%s'",
            canonical,
            normalized_strategy.model_file,
        )

    def register_timeframe(
        self,
        timeframe: str,
        model_file: str,
        feature_config: Optional[TimeframeFeatureConfig] = None,
        prediction_settings: Optional[TimeframePredictionSettings] = None,
        aliases: Tuple[str, ...] = (),
    ) -> None:
        """
        Convenience helper for registering a timeframe from raw values.
        """
        strategy = TimeframeStrategy(
            timeframe=timeframe,
            model_file=model_file,
            feature_config=feature_config or TimeframeFeatureConfig(),
            prediction_settings=prediction_settings or TimeframePredictionSettings(),
            aliases=aliases,
        )
        self.register_strategy(strategy)

    def get_strategy(self, timeframe: str) -> TimeframeStrategy:
        tf = self._resolve_timeframe(timeframe)
        return self._strategies[tf]

    def get_model(self, timeframe: str) -> Any:
        """
        Return cached model if available, otherwise load once and cache it.
        """
        tf = self._resolve_timeframe(timeframe)
        strategy = self._strategies[tf]

        if tf in self._models:
            return self._models[tf]

        model_path = self.model_dir / strategy.model_file
        if not model_path.exists():
            raise ModelNotFoundError(
                f"Model file not found for timeframe '{tf}': {model_path}"
            )

        try:
            model = self._loader(model_path)
        except Exception as exc:  # pragma: no cover
            raise ModelLoadError(
                f"Failed to load model for timeframe '{tf}' from '{model_path}'"
            ) from exc

        self._models[tf] = model
        logger.info("Loaded model for timeframe '%s' from %s", tf, model_path)
        return model

    def load_all(self) -> None:
        for tf in self.supported_timeframes:
            self.get_model(tf)

    def clear_cache(self) -> None:
        self._models.clear()
        logger.info("Cleared model cache")

    @staticmethod
    def _normalize_timeframe(timeframe: str) -> str:
        return str(timeframe).strip().lower()

    @staticmethod
    def _timeframe_sort_key(value: str) -> int:
        return int("".join(ch for ch in value if ch.isdigit()) or "0")

    def _resolve_timeframe(self, timeframe: str) -> str:
        normalized = self._normalize_timeframe(timeframe)
        canonical = self._alias_to_timeframe.get(normalized, normalized)
        if canonical not in self._strategies:
            raise TimeframeNotSupportedError(
                f"Unsupported timeframe '{timeframe}'. "
                f"Supported: {', '.join(self.supported_timeframes)}"
            )
        return canonical

    def _resolve_strategy_source(
        self,
        strategies: Optional[Mapping[str, Any]],
        timeframe_to_model: Optional[Mapping[str, str]],
    ) -> Mapping[str, TimeframeStrategy]:
        if strategies:
            return {
                self._normalize_timeframe(key): self._coerce_strategy(key, value)
                for key, value in strategies.items()
            }

        if timeframe_to_model:
            # Backward-compatible fallback for callers that pass raw model mapping.
            return {
                self._normalize_timeframe(key): TimeframeStrategy(
                    timeframe=key,
                    model_file=model_file,
                )
                for key, model_file in timeframe_to_model.items()
            }

        return DEFAULT_TIMEFRAME_STRATEGIES

    @staticmethod
    def _coerce_strategy(timeframe: str, value: Any) -> TimeframeStrategy:
        if isinstance(value, TimeframeStrategy):
            return value

        if isinstance(value, Mapping):
            feature_cfg = value.get("feature_config")
            prediction_cfg = value.get("prediction_settings")

            if isinstance(feature_cfg, Mapping):
                feature_cfg = TimeframeFeatureConfig(**feature_cfg)
            if isinstance(prediction_cfg, Mapping):
                prediction_cfg = TimeframePredictionSettings(**prediction_cfg)

            return TimeframeStrategy(
                timeframe=timeframe,
                model_file=value["model_file"],
                feature_config=feature_cfg or TimeframeFeatureConfig(),
                prediction_settings=prediction_cfg or TimeframePredictionSettings(),
                aliases=tuple(value.get("aliases", ())),
            )

        raise TypeError(
            "Strategy values must be TimeframeStrategy or mapping definitions"
        )
