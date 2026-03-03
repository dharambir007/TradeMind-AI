import gc
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import lightgbm as lgb
import optuna

import config
import utils

logger = utils.setup_logger(__name__)


def create_lgb_pipeline(scaler: StandardScaler = None, lgb_params: Dict = None) -> Pipeline:
    """Create LightGBM pipeline with optional scaling."""
    if lgb_params is None:
        lgb_params = config.LGB_BASE_PARAMS.copy()
    
    steps = []
    
    if scaler is not None:
        steps.append(('scaler', scaler))
    
    steps.append(('model', lgb.LGBMRegressor(
        num_leaves=lgb_params.get('num_leaves', 31),
        max_depth=lgb_params.get('max_depth', -1),
        learning_rate=lgb_params.get('learning_rate', 0.05),
        n_estimators=lgb_params.get('n_estimators', 1000),
        objective='regression',
        metric='rmse',
        n_jobs=config.N_JOBS,
        verbose=-1,
        random_state=config.RANDOM_STATE,
    )))
    
    pipeline = Pipeline(steps)
    return pipeline


def train_model(X_train: pd.DataFrame, y_train: pd.Series,
                X_val: pd.DataFrame = None, y_val: pd.Series = None,
                lgb_params: Dict = None) -> Tuple[Pipeline, Dict]:
    """Train LightGBM model and return pipeline with metrics."""
    logger.info("Training model...")
    
    if lgb_params is None:
        lgb_params = config.LGB_BASE_PARAMS.copy()
    
    scaler = StandardScaler()
    scaler.set_output(transform='pandas')
    pipeline = create_lgb_pipeline(scaler=scaler, lgb_params=lgb_params)
    
    logger.info(f"Training set shape: {X_train.shape}")
    pipeline.fit(X_train, y_train)
    
    y_train_pred = pipeline.predict(X_train)
    train_metrics = utils.calculate_metrics(y_train.values, y_train_pred)
    utils.log_metrics(train_metrics, "TRAIN")
    
    if X_val is not None and y_val is not None:
        logger.info(f"Validation set shape: {X_val.shape}")
        y_val_pred = pipeline.predict(X_val)
        val_metrics = utils.calculate_metrics(y_val.values, y_val_pred)
        utils.log_metrics(val_metrics, "VALIDATION")
    
    
    return pipeline, train_metrics


def cross_validate_model(X: pd.DataFrame, y: pd.Series,
                        n_splits: int = 5) -> Dict[str, List[float]]:
    """Run time-series cross-validation."""
    logger.info(f"Running {n_splits}-fold cross validation")
    
    cv_indices = utils.time_series_cv_split(len(X), n_splits=n_splits)
    
    cv_results = {
        'fold': [],
        'RMSE': [],
        'MAE': [],
        'R2': [],
        'MAPE': [],
    }
    
    for fold, (train_idx, val_idx) in enumerate(cv_indices):
        logger.info(f"\nFold {fold + 1}/{len(cv_indices)}")
        
        X_train_fold = X.iloc[train_idx]
        y_train_fold = y.iloc[train_idx]
        X_val_fold = X.iloc[val_idx]
        y_val_fold = y.iloc[val_idx]
        
        pipeline, _ = train_model(X_train_fold, y_train_fold)
        y_val_pred = pipeline.predict(X_val_fold)
        fold_metrics = utils.calculate_metrics(y_val_fold.values, y_val_pred)
        
        cv_results['fold'].append(fold + 1)
        for metric_name, value in fold_metrics.items():
            cv_results[metric_name].append(value)
        
        logger.info(f"Fold metrics: {fold_metrics}")
    
    logger.info("Cross validation summary:")
    
    for metric in ['RMSE', 'MAE', 'R2', 'MAPE']:
        values = cv_results[metric]
        logger.info(f"{metric}: {np.mean(values):.6f} (+/- {np.std(values):.6f})")
    
    
    return cv_results


def objective_function(trial, X_train: pd.DataFrame, y_train: pd.Series,
                      X_val: pd.DataFrame, y_val: pd.Series) -> float:
    """Optuna objective function, returns validation RMSE."""
    params = {
        'num_leaves': trial.suggest_int('num_leaves', *config.OPTUNA_PARAMS['num_leaves']),
        'max_depth': trial.suggest_int('max_depth', *config.OPTUNA_PARAMS['max_depth']),
        'learning_rate': trial.suggest_float('learning_rate', *config.OPTUNA_PARAMS['learning_rate']),
        'min_data_in_leaf': trial.suggest_int('min_data_in_leaf', *config.OPTUNA_PARAMS['min_data_in_leaf']),
        'feature_fraction': trial.suggest_float('feature_fraction', *config.OPTUNA_PARAMS['feature_fraction']),
        'bagging_fraction': trial.suggest_float('bagging_fraction', *config.OPTUNA_PARAMS['bagging_fraction']),
        'lambda_l1': trial.suggest_float('lambda_l1', *config.OPTUNA_PARAMS['lambda_l1']),
        'lambda_l2': trial.suggest_float('lambda_l2', *config.OPTUNA_PARAMS['lambda_l2']),
    }
    
    pipeline, _ = train_model(X_train, y_train, lgb_params=params)
    y_val_pred = pipeline.predict(X_val)
    rmse = np.sqrt(np.mean((y_val.values - y_val_pred) ** 2))
    
    return rmse


def hyperparameter_tuning(X_train: pd.DataFrame, y_train: pd.Series,
                         X_val: pd.DataFrame, y_val: pd.Series,
                         n_trials: int = 50) -> Dict:
    """Run Optuna hyperparameter search."""
    logger.info(f"Starting hyperparameter tuning with {n_trials} trials")
    
    study = optuna.create_study(
        direction='minimize',
        sampler=optuna.samplers.TPESampler(seed=config.RANDOM_STATE)
    )
    
    study.optimize(
        lambda trial: objective_function(trial, X_train, y_train, X_val, y_val),
        n_trials=n_trials,
        show_progress_bar=True
    )
    
    best_params = study.best_params
    best_value = study.best_value
    
    logger.info(f"Best RMSE: {best_value:.6f}")
    for param_name, param_value in best_params.items():
        logger.info(f"{param_name}: {param_value}")
    
    return best_params


def get_feature_importance(pipeline: Pipeline, top_k: int = 20) -> pd.DataFrame:
    """Extract feature importance from trained pipeline."""
    model = pipeline.named_steps['model']
    
    importances = model.feature_importances_
    
    try:
        feature_names = model.feature_name_
    except AttributeError:
        try:
            feature_names = pipeline[:-1].get_feature_names_out()
        except Exception:
            feature_names = [f"feature_{i}" for i in range(len(importances))]
    
    importance_df = pd.DataFrame({
        'feature': feature_names,
        'importance': importances,
    }).sort_values('importance', ascending=False)
    
    logger.info(f"Top {top_k} features:")
    for idx, row in importance_df.head(top_k).iterrows():
        logger.info(f"{row['feature']:30s}: {row['importance']:.6f}")
    
    return importance_df


def plot_feature_importance(importance_df: pd.DataFrame, top_k: int = 20,
                           save_path = None):
    """Plot top feature importances as horizontal bar chart."""
    try:
        import matplotlib.pyplot as plt
        
        top_features = importance_df.head(top_k)
        
        plt.figure(figsize=(12, 8))
        plt.barh(range(len(top_features)), top_features['importance'].values)
        plt.yticks(range(len(top_features)), top_features['feature'].values)
        plt.xlabel('Importance')
        plt.title(f'Top {top_k} Feature Importance')
        plt.gca().invert_yaxis()
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            logger.info(f"Feature importance plot saved to {save_path}")
        
        plt.close()
        
    except ImportError:
        logger.warning("Matplotlib not installed, skipping plot generation")
