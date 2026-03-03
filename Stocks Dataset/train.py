import gc
import joblib
from pathlib import Path

import pandas as pd

import config
import utils
import preprocess
import features
import models

logger = utils.setup_logger(__name__)


def main():
    """Run the full training pipeline."""
    
    logger.info("\n")
    logger.info("╔" + "="*58 + "╗")
    logger.info("║" + " "*58 + "║")
    logger.info("║" + "STOCK PRICE PREDICTION - ML TRAINING PIPELINE".center(58) + "║")
    logger.info("║" + " "*58 + "║")
    logger.info("╚" + "="*58 + "╝")
    
    logger.info("\n[STEP 1] Loading and preprocessing data...")
    
    df = preprocess.preprocess(
        data_folders=config.DATA_FOLDERS,
        sample=False  # Set to True for quick testing
    )
    
    logger.info(f"Data shape after preprocessing: {df.shape}")
    logger.info(f"Memory usage: {utils.get_data_size(df)}")
    
    logger.info("\n[STEP 2] Feature engineering...")
    
    df = features.engineer_features(df)
    df = features.create_target(df, target_type='return')
    
    logger.info(f"Data shape after feature engineering: {df.shape}")
    logger.info(f"Memory usage: {utils.get_data_size(df)}")
    
    target_col = config.TARGET_VARIABLE
    X = df.drop(columns=[target_col, 'date'], errors='ignore')
    y = df[target_col]
    
    logger.info(f"Features shape: {X.shape}")
    logger.info(f"Target shape: {y.shape}")
    
    logger.info("\n[STEP 3] Train-test split (time-series safe)...")
    
    X_train, X_test, y_train, y_test = utils.time_series_train_test_split(
        X, y, test_size=config.TEST_SIZE
    )
    
    val_frac = config.VAL_FRAC / (1 - config.TEST_SIZE)
    X_train, X_val, y_train, y_val = utils.time_series_train_test_split(
        X_train, y_train, test_size=val_frac
    )
    
    logger.info(f"Final split - Train: {X_train.shape[0]}, Val: {X_val.shape[0]}, Test: {X_test.shape[0]}")
    
    del df
    gc.collect()
    
    logger.info("\n[STEP 4] Time-series cross-validation...")
    
    cv_results = models.cross_validate_model(X_train, y_train, n_splits=config.N_SPLITS)
    
    logger.info("\n[STEP 5] Hyperparameter tuning with Optuna...")
    
    best_params = models.hyperparameter_tuning(
        X_train, y_train, X_val, y_val,
        n_trials=config.OPTUNA_TRIALS
    )
    
    logger.info("\n[STEP 6] Training final model with best hyperparameters...")
    
    X_train_full = pd.concat([X_train, X_val], ignore_index=True)
    y_train_full = pd.concat([y_train, y_val], ignore_index=True)
    
    final_pipeline, train_metrics = models.train_model(
        X_train_full, y_train_full,
        lgb_params=best_params
    )
    
    logger.info("\n[STEP 7] Evaluating on test set...")
    
    y_test_pred = final_pipeline.predict(X_test)
    test_metrics = utils.calculate_metrics(y_test.values, y_test_pred)
    utils.log_metrics(test_metrics, "TEST")
    
    logger.info("\n[STEP 8] Feature importance analysis...")
    
    importance_df = models.get_feature_importance(final_pipeline, top_k=20)
    models.plot_feature_importance(
        importance_df,
        top_k=20,
        save_path=config.FEATURE_IMPORTANCE_PATH
    )
    
    logger.info("\n[STEP 9] Saving results...")
    
    joblib.dump(final_pipeline, config.MODEL_PATH)
    logger.info(f"Model saved to {config.MODEL_PATH}")
    
    all_metrics = {
        'Train_RMSE': train_metrics.get('RMSE', 0),
        'Train_MAE': train_metrics.get('MAE', 0),
        'Train_R2': train_metrics.get('R2', 0),
        'Test_RMSE': test_metrics.get('RMSE', 0),
        'Test_MAE': test_metrics.get('MAE', 0),
        'Test_R2': test_metrics.get('R2', 0),
        'CV_RMSE_Mean': pd.Series(cv_results['RMSE']).mean(),
        'CV_RMSE_Std': pd.Series(cv_results['RMSE']).std(),
    }
    
    utils.save_metrics_to_csv(all_metrics, config.METRICS_PATH)
    
    importance_df.to_csv(config.OUTPUT_DIR / 'feature_importance.csv', index=False)
    logger.info(f"Feature importance saved to {config.OUTPUT_DIR / 'feature_importance.csv'}")
    
    cv_df = pd.DataFrame(cv_results)
    cv_df.to_csv(config.OUTPUT_DIR / 'cv_results.csv', index=False)
    logger.info(f"CV results saved to {config.OUTPUT_DIR / 'cv_results.csv'}")
    
    logger.info("\n")
    logger.info("╔" + "="*58 + "╗")
    logger.info("║" + "TRAINING COMPLETE".center(58) + "║")
    logger.info("╠" + "="*58 + "╣")
    logger.info(f"║ Model: {str(config.MODEL_PATH).ljust(52)} ║")
    logger.info(f"║ Metrics: {str(config.METRICS_PATH).ljust(50)} ║")
    logger.info(f"║ Feature Importance: {str(config.FEATURE_IMPORTANCE_PATH).ljust(36)} ║")
    logger.info("╠" + "="*58 + "╣")
    rmse_str = f"{test_metrics['RMSE']:.6f}"
    mae_str = f"{test_metrics['MAE']:.6f}"
    r2_str = f"{test_metrics['R2']:.6f}"
    logger.info(f"║ Test RMSE: {rmse_str.ljust(44)} ║")
    logger.info(f"║ Test MAE: {mae_str.ljust(45)} ║")
    logger.info(f"║ Test R²: {r2_str.ljust(46)} ║")
    logger.info("╚" + "="*58 + "╝")
    
    logger.info("\n✓ Pipeline execution completed successfully!")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.error(f"Pipeline failed with error: {e}", exc_info=True)
        raise