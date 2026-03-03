import gc
from pathlib import Path
from typing import Optional

import pandas as pd

import config
import utils

logger = utils.setup_logger(__name__)


def load_csv_files(data_folders, sample: bool = False, sample_size: int = 10000) -> pd.DataFrame:
    """Load and merge all CSV files from given folders."""
    csv_files = utils.get_csv_files(data_folders)
    logger.info(f"Loading {len(csv_files)} CSV files...")
    
    dfs = []
    
    for i, csv_file in enumerate(csv_files):
        logger.info(f"Loading {i+1}/{len(csv_files)}: {csv_file.name}")
        
        try:
            if sample:
                df = pd.read_csv(csv_file, nrows=sample_size)
            else:
                df = pd.read_csv(csv_file)
            
            logger.info(f"  Loaded shape: {df.shape}, columns: {list(df.columns)}")
            dfs.append(df)
            
            if i % 5 == 0:
                gc.collect()
                
        except Exception as e:
            logger.error(f"Error loading {csv_file.name}: {e}")
            continue
    
    if not dfs:
        raise ValueError("No valid CSV files loaded")
    
    logger.info(f"Concatenating {len(dfs)} dataframes...")
    df_merged = pd.concat(dfs, ignore_index=True)
    
    logger.info(f"Merged shape: {df_merged.shape}")
    logger.info(f"Memory usage: {utils.get_data_size(df_merged)}")
    
    return df_merged


def standardize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Standardize column names to lowercase."""
    df.columns = df.columns.str.lower().str.strip()
    logger.info(f"Columns after standardization: {list(df.columns)}")
    
    # Check for required columns (volume is optional for index data)
    required_cols = {'date', 'open', 'high', 'low', 'close'}
    available_cols = set(df.columns)
    
    missing_cols = required_cols - available_cols
    if missing_cols:
        logger.warning(f"Missing expected columns: {missing_cols}")
        logger.info(f"Available columns: {available_cols}")
    
    if 'volume' not in df.columns:
        logger.info("Volume column not found — creating synthetic volume from price range")
        df['volume'] = ((df['high'] - df['low']) * 1000).clip(lower=1).astype(int)
    
    return df


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """Clean data: convert dates, remove nulls and duplicates, sort."""
    logger.info("Starting data cleaning...")
    logger.info(f"Initial shape: {df.shape}")
    
    if 'instrument' in df.columns:
        instruments = df['instrument'].unique()
        logger.info(f"Instruments found: {instruments}")
        df = df.drop(columns=['instrument'])
    
    if 'date' in df.columns:
        df['date'] = pd.to_datetime(df['date'], format='%Y%m%d', errors='coerce')
    
    if 'time' in df.columns:
        df = df.drop(columns=['time'])
    
    nat_before = len(df)
    df = df.dropna(subset=['date'])
    nat_removed = nat_before - len(df)
    logger.info(f"Removed {nat_removed} rows with invalid dates")
    
    nulls_before = len(df)
    df = df.dropna()
    nulls_removed = nulls_before - len(df)
    logger.info(f"Removed {nulls_removed} rows with null values")
    
    dupes_before = len(df)
    df = df.drop_duplicates(subset=['date', 'close'], keep='first')
    dupes_removed = dupes_before - len(df)
    logger.info(f"Removed {dupes_removed} duplicate rows")
    
    df = df.sort_values('date').reset_index(drop=True)
    logger.info(f"Final shape: {df.shape}")
    logger.info(f"Date range: {df['date'].min()} to {df['date'].max()}")
    
    return df


def handle_outliers(df: pd.DataFrame, columns: list = None, std_threshold: float = 5.0) -> pd.DataFrame:
    """Cap outliers using z-score method."""
    if columns is None:
        columns = ['open', 'high', 'low', 'close', 'volume']
    
    columns = [col for col in columns if col in df.columns]
    logger.info(f"Handling outliers in columns: {columns}")
    
    for col in columns:
        mean = df[col].mean()
        std = df[col].std()
        
        lower_bound = mean - std_threshold * std
        upper_bound = mean + std_threshold * std
        
        outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)]
        logger.info(f"  {col}: Found {len(outliers)} outliers")
        
        df[col] = df[col].clip(lower_bound, upper_bound)
    
    return df


def validate_data(df: pd.DataFrame) -> bool:
    """Run basic data quality checks."""
    price_cols = [c for c in ['open', 'high', 'low', 'close'] if c in df.columns]
    checks = {
        "has_data": len(df) > 0,
        "has_date": 'date' in df.columns,
        "has_ohlc": all(col in df.columns for col in ['open', 'high', 'low', 'close']),
        "no_nulls": df.isnull().sum().sum() == 0,
        "date_sorted": df['date'].is_monotonic_increasing if 'date' in df.columns else False,
        "positive_prices": (df[price_cols] > 0).all().all() if price_cols else False,
    }
    
    logger.info("\nData validation:")
    all_passed = True
    for check, passed in checks.items():
        status = "✓" if passed else "✗"
        logger.info(f"  {status} {check}")
        if not passed:
            all_passed = False
    
    return all_passed


def aggregate_to_daily(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate intraday data to daily OHLC bars."""
    logger.info("Aggregating intraday data to daily OHLC bars...")
    logger.info(f"Rows before aggregation: {len(df)}")
    
    agg_dict = {
        'open': 'first',
        'high': 'max',
        'low': 'min',
        'close': 'last',
    }
    
    if 'volume' in df.columns:
        agg_dict['volume'] = 'sum'
    
    df_daily = df.groupby('date').agg(agg_dict).reset_index()
    df_daily = df_daily.sort_values('date').reset_index(drop=True)
    
    logger.info(f"Rows after aggregation: {len(df_daily)} trading days")
    
    return df_daily


def preprocess(data_folders=None, sample: bool = False) -> pd.DataFrame:
    """Run full preprocessing pipeline."""
    logger.info("Starting preprocessing pipeline")
    
    if data_folders is None:
        data_folders = config.DATA_FOLDERS
    
    df = load_csv_files(data_folders, sample=sample)
    df = standardize_columns(df)
    df = clean_data(df)
    df = aggregate_to_daily(df)
    df = handle_outliers(df)
    is_valid = validate_data(df)
    
    if not is_valid:
        logger.warning("Data validation failed but continuing...")
    
    logger.info(f"Preprocessing complete! Final shape: {df.shape}")
    
    return df
