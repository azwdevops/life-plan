import os
from decouple import config, Config, RepositoryEnv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Get the project root directory (life-plan folder)
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
_env_file = os.path.join(_project_root, ".env")

# Create a config instance that reads from the .env file in project root
_env_config = Config(RepositoryEnv(_env_file))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_env_file,
        extra="ignore",  # Ignore extra environment variables that don't match field names
    )

    DATABASE_URL: str = _env_config("LIFE_PLAN_DATABASE_URL")
    OPENROUTER_API_KEY: str = _env_config("OPENROUTER_API_KEY")

    # YouTube channel management (Google OAuth). One app-level client id/secret/
    # redirect covers every Gmail account a user connects - each connected account
    # gets its own access/refresh token pair, stored per-account in the DB.
    # Optional at startup - the "Connect account" endpoint returns a clear error
    # if these are unset, rather than crashing the whole app before they're configured.
    GOOGLE_CLIENT_ID: str = _env_config("LIFE_PLAN_GOOGLE_CLIENT_ID", default="")
    GOOGLE_CLIENT_SECRET: str = _env_config("LIFE_PLAN_GOOGLE_CLIENT_SECRET", default="")
    # Must exactly match an "Authorized redirect URI" on the Google Cloud OAuth
    # client (e.g. http://localhost:8000/api/v1/youtube/oauth/callback in dev).
    GOOGLE_OAUTH_REDIRECT_URI: str = _env_config("LIFE_PLAN_GOOGLE_OAUTH_REDIRECT_URI", default="")
    # Where to send the browser back to after the OAuth callback completes.
    FRONTEND_URL: str = _env_config("LIFE_PLAN_FRONTEND_URL", default="http://localhost:3000")


settings = Settings()
