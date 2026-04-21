# Preflight scanner — Fly.io target image.
# Multi-stage: builder installs deps into a venv, runtime copies the venv only.

FROM python:3.11-slim AS builder

# libgl1 / libxrender1: trimesh image-op deps.
# libcairo2-dev / libpango1.0-dev / pkg-config: Phase 2B cairocffi build-time deps.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libxrender1 \
    libcairo2-dev \
    libpango1.0-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY requirements.txt .
RUN python -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir --upgrade pip && \
    /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# -----------------------------------------------------------------------------

FROM python:3.11-slim AS runtime

# trimesh needs libgl + libxrender at runtime for some image ops even
# when we never open a window. matplotlib needs libfreetype.
# Phase 2B: libcairo2 + libpango-1.0-0 for cairocffi runtime SVG rendering.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libxrender1 \
    libfreetype6 \
    libcairo2 \
    libpango-1.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 scanner \
    && useradd --system --uid 1001 --gid scanner --home-dir /app scanner

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONPATH="/app/src" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MPLBACKEND=Agg

WORKDIR /app
COPY --chown=scanner:scanner src /app/src
USER scanner

# Poll interval, dry-run default, and Supabase URL / key come from env.
# See .env.example for the full list.
CMD ["python", "-m", "worker.main"]
