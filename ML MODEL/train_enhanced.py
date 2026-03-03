import gc
import joblib
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import lightgbm as lgb
import xgboost as xgb
import optuna

import config
import utils

warnings.filterwarnings('ignore')
logger = utils.setup_logger(__name__)

PREDICTION_HORIZONS = [2, 3, 5]
OPTUNA_TRIALS = 15
MAX_ROWS = 500000
TRAIN_SUBSAMPLE = 200000


def load_minute_data():
    """Load raw minute-level CSV data."""
    csv_files = utils.get_csv_files(config.DATA_FOLDERS)
    logger.info(f"Loading {len(csv_files)} CSV files...")

    dfs = []
    for i, f in enumerate(csv_files):
        try:
            df = pd.read_csv(f)
            dfs.append(df)
        except Exception as e:
            logger.error(f"Error loading {f.name}: {e}")
        if i % 5 == 0:
            gc.collect()

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
    logger.info(f"Loaded {len(df)} bars ({df['datetime'].min()} → {df['datetime'].max()})")

    if len(df) > MAX_ROWS:
        df = df.tail(MAX_ROWS).reset_index(drop=True)
        logger.info(f"Trimmed to {MAX_ROWS} most recent rows")

    return df


def engineer_features_v2(df):
    """Advanced feature engineering pipeline."""
    logger.info("Starting enhanced feature engineering")
    df = df.copy()

    logger.info("  [1/9] Price features...")
    df['hl_ratio'] = df['high'] / df['low']
    df['co_ratio'] = df['close'] / df['open']
    df['oc_ratio'] = df['open'] / df['close']
    df['hc_ratio'] = df['high'] / df['close']
    df['lc_ratio'] = df['low'] / df['close']
    df['range'] = df['high'] - df['low']
    df['range_pct'] = df['range'] / df['close'] * 100
    df['avg_price'] = (df['open'] + df['high'] + df['low'] + df['close']) / 4
    df['median_price'] = (df['high'] + df['low']) / 2
    df['typical_price'] = (df['high'] + df['low'] + df['close']) / 3
    df['body'] = abs(df['close'] - df['open'])
    df['body_pct'] = df['body'] / df['range'].replace(0, np.nan)
    df['upper_shadow'] = df['high'] - df[['open', 'close']].max(axis=1)
    df['lower_shadow'] = df[['open', 'close']].min(axis=1) - df['low']
    df['is_bullish'] = (df['close'] > df['open']).astype(int)

    logger.info("  [2/9] Returns & momentum...")
    for p in [1, 2, 3, 5, 10, 15, 20, 30]:
        df[f'return_{p}'] = df['close'].pct_change(periods=p)
    for p in [1, 3, 5, 10]:
        df[f'log_return_{p}'] = np.log(df['close'] / df['close'].shift(p))
    df['momentum_5'] = df['close'] - df['close'].shift(5)
    df['momentum_10'] = df['close'] - df['close'].shift(10)
    df['momentum_20'] = df['close'] - df['close'].shift(20)
    df['roc_5'] = (df['close'] - df['close'].shift(5)) / df['close'].shift(5) * 100
    df['roc_10'] = (df['close'] - df['close'].shift(10)) / df['close'].shift(10) * 100
    df['acceleration'] = df['return_1'] - df['return_1'].shift(1)

    logger.info("  [3/9] Volume features...")
    df['volume_ma_5'] = df['volume'].rolling(5).mean()
    df['volume_ma_10'] = df['volume'].rolling(10).mean()
    df['volume_ma_20'] = df['volume'].rolling(20).mean()
    df['volume_ratio_5'] = df['volume'] / df['volume_ma_5']
    df['volume_ratio_20'] = df['volume'] / df['volume_ma_20']
    df['volume_change'] = df['volume'].pct_change()
    df['volume_std_10'] = df['volume'].rolling(10).std()
    df['obv'] = (np.sign(df['close'].diff()) * df['volume']).cumsum()
    df['obv_ma_10'] = df['obv'].rolling(10).mean()
    df['obv_divergence'] = df['obv'] - df['obv_ma_10']
    df['vwap'] = (df['typical_price'] * df['volume']).rolling(20).sum() / df['volume'].rolling(20).sum()
    df['price_vs_vwap'] = df['close'] / df['vwap']

    logger.info("  [4/9] Technical indicators...")

    delta = df['close'].diff()
    gain = delta.where(delta > 0, 0)
    loss = (-delta.where(delta < 0, 0))
    for period in [7, 14, 21]:
        avg_gain = gain.rolling(period).mean()
        avg_loss = loss.rolling(period).mean()
        rs = avg_gain / avg_loss.replace(0, np.nan)
        df[f'rsi_{period}'] = 100 - (100 / (1 + rs))

    for fast, slow in [(12, 26), (5, 13)]:
        ema_fast = df['close'].ewm(span=fast, adjust=False).mean()
        ema_slow = df['close'].ewm(span=slow, adjust=False).mean()
        macd = ema_fast - ema_slow
        macd_signal = macd.ewm(span=9, adjust=False).mean()
        df[f'macd_{fast}_{slow}'] = macd
        df[f'macd_signal_{fast}_{slow}'] = macd_signal
        df[f'macd_hist_{fast}_{slow}'] = macd - macd_signal

    for period in [14, 21]:
        low_min = df['low'].rolling(period).min()
        high_max = df['high'].rolling(period).max()
        df[f'stoch_k_{period}'] = 100 * (df['close'] - low_min) / (high_max - low_min).replace(0, np.nan)
        df[f'stoch_d_{period}'] = df[f'stoch_k_{period}'].rolling(3).mean()

    for period in [14, 21]:
        high_max = df['high'].rolling(period).max()
        low_min = df['low'].rolling(period).min()
        df[f'williams_r_{period}'] = -100 * (high_max - df['close']) / (high_max - low_min).replace(0, np.nan)

    for period in [14, 20]:
        tp = df['typical_price']
        tp_ma = tp.rolling(period).mean()
        tp_mad = tp.rolling(period).apply(lambda x: np.abs(x - x.mean()).mean(), raw=True)
        df[f'cci_{period}'] = (tp - tp_ma) / (0.015 * tp_mad)

    high_diff = df['high'].diff()
    low_diff = -df['low'].diff()
    plus_dm = np.where((high_diff > low_diff) & (high_diff > 0), high_diff, 0)
    minus_dm = np.where((low_diff > high_diff) & (low_diff > 0), low_diff, 0)
    tr1 = df['high'] - df['low']
    tr2 = abs(df['high'] - df['close'].shift())
    tr3 = abs(df['low'] - df['close'].shift())
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr_14 = tr.rolling(14).mean()
    plus_di = 100 * pd.Series(plus_dm).rolling(14).mean() / atr_14
    minus_di = 100 * pd.Series(minus_dm).rolling(14).mean() / atr_14
    dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di).replace(0, np.nan)
    df['adx'] = dx.rolling(14).mean()
    df['plus_di'] = plus_di
    df['minus_di'] = minus_di

    logger.info("  [5/9] Moving averages & crossovers...")
    for w in [5, 10, 20, 50]:
        df[f'ema_{w}'] = df['close'].ewm(span=w, adjust=False).mean()
        df[f'sma_{w}'] = df['close'].rolling(w).mean()
        df[f'price_vs_ema_{w}'] = df['close'] / df[f'ema_{w}']
        df[f'price_vs_sma_{w}'] = df['close'] / df[f'sma_{w}']
    df['ema_5_10_cross'] = df['ema_5'] - df['ema_10']
    df['ema_10_20_cross'] = df['ema_10'] - df['ema_20']
    df['ema_20_50_cross'] = df['ema_20'] - df['ema_50']
    df['golden_cross'] = (df['ema_5_10_cross'] > 0).astype(int)
    df['death_cross'] = (df['ema_5_10_cross'] < 0).astype(int)
    # Bollinger Bands
    for w in [10, 20]:
        bb_mid = df['close'].rolling(w).mean()
        bb_std = df['close'].rolling(w).std()
        df[f'bb_upper_{w}'] = bb_mid + 2 * bb_std
        df[f'bb_lower_{w}'] = bb_mid - 2 * bb_std
        df[f'bb_width_{w}'] = (df[f'bb_upper_{w}'] - df[f'bb_lower_{w}']) / bb_mid
        df[f'bb_pct_{w}'] = (df['close'] - df[f'bb_lower_{w}']) / (df[f'bb_upper_{w}'] - df[f'bb_lower_{w}']).replace(0, np.nan)

    # ATR
    df['atr_7'] = tr.rolling(7).mean()
    df['atr_14'] = atr_14
    df['atr_pct'] = df['atr_14'] / df['close'] * 100

    logger.info("  [6/9] Volatility features...")
    for w in [5, 10, 20, 30]:
        df[f'volatility_{w}'] = df['return_1'].rolling(w).std()
    df['gk_volatility'] = np.sqrt(
        0.5 * np.log(df['high'] / df['low']) ** 2 -
        (2 * np.log(2) - 1) * np.log(df['close'] / df['open']) ** 2
    )
    df['gk_vol_ma_10'] = df['gk_volatility'].rolling(10).mean()
    df['vol_change'] = df['volatility_10'] - df['volatility_10'].shift(5)

    logger.info("  [7/9] Rolling statistics...")
    for w in [5, 10, 20, 30]:
        df[f'rolling_mean_{w}'] = df['close'].rolling(w).mean()
        df[f'rolling_std_{w}'] = df['close'].rolling(w).std()
        df[f'rolling_min_{w}'] = df['close'].rolling(w).min()
        df[f'rolling_max_{w}'] = df['close'].rolling(w).max()
        df[f'rolling_range_{w}'] = df[f'rolling_max_{w}'] - df[f'rolling_min_{w}']
        df[f'zscore_{w}'] = (df['close'] - df[f'rolling_mean_{w}']) / df[f'rolling_std_{w}'].replace(0, np.nan)
    df['pct_rank_20'] = df['close'].rolling(20).apply(
        lambda x: pd.Series(x).rank(pct=True).iloc[-1], raw=False
    )
    df['is_up'] = (df['close'] > df['close'].shift(1)).astype(int)
    df['consecutive_up'] = df['is_up'].groupby((df['is_up'] != df['is_up'].shift()).cumsum()).cumsum()
    df['consecutive_down'] = (1 - df['is_up']).groupby(((1 - df['is_up']) != (1 - df['is_up']).shift()).cumsum()).cumsum()

    logger.info("  [8/9] Lag features...")
    for lag in [1, 2, 3, 5, 10, 15, 20]:
        df[f'close_lag_{lag}'] = df['close'].shift(lag)
        df[f'return_lag_{lag}'] = df['return_1'].shift(lag)
    for lag in [1, 2, 3, 5]:
        df[f'volume_lag_{lag}'] = df['volume'].shift(lag)
        df[f'range_lag_{lag}'] = df['range'].shift(lag)
        df[f'rsi_14_lag_{lag}'] = df['rsi_14'].shift(lag)

    logger.info("  [9/9] Interaction features...")
    df['rsi_macd_interact'] = df['rsi_14'] * df['macd_hist_12_26']
    df['vol_momentum_interact'] = df['volume_ratio_5'] * df['momentum_5']
    df['rsi_vol_interact'] = df['rsi_14'] * df['volatility_10']
    df['bb_rsi_interact'] = df['bb_pct_20'] * df['rsi_14']
    df['stoch_rsi_interact'] = df['stoch_k_14'] * df['rsi_14']
    df['adx_trend_interact'] = df['adx'] * abs(df['return_5'])
    df['cross_momentum'] = df['ema_5_10_cross'] * df['momentum_5']
    df['oversold'] = ((df['rsi_14'] < 30) & (df['stoch_k_14'] < 20)).astype(int)
    df['overbought'] = ((df['rsi_14'] > 70) & (df['stoch_k_14'] > 80)).astype(int)

    # Clean up
    df = df.replace([np.inf, -np.inf], np.nan)
    n_before = len(df)
    df = df.dropna()
    n_features = len([c for c in df.columns if c != 'datetime'])
    logger.info(f"Total features: {n_features} | Rows: {n_before} → {len(df)} ({n_before-len(df)} dropped)")
    return df


def create_target(df, horizon=5):
    """Create binary direction and return targets."""
    df[f'target_return_{horizon}m'] = df['close'].pct_change(periods=horizon).shift(-horizon)
    df[f'target_dir_{horizon}m'] = (df[f'target_return_{horizon}m'] > 0).astype(int)
    df = df.dropna(subset=[f'target_return_{horizon}m'])
    return df


class EnsembleModel:
    """Weighted XGBoost + LightGBM ensemble."""

    def __init__(self, lgb_params=None, xgb_params=None, lgb_weight=0.5):
        self.lgb_weight = lgb_weight
        self.xgb_weight = 1 - lgb_weight
        self.scaler = StandardScaler()
        self.scaler.set_output(transform='pandas')

        lgb_base = {
            'n_estimators': 500, 'verbose': -1, 'n_jobs': -1,
            'random_state': 42, 'importance_type': 'gain'
        }
        xgb_base = {
            'n_estimators': 500, 'verbosity': 0, 'n_jobs': -1,
            'random_state': 42, 'tree_method': 'hist'
        }
        if lgb_params:
            lgb_base.update(lgb_params)
        if xgb_params:
            xgb_base.update(xgb_params)

        self.lgb_model = lgb.LGBMClassifier(**lgb_base)
        self.xgb_model = xgb.XGBClassifier(**xgb_base, eval_metric='logloss')
        self.feature_names = None

    def fit(self, X, y):
        self.feature_names = list(X.columns) if hasattr(X, 'columns') else None
        X_scaled = self.scaler.fit_transform(X)
        logger.info(f"  Training LightGBM (weight={self.lgb_weight:.1f})...")
        self.lgb_model.fit(X_scaled, y)
        logger.info(f"  Training XGBoost (weight={self.xgb_weight:.1f})...")
        self.xgb_model.fit(X_scaled, y)
        return self

    def predict_proba(self, X):
        X_scaled = self.scaler.transform(X)
        lgb_proba = self.lgb_model.predict_proba(X_scaled)[:, 1]
        xgb_proba = self.xgb_model.predict_proba(X_scaled)[:, 1]
        return self.lgb_weight * lgb_proba + self.xgb_weight * xgb_proba

    def predict(self, X):
        proba = self.predict_proba(X)
        return (proba > 0.5).astype(int)

    def get_feature_importance(self, top_k=30):
        lgb_imp = self.lgb_model.feature_importances_
        xgb_imp = self.xgb_model.feature_importances_
        lgb_norm = lgb_imp / (lgb_imp.sum() + 1e-10)
        xgb_norm = xgb_imp / (xgb_imp.sum() + 1e-10)
        combined = self.lgb_weight * lgb_norm + self.xgb_weight * xgb_norm
        names = self.feature_names or [f"f_{i}" for i in range(len(combined))]
        imp_df = pd.DataFrame({'feature': names, 'importance': combined})
        return imp_df.sort_values('importance', ascending=False).head(top_k)


def tune_and_train(X_train, y_train, X_val, y_val, n_trials=15):
    """Optuna tuning for ensemble weights and hyperparameters."""

    if len(X_train) > TRAIN_SUBSAMPLE:
        idx = np.random.RandomState(42).choice(len(X_train), TRAIN_SUBSAMPLE, replace=False)
        idx.sort()
        X_sub, y_sub = X_train.iloc[idx], y_train.iloc[idx]
    else:
        X_sub, y_sub = X_train, y_train

    def objective(trial):
        lgb_params = {
            'num_leaves': trial.suggest_int('lgb_num_leaves', 20, 60),
            'max_depth': trial.suggest_int('lgb_max_depth', 4, 10),
            'learning_rate': trial.suggest_float('lgb_lr', 0.02, 0.12),
            'min_data_in_leaf': trial.suggest_int('lgb_min_data', 15, 50),
            'feature_fraction': trial.suggest_float('lgb_feature_frac', 0.5, 0.9),
            'bagging_fraction': trial.suggest_float('lgb_bagging_frac', 0.5, 0.9),
            'lambda_l1': trial.suggest_float('lgb_l1', 0.5, 4),
            'lambda_l2': trial.suggest_float('lgb_l2', 0.5, 4),
        }
        xgb_params = {
            'max_depth': trial.suggest_int('xgb_max_depth', 4, 10),
            'learning_rate': trial.suggest_float('xgb_lr', 0.02, 0.12),
            'min_child_weight': trial.suggest_int('xgb_min_child', 5, 30),
            'subsample': trial.suggest_float('xgb_subsample', 0.5, 0.9),
            'colsample_bytree': trial.suggest_float('xgb_colsample', 0.5, 0.9),
            'reg_alpha': trial.suggest_float('xgb_alpha', 0.5, 4),
            'reg_lambda': trial.suggest_float('xgb_lambda', 0.5, 4),
        }
        lgb_weight = trial.suggest_float('lgb_weight', 0.3, 0.7)

        lgb_params['n_estimators'] = 200
        xgb_params['n_estimators'] = 200

        model = EnsembleModel(lgb_params, xgb_params, lgb_weight)
        model.fit(X_sub, y_sub)
        preds = model.predict(X_val)
        accuracy = np.mean(preds == y_val.values)
        return accuracy

    optuna.logging.set_verbosity(optuna.logging.WARNING)
    study = optuna.create_study(direction='maximize',
                                sampler=optuna.samplers.TPESampler(seed=42))
    study.optimize(objective, n_trials=n_trials, show_progress_bar=True)

    logger.info(f"Best accuracy: {study.best_value:.4f}")
    logger.info(f"Best params: {study.best_params}")

    bp = study.best_params
    best_lgb = {k.replace('lgb_', ''): v for k, v in bp.items()
                if k.startswith('lgb_') and k != 'lgb_weight'}
    best_lgb['lr'] = best_lgb.pop('lr', 0.05)
    best_lgb['learning_rate'] = best_lgb.pop('lr', best_lgb.get('learning_rate', 0.05))

    best_xgb = {k.replace('xgb_', ''): v for k, v in bp.items() if k.startswith('xgb_')}
    best_xgb['lr'] = best_xgb.pop('lr', 0.05)
    best_xgb['learning_rate'] = best_xgb.pop('lr', best_xgb.get('learning_rate', 0.05))

    lgb_weight = bp.get('lgb_weight', 0.5)

    best_lgb['n_estimators'] = 500
    best_xgb['n_estimators'] = 500

    X_full = pd.concat([X_train, X_val])
    y_full = pd.concat([y_train, y_val])

    logger.info(f"Training final ensemble on {len(X_full)} samples...")
    final_model = EnsembleModel(best_lgb, best_xgb, lgb_weight)
    final_model.fit(X_full, y_full)

    return final_model, study.best_params


def main():
    logger.info("\n╔" + "=" * 58 + "╗")
    logger.info("║" + "ENHANCED STOCK PREDICTION v2 (XGB+LGBM)".center(58) + "║")
    logger.info("║" + "Target: 80%+ Direction Accuracy".center(58) + "║")
    logger.info("╚" + "=" * 58 + "╝")

    logger.info("\n[STEP 1] Loading data...")
    df = load_minute_data()

    logger.info("\n[STEP 2] Enhanced feature engineering...")
    df = engineer_features_v2(df)

    for horizon in PREDICTION_HORIZONS:
        logger.info(f"\n{'='*60}")
        logger.info(f"TRAINING {horizon}-MINUTE ENSEMBLE MODEL")
        logger.info(f"{'='*60}")

        df_h = create_target(df.copy(), horizon)
        target_col = f'target_dir_{horizon}m'

        exclude = ['datetime', f'target_return_{horizon}m', target_col]
        feature_cols = [c for c in df_h.columns if c not in exclude]
        X = df_h[feature_cols]
        y = df_h[target_col]

        # Split
        s1 = int(len(X) * 0.7)
        s2 = int(len(X) * 0.85)
        X_train, y_train = X.iloc[:s1], y.iloc[:s1]
        X_val, y_val = X.iloc[s1:s2], y.iloc[s1:s2]
        X_test, y_test = X.iloc[s2:], y.iloc[s2:]

        logger.info(f"Train: {len(X_train)} | Val: {len(X_val)} | Test: {len(X_test)}")
        logger.info(f"Features: {len(feature_cols)}")
        logger.info(f"Class balance — Train UP: {y_train.mean():.1%} | Test UP: {y_test.mean():.1%}")

        # Train
        logger.info(f"\n[STEP 3] Optuna ensemble tuning ({OPTUNA_TRIALS} trials)...")
        model, best_params = tune_and_train(X_train, y_train, X_val, y_val, OPTUNA_TRIALS)

        # Evaluate
        preds = model.predict(X_test)
        proba = model.predict_proba(X_test)
        accuracy = np.mean(preds == y_test.values) * 100
        # Detailed metrics
        tp = np.sum((preds == 1) & (y_test.values == 1))
        tn = np.sum((preds == 0) & (y_test.values == 0))
        fp = np.sum((preds == 1) & (y_test.values == 0))
        fn = np.sum((preds == 0) & (y_test.values == 1))

        precision = tp / (tp + fp) * 100 if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) * 100 if (tp + fn) > 0 else 0

        logger.info(f"\n{'='*50}")
        logger.info(f"  {horizon}-MIN TEST RESULTS")
        logger.info(f"{'='*50}")
        logger.info(f"  ★ Direction Accuracy: {accuracy:.1f}%")
        logger.info(f"  Precision (UP):       {precision:.1f}%")
        logger.info(f"  Recall (UP):          {recall:.1f}%")
        logger.info(f"  Confusion: TP={tp} TN={tn} FP={fp} FN={fn}")
        logger.info(f"{'='*50}")

        # Save
        model_path = config.OUTPUT_DIR / f"model_v2_{horizon}min.pkl"
        joblib.dump(model, model_path)
        logger.info(f"Model saved: {model_path}")

        feature_path = config.OUTPUT_DIR / f"features_v2_{horizon}min.txt"
        with open(feature_path, 'w') as f:
            f.write('\n'.join(feature_cols))

        # Feature importance
        imp_df = model.get_feature_importance(top_k=30)
        imp_path = config.OUTPUT_DIR / f"feature_importance_v2_{horizon}min.csv"
        imp_df.to_csv(imp_path, index=False)
        logger.info(f"\nTop 10 features ({horizon}-min):")
        for _, row in imp_df.head(10).iterrows():
            logger.info(f"  {row['feature']:30s} {row['importance']:.4f}")

        gc.collect()

    logger.info("\n╔" + "=" * 58 + "╗")
    logger.info("║" + "ALL ENHANCED MODELS TRAINED".center(58) + "║")
    logger.info("╚" + "=" * 58 + "╝")
    for h in PREDICTION_HORIZONS:
        logger.info(f"  • model_v2_{h}min.pkl")
    logger.info("\n✓ Done! Start API: python predict_api.py")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.error(f"Training failed: {e}", exc_info=True)
        raise
