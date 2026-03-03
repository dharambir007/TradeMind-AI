class ModelRegistryError(Exception):
    """Base exception for model registry failures."""


class TimeframeNotSupportedError(ModelRegistryError):
    """Raised when a requested timeframe is not configured."""


class ModelNotFoundError(ModelRegistryError):
    """Raised when the configured model file does not exist."""


class ModelLoadError(ModelRegistryError):
    """Raised when model loading fails."""


class InvalidMarketDataError(ValueError):
    """Raised when market data payload cannot be processed."""
