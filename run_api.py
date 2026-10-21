"""
WorldSim API Server Launcher
============================
Starts the FastAPI application and SimPy engine.
Usage:
  cd worldsim
  uv run python run_api.py
"""
import sys
from pathlib import Path
import uvicorn

# Ensure absolute paths to apps/api and all packages are always on sys.path
ROOT = Path(__file__).resolve().parent

paths = [
    ROOT / "apps" / "api",
    ROOT / "packages" / "shared",
    ROOT / "packages" / "engine",
    ROOT / "packages" / "packs" / "hospital",
    ROOT / "packages" / "packs" / "college",
    ROOT / "packages" / "packs" / "office",
    ROOT / "packages" / "packs" / "policy",
    ROOT / "packages" / "packs" / "social",
    ROOT / "packages" / "llm_gateway",
    ROOT / "packages" / "agents",
]

for p in paths:
    if p.exists() and str(p) not in sys.path:
        sys.path.insert(0, str(p))

if __name__ == "__main__":
    print(f"Starting WorldSim API on http://127.0.0.1:8000 ...")
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        app_dir=str(ROOT / "apps" / "api"),
        log_level="info",
    )
