import os

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:////tmp/swasth_test_pytest.db")
os.environ.setdefault("AI_MODEL_DIR", "/tmp/swasth_models_pytest")
