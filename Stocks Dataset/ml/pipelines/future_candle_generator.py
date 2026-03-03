import time
from typing import Any, Dict, List, Mapping, Sequence

import numpy as np
import pandas as pd

from ml.utils.timeframe_config import TIMEFRAME_INTERVAL_SECONDS


class FutureCandleGenerator:
    """
    Generate chart-ready future candles for any supported timeframe.

    Inputs:
    - historical candles
    - predicted direction/value
    - timeframe (e.g. 3m, 5m, 10m)
    """

    def generate(
        self,
        historical_candles: Sequence[Mapping[str, Any]],
        predicted_direction: str,
        predicted_value: float,
        timeframe: str,
        steps: int = 3,
        value_type: str = "return",
        prediction_scale: str = "fraction",
        spread_factor: float = 0.40,
        atr_period: int = 14,
        smooth_transition: bool = True,
        transition_tension: float = 0.35,
    ) -> List[Dict[str, Any]]:
        if not historical_candles:
            return []

        steps = max(1, int(steps))
        df = self._to_dataframe(historical_candles)
        increment_seconds = self._timeframe_to_seconds(timeframe)

        last_ts = self._extract_last_timestamp(df)
        current_close = float(df["close"].iloc[-1])
        atr = self._compute_atr(df, period=atr_period)
        has_volume = "volume" in df.columns and not df["volume"].isna().all()
        last_volume = float(df["volume"].iloc[-1]) if has_volume else None

        step_return = self._resolve_step_return(
            predicted_value=predicted_value,
            predicted_direction=predicted_direction,
            current_close=current_close,
            steps=steps,
            value_type=value_type,
            prediction_scale=prediction_scale,
        )
        step_returns = self._build_continuation_returns(
            base_step_return=step_return,
            close_series=df["close"],
            steps=steps,
            smooth_transition=smooth_transition,
            transition_tension=transition_tension,
        )

        future = []
        prev_close = current_close
        for step_index in range(1, steps + 1):
            step_ret = step_returns[step_index - 1]
            next_open = prev_close
            next_close = prev_close * (1.0 + step_ret)
            half_spread = atr * spread_factor

            if next_close >= next_open:
                next_high = max(next_close, next_open) + half_spread * 0.5
                next_low = min(next_close, next_open) - half_spread * 0.3
            else:
                next_high = max(next_close, next_open) + half_spread * 0.3
                next_low = min(next_close, next_open) - half_spread * 0.5

            candle = {
                "time": int(last_ts + step_index * increment_seconds),
                "open": round(float(next_open), 6),
                "high": round(float(next_high), 6),
                "low": round(float(next_low), 6),
                "close": round(float(next_close), 6),
            }
            if has_volume:
                candle["volume"] = round(float(last_volume), 6)
            future.append(candle)
            prev_close = next_close

        return future

    @staticmethod
    def _to_dataframe(candles: Sequence[Mapping[str, Any]]) -> pd.DataFrame:
        df = pd.DataFrame(candles).copy()
        df.columns = [str(c).lower().strip() for c in df.columns]
        for col in ("open", "high", "low", "close"):
            df[col] = pd.to_numeric(df[col], errors="coerce")
        if "volume" in df.columns:
            df["volume"] = pd.to_numeric(df["volume"], errors="coerce")
        return df.dropna(subset=["open", "high", "low", "close"]).reset_index(drop=True)

    @staticmethod
    def _compute_atr(df: pd.DataFrame, period: int = 14) -> float:
        highs = df["high"].astype(float)
        lows = df["low"].astype(float)
        closes = df["close"].astype(float)
        if len(df) < 2:
            return float(max(highs.iloc[-1] - lows.iloc[-1], 1e-9))

        tr1 = highs - lows
        tr2 = (highs - closes.shift(1)).abs()
        tr3 = (lows - closes.shift(1)).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1).dropna()
        if tr.empty:
            return float(max(highs.iloc[-1] - lows.iloc[-1], 1e-9))

        lookback = min(period, len(tr))
        atr = float(tr.tail(lookback).mean())
        return max(atr, 1e-9)

    @staticmethod
    def _extract_last_timestamp(df: pd.DataFrame) -> int:
        if "time" in df.columns:
            last_time = df["time"].iloc[-1]
            if isinstance(last_time, (int, float, np.integer, np.floating)):
                # Support both seconds and milliseconds.
                value = int(last_time)
                return value // 1000 if value > 10**11 else value
            try:
                return int(pd.Timestamp(last_time).timestamp())
            except Exception:
                pass

        if "date" in df.columns:
            try:
                return int(pd.Timestamp(df["date"].iloc[-1]).timestamp())
            except Exception:
                pass

        return int(time.time())

    def _resolve_step_return(
        self,
        predicted_value: float,
        predicted_direction: str,
        current_close: float,
        steps: int,
        value_type: str,
        prediction_scale: str,
    ) -> float:
        sign = 1.0 if str(predicted_direction).upper() == "UP" else -1.0
        value = float(predicted_value)

        if value_type == "target_price":
            if current_close <= 0:
                return 0.0
            total_return = (value - current_close) / current_close
            return float(total_return / max(steps, 1))

        # value_type == "return"
        normalized = value / 100.0 if prediction_scale == "percent" else value
        normalized = abs(normalized) * sign
        return float(normalized)

    @staticmethod
    def _build_continuation_returns(
        base_step_return: float,
        close_series: pd.Series,
        steps: int,
        smooth_transition: bool = True,
        transition_tension: float = 0.35,
    ) -> List[float]:
        """
        Build a smooth continuation return path from the last real candle.

        Guarantees:
        - Starts from last historical close (via candle open=prev_close in caller)
        - Reduces abrupt first predicted jump using recent volatility context
        - Preserves overall move by redistributing any clipped first-step delta
        """
        if steps <= 1:
            return [float(base_step_return)]

        returns = np.full(shape=(steps,), fill_value=float(base_step_return), dtype=float)

        if smooth_transition:
            # Front-load continuity: smaller first step, larger later steps.
            tension = float(np.clip(transition_tension, 0.0, 0.9))
            weights = np.linspace(1.0 - tension, 1.0 + tension, steps)
            weights = weights / weights.mean()
            returns = returns * weights

        vol = float(pd.to_numeric(close_series, errors="coerce").pct_change().dropna().tail(30).std())
        if np.isnan(vol) or vol <= 0:
            return returns.tolist()

        # Soft cap for first predicted move to avoid unnatural discontinuity.
        soft_limit = max(vol * 2.5, 1e-6)
        signal_ratio = abs(base_step_return) / soft_limit
        allowed_multiplier = float(np.clip(signal_ratio, 1.0, 3.0))
        max_first_abs = soft_limit * allowed_multiplier

        first = returns[0]
        if abs(first) > max_first_abs:
            clipped_first = np.sign(first) * max_first_abs
            delta = first - clipped_first
            returns[0] = clipped_first
            returns[1:] = returns[1:] + (delta / (steps - 1))

        return returns.tolist()

    @staticmethod
    def _timeframe_to_seconds(timeframe: str) -> int:
        key = str(timeframe).strip().lower()
        interval = TIMEFRAME_INTERVAL_SECONDS.get(key)
        if interval is None:
            supported = ", ".join(sorted(TIMEFRAME_INTERVAL_SECONDS.keys()))
            raise ValueError(
                f"Unsupported timeframe '{timeframe}'. Supported: {supported}"
            )
        return int(interval)
