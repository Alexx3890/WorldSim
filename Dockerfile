# WorldSim AI Backend Dockerfile
# Optimized for Render / Railway / Docker deployments with uv
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# Performance & environment settings
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV PYTHONUNBUFFERED=1
ENV HOST=0.0.0.0
ENV PORT=8000

# Copy workspace definition and source code
COPY pyproject.toml uv.lock ./
COPY packages/ packages/
COPY apps/api/ apps/api/
COPY config/ config/
COPY run_api.py ./

# Sync production dependencies across all workspace packages
RUN uv sync --frozen --no-dev

EXPOSE 8000

# Launch WorldSim API and SimPy engine
CMD ["uv", "run", "python", "run_api.py"]
