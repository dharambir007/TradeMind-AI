from abc import ABC, abstractmethod
from typing import Any, Mapping, Optional, Sequence

import pandas as pd


class BaseFeatureEngineer(ABC):
    """
    Abstract base for feature engineering strategies.
    """

    @abstractmethod
    def transform(
        self,
        market_data: Sequence[Mapping[str, Any]],
        timeframe: str,
        feature_config: Optional[Any] = None,
    ) -> pd.DataFrame:
        """
        Transform raw market candles into model-ready feature rows.
        """

    @abstractmethod
    def align_for_model(self, features: pd.DataFrame, model: Any) -> pd.DataFrame:
        """
        Align engineered features with model-expected schema.
        """
