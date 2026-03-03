import numpy as np
import pandas as pd

import config
import utils

logger = utils.setup_logger(__name__)


def calculate_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    """Calculate RSI."""
    delta = close.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    
    rs = utils.safe_divide(gain, loss)
    rsi = 100 - (100 / (1 + rs))
    
    return rsi


def calculate_macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> tuple:
    """Calculate MACD."""
    exp_fast = close.ewm(span=fast, adjust=False).mean()
    exp_slow = close.ewm(span=slow, adjust=False).mean()
    
    macd = exp_fast - exp_slow
    macd_signal = macd.ewm(span=signal, adjust=False).mean()
    macd_hist = macd - macd_signal
    
    return macd, macd_signal, macd_hist


def calculate_moving_average(close: pd.Series, periods: list) -> dict:
    """Calculate moving averages for given periods."""
    mas = {}
    for period in periods:
        mas[f'MA_{period}'] = close.rolling(window=period).mean()
    
    return mas


def calculate_bollinger_bands(close: pd.Series, period: int = 20, num_std: float = 2.0) -> tuple:
    """Calculate Bollinger Bands."""
    middle = close.rolling(window=period).mean()
    std = close.rolling(window=period).std()
    
    upper = middle + (std * num_std)
    lower = middle - (std * num_std)
    
    return upper, middle, lower


def calculate_atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    """Calculate Average True Range."""
    tr1 = high - low
    tr2 = abs(high - close.shift())
    tr3 = abs(low - close.shift())
    
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(window=period).mean()
    
    return atr


def calculate_returns(close: pd.Series, periods: list = [1]) -> dict:
    """Calculate returns for given periods."""
    returns = {}
    for period in periods:
        returns[f'return_{period}'] = close.pct_change(periods=period)
    
    return returns


def calculate_log_returns(close: pd.Series, periods: list = [1]) -> dict:
    """Calculate log returns."""
    log_returns = {}
    for period in periods:
        log_returns[f'log_return_{period}'] = np.log(close / close.shift(period))
    
    return log_returns


def calculate_volatility(close: pd.Series, periods: list = [10, 20]) -> dict:
    """Calculate rolling volatility."""
    volatility = {}
    for period in periods:
        returns = close.pct_change()
        volatility[f'volatility_{period}'] = returns.rolling(window=period).std()
    
    return volatility


def create_lag_features(df: pd.DataFrame, columns: list, lags: list) -> pd.DataFrame:
    """Create lag features for given columns."""
    logger.info(f"Creating lag features for {columns} with lags {lags}")
    
    for col in columns:
        if col not in df.columns:
            logger.warning(f"Column {col} not found, skipping")
            continue
        
        for lag in lags:
            df[f'{col}_lag_{lag}'] = df[col].shift(lag)
    
    return df


def create_rolling_features(df: pd.DataFrame, close_col: str = 'close', 
                           windows: list = [5, 10, 20]) -> pd.DataFrame:
    """Create rolling statistics features."""
    logger.info(f"Creating rolling features with windows {windows}")
    
    for window in windows:
        df[f'rolling_mean_{window}'] = df[close_col].rolling(window=window).mean()
        df[f'rolling_std_{window}'] = df[close_col].rolling(window=window).std()
        df[f'rolling_min_{window}'] = df[close_col].rolling(window=window).min()
        df[f'rolling_max_{window}'] = df[close_col].rolling(window=window).max()
    
    return df


def create_price_features(df: pd.DataFrame) -> pd.DataFrame:
    """Create price-based features."""
    logger.info("Creating price-based features")
    
    df['hl_ratio'] = df['high'] / df['low']
    df['co_ratio'] = df['close'] / df['open']
    df['oc_ratio'] = df['open'] / df['close']
    df['hc_ratio'] = df['high'] / df['close']
    df['lc_ratio'] = df['low'] / df['close']
    df['range'] = df['high'] - df['low']
    df['range_pct'] = (df['high'] - df['low']) / df['close'] * 100
    df['avg_price'] = (df['open'] + df['high'] + df['low'] + df['close']) / 4
    
    return df


def create_volume_features(df: pd.DataFrame) -> pd.DataFrame:
    """Create volume-based features."""
    logger.info("Creating volume-based features")
    
    df['volume_ma_ratio'] = df['volume'] / df['volume'].rolling(window=20).mean()
    df['volume_change'] = df['volume'].pct_change()
    df['log_volume'] = np.log(df['volume'] + 1)
    
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Run full feature engineering pipeline."""
    logger.info("Starting feature engineering pipeline")
    
    df = df.copy()
    
    df = create_price_features(df)
    
    if 'volume' in df.columns:
        df = create_volume_features(df)
    
    df['rsi'] = calculate_rsi(df['close'], period=config.RSI_PERIOD)
    
    macd, macd_signal, macd_hist = calculate_macd(
        df['close'],
        fast=config.MACD_FAST,
        slow=config.MACD_SLOW,
        signal=config.MACD_SIGNAL
    )
    df['macd'] = macd
    df['macd_signal'] = macd_signal
    df['macd_hist'] = macd_hist
    
    mas = calculate_moving_average(df['close'], config.MA_PERIODS)
    for key, val in mas.items():
        df[key] = val
    
    upper, middle, lower = calculate_bollinger_bands(df['close'])
    df['bb_upper'] = upper
    df['bb_middle'] = middle
    df['bb_lower'] = lower
    df['bb_pct'] = (df['close'] - lower) / (upper - lower)
    
    df['atr'] = calculate_atr(df['high'], df['low'], df['close'])
    
    returns = calculate_returns(df['close'], periods=[1, 5, 10])
    for key, val in returns.items():
        df[key] = val
    
    log_returns = calculate_log_returns(df['close'], periods=[1, 5])
    for key, val in log_returns.items():
        df[key] = val
    
    volatility = calculate_volatility(df['close'], periods=[10, 20])
    for key, val in volatility.items():
        df[key] = val
    
    df = create_rolling_features(df, windows=[5, 10, 20])
    
    lag_columns = ['close', 'return_1']
    if 'volume' in df.columns:
        lag_columns.insert(1, 'volume')
    df = create_lag_features(df, lag_columns, config.LAG_FEATURES)
    
    logger.info(f"Total features created: {df.shape[1]}")
    logger.info(f"Features: {list(df.columns)}")
    
    df = utils.remove_infinite_values(df)
    
    nulls_before = len(df)
    df = df.dropna()
    nulls_removed = nulls_before - len(df)
    logger.info(f"Removed {nulls_removed} rows with NaN values (from feature calculations)")
    logger.info(f"Final shape: {df.shape}")
    
    return df


def create_target(df: pd.DataFrame, target_type: str = 'return', 
                  target_periods: int = 1) -> pd.DataFrame:
    """Create target variable for prediction."""
    logger.info(f"Creating target: {target_type}")
    
    if target_type == 'return':
        df['target_return'] = df['close'].pct_change(periods=target_periods).shift(-target_periods)
    elif target_type == 'price':
        df['target_price'] = df['close'].shift(-target_periods)
    else:
        raise ValueError(f"Unknown target type: {target_type}")
    
    df = df.dropna(subset=[f'target_{target_type}'])
    
    logger.info(f"Target created: {config.TARGET_VARIABLE}")
    logger.info(f"Shape: {df.shape}")
    
    return df
