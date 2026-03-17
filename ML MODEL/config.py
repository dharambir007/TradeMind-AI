import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
DATA_FOLDERS = [PROJECT_ROOT / "BANK_NIFTY_data", PROJECT_ROOT / "NIFTY_data"]

_model_dir_env = os.getenv("MODEL_DIR", "").strip()
if _model_dir_env:
    configured_model_dir = Path(_model_dir_env).expanduser()
    if not configured_model_dir.is_absolute():
        configured_model_dir = Path(os.getcwd()).resolve() / configured_model_dir
    OUTPUT_DIR = configured_model_dir.resolve()
else:
    OUTPUT_DIR = (PROJECT_ROOT / "output").resolve()

MODEL_PATH = (OUTPUT_DIR / "model.pkl").resolve()
METRICS_PATH = (OUTPUT_DIR / "metrics.csv").resolve()
FEATURE_IMPORTANCE_PATH = (OUTPUT_DIR / "feature_importance.png").resolve()
PREPROCESSED_DATA_PATH = (OUTPUT_DIR / "preprocessed_data.parquet").resolve()

OUTPUT_DIR.mkdir(exist_ok=True)

CSV_PATTERN = "*.csv"
CHUNK_SIZE = 50000
TEST_SIZE = 0.2
RANDOM_STATE = 42

TARGET_VARIABLE = "target_return"
LAG_FEATURES = [1, 2, 3, 5]
MA_PERIODS = [10, 50]
RSI_PERIOD = 14
MACD_FAST = 12
MACD_SLOW = 26
MACD_SIGNAL = 9

MODEL_TYPE = "lgb"
TEST_FRAC = 0.2
VAL_FRAC = 0.1

# LightGBM parameters
LGB_BASE_PARAMS = {
    "objective": "regression",
    "metric": "rmse",
    "learning_rate": 0.05,
    "num_leaves": 31,
    "max_depth": -1,
    "n_jobs": -1,
    "verbose": -1,
}

# Hyperparameter search space for Optuna
OPTUNA_PARAMS = {
    "num_leaves": (20, 100),
    "max_depth": (3, 15),
    "learning_rate": (0.01, 0.2),
    "min_data_in_leaf": (5, 50),
    "feature_fraction": (0.5, 1.0),
    "bagging_fraction": (0.5, 1.0),
    "lambda_l1": (0, 5),
    "lambda_l2": (0, 5),
}

N_SPLITS = 5
OPTUNA_TRIALS = 50
N_JOBS = -1

LOG_LEVEL = "INFO"
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
