"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-01-01
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    from app.database import Base
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=bind)

    op.create_index("ix_tokens_queue_status", "tokens", ["queue_id", "status"])
    op.create_index("ix_appointments_patient_scheduled", "appointments", ["patient_id", "scheduled_at"])
    op.create_index("ix_analytics_date_hospital", "analytics_records", ["date", "hospital_id"])


def downgrade() -> None:
    bind = op.get_bind()
    from app.database import Base

    Base.metadata.drop_all(bind=bind)
