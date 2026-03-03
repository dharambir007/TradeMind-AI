"""Inference script for saved models."""

import joblib
import pandas as pd
import numpy as np

import config
import preprocess
import features
import utils

logger = utils.setup_logger(__name__)


def load_model(model_path=None):
    if model_path is None:
        model_path = config.MODEL_PATH
    
    logger.info(f"Loading model from {model_path}")
    pipeline = joblib.load(model_path)
    logger.info("Model loaded successfully!")
    return pipeline


def predict_on_new_data(pipeline, data_folders=None, n_latest=5):
    """Run predictions on preprocessed data."""
    logger.info("=" * 60)
    logger.info("INFERENCE MODE")
    logger.info("=" * 60)
    
    if data_folders is None:
        data_folders = config.DATA_FOLDERS
    
    df = preprocess.preprocess(data_folders=data_folders, sample=False)
    df = features.engineer_features(df)
    df = features.create_target(df, target_type='return')
    
    target_col = config.TARGET_VARIABLE
    X = df.drop(columns=[target_col, 'date'], errors='ignore')
    y_actual = df[target_col]
    dates = df['date'] if 'date' in df.columns else pd.RangeIndex(len(df))
    
    logger.info(f"Running predictions on {len(X)} samples...")
    y_pred = pipeline.predict(X)
    
    logger.info(f"\n{'=' * 60}")
    logger.info(f"LATEST {n_latest} PREDICTIONS vs ACTUAL")
    logger.info(f"{'=' * 60}")
    
    results = pd.DataFrame({
        'date': dates.values[-n_latest:],
        'actual_return': y_actual.values[-n_latest:],
        'predicted_return': y_pred[-n_latest:],
        'error': np.abs(y_actual.values[-n_latest:] - y_pred[-n_latest:]),
    })
    
    for _, row in results.iterrows():
        direction_actual = "+" if row['actual_return'] > 0 else "-"
        direction_pred = "+" if row['predicted_return'] > 0 else "-"
        match = "Y" if direction_actual == direction_pred else "N"
        logger.info(
            f"  {row['date']} | Actual: {row['actual_return']:+.4f} {direction_actual} | "
            f"Pred: {row['predicted_return']:+.4f} {direction_pred} | {match}"
        )
    
    full_metrics = utils.calculate_metrics(y_actual.values, y_pred)
    utils.log_metrics(full_metrics, "FULL DATASET")
    
    direction_correct = np.sum(
        (y_actual.values > 0) == (y_pred > 0)
    )
    direction_accuracy = direction_correct / len(y_actual) * 100
    logger.info(f"Direction accuracy: {direction_accuracy:.1f}% ({direction_correct}/{len(y_actual)})")
    
    return results


if __name__ == "__main__":
    pipeline = load_model()

    results = predict_on_new_data(pipeline, n_latest=10)

    output_path = config.OUTPUT_DIR / "inference_results.csv"
    results.to_csv(output_path, index=False)
    logger.info(f"\nResults saved to {output_path}")
    logger.info("Inference completed successfully!")
