from pydantic_settings import BaseSettings, SettingsConfigDict


class BotSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    BOT_TOKEN: str = ""
    REDIS_URL: str = "redis://localhost:6379/1"
    BACKEND_INTERNAL_URL: str = "http://backend:8000"
    INTERNAL_BOT_TOKEN: str = "crm-internal-bot-token-change-in-production"
    WEBHOOK_URL: str = ""
    WEBHOOK_PATH: str = "/webhook"


settings = BotSettings()
