"""Prediction API."""

import argparse
import joblib
import json
from pathlib import Path

import numpy as np
import pandas as pd

import config
import utils

logger = utils.setup_logger(__name__)

MODELS = {}
FEATURE_LISTS = {}


def load_all_models():
    """Load all available minute-level models."""
    for h in [2, 3, 5]:
        model_path = config.OUTPUT_DIR / f"model_{h}min.pkl"
        feature_path = config.OUTPUT_DIR / f"features_{h}min.txt"

        if model_path.exists():
            MODELS[h] = joblib.load(model_path)
            logger.info(f"Loaded {h}-min model from {model_path}")

            if feature_path.exists():
                with open(feature_path) as f:
                    FEATURE_LISTS[h] = f.read().strip().split('\n')
        else:
            logger.warning(f"Model not found: {model_path}")

    if config.MODEL_PATH.exists():
        MODELS['daily'] = joblib.load(config.MODEL_PATH)
        logger.info(f"Loaded daily model from {config.MODEL_PATH}")

    logger.info(f"Available models: {list(MODELS.keys())}")


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


def predict(candles_df, horizon=5):
    """Make a prediction from recent candle data."""
    if horizon not in MODELS:
        return {"error": f"No model for {horizon}-min. Available: {list(MODELS.keys())}"}

    if len(candles_df) < 60:
        return {"error": f"Need at least 60 candle rows, got {len(candles_df)}"}

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

    @app.route('/models', methods=['GET'])
    def list_models():
        return jsonify({
            "available_horizons": [k for k in MODELS.keys() if isinstance(k, int)],
            "daily_model": 'daily' in MODELS,
        })

    @app.route('/predict', methods=['POST'])
    def predict_endpoint():
        try:
            body = request.get_json()
            horizon = body.get('horizon', 5)
            data = body.get('data', [])

            if not data:
                return jsonify({"error": "No candle data provided"}), 400

            candles_df = pd.DataFrame(data)
            result = predict(candles_df, horizon=horizon)

            if "error" in result:
                return jsonify(result), 400

            return jsonify(result)

        except Exception as e:
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

    for horizon in [2, 3, 5]:
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
            logger.info("  GET  /models   - List models")
            app.run(host='0.0.0.0', port=args.port, debug=False)
        else:
            logger.info("Running standalone test instead...")
            standalone_test()
