import logging
import os
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

import config


def setup_logger(name: str) -> logging.Logger:
    """Setup logger for a module."""
    logger = logging.getLogger(name)
    logger.setLevel(config.LOG_LEVEL)
    
    # Create handlers
    handler = logging.StreamHandler()
    formatter = logging.Formatter(config.LOG_FORMAT)
    handler.setFormatter(formatter)
    
    # Add handler if not already added
    if not logger.handlers:
        logger.addHandler(handler)
    
    return logger


logger = setup_logger(__name__)


def calculate_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """Calculate regression metrics."""
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae = mean_absolute_error(y_true, y_pred)
    r2 = r2_score(y_true, y_pred)
    mape = np.mean(np.abs((y_true - y_pred) / y_true)) * 100
    
    return {
        "RMSE": rmse,
        "MAE": mae,
        "R2": r2,
        "MAPE": mape,
    }


def log_metrics(metrics: Dict[str, float], dataset_name: str = "Dataset"):
    """Log metrics summary."""
    logger.info(f"\n{'='*50}")
    logger.info(f"{dataset_name} Metrics:")
    logger.info(f"{'='*50}")
    for metric_name, value in metrics.items():
        logger.info(f"{metric_name}: {value:.6f}")
    logger.info(f"{'='*50}\n")


def get_csv_files(data_folders) -> List[Path]:
    """Get all CSV files from data folders."""
    if isinstance(data_folders, (str, Path)):
        data_folders = [Path(data_folders)]
    
    csv_files = []
    # Combined/aggregate files to skip (they contain duplicate data)
    skip_patterns = ['_2010_2020', '_2008_2020']
    
    for folder in data_folders:
        folder = Path(folder)
        if not folder.exists():
            logger.warning(f"Data folder not found: {folder}")
            continue
        found = sorted(folder.glob(config.CSV_PATTERN))
        # Filter out combined files to avoid double-counting
        found = [f for f in found if not any(pat in f.stem for pat in skip_patterns)]
        csv_files.extend(found)
        logger.info(f"Found {len(found)} CSV files in {folder.name}")
    
    csv_files = sorted(csv_files)
    logger.info(f"Total CSV files to load: {len(csv_files)}")
    
    if not csv_files:
        raise FileNotFoundError(f"No CSV files found in {data_folders}")
    
    return csv_files


def get_data_size(df: pd.DataFrame) -> str:
    """Get human-readable dataframe size."""
    size_bytes = df.memory_usage(deep=True).sum()
    size_mb = size_bytes / (1024 ** 2)
    return f"{size_mb:.2f} MB"


def memory_usage_summary(df: pd.DataFrame):
    """Print memory usage summary."""
    logger.info(f"Memory usage: {get_data_size(df)}")
    logger.info(f"Shape: {df.shape}")
    logger.info(f"Columns: {list(df.columns)}")


def time_series_train_test_split(
    X: pd.DataFrame,
    y: pd.Series,
    test_size: float = 0.2
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    """Split data chronologically for time-series."""
    split_idx = int(len(X) * (1 - test_size))
    
    X_train = X.iloc[:split_idx].copy()
    X_test = X.iloc[split_idx:].copy()
    y_train = y.iloc[:split_idx].copy()
    y_test = y.iloc[split_idx:].copy()
    
    logger.info(f"Train set: {X_train.shape[0]} samples")
    logger.info(f"Test set: {X_test.shape[0]} samples")
    logger.info(f"Train-Test split ratio: {split_idx}/{len(X)}")
    
    return X_train, X_test, y_train, y_test


def time_series_cv_split(
    n_samples: int,
    n_splits: int = 5,
    test_frac: float = 0.1
) -> List[Tuple[np.ndarray, np.ndarray]]:
    """Generate expanding-window CV indices for time-series."""
    fold_size = int(n_samples / (n_splits + 1))
    indices = []
    
    for i in range(n_splits):
        val_start = fold_size * (i + 1)
        val_end = val_start + fold_size
        
        train_idx = np.arange(0, val_start)
        val_idx = np.arange(val_start, min(val_end, n_samples))
        
        if len(val_idx) > 0:
            indices.append((train_idx, val_idx))
    
    logger.info(f"Created {len(indices)} time-series CV folds")
    return indices


def safe_divide(numerator: np.ndarray, denominator: np.ndarray) -> np.ndarray:
    """Safe division avoiding division by zero."""
    return np.divide(numerator, denominator, where=denominator != 0, out=np.zeros_like(numerator))


def remove_infinite_values(X: pd.DataFrame) -> pd.DataFrame:
    """Replace infinite values with NaN."""
    X_clean = X.replace([np.inf, -np.inf], np.nan)
    return X_clean


def save_metrics_to_csv(metrics: Dict, filepath: Path):
    """Save metrics to CSV file."""
    df = pd.DataFrame([metrics])
    df.to_csv(filepath, index=False)
    logger.info(f"Metrics saved to {filepath}")


def ensure_directory(path: Path):
    """Ensure directory exists."""
    path.mkdir(parents=True, exist_ok=True)
