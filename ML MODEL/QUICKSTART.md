"""
QUICK START GUIDE - Stock Price Prediction ML Pipeline
========================================================

This file demonstrates how to use the pipeline step-by-step.
Copy and modify for your specific use case.
"""

# ============ INSTALLATION ============
"""
1. Install dependencies:
   pip install -r requirements.txt

2. Create data folder with CSV files:
   mkdir data
   # Copy your 26 CSV files here

3. Run the complete pipeline:
   python train.py
"""

# ============ EXAMPLE 1: RUN COMPLETE PIPELINE ============
"""
Simplest way - just run everything:

$ python train.py

This will:
- Load all CSV files from 'data/' folder
- Clean and merge them
- Engineer 40+ features
- Cross-validate with 5 folds
- Tune hyperparameters with 50 Optuna trials
- Train final model
- Evaluate on test set
- Save model, metrics, and plots
- Print detailed logs to console
"""

# ============ EXAMPLE 2: CUSTOM TRAINING (Python Script) ============

import pandas as pd
from pathlib import Path

import config
import preprocess
import features
import models
import utils

# Setup
logger = utils.setup_logger(__name__)

# Step 1: Load and preprocess
logger.info("Step 1: Loading data...")
df = preprocess.preprocess(
    data_folder=config.DATA_FOLDER,
    sample=False  # Set to True for quick testing
)

# Step 2: Feature engineering
logger.info("Step 2: Engineering features...")
df = features.engineer_features(df)
df = features.create_target(df, target_type='return')  # or 'price'

# Step 3: Prepare features and target
X = df.drop(columns=[config.TARGET_VARIABLE, 'date'], errors='ignore')
y = df[config.TARGET_VARIABLE]

# Step 4: Train-test split (TIME-SERIES SAFE - NO SHUFFLING)
logger.info("Step 3: Splitting data...")
X_train, X_test, y_train, y_test = utils.time_series_train_test_split(
    X, y, test_size=config.TEST_SIZE
)

# Step 5: Split train into train and validation
val_frac = config.VAL_FRAC / (1 - config.TEST_SIZE)
X_train, X_val, y_train, y_val = utils.time_series_train_test_split(
    X_train, y_train, test_size=val_frac
)

# Step 6: Cross-validation
logger.info("Step 4: Cross-validation...")
cv_results = models.cross_validate_model(X_train, y_train, n_splits=5)

# Step 7: Hyperparameter tuning
logger.info("Step 5: Hyperparameter tuning...")
best_params = models.hyperparameter_tuning(
    X_train, y_train, X_val, y_val,
    n_trials=50
)

# Step 8: Train final model
logger.info("Step 6: Training final model...")
X_train_full = pd.concat([X_train, X_val], ignore_index=True)
y_train_full = pd.concat([y_train, y_val], ignore_index=True)

pipeline, train_metrics = models.train_model(
    X_train_full, y_train_full,
    lgb_params=best_params
)

# Step 9: Evaluate
logger.info("Step 7: Evaluating...")
y_test_pred = pipeline.predict(X_test)
test_metrics = utils.calculate_metrics(y_test.values, y_test_pred)
utils.log_metrics(test_metrics, "TEST")

# Step 10: Save
import joblib

logger.info("Step 8: Saving results...")
joblib.dump(pipeline, config.MODEL_PATH)
utils.save_metrics_to_csv(test_metrics, config.METRICS_PATH)

logger.info("✓ Complete!")


# ============ EXAMPLE 3: QUICK TESTING WITH SAMPLE DATA ============

# To test quickly with only 10,000 rows per file:
df = preprocess.preprocess(
    data_folder=config.DATA_FOLDER,
    sample=True,      # Enable sampling
    sample_size=10000 # Rows per file
)

# Rest of pipeline continues same way...


# ============ EXAMPLE 4: MODIFY TARGET VARIABLE ============

# Train to predict next-day PRICE instead of RETURN:

config.TARGET_VARIABLE = "target_price"

df = features.engineer_features(df)
df = features.create_target(df, target_type='price')  # Change this
# ... rest of pipeline ...


# ============ EXAMPLE 5: ADJUST HYPERPARAMETERS ============

# Reduce trials for faster tuning (less accurate):
config.OPTUNA_TRIALS = 20  # From 50

# Use fewer CV folds:
config.N_SPLITS = 3  # From 5

# Change feature parameters:
config.MA_PERIODS = [5, 20, 50]  # More moving averages
config.LAG_FEATURES = [1, 2, 3]   # Fewer lags


# ============ EXAMPLE 6: USE IN PRODUCTION ============

import joblib
import pandas as pd

# Load trained model
pipeline = joblib.load('output/model.pkl')

# Prepare new data (must have same features as training)
new_data = pd.read_csv('new_stock_data.csv')

# Apply preprocessing (same as training)
new_data = preprocess.standardize_columns(new_data)
new_data = preprocess.clean_data(new_data)

# Apply feature engineering (same as training)
new_data = features.engineer_features(new_data)

# Make prediction
predictions = pipeline.predict(new_data)

# Use predictions
print(f"Next day return predictions: {predictions[:5]}")


# ============ EXAMPLE 7: GET FEATURE IMPORTANCE ============

# After training
importance_df = models.get_feature_importance(pipeline, top_k=20)

# Save to CSV
importance_df.to_csv('feature_importance.csv', index=False)

# Plot
models.plot_feature_importance(
    importance_df,
    top_k=20,
    save_path='feature_importance.png'
)


# ============ EXAMPLE 8: EVALUATE ON CUSTOM DATA ============

# After training, evaluate on test set
y_test_pred = pipeline.predict(X_test)

# Get detailed metrics
metrics = utils.calculate_metrics(y_test.values, y_test_pred)

# Print nicely
utils.log_metrics(metrics, "CUSTOM TEST SET")

# Additional analysis
from sklearn.metrics import median_absolute_error

median_ae = median_absolute_error(y_test.values, y_test_pred)
print(f"Median Absolute Error: {median_ae:.6f}")


# ============ EXAMPLE 9: CUSTOM FEATURE ENGINEERING ============

def add_custom_features(df):
    """Add custom features specific to your use case"""
    df['price_momentum'] = df['close'].pct_change(periods=5)
    df['volume_spike'] = df['volume'] > df['volume'].rolling(20).mean() * 1.5
    return df

# Use in pipeline:
df = features.engineer_features(df)
df = add_custom_features(df)  # Add custom features
df = features.create_target(df)


# ============ EXAMPLE 10: MEMORY OPTIMIZATION FOR GOOGLE COLAB ============

# In Google Colab, use sampling to reduce memory:
config.CHUNK_SIZE = 25000  # Reduce chunk size

df = preprocess.preprocess(
    data_folder=config.DATA_FOLDER,
    sample=True,       # Only sample data
    sample_size=50000  # 50K rows per file
)

# Rest of pipeline continues with lower memory footprint


# ============ TROUBLESHOOTING COMMANDS ============

"""
# Check if data is loaded correctly
df = preprocess.preprocess(config.DATA_FOLDER)
print(df.head())
print(df.info())
print(df.describe())

# Check memory usage
print(utils.get_data_size(df))

# Check features created
df_with_features = features.engineer_features(df)
print(f"Total features: {df_with_features.shape[1]}")
print(list(df_with_features.columns))

# Check train-test split
X_train, X_test, y_train, y_test = utils.time_series_train_test_split(X, y)
print(f"Train: {X_train.shape}, Test: {X_test.shape}")
print(f"Date range train: {df_train['date'].min()} to {df_train['date'].max()}")
print(f"Date range test: {df_test['date'].min()} to {df_test['date'].max()}")

# Check CV split (verify no data leakage)
cv_indices = utils.time_series_cv_split(len(X), n_splits=5)
for fold, (train_idx, val_idx) in enumerate(cv_indices):
    print(f"Fold {fold}: Train {len(train_idx)}, Val {len(val_idx)}")
"""


# ============ PERFORMANCE TIPS ============

"""
1. FASTER TRAINING
   - Reduce OPTUNA_TRIALS from 50 to 20
   - Reduce N_SPLITS from 5 to 3
   - Use sample=True in preprocess()

2. LOWER MEMORY
   - Reduce CHUNK_SIZE from 50000 to 25000
   - Use sample=True with smaller sample_size
   - Drop unnecessary features after engineering

3. BETTER ACCURACY
   - Increase OPTUNA_TRIALS to 100+
   - Add more features in features.py
   - Use larger sample_size
   - Use full dataset (sample=False)

4. REPRODUCIBILITY
   - Set config.RANDOM_STATE = 42
   - Save feature names and preprocessing info
   - Document which features were used
   - Save metrics and cv_results.csv
"""


# ============ COMMON MISTAKES ============

"""
❌ WRONG: Random shuffling in time-series
    X_train = X.sample(frac=0.8)  # NO! Data leakage!

✓ CORRECT: Chronological split
    split_idx = int(len(X) * 0.8)
    X_train = X[:split_idx]
    X_test = X[split_idx:]

❌ WRONG: Scaling before split
    X_scaled = scaler.fit_transform(X)  # Leaks test data!
    X_train, X_test = train_test_split(X_scaled)

✓ CORRECT: Scale within pipeline
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('model', model)
    ])
    pipeline.fit(X_train, y_train)

❌ WRONG: Using future data as features
    df['tomorrow_close'] = df['close'].shift(-1)  # Leakage!

✓ CORRECT: Use only past data
    df['yesterday_close'] = df['close'].shift(1)  # OK!
"""

print("✓ Quick start examples ready!")
print("Run: python train.py")
