"""Stock prediction FastAPI service."""

import os
from dotenv import load_dotenv
load_dotenv()  # Load .env before anything reads env vars

os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

import time
import joblib
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Tuple
from contextlib import asynccontextmanager

import config
import utils
from predict_api import engineer_features_from_candles

logger = utils.setup_logger("ml_fastapi")

TIMEFRAME_MODEL_FILES = {
    "3m": "model_3min.pkl",
    "5m": "model_5min.pkl",
    "10m": "model_10min.pkl",
}
TIMEFRAME_FEATURE_FILES = {
    "3m": "features_3min.txt",
    "5m": "features_5min.txt",
    "10m": "features_10min.txt",
}
FALLBACK_TIMEFRAME = "5m"
LEGACY_MODEL_FILE = "model_2min.pkl"
LEGACY_FEATURE_FILE = "features_2min.txt"

pipelines: Dict[str, Any] = {}
feature_lists: Dict[str, List[str]] = {}


class Candle(BaseModel):
    open: float
    high: float
    low: float
    close: float
    volume: float
    date: str

class PredictionRequest(BaseModel):
    candles: List[Candle]
    horizon: int = 5

class PredictionResponse(BaseModel):
    prediction: float
    direction: str
    probability: float = 0.0
    processing_time_ms: float

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pipelines, feature_lists
    logger.info("Loading model...")
    try:
        pipelines = {}
        feature_lists = {}

        for timeframe, model_file in TIMEFRAME_MODEL_FILES.items():
            model_path = config.OUTPUT_DIR / model_file
            feature_path = config.OUTPUT_DIR / TIMEFRAME_FEATURE_FILES[timeframe]

            if not model_path.exists():
                logger.warning("Model file missing for %s: %s", timeframe, model_path)
                continue

            pipelines[timeframe] = joblib.load(model_path)
            logger.info("Loaded %s model from %s", timeframe, model_path)

            if feature_path.exists():
                features = feature_path.read_text().strip().split('\n')
                feature_lists[timeframe] = [f.strip() for f in features if f.strip()]
                logger.info(
                    "Loaded %s feature list (%s features)",
                    timeframe,
                    len(feature_lists[timeframe]),
                )
            else:
                logger.warning("Feature list missing for %s: %s", timeframe, feature_path)

        if not pipelines:
            legacy_model_path = config.OUTPUT_DIR / LEGACY_MODEL_FILE
            legacy_feature_path = config.OUTPUT_DIR / LEGACY_FEATURE_FILE

            if legacy_model_path.exists():
                pipelines[FALLBACK_TIMEFRAME] = joblib.load(legacy_model_path)
                logger.warning(
                    "No timeframe-specific minute models found; using legacy fallback %s for %s",
                    legacy_model_path,
                    FALLBACK_TIMEFRAME,
                )
                if legacy_feature_path.exists():
                    features = legacy_feature_path.read_text().strip().split('\n')
                    feature_lists[FALLBACK_TIMEFRAME] = [f.strip() for f in features if f.strip()]
            elif config.MODEL_PATH.exists():
                pipelines[FALLBACK_TIMEFRAME] = joblib.load(config.MODEL_PATH)
                logger.warning(
                    "Minute models not found, fell back to daily model %s for %s",
                    config.MODEL_PATH,
                    FALLBACK_TIMEFRAME,
                )
            else:
                raise RuntimeError("No model file found")

        logger.info("Warming up model...")
        warmup_data = pd.DataFrame([{
            'open': 100.0, 'high': 105.0, 'low': 95.0, 'close': 102.0, 'volume': 1000,
            'date': '2023-01-01 10:00:00'
        }] * 60)

        try:
            for timeframe in pipelines.keys():
                _ = _predict_logic(warmup_data, 5, timeframe=timeframe)
            logger.info("Model warm-up complete for %s", ", ".join(sorted(pipelines.keys())))
        except Exception as e:
            logger.warning(f"Warm-up failed (non-critical): {e}")

    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise RuntimeError("Could not load model")

    yield

    pipelines = {}
    feature_lists = {}

app = FastAPI(lifespan=lifespan)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5000,http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _align_features(
    row: pd.DataFrame,
    model: Any,
    expected_features: Optional[List[str]] = None,
    df: pd.DataFrame = None,
) -> pd.DataFrame:
    """Align features to match model expectations."""
    rename_map = {}
    if 'ma_10' in row.columns and 'MA_10' not in row.columns:
        rename_map['ma_10'] = 'MA_10'
    if 'ma_50' in row.columns and 'MA_50' not in row.columns:
        rename_map['ma_50'] = 'MA_50'
    if rename_map:
        row = row.rename(columns=rename_map)

    if 'hl_ratio' not in row.columns:
        row['hl_ratio'] = row['high'] / row['low']
    if 'co_ratio' not in row.columns:
        row['co_ratio'] = row['close'] / row['open']
    if 'oc_ratio' not in row.columns:
        row['oc_ratio'] = row['open'] / row['close']
    if 'hc_ratio' not in row.columns:
        row['hc_ratio'] = row['high'] / row['close']
    if 'lc_ratio' not in row.columns:
        row['lc_ratio'] = row['low'] / row['close']
    if 'log_volume' not in row.columns:
        row['log_volume'] = np.log1p(row['volume'])
    if 'bb_middle' not in row.columns:
        if 'ma_20' in row.columns:
            row['bb_middle'] = row['ma_20']
        elif df is not None and len(df) >= 20:
            row['bb_middle'] = df['close'].rolling(20).mean().iloc[-1]
        else:
            row['bb_middle'] = row['close'].values[0] if len(row) > 0 else 0

    if expected_features:
        for feat in expected_features:
            if feat not in row.columns:
                row[feat] = 0.0
        row = row[expected_features]
    elif hasattr(model, 'feature_names_in_'):
        expected = list(model.feature_names_in_)
        for feat in expected:
            if feat not in row.columns:
                row[feat] = 0.0
        row = row[expected]

    return row


def _resolve_timeframe_key(
    timeframe: Optional[str] = None,
    horizon: Optional[int] = None,
    interval_seconds: Optional[int] = None,
) -> str:
    candidates = []

    tf = str(timeframe or "").strip().lower()
    if tf in pipelines:
        candidates.append(tf)

    if isinstance(horizon, int) and horizon > 0:
        horizon_key = f"{horizon}m"
        if horizon_key in pipelines:
            candidates.append(horizon_key)

    interval_map = {
        180: "3m",
        300: "5m",
        600: "10m",
    }
    mapped_interval = interval_map.get(int(interval_seconds)) if interval_seconds else None
    if mapped_interval in pipelines:
        candidates.append(mapped_interval)

    for candidate in candidates:
        if candidate in pipelines:
            return candidate

    if FALLBACK_TIMEFRAME in pipelines:
        return FALLBACK_TIMEFRAME

    if pipelines:
        return next(iter(sorted(pipelines.keys())))

    raise RuntimeError("No prediction models loaded")


def _get_model_bundle(
    timeframe: Optional[str] = None,
    horizon: Optional[int] = None,
    interval_seconds: Optional[int] = None,
) -> Tuple[str, Any, Optional[List[str]]]:
    timeframe_key = _resolve_timeframe_key(
        timeframe=timeframe,
        horizon=horizon,
        interval_seconds=interval_seconds,
    )
    return timeframe_key, pipelines[timeframe_key], feature_lists.get(timeframe_key)


def _compute_confidence(pred_return: float, df: pd.DataFrame) -> float:
    if df is None or len(df) < 20:
        return 0.5

    recent_returns = df['close'].pct_change().dropna().tail(20)
    if len(recent_returns) < 5:
        return 0.5

    vol = recent_returns.std()
    if vol <= 0 or np.isnan(vol):
        return 0.5

    snr = abs(pred_return) / vol

    confidence = 0.50 + 0.35 * (1 - np.exp(-snr * 0.8))

    return round(min(max(confidence, 0.30), 0.95), 3)


def _clamp_return(pred_return: float, max_pct: float = 0.005) -> float:
    return float(np.clip(pred_return, -max_pct, max_pct))


def _predict_logic(
    df: pd.DataFrame,
    horizon: int,
    timeframe: Optional[str] = None,
    interval_seconds: Optional[int] = None,
):
    X = engineer_features_from_candles(df)

    if X.empty:
        raise ValueError("Insufficient data for feature engineering")

    timeframe_key, model, expected_features = _get_model_bundle(
        timeframe=timeframe,
        horizon=horizon,
        interval_seconds=interval_seconds,
    )
    latest_X = X.iloc[[-1]].copy()
    latest_X = _align_features(latest_X, model, expected_features, df)

    pred = model.predict(latest_X)[0]
    logger.info("Using model timeframe %s for horizon=%s interval=%s", timeframe_key, horizon, interval_seconds)
    return _clamp_return(float(pred))

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "model_loaded": bool(pipelines),
        "loaded_models": sorted(pipelines.keys()),
    }

@app.post("/predict", response_model=PredictionResponse)
async def predict_endpoint(request: PredictionRequest):
    start_time = time.perf_counter()

    if not pipelines:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        data = [c.model_dump() for c in request.candles]
        df = pd.DataFrame(data)

        pred_return = _predict_logic(df, request.horizon)

        direction = "UP" if pred_return > 0 else "DOWN"

        confidence = _compute_confidence(pred_return, df)

        end_time = time.perf_counter()
        processing_time = (end_time - start_time) * 1000

        return {
            "prediction": pred_return,
            "direction": direction,
            "probability": confidence,
            "processing_time_ms": round(processing_time, 2)
        }

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction error: {type(e).__name__}: {e}")


# multi-step candle prediction

class PredictionCandlesRequest(BaseModel):
    candles: List[Candle]
    steps: int = 3
    timeframe: Optional[str] = None
    interval_seconds: Optional[int] = None
    pullback_probability: float = 0.35
    volatility_scale: float = 1.0

class PredictedCandle(BaseModel):
    time: int
    open: float
    high: float
    low: float
    close: float
    confidence: float
    step: int

class PredictionCandlesResponse(BaseModel):
    predicted_candles: List[PredictedCandle]
    direction: str
    confidence: float
    current_price: float
    target_price: float
    processing_time_ms: float

_TIMEFRAME_INTERVAL_SECONDS = {
    "1m": 60,
    "2m": 120,
    "3m": 180,
    "5m": 300,
    "10m": 600,
    "15m": 900,
    "30m": 1800,
    "1h": 3600,
    "4h": 14400,
}


def _compute_atr_fast(highs, lows, closes, period: int = 14) -> float:
    """Compute ATR from numpy arrays."""
    if len(highs) < 2:
        return abs(float(highs[-1]) - float(lows[-1]))
    tr1 = highs - lows
    tr2 = np.abs(highs[1:] - closes[:-1])
    tr3 = np.abs(lows[1:] - closes[:-1])
    tr = np.maximum(np.maximum(tr1[1:], tr2), tr3)
    n = min(period, len(tr))
    return max(float(np.mean(tr[-n:])), 1e-9)


def _safe_timestamp_to_seconds(value: Any) -> Optional[int]:
    if isinstance(value, (int, float, np.integer, np.floating)):
        raw = int(value)
        return raw // 1000 if raw > 10**11 else raw
    try:
        ts = pd.Timestamp(value)
        if pd.isna(ts):
            return None
        return int(ts.timestamp())
    except Exception:
        return None


def _resolve_interval_seconds(df: pd.DataFrame, request: PredictionCandlesRequest) -> int:
    requested = request.interval_seconds
    if isinstance(requested, int) and requested > 0:
        return requested

    tf_key = str(request.timeframe or "").strip().lower()
    if tf_key in _TIMEFRAME_INTERVAL_SECONDS:
        return _TIMEFRAME_INTERVAL_SECONDS[tf_key]

    inferred = None
    if "date" in df.columns:
        dt = pd.to_datetime(df["date"], errors="coerce", utc=True)
        sec = (dt.dropna().astype("int64") // 10**9).astype("int64")
        diffs = sec.diff().dropna()
        diffs = diffs[diffs > 0]
        if not diffs.empty:
            inferred = int(np.median(diffs.tail(30).values))

    if inferred is None and "time" in df.columns:
        ts = pd.to_numeric(df["time"], errors="coerce").dropna().astype("int64")
        ts = ts.apply(lambda v: v // 1000 if v > 10**11 else v)
        diffs = ts.diff().dropna()
        diffs = diffs[diffs > 0]
        if not diffs.empty:
            inferred = int(np.median(diffs.tail(30).values))

    if inferred is not None and 30 <= inferred <= 86400:
        return inferred
    return 60


def _coerce_probability(value: float, default: float = 0.35) -> float:
    try:
        n = float(value)
    except Exception:
        return default
    if np.isnan(n):
        return default
    return float(np.clip(n, 0.20, 0.60))


def _coerce_volatility_scale(value: float, default: float = 1.0) -> float:
    try:
        n = float(value)
    except Exception:
        return default
    if np.isnan(n):
        return default
    return float(np.clip(n, 0.6, 1.8))


def _normalize_confidence_percent(value: float) -> float:
    n = float(value) if np.isfinite(value) else 50.0
    if n <= 1:
        n *= 100.0
    return float(np.clip(n, 30.0, 95.0))


def _compute_market_state(df: pd.DataFrame) -> Dict[str, float]:
    highs = pd.to_numeric(df["high"], errors="coerce").values.astype(float)
    lows = pd.to_numeric(df["low"], errors="coerce").values.astype(float)
    closes = pd.to_numeric(df["close"], errors="coerce").values.astype(float)

    current_close = float(closes[-1])
    atr = _compute_atr_fast(highs, lows, closes)
    atr_pct = atr / max(current_close, 1e-6)

    close_series = pd.Series(closes, dtype=float)
    returns = close_series.pct_change().dropna()
    recent_returns = returns.tail(60)
    volatility = float(recent_returns.tail(30).std()) if len(recent_returns) >= 3 else 0.0

    if not np.isfinite(volatility) or volatility <= 0:
        volatility = max(atr_pct * 0.25, 0.0008)

    drift = float(recent_returns.tail(8).mean()) if len(recent_returns) >= 2 else 0.0

    slope = 0.0
    lookback = min(len(closes) - 1, 20)
    if lookback > 0:
        base = float(closes[-1 - lookback])
        if base > 0:
            slope = ((float(closes[-1]) - base) / base) / lookback

    structure_sign = 0.0
    if len(highs) >= 12 and len(lows) >= 12:
        recent_high = float(np.max(highs[-4:]))
        prev_high = float(np.max(highs[-12:-4]))
        recent_low = float(np.min(lows[-4:]))
        prev_low = float(np.min(lows[-12:-4]))
        if recent_high >= prev_high and recent_low >= prev_low:
            structure_sign = 1.0
        elif recent_high <= prev_high and recent_low <= prev_low:
            structure_sign = -1.0

    return {
        "atr": float(atr),
        "atr_pct": float(atr_pct),
        "volatility": float(volatility),
        "drift": float(drift),
        "slope": float(slope),
        "structure_sign": float(structure_sign),
        "current_close": float(current_close),
    }


def _resolve_trend_bias(model_return: float, state: Dict[str, float]) -> float:
    model_component = float(np.clip(model_return, -0.012, 0.012))
    structure_component = state["structure_sign"] * state["volatility"] * 0.35
    bias = (
        0.55 * model_component
        + 0.30 * state["drift"]
        + 0.15 * state["slope"]
        + structure_component
    )

    if abs(bias) < state["volatility"] * 0.12:
        bias = state["drift"] + structure_component
    if abs(bias) < 1e-9:
        direction = 1.0 if state["structure_sign"] >= 0 else -1.0
        bias = direction * max(state["volatility"] * 0.2, 0.0002)
    return float(bias)


def _generate_structured_returns(
    *,
    steps: int,
    trend_bias: float,
    market_state: Dict[str, float],
    pullback_probability: float,
    volatility_scale: float,
    rng: np.random.Generator,
) -> Tuple[List[float], List[bool], float]:
    vol_unit = max(
        market_state["volatility"],
        market_state["atr_pct"] * 0.30,
        0.0008,
    ) * volatility_scale
    base_magnitude = max(abs(trend_bias), vol_unit * 0.25)

    raw_direction = np.sign(trend_bias)
    if raw_direction == 0:
        raw_direction = np.sign(market_state["drift"])
    if raw_direction == 0:
        raw_direction = np.sign(market_state["structure_sign"])
    base_direction = float(raw_direction if raw_direction != 0 else 1.0)

    returns: List[float] = []
    pullback_flags: List[bool] = []
    run_length = 0
    prev_sign = 0

    for idx in range(steps):
        decay = 1.0 - min(idx / max(steps * 1.8, 1), 0.45)
        directional = base_direction * base_magnitude * decay
        noise = float(rng.normal(0.0, vol_unit * 0.85))

        dynamic_pullback = np.clip(
            pullback_probability
            + max(run_length - 1, 0) * 0.16
            + (0.06 if abs(noise) > vol_unit * 0.90 else 0.0),
            0.20,
            0.85,
        )
        should_pullback = run_length >= 2 and rng.random() < dynamic_pullback

        pullback = False
        if should_pullback:
            pullback = True
            magnitude = float(rng.uniform(vol_unit * 0.45, vol_unit * 1.70))
            ret = (-base_direction * magnitude) + noise * 0.20
        else:
            ret = directional + noise
            if run_length >= 3:
                ret *= 0.60
                if rng.random() < 0.40:
                    pullback = True
                    fallback_sign = prev_sign if prev_sign != 0 else int(base_direction)
                    ret = -float(np.sign(fallback_sign)) * float(
                        rng.uniform(vol_unit * 0.25, vol_unit * 0.95)
                    )

        max_abs_move = max(vol_unit * 3.2, 0.0075)
        ret = float(np.clip(ret, -max_abs_move, max_abs_move))

        if abs(ret) < vol_unit * 0.06:
            nudge = float(rng.uniform(vol_unit * 0.08, vol_unit * 0.22))
            ret += nudge if rng.random() < 0.55 else -nudge

        sign = int(np.sign(ret))
        if sign != 0 and sign == prev_sign:
            run_length += 1
        elif sign != 0:
            run_length = 1
        else:
            run_length = max(run_length - 1, 0)

        if sign != 0:
            prev_sign = sign

        returns.append(ret)
        pullback_flags.append(pullback)

    non_zero_signs = [int(np.sign(r)) for r in returns if abs(r) > 1e-8]
    if len(non_zero_signs) >= 3 and abs(sum(non_zero_signs)) == len(non_zero_signs):
        if steps > 1:
            flip_idx = int(rng.integers(1, steps))
        else:
            flip_idx = 0
        flip_base = returns[flip_idx] if returns[flip_idx] != 0 else base_direction * vol_unit
        flip_mag = max(abs(flip_base) * 0.65, vol_unit * 0.45)
        returns[flip_idx] = -float(np.sign(flip_base)) * float(flip_mag)
        pullback_flags[flip_idx] = True

    return returns, pullback_flags, float(vol_unit)


def _build_structured_ohlc_path(
    *,
    start_close: float,
    start_high: float,
    start_low: float,
    start_volume: float,
    last_ts: int,
    interval_seconds: int,
    step_returns: List[float],
    pullback_flags: List[bool],
    trend_bias: float,
    market_state: Dict[str, float],
    base_confidence: float,
    rng: np.random.Generator,
) -> List[PredictedCandle]:
    predicted: List[PredictedCandle] = []
    prev_close = float(start_close)
    prev_high = float(start_high)
    prev_low = float(start_low)
    cumulative_log_return = 0.0
    vol_unit = max(market_state["volatility"], market_state["atr_pct"] * 0.30, 0.0008)

    for idx, step_ret in enumerate(step_returns):
        next_open = prev_close
        safe_step = float(max(step_ret, -0.95))
        cumulative_log_return += float(np.log1p(safe_step))

        anchored_close = float(start_close * np.exp(cumulative_log_return))
        local_close = float(next_open * (1.0 + step_ret))
        next_close = float(0.65 * anchored_close + 0.35 * local_close)

        base_range = max(
            market_state["atr"] * 0.28,
            start_close * vol_unit * 0.95,
            0.02,
        )
        wick_budget = float(rng.uniform(base_range * 0.60, base_range * 1.60))
        is_up = next_close >= next_open

        if is_up:
            upper_wick = wick_budget * float(rng.uniform(0.35, 0.78))
            lower_wick = wick_budget - upper_wick
        else:
            lower_wick = wick_budget * float(rng.uniform(0.35, 0.78))
            upper_wick = wick_budget - lower_wick

        high = max(next_open, next_close) + upper_wick
        low = min(next_open, next_close) - lower_wick
        is_pullback = pullback_flags[idx]

        if trend_bias > 0 and idx > 0:
            if not is_pullback:
                high = max(high, prev_high * (1.0 + float(rng.uniform(0.00005, 0.00120))))
                low = max(low, prev_low * (1.0 + float(rng.uniform(0.0, 0.00100))))
            else:
                high = min(high, prev_high * (1.0 + float(rng.uniform(0.0, 0.00070))))
        elif trend_bias < 0 and idx > 0:
            if not is_pullback:
                low = min(low, prev_low * (1.0 - float(rng.uniform(0.00005, 0.00120))))
                high = min(high, prev_high * (1.0 - float(rng.uniform(0.0, 0.00100))))
            else:
                low = max(low, prev_low * (1.0 - float(rng.uniform(0.0, 0.00070))))

        core_high = max(next_open, next_close)
        core_low = min(next_open, next_close)
        high = max(high, core_high + 0.01)
        low = min(low, core_low - 0.01)
        low = max(low, 0.01)

        if high <= low:
            spread = max(base_range, 0.02)
            mid = (core_high + core_low) * 0.5
            high = mid + spread * 0.5
            low = max(0.01, mid - spread * 0.5)

        next_close = float(np.clip(next_close, low + 1e-6, high - 1e-6))
        next_volume = max(float(start_volume) * float(rng.uniform(0.90, 1.15)), 0.0)
        step_confidence = round(max(30.0, min(95.0, base_confidence * (0.92 ** idx))), 1)

        predicted.append(
            PredictedCandle(
                time=int(last_ts + ((idx + 1) * interval_seconds)),
                open=round(float(next_open), 2),
                high=round(float(high), 2),
                low=round(float(low), 2),
                close=round(float(next_close), 2),
                confidence=step_confidence,
                step=idx + 1,
            )
        )

        prev_close = next_close
        prev_high = high
        prev_low = low
        start_volume = next_volume

    return predicted


@app.post("/predict-candles", response_model=PredictionCandlesResponse)
async def predict_candles_endpoint(request: PredictionCandlesRequest):
    start_time = time.perf_counter()

    if not pipelines:
        raise HTTPException(status_code=503, detail="Model not loaded")

    steps = max(1, min(int(request.steps), 30))

    try:
        data = [c.model_dump() for c in request.candles]
        df = pd.DataFrame(data)

        for col in ("open", "high", "low", "close", "volume"):
            if col not in df.columns:
                raise ValueError(f"Missing required column '{col}'")
            df[col] = pd.to_numeric(df[col], errors="coerce")
        df = df.dropna(subset=["open", "high", "low", "close"]).reset_index(drop=True)

        if len(df) < 50:
            raise ValueError(f"Need at least 50 candles, got {len(df)}")
        if len(df) > 100:
            df = df.tail(100).reset_index(drop=True)

        if "date" in df.columns:
            last_ts = _safe_timestamp_to_seconds(df["date"].iloc[-1])
        else:
            last_ts = None
        if last_ts is None and "time" in df.columns:
            last_ts = _safe_timestamp_to_seconds(df["time"].iloc[-1])
        if last_ts is None:
            last_ts = int(time.time())

        interval_seconds = _resolve_interval_seconds(df, request)
        current_price = float(df["close"].iloc[-1])
        market_state = _compute_market_state(df)

        model_return = _predict_logic(
            df,
            steps,
            timeframe=request.timeframe,
            interval_seconds=interval_seconds,
        )
        trend_bias = _resolve_trend_bias(model_return, market_state)
        base_confidence = _normalize_confidence_percent(_compute_confidence(model_return, df))

        pullback_probability = _coerce_probability(request.pullback_probability)
        volatility_scale = _coerce_volatility_scale(request.volatility_scale)

        seed_input = float(df["close"].tail(5).sum()) + float(df["volume"].tail(5).sum()) * 1e-6
        seed = int(abs(seed_input) * 1000) + (steps * 131) + (interval_seconds * 17)
        rng = np.random.default_rng(seed % (2**32 - 1))

        step_returns, pullback_flags, _ = _generate_structured_returns(
            steps=steps,
            trend_bias=trend_bias,
            market_state=market_state,
            pullback_probability=pullback_probability,
            volatility_scale=volatility_scale,
            rng=rng,
        )

        predicted_candles = _build_structured_ohlc_path(
            start_close=current_price,
            start_high=float(df["high"].iloc[-1]),
            start_low=float(df["low"].iloc[-1]),
            start_volume=float(df["volume"].iloc[-1]) if "volume" in df.columns else 0.0,
            last_ts=int(last_ts),
            interval_seconds=int(interval_seconds),
            step_returns=step_returns,
            pullback_flags=pullback_flags,
            trend_bias=trend_bias,
            market_state=market_state,
            base_confidence=base_confidence,
            rng=rng,
        )

        final_close = predicted_candles[-1].close
        overall_direction = "UP" if final_close > current_price else "DOWN"
        avg_confidence = round(
            sum(c.confidence for c in predicted_candles) / len(predicted_candles), 1
        )

        logger.info(
            f"[predict-candles] steps={steps} interval={interval_seconds}s "
            f"trend_bias={trend_bias:.6f} vol={market_state['volatility']:.6f} "
            f"pullback_prob={pullback_probability:.2f}"
        )

        end_time = time.perf_counter()
        processing_time = (end_time - start_time) * 1000

        return PredictionCandlesResponse(
            predicted_candles=predicted_candles,
            direction=overall_direction,
            confidence=avg_confidence,
            current_price=round(current_price, 2),
            target_price=round(final_close, 2),
            processing_time_ms=round(processing_time, 2),
        )

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Predict-candles error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal prediction error")


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("ml_fastapi:app", host=host, port=port, reload=True)
