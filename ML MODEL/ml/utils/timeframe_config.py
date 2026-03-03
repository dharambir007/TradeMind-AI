from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple

TIMEFRAME_INTERVAL_SECONDS: Dict[str, int] = {
    "3m": 180,
    "5m": 300,
    "10m": 600,
}


@dataclass(frozen=True)
class TimeframeFeatureConfig:
    min_rows: int = 60
    return_periods: Tuple[int, ...] = (1, 2, 3, 5, 10)
    log_return_periods: Tuple[int, ...] = (1, 5)
    ma_windows: Tuple[int, ...] = (5, 10, 20, 50)
    volatility_windows: Tuple[int, ...] = (5, 10, 20)
    rolling_windows: Tuple[int, ...] = (5, 10, 20)
    lag_steps: Tuple[int, ...] = (1, 2, 3, 5)
    rsi_period: int = 14
    macd_fast: int = 12
    macd_slow: int = 26
    macd_signal: int = 9
    bb_window: int = 20
    atr_window: int = 14
    volume_window: int = 20


@dataclass(frozen=True)
class TimeframePredictionSettings:
    prediction_scale: str = "fraction"  # "fraction" or "percent"
    clamp_max_abs_return: Optional[float] = None
    confidence_floor: float = 0.30
    confidence_ceiling: float = 0.95
    confidence_baseline: float = 0.50
    confidence_gain: float = 0.35
    confidence_decay: float = 0.80
    confidence_lookback: int = 20
    min_confidence_points: int = 5
    default_future_steps: int = 3
    future_atr_period: int = 14
    future_spread_factor: float = 0.40
    smooth_transition: bool = True
    transition_tension: float = 0.35


@dataclass(frozen=True)
class TimeframeStrategy:
    timeframe: str
    model_file: str
    feature_config: TimeframeFeatureConfig = field(default_factory=TimeframeFeatureConfig)
    prediction_settings: TimeframePredictionSettings = field(
        default_factory=TimeframePredictionSettings
    )
    aliases: Tuple[str, ...] = field(default_factory=tuple)


DEFAULT_TIMEFRAME_STRATEGIES: Dict[str, TimeframeStrategy] = {
    "3m": TimeframeStrategy(
        timeframe="3m",
        model_file="model_3min.pkl",
        feature_config=TimeframeFeatureConfig(
            min_rows=60,
            return_periods=(1, 2, 3, 5, 10),
            log_return_periods=(1, 3),
            ma_windows=(3, 5, 10, 20),
            volatility_windows=(3, 5, 10),
            rolling_windows=(3, 5, 10),
            lag_steps=(1, 2, 3, 5),
            volume_window=10,
        ),
        prediction_settings=TimeframePredictionSettings(
            prediction_scale="fraction",
            clamp_max_abs_return=0.006,
            confidence_lookback=20,
        ),
        aliases=("3", "3min"),
    ),
    "5m": TimeframeStrategy(
        timeframe="5m",
        model_file="model_5min.pkl",
        feature_config=TimeframeFeatureConfig(
            min_rows=60,
            return_periods=(1, 2, 3, 5, 10),
            log_return_periods=(1, 5),
            ma_windows=(5, 10, 20, 50),
            volatility_windows=(5, 10, 20),
            rolling_windows=(5, 10, 20),
            lag_steps=(1, 2, 3, 5),
            volume_window=20,
        ),
        prediction_settings=TimeframePredictionSettings(
            prediction_scale="fraction",
            clamp_max_abs_return=0.010,
            confidence_lookback=20,
        ),
        aliases=("5", "5min"),
    ),
    "10m": TimeframeStrategy(
        timeframe="10m",
        model_file="model_10min.pkl",
        feature_config=TimeframeFeatureConfig(
            min_rows=60,
            return_periods=(1, 2, 3, 5, 10),
            log_return_periods=(1, 5, 10),
            ma_windows=(5, 10, 20, 50),
            volatility_windows=(5, 10, 20),
            rolling_windows=(5, 10, 20),
            lag_steps=(1, 2, 3, 5, 10),
            volume_window=20,
        ),
        prediction_settings=TimeframePredictionSettings(
            prediction_scale="fraction",
            clamp_max_abs_return=0.015,
            confidence_lookback=30,
        ),
        aliases=("10", "10min"),
    ),
}
