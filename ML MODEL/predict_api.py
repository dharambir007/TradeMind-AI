"""Prediction API."""

import argparse
import joblib
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

import config
import utils

logger = utils.setup_logger(__name__)

MODELS = {}
FEATURE_LISTS = {}
MIN_REQUIRED_CANDLES = 60
MAX_CANDLES_FOR_INFERENCE = 150


def _print_and_log(message, level="info"):
    print(message)
    getattr(logger, level, logger.info)(message)


def _candidate_paths(file_name):
    return [
        (config.OUTPUT_DIR / file_name).resolve(),
        (config.PROJECT_ROOT / file_name).resolve(),
    ]


def _find_existing_path(file_name):
    for candidate in _candidate_paths(file_name):
        if candidate.exists():
            return candidate
    return None


def _safe_json(data, limit=2000):
    try:
        payload = json.dumps(data, default=str)
    except Exception:
        payload = str(data)
    return payload if len(payload) <= limit else f"{payload[:limit]}...<truncated>"


def load_all_models():
    """Load all available minute-level models."""
    _print_and_log("Loading model...")
    MODELS.clear()
    FEATURE_LISTS.clear()

    for h in [3, 5, 10]:
        model_path = _find_existing_path(f"model_{h}min.pkl")
        feature_path = _find_existing_path(f"features_{h}min.txt")

        if model_path is not None:
            _print_and_log(f"Loading model for {h}m from {model_path}")
            MODELS[h] = joblib.load(model_path)
            _print_and_log(f"Model loaded successfully for {h}m")

            if feature_path is not None:
                with open(feature_path) as f:
                    FEATURE_LISTS[h] = f.read().strip().split('\n')
        else:
            _print_and_log(
                f"Model not found for {h}m. Checked: {', '.join(str(p) for p in _candidate_paths(f'model_{h}min.pkl'))}",
                level="warning",
            )

    if not any(isinstance(key, int) for key in MODELS.keys()):
        legacy_model_path = _find_existing_path("model_2min.pkl")
        legacy_feature_path = _find_existing_path("features_2min.txt")

        if legacy_model_path is not None:
            _print_and_log(f"Loading legacy minute fallback model from {legacy_model_path}")
            legacy_model = joblib.load(legacy_model_path)
            for horizon in [3, 5, 10]:
                MODELS[horizon] = legacy_model
            if legacy_feature_path is not None:
                with open(legacy_feature_path) as f:
                    features = [line.strip() for line in f.read().strip().split('\n') if line.strip()]
                for horizon in [3, 5, 10]:
                    FEATURE_LISTS[horizon] = features
            _print_and_log("Model loaded successfully for legacy minute fallback")

    fallback_model_path = _find_existing_path("model.pkl")
    if fallback_model_path is not None:
        _print_and_log(f"Loading fallback model from {fallback_model_path}")
        fallback_model = joblib.load(fallback_model_path)
        MODELS['daily'] = fallback_model
        for horizon in [3, 5, 10]:
            MODELS.setdefault(horizon, fallback_model)
        _print_and_log("Model loaded successfully for daily fallback")

    _print_and_log(f"Available models: {list(MODELS.keys())}")


def engineer_features_from_candles(candles_df):
    """Build features from OHLCV candle data (needs 60+ rows)."""
    df = candles_df.copy()
    df.columns = [c.lower().strip() for c in df.columns]

    if 'volume' not in df.columns:
        df['volume'] = ((df['high'] - df['low']) * 1000).clip(lower=1).astype(int)

    df['hl_ratio'] = df['high'] / df['low']
    df['co_ratio'] = df['close'] / df['open']
    df['range'] = df['high'] - df['low']
    df['range_pct'] = (df['high'] - df['low']) / df['close'] * 100
    df['avg_price'] = (df['open'] + df['high'] + df['low'] + df['close']) / 4

    for p in [1, 2, 3, 5, 10]:
        df[f'return_{p}'] = df['close'].pct_change(periods=p)

    for p in [1, 5]:
        df[f'log_return_{p}'] = np.log(df['close'] / df['close'].shift(p))

    # RSI
    delta = df['close'].diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    df['rsi'] = 100 - (100 / (1 + rs))

    exp12 = df['close'].ewm(span=12, adjust=False).mean()
    exp26 = df['close'].ewm(span=26, adjust=False).mean()
    df['macd'] = exp12 - exp26
    df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
    df['macd_hist'] = df['macd'] - df['macd_signal']

    for w in [5, 10, 20, 50]:
        df[f'ma_{w}'] = df['close'].rolling(w).mean()
        df[f'ma_ratio_{w}'] = df['close'] / df[f'ma_{w}']

    bb_mid = df['close'].rolling(20).mean()
    bb_std = df['close'].rolling(20).std()
    df['bb_upper'] = bb_mid + 2 * bb_std
    df['bb_lower'] = bb_mid - 2 * bb_std
    df['bb_pct'] = (df['close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])

    tr1 = df['high'] - df['low']
    tr2 = abs(df['high'] - df['close'].shift())
    tr3 = abs(df['low'] - df['close'].shift())
    df['atr'] = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1).rolling(14).mean()

    for w in [5, 10, 20]:
        df[f'volatility_{w}'] = df['close'].pct_change().rolling(w).std()

    for w in [5, 10, 20]:
        df[f'rolling_mean_{w}'] = df['close'].rolling(w).mean()
        df[f'rolling_std_{w}'] = df['close'].rolling(w).std()
        df[f'rolling_min_{w}'] = df['close'].rolling(w).min()
        df[f'rolling_max_{w}'] = df['close'].rolling(w).max()

    for lag in [1, 2, 3, 5]:
        df[f'close_lag_{lag}'] = df['close'].shift(lag)
        df[f'return_1_lag_{lag}'] = df['return_1'].shift(lag)
        df[f'volume_lag_{lag}'] = df['volume'].shift(lag)

    df['volume_ma_ratio'] = df['volume'] / df['volume'].rolling(20).mean()
    df['volume_change'] = df['volume'].pct_change()

    df = df.replace([np.inf, -np.inf], np.nan)
    return df


def validate_input_candles(candles_df):
    if candles_df is None or candles_df.empty:
        raise ValueError("Invalid input")

    df = candles_df.copy()
    df.columns = [c.lower().strip() for c in df.columns]

    required_columns = ["open", "high", "low", "close"]
    missing = [column for column in required_columns if column not in df.columns]
    if missing:
        raise ValueError(f"Invalid input: missing columns {missing}")

    if "volume" not in df.columns:
        df["volume"] = 0.0

    for column in ["open", "high", "low", "close", "volume"]:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    if df[["open", "high", "low", "close", "volume"]].isnull().any().any():
        raise ValueError("Invalid input: null or non-numeric values found")

    if len(df) < MIN_REQUIRED_CANDLES:
        raise ValueError(f"Need at least {MIN_REQUIRED_CANDLES} candle rows, got {len(df)}")

    if len(df) > MAX_CANDLES_FOR_INFERENCE:
        df = df.tail(MAX_CANDLES_FOR_INFERENCE).reset_index(drop=True)

    return df


def predict(candles_df, horizon=5):
    """Make a prediction from recent candle data."""
    if horizon not in MODELS:
        numeric_horizons = sorted(key for key in MODELS.keys() if isinstance(key, int))
        if numeric_horizons:
            horizon = min(numeric_horizons, key=lambda value: abs(value - horizon))
        elif 'daily' in MODELS:
            horizon = 'daily'
        else:
            return {"error": f"No model for {horizon}-min. Available: {list(MODELS.keys())}"}

    try:
        candles_df = validate_input_candles(candles_df)
    except ValueError as exc:
        return {"error": str(exc)}

    df = engineer_features_from_candles(candles_df)

    latest = df.iloc[[-1]].copy()

    if horizon in FEATURE_LISTS:
        expected_features = FEATURE_LISTS[horizon]
        missing = [f for f in expected_features if f not in latest.columns]
        if missing:
            for f in missing:
                latest[f] = 0
        latest = latest[expected_features]
    else:
        drop_cols = ['datetime', 'date', 'time', 'instrument']
        latest = latest.drop(columns=[c for c in drop_cols if c in latest.columns])

    pipeline = MODELS[horizon]
    predicted_return = float(pipeline.predict(latest)[0])

    current_price = float(candles_df['close'].iloc[-1])
    predicted_price = current_price * (1 + predicted_return / 100)
    direction = "UP" if predicted_return > 0 else "DOWN"
    confidence = min(abs(predicted_return) * 10, 100)

    return {
        "horizon_minutes": horizon,
        "current_price": round(current_price, 2),
        "predicted_return_pct": round(predicted_return, 4),
        "predicted_price": round(predicted_price, 2),
        "direction": direction,
        "confidence": round(confidence, 1),
    }


def create_app():
    """Create Flask app with prediction endpoints."""
    try:
        from flask import Flask, request, jsonify
        from flask_cors import CORS
    except ImportError:
        logger.error("Flask not installed. Run: pip install flask flask-cors")
        return None

    app = Flask(__name__)
    CORS(app)

    @app.route('/health', methods=['GET'])
    def health():
        return jsonify({
            "status": "ok",
            "models_loaded": list(MODELS.keys()),
        })

    @app.route('/test', methods=['GET'])
    def test():
        return jsonify({"message": "API working", "status": "success"})

    @app.route('/models', methods=['GET'])
    def list_models():
        return jsonify({
            "available_horizons": [k for k in MODELS.keys() if isinstance(k, int)],
            "daily_model": 'daily' in MODELS,
        })

    @app.route('/predict', methods=['POST'])
    def predict_endpoint():
        start = time.time()
        try:
            body = request.get_json()
            print("Incoming request:", _safe_json(body))
            print("Prediction started")
            if not isinstance(body, dict):
                return jsonify({"error": "Invalid input"}), 400

            horizon = body.get('horizon', 5)
            data = body.get('data', [])

            if not data:
                return jsonify({"error": "No candle data provided"}), 400

            candles_df = pd.DataFrame(data)
            result = predict(candles_df, horizon=horizon)

            if "error" in result:
                return jsonify(result), 400

            response = {
                "status": "success",
                "prediction": result,
            }
            print("Prediction output:", _safe_json(response))
            print("Response time:", round(time.time() - start, 4))
            return jsonify(response)

        except Exception as e:
            print("ERROR:", str(e))
            logger.error(f"Prediction error: {e}", exc_info=True)
            return jsonify({"error": str(e)}), 500

    return app


def standalone_test():
    """Test predictions using existing data."""
    logger.info("\n=== STANDALONE PREDICTION TEST ===\n")

    sample_csv = list(Path(config.DATA_FOLDERS[0]).glob("*.csv"))[0]
    df = pd.read_csv(sample_csv, nrows=200)
    df.columns = [c.lower().strip() for c in df.columns]

    df = df.drop(columns=[c for c in ['instrument', 'date', 'time'] if c in df.columns],
                 errors='ignore')

    if 'volume' not in df.columns:
        df['volume'] = ((df['high'] - df['low']) * 1000).clip(lower=1).astype(int)

    for horizon in [3, 5, 10]:
        if horizon in MODELS:
            result = predict(df, horizon=horizon)
            logger.info(f"\n{horizon}-MIN PREDICTION:")
            for k, v in result.items():
                logger.info(f"  {k}: {v}")

    logger.info("\nStandalone test completed!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Stock Prediction API")
    parser.add_argument('--port', type=int, default=5000, help='Server port')
    parser.add_argument('--test', action='store_true', help='Run standalone test only')
    args = parser.parse_args()

    load_all_models()

    if args.test:
        standalone_test()
    else:
        app = create_app()
        if app:
            logger.info(f"\nStarting prediction server on http://localhost:{args.port}")
            logger.info("Endpoints:")
            logger.info("  POST /predict  - Make predictions")
            logger.info("  GET  /health   - Health check")
            logger.info("  GET  /test     - Test route")
            logger.info("  GET  /models   - List models")
            app.run(host='0.0.0.0', port=args.port, debug=False)
        else:
            logger.info("Running standalone test instead...")
            standalone_test()
