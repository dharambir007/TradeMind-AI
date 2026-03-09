import gc
import joblib
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import lightgbm as lgb
import optuna

import config
import utils

logger = utils.setup_logger(__name__)

PREDICTION_HORIZONS = [3, 5, 10]  # Minutes ahead to predict
OPTUNA_TRIALS = 10  # Fast tuning (3 timeframe-specific models to train)
MAX_ROWS = 500000  # Use most recent N rows (recent data is most relevant)
TRAIN_SUBSAMPLE = 200000  # Subsample for Optuna speed
MIN_FEATURE_WINDOW = 60  # Need at least 60 rows for rolling features


def load_minute_data(data_folders=None, sample=False):
    """Load raw minute-level data without daily aggregation."""
    if data_folders is None:
        data_folders = config.DATA_FOLDERS

    csv_files = utils.get_csv_files(data_folders)
    logger.info(f"Loading {len(csv_files)} CSV files (minute-level)...")

    dfs = []
    for i, f in enumerate(csv_files):
        logger.info(f"  {i+1}/{len(csv_files)}: {f.name}")
        try:
            df = pd.read_csv(f, nrows=50000 if sample else None)
            dfs.append(df)
            if i % 5 == 0:
                gc.collect()
        except Exception as e:
            logger.error(f"Error loading {f.name}: {e}")

    df = pd.concat(dfs, ignore_index=True)
    df.columns = df.columns.str.lower().str.strip()

    if 'instrument' in df.columns:
        df = df.drop(columns=['instrument'])

    if 'time' in df.columns:
        df['datetime'] = pd.to_datetime(
            df['date'].astype(str) + ' ' + df['time'].astype(str),
            format='%Y%m%d %H:%M', errors='coerce'
        )
        df = df.drop(columns=['date', 'time'])
    else:
        df['datetime'] = pd.to_datetime(df['date'], format='%Y%m%d', errors='coerce')
        df = df.drop(columns=['date'])

    if 'volume' not in df.columns:
        df['volume'] = ((df['high'] - df['low']) * 1000).clip(lower=1).astype(int)

    df = df.dropna(subset=['datetime']).sort_values('datetime').reset_index(drop=True)
    logger.info(f"Loaded {len(df)} minute bars from {df['datetime'].min()} to {df['datetime'].max()}")

    if len(df) > MAX_ROWS:
        logger.info(f"Using most recent {MAX_ROWS} rows (from {len(df)} total)")
        df = df.tail(MAX_ROWS).reset_index(drop=True)
        logger.info(f"Date range after trim: {df['datetime'].min()} to {df['datetime'].max()}")

    return df


def engineer_minute_features(df):
    """Feature engineering for minute-level data."""
    logger.info("Engineering minute-level features...")
    df = df.copy()
    # Price features
    df['hl_ratio'] = df['high'] / df['low']
    df['co_ratio'] = df['close'] / df['open']
    df['range'] = df['high'] - df['low']
    df['range_pct'] = (df['high'] - df['low']) / df['close'] * 100
    df['avg_price'] = (df['open'] + df['high'] + df['low'] + df['close']) / 4

    for p in [1, 2, 3, 5, 10]:
        df[f'return_{p}'] = df['close'].pct_change(periods=p)

    for p in [1, 5]:
        df[f'log_return_{p}'] = np.log(df['close'] / df['close'].shift(p))

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
    n_before = len(df)
    df = df.dropna()
    logger.info(f"Features: {df.shape[1]} columns, {n_before - len(df)} rows dropped (NaN from rolling)")
    logger.info(f"Final minute data: {len(df)} rows")

    return df


def create_minute_target(df, horizon=5):
    """Create return target for next N minutes."""
    target_col = f'target_return_{horizon}m'
    df[target_col] = df['close'].pct_change(periods=horizon).shift(-horizon)
    df = df.dropna(subset=[target_col])
    return df, target_col


def train_minute_model(X_train, y_train, X_val, y_val, n_trials=10):
    """Train with Optuna hyperparameter tuning."""

    if len(X_train) > TRAIN_SUBSAMPLE:
        idx = np.random.RandomState(42).choice(len(X_train), TRAIN_SUBSAMPLE, replace=False)
        idx.sort()
        X_train_sub = X_train.iloc[idx]
        y_train_sub = y_train.iloc[idx]
        logger.info(f"Subsampled training data: {len(X_train)} -> {TRAIN_SUBSAMPLE} for Optuna")
    else:
        X_train_sub = X_train
        y_train_sub = y_train

    def objective(trial):
        params = {
            'num_leaves': trial.suggest_int('num_leaves', 20, 60),
            'max_depth': trial.suggest_int('max_depth', 4, 10),
            'learning_rate': trial.suggest_float('learning_rate', 0.02, 0.12),
            'min_data_in_leaf': trial.suggest_int('min_data_in_leaf', 15, 50),
            'feature_fraction': trial.suggest_float('feature_fraction', 0.5, 0.9),
            'bagging_fraction': trial.suggest_float('bagging_fraction', 0.5, 0.9),
            'lambda_l1': trial.suggest_float('lambda_l1', 0.5, 4),
            'lambda_l2': trial.suggest_float('lambda_l2', 0.5, 4),
        }

        model = lgb.LGBMRegressor(
            n_estimators=300, verbose=-1, n_jobs=-1,
            random_state=42, **params
        )
        model.fit(X_train_sub, y_train_sub)
        pred = model.predict(X_val)
        return np.sqrt(np.mean((y_val.values - pred) ** 2))

    optuna.logging.set_verbosity(optuna.logging.WARNING)
    study = optuna.create_study(direction='minimize',
                                sampler=optuna.samplers.TPESampler(seed=42))
    study.optimize(objective, n_trials=n_trials, show_progress_bar=True)
    logger.info(f"Best RMSE: {study.best_value:.6f}")
    logger.info(f"Best params: {study.best_params}")

    # Train final model with best params on FULL data (no subsample)
    scaler = StandardScaler()
    scaler.set_output(transform='pandas')
    model = lgb.LGBMRegressor(
        n_estimators=500, verbose=-1, n_jobs=-1,
        random_state=42, **study.best_params
    )
    pipeline = Pipeline([('scaler', scaler), ('model', model)])

    X_full = pd.concat([X_train, X_val])
    y_full = pd.concat([y_train, y_val])
    logger.info(f"Training final model on {len(X_full)} samples...")
    pipeline.fit(X_full, y_full)

    return pipeline, study.best_params


def main():
    logger.info("\n")
    logger.info("╔" + "=" * 58 + "╗")
    logger.info("║" + "MINUTE-LEVEL STOCK PREDICTION TRAINING".center(58) + "║")
    logger.info("╚" + "=" * 58 + "╝")

    logger.info("\n[STEP 1] Loading minute-level data...")
    df = load_minute_data(sample=False)

    logger.info("\n[STEP 2] Feature engineering...")
    df = engineer_minute_features(df)

    for horizon in PREDICTION_HORIZONS:
        logger.info(f"\n{'=' * 60}")
        logger.info(f"TRAINING {horizon}-MINUTE PREDICTION MODEL")
        logger.info(f"{'=' * 60}")

        # Create target
        df_h, target_col = create_minute_target(df.copy(), horizon=horizon)

        exclude_cols = ['datetime', target_col]
        feature_cols = [c for c in df_h.columns if c not in exclude_cols]
        X = df_h[feature_cols]
        y = df_h[target_col]

        split_80 = int(len(X) * 0.7)
        split_90 = int(len(X) * 0.85)

        X_train, y_train = X.iloc[:split_80], y.iloc[:split_80]
        X_val, y_val = X.iloc[split_80:split_90], y.iloc[split_80:split_90]
        X_test, y_test = X.iloc[split_90:], y.iloc[split_90:]

        logger.info(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")

        logger.info(f"\n[STEP 3] Optuna tuning ({OPTUNA_TRIALS} trials)...")
        pipeline, best_params = train_minute_model(
            X_train, y_train, X_val, y_val, n_trials=OPTUNA_TRIALS
        )

        y_pred = pipeline.predict(X_test)
        metrics = utils.calculate_metrics(y_test.values, y_pred)
        utils.log_metrics(metrics, f"TEST ({horizon}-MIN)")

        correct = np.sum((y_test.values > 0) == (y_pred > 0))
        accuracy = correct / len(y_test) * 100
        logger.info(f"Direction accuracy ({horizon}-min): {accuracy:.1f}% ({correct}/{len(y_test)})")

        model_path = config.OUTPUT_DIR / f"model_{horizon}min.pkl"
        joblib.dump(pipeline, model_path)
        logger.info(f"Model saved: {model_path}")

        feature_path = config.OUTPUT_DIR / f"features_{horizon}min.txt"
        with open(feature_path, 'w') as f:
            f.write('\n'.join(feature_cols))
        logger.info(f"Feature list saved: {feature_path}")

        gc.collect()

    logger.info("\n")
    logger.info("╔" + "=" * 58 + "╗")
    logger.info("║" + "ALL MINUTE MODELS TRAINED SUCCESSFULLY".center(58) + "║")
    logger.info("╚" + "=" * 58 + "╝")
    logger.info(f"\nModels saved in: {config.OUTPUT_DIR}")
    for h in PREDICTION_HORIZONS:
        logger.info(f"  • model_{h}min.pkl")
    logger.info("\n✓ Run `python predict_api.py` to start the prediction server")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.error(f"Training failed: {e}", exc_info=True)
        raise
