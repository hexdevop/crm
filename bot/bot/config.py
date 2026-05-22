import os
from pydantic_settings import BaseSettings, SettingsConfigDict

_env_file = None if os.environ.get("ENVIRONMENT") == "production" else ".env"


class BotSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_env_file, case_sensitive=False)

    BOT_TOKEN: str = ""
    REDIS_URL: str = "redis://localhost:6379/1"
    BACKEND_INTERNAL_URL: str = "http://backend:8000"
    INTERNAL_BOT_TOKEN: str = "crm-internal-bot-token-change-in-production"
    WEBHOOK_URL: str = ""
    WEBHOOK_PATH: str = "/webhook"
    # Optional proxy for Telegram API (HTTP or SOCKS5)
    # Examples: http://user:pass@host:1080  |  socks5://user:pass@host:1080
    TELEGRAM_PROXY: str = ""


settings = BotSettings()
