from typing import Any, Dict, List, Mapping, Optional, Sequence

import numpy as np
import pandas as pd

from ml.feature_engineering.base import BaseFeatureEngineer
from ml.utils.exceptions import InvalidMarketDataError


class TechnicalFeatureEngineer(BaseFeatureEngineer):
    """
    Default technical feature engineer for candle-based models.

    This implementation is deliberately compatible with the project's current
    OHLCV feature style and remains isolated from existing code paths.
    """

    REQUIRED_COLUMNS = ("open", "high", "low", "close")
    DEFAULT_FEATURE_CONFIG: Dict[str, Any] = {
        "min_rows": 60,
        "return_periods": (1, 2, 3, 5, 10),
        "log_return_periods": (1, 5),
        "ma_windows": (5, 10, 20, 50),
        "volatility_windows": (5, 10, 20),
        "rolling_windows": (5, 10, 20),
        "lag_steps": (1, 2, 3, 5),
        "rsi_period": 14,
        "macd_fast": 12,
        "macd_slow": 26,
        "macd_signal": 9,
        "bb_window": 20,
        "atr_window": 14,
        "volume_window": 20,
    }

    def __init__(self, min_rows: int = 60) -> None:
        self.min_rows = min_rows

    def transform(
        self,
        market_data: Sequence[Mapping[str, Any]],
        timeframe: str,
        feature_config: Optional[Any] = None,
    ) -> pd.DataFrame:
        cfg = self._resolve_feature_config(feature_config)
        df = self._to_dataframe(market_data, cfg)
        df = self._add_features(df, cfg)
        df = df.replace([np.inf, -np.inf], np.nan).dropna()

        if df.empty:
            raise InvalidMarketDataError("Feature engineering produced empty dataset")

        return df

    def align_for_model(self, features: pd.DataFrame, model: Any) -> pd.DataFrame:
        """
        Return the latest aligned feature row for inference.
        """
        latest = features.iloc[[-1]].copy()
        expected = self._extract_expected_columns(model)
        if expected is None:
            # If model does not expose feature names, use all columns as-is.
            return latest

        for col in expected:
            if col not in latest.columns:
                latest[col] = 0.0
        return latest[expected]

    def _to_dataframe(
        self, market_data: Sequence[Mapping[str, Any]], cfg: Mapping[str, Any]
    ) -> pd.DataFrame:
        if not market_data:
            raise InvalidMarketDataError("market_data is empty")

        df = pd.DataFrame(market_data).copy()
        df.columns = [str(c).lower().strip() for c in df.columns]

        missing = [c for c in self.REQUIRED_COLUMNS if c not in df.columns]
        if missing:
            raise InvalidMarketDataError(
                f"Missing required candle fields: {', '.join(missing)}"
            )

        if "volume" not in df.columns:
            df["volume"] = ((df["high"] - df["low"]) * 1000).clip(lower=1).astype(float)

        min_rows = int(cfg.get("min_rows", self.min_rows))
        if len(df) < min_rows:
            raise InvalidMarketDataError(
                f"At least {min_rows} candles required, got {len(df)}"
            )

        # Ensure numeric OHLCV
        for col in ("open", "high", "low", "close", "volume"):
            df[col] = pd.to_numeric(df[col], errors="coerce")

        return df.dropna(subset=["open", "high", "low", "close", "volume"])

    def _add_features(self, df: pd.DataFrame, cfg: Mapping[str, Any]) -> pd.DataFrame:
        return_periods = tuple(cfg.get("return_periods", (1, 2, 3, 5, 10)))
        log_return_periods = tuple(cfg.get("log_return_periods", (1, 5)))
        ma_windows = tuple(cfg.get("ma_windows", (5, 10, 20, 50)))
        volatility_windows = tuple(cfg.get("volatility_windows", (5, 10, 20)))
        rolling_windows = tuple(cfg.get("rolling_windows", (5, 10, 20)))
        lag_steps = tuple(cfg.get("lag_steps", (1, 2, 3, 5)))
        rsi_period = int(cfg.get("rsi_period", 14))
        macd_fast = int(cfg.get("macd_fast", 12))
        macd_slow = int(cfg.get("macd_slow", 26))
        macd_signal = int(cfg.get("macd_signal", 9))
        bb_window = int(cfg.get("bb_window", 20))
        atr_window = int(cfg.get("atr_window", 14))
        volume_window = int(cfg.get("volume_window", 20))

        # Price ratios
        df["hl_ratio"] = df["high"] / df["low"]
        df["co_ratio"] = df["close"] / df["open"]
        df["range"] = df["high"] - df["low"]
        df["range_pct"] = (df["high"] - df["low"]) / df["close"] * 100
        df["avg_price"] = (
            df["open"] + df["high"] + df["low"] + df["close"]
        ) / 4.0

        # Returns
        for p in return_periods:
            df[f"return_{p}"] = df["close"].pct_change(periods=p)
        for p in log_return_periods:
            df[f"log_return_{p}"] = np.log(df["close"] / df["close"].shift(p))

        # RSI
        delta = df["close"].diff()
        gain = delta.where(delta > 0, 0.0).rolling(rsi_period).mean()
        loss = (-delta.where(delta < 0, 0.0)).rolling(rsi_period).mean()
        rs = gain / loss.replace(0, np.nan)
        df["rsi"] = 100 - (100 / (1 + rs))

        # MACD
        ema12 = df["close"].ewm(span=macd_fast, adjust=False).mean()
        ema26 = df["close"].ewm(span=macd_slow, adjust=False).mean()
        df["macd"] = ema12 - ema26
        df["macd_signal"] = df["macd"].ewm(span=macd_signal, adjust=False).mean()
        df["macd_hist"] = df["macd"] - df["macd_signal"]

        # Moving averages and ratios
        for window in ma_windows:
            df[f"ma_{window}"] = df["close"].rolling(window).mean()
            df[f"ma_ratio_{window}"] = df["close"] / df[f"ma_{window}"]

        # Bollinger bands
        bb_mid = df["close"].rolling(bb_window).mean()
        bb_std = df["close"].rolling(bb_window).std()
        df["bb_upper"] = bb_mid + 2 * bb_std
        df["bb_lower"] = bb_mid - 2 * bb_std
        df["bb_pct"] = (df["close"] - df["bb_lower"]) / (
            df["bb_upper"] - df["bb_lower"]
        )

        # ATR
        tr1 = df["high"] - df["low"]
        tr2 = (df["high"] - df["close"].shift()).abs()
        tr3 = (df["low"] - df["close"].shift()).abs()
        df["atr"] = (
            pd.concat([tr1, tr2, tr3], axis=1).max(axis=1).rolling(atr_window).mean()
        )

        # Volatility and rolling stats
        for window in volatility_windows:
            df[f"volatility_{window}"] = df["close"].pct_change().rolling(window).std()
        for window in rolling_windows:
            df[f"rolling_mean_{window}"] = df["close"].rolling(window).mean()
            df[f"rolling_std_{window}"] = df["close"].rolling(window).std()
            df[f"rolling_min_{window}"] = df["close"].rolling(window).min()
            df[f"rolling_max_{window}"] = df["close"].rolling(window).max()

        # Lags
        for lag in lag_steps:
            df[f"close_lag_{lag}"] = df["close"].shift(lag)
            if "return_1" in df.columns:
                df[f"return_1_lag_{lag}"] = df["return_1"].shift(lag)
            df[f"volume_lag_{lag}"] = df["volume"].shift(lag)

        # Volume features
        df["volume_ma_ratio"] = df["volume"] / df["volume"].rolling(volume_window).mean()
        df["volume_change"] = df["volume"].pct_change()

        return df

    def _resolve_feature_config(self, feature_config: Optional[Any]) -> Dict[str, Any]:
        cfg = dict(self.DEFAULT_FEATURE_CONFIG)
        if feature_config is None:
            cfg["min_rows"] = self.min_rows
            return cfg

        if isinstance(feature_config, Mapping):
            cfg.update(dict(feature_config))
        else:
            cfg.update(vars(feature_config))

        return cfg

    @staticmethod
    def _extract_expected_columns(model: Any) -> Optional[List[str]]:
        if hasattr(model, "feature_names_in_"):
            return list(model.feature_names_in_)

        if hasattr(model, "named_steps"):
            inner = model.named_steps.get("model")
            if inner is not None and hasattr(inner, "feature_name_"):
                names = getattr(inner, "feature_name_", None)
                if names:
                    return list(names)

        return None
