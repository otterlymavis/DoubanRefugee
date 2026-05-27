from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    app_secret_key: str = "dev-secret-change-me"
    database_url: str = "sqlite:///./douban_refugee.db"
    redis_url: str = "redis://localhost:6379/0"
    frontend_origin: str = "http://localhost:3000"
    export_storage_dir: str = "./storage/exports"
    cookie_encryption_key: str = "dev-cookie-key"
    tmdb_api_key: str | None = None
    open_library_base_url: str = "https://openlibrary.org"
    musicbrainz_base_url: str = "https://musicbrainz.org/ws/2"
    douban_request_min_delay_seconds: int = Field(default=2, ge=0)
    douban_request_max_delay_seconds: int = Field(default=9, ge=0)


@lru_cache
def get_settings() -> Settings:
    return Settings()

