"""Application settings, loaded from environment / .env (pydantic-settings)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Anthropic / Claude
    anthropic_api_key: str | None = None
    voiant_model_default: str = "claude-sonnet-4-6"
    voiant_model_complex: str = "claude-opus-4-8"
    voiant_model_classifier: str = "claude-haiku-4-5-20251001"  # small/fast model for intent routing

    # Per-model pricing ($ per 1M tokens) — configurable reference data (external Anthropic list
    # prices), used only to estimate request cost from real token usage. Update if pricing changes.
    voiant_model_pricing: dict[str, dict[str, float]] = {
        "claude-opus-4-8": {"input": 5.0, "output": 25.0},
        "claude-opus-4-7": {"input": 5.0, "output": 25.0},
        "claude-sonnet-5": {"input": 3.0, "output": 15.0},
        "claude-sonnet-4-6": {"input": 3.0, "output": 15.0},
        "claude-haiku-4-5": {"input": 1.0, "output": 5.0},
        "claude-haiku-4-5-20251001": {"input": 1.0, "output": 5.0},
    }

    # Bright Masker (PII detection + masking)
    bright_shield_base_url: str = "https://36owxpb34jb9et-8000.proxy.runpod.net"
    bright_shield_enabled: bool = True
    bright_shield_timeout_seconds: int = 60

    # Application
    voiant_client_id: str = "rapid7"
    # Seed config: the DB (client_config table) is authoritative at runtime; this YAML
    # is the human-readable starting point used to seed a client on first boot.
    voiant_config_path: str = "config/client_rapid7.yaml"
    voiant_data_dir: str = "data"
    voiant_dataset_seed: int = 42
    voiant_frontend_origin: str = "http://localhost:5173"

    # Data source: where the rep dataset comes from.
    #   synthetic → generated in-memory (default)
    #   csv       → read VOIANT_DATA_CSV_PATH (a spreadsheet of reps)
    #   database  → read VOIANT_DATABASE_URL using VOIANT_DB_QUERY (table or SELECT)
    voiant_data_source: str = "synthetic"
    voiant_data_csv_path: str = ""
    voiant_database_url: str = ""
    voiant_db_query: str = "reps"
    # Safety valve on rows pulled into memory — generous enough for any realistic sales-rep
    # dataset (tens of thousands). Raise it for larger tenants; it only guards against an
    # accidental unbounded load, and logs a warning if hit.
    voiant_max_reps: int = 100000
    # Whether to show the "MOCK DATA" label. Keep True while the DB holds seeded
    # synthetic data; set False only when real production data is loaded.
    voiant_mock_data: bool = True

    # Demo login credentials — supplied ONLY via env (VOIANT_AUTH_USER / VOIANT_AUTH_PASSWORD).
    # No hardcoded defaults: if unset, login is disabled (fail-closed).
    voiant_auth_user: str = ""
    voiant_auth_password: str = ""

    @property
    def config_path(self) -> Path:
        p = Path(self.voiant_config_path)
        return p if p.is_absolute() else BACKEND_ROOT / p

    @property
    def data_dir(self) -> Path:
        p = Path(self.voiant_data_dir)
        return p if p.is_absolute() else BACKEND_ROOT / p

    @property
    def prompts_dir(self) -> Path:
        return BACKEND_ROOT / "config" / "prompts"

    @property
    def llm_enabled(self) -> bool:
        return bool(self.anthropic_api_key)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.data_dir.mkdir(parents=True, exist_ok=True)
    return s
