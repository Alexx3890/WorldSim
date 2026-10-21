# WorldSim AI — Developer & Contributor Guide

This guide details the technical setup, package structure, testing workflows, and step-by-step instructions for extending WorldSim AI with new scenario packs and simulation models.

---

## 1. Repository & Monorepo Structure

```
worldsim/
├── apps/
│   ├── api/                     # FastAPI backend application
│   │   ├── app/
│   │   │   ├── main.py          # Application entrypoint & middleware
│   │   │   ├── routers/         # REST API routers (agent_simulation, health, packs, runs)
│   │   │   └── services/        # Pack registry & runner services
│   └── web/                     # Next.js 16 Web Studio frontend
│       ├── app/                 # App router pages & layouts
│       ├── components/          # React components (ResultsDashboardView, WhatIf, etc.)
│       └── lib/                 # Types, scenarioTemplates, API client
├── packages/
│   ├── agents/                  # Multi-agent pipeline (Router, Builder, Strategy, Reporter, Critic)
│   ├── engine/                  # Core SimPy runner, parallel Monte Carlo, statistical scorer
│   ├── llm_gateway/             # Gemini API client, multi-key rotation, circuit breakers
│   ├── packs/                   # Domain packs (hospital, college, office, policy, social)
│   └── shared/                  # Common Pydantic schemas, config, and logging
├── docs/                        # Architectural, API, system, and pack documentation
├── tests/                       # Pytest test suite (agents, engine, simulation, API)
├── pyproject.toml               # Python dependencies and workspace definitions
└── run_api.py                   # Convenience runner for FastAPI backend
```

---

## 2. Local Development Setup

### Prerequisites
- **Python 3.12+** with `uv` package manager installed
- **Node.js 20+** (default path on Windows: `C:\Program Files\nodejs`)

### 1. Install Python Workspace Dependencies
```powershell
uv sync
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```
Ensure your Gemini API key is configured:
```env
GEMINI_API_KEY=your_actual_key_here
```

### 3. Install Web Studio Dependencies
```powershell
cd apps/web
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npm install
cd ../..
```

---

## 3. Running Locally

### Starting the Backend Server
```powershell
uv run python run_api.py
```
- API starts at `http://127.0.0.1:8000`
- Swagger docs at `http://127.0.0.1:8000/api/docs`

### Starting the Frontend Dev Server
In a second terminal:
```powershell
cd apps/web
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npm run dev
```
- Web Studio starts at `http://localhost:3000`

---

## 4. How to Add a New Scenario Pack

Follow these 5 steps to create and register a new domain pack:

### Step 1: Create the Pack Directory Structure
Create a directory under `packages/packs/<new_pack>`:
```
packages/packs/<new_pack>/
├── manifest.toml
├── pyproject.toml
├── data/
│   └── distributions.toml
└── <new_pack>_pack/
    ├── __init__.py
    ├── schema.py
    └── model.py
```

### Step 2: Define `manifest.toml`
```toml
id = "logistics"
name = "Warehouse Freight & Delivery Operations"
version = "1.0.0"
domain = "Supply Chain & Logistics"
description = "Simulates cross-dock freight sorting, loading bay queues, and fleet dispatch delays."

[metrics]
time = "avg_dock_turnaround_hours"
risk = "p95_dispatch_delay_hours"
efficiency = "dock_bay_utilization"
cost = "cost_per_pallet_usd"
```

### Step 3: Define Input & Output Schemas (`schema.py`)
```python
from pydantic import BaseModel, Field

class LogisticsParameters(BaseModel):
    loading_bays: int = Field(default=8, ge=2, le=30)
    forklift_drivers: int = Field(default=12, ge=3, le=50)
    inbound_trucks_per_day: int = Field(default=45, ge=10, le=200)

class LogisticsMetrics(BaseModel):
    avg_dock_turnaround_hours: float
    p95_dispatch_delay_hours: float
    dock_bay_utilization: float
    cost_per_pallet_usd: float
```

### Step 4: Implement SimPy Simulation (`model.py`)
```python
import simpy
import random
from typing import Any

class LogisticsSimulation:
    def __init__(self, params: dict[str, Any], seed: int):
        self.params = params
        self.env = simpy.Environment()
        self.rng = random.Random(seed)
        self.bays = simpy.Resource(self.env, capacity=params.get("loading_bays", 8))
        self.turnaround_times: list[float] = []

    def truck_process(self, name: str):
        arrive = self.env.now
        with self.bays.request() as req:
            yield req
            # Unload duration based on distribution
            unload_time = self.rng.triangular(0.5, 1.2, 2.5)
            yield self.env.timeout(unload_time)
            self.turnaround_times.append(self.env.now - arrive)

    def run(self, until: float = 24.0) -> dict[str, float]:
        # Process logic...
        self.env.run(until=until)
        return {
            "avg_dock_turnaround_hours": sum(self.turnaround_times) / max(1, len(self.turnaround_times)),
            "p95_dispatch_delay_hours": 2.4,
            "dock_bay_utilization": 0.78,
            "cost_per_pallet_usd": 14.50,
        }
```

### Step 5: Register the Pack in Backend and Frontend
1. Add the pack to `PACK_FACTORIES` in [agent_simulation.py](file:///c:/Users/ankit/Downloads/INNOTECH/worldsim/apps/api/app/routers/agent_simulation.py).
2. Add the pack factory in [runs.py](file:///c:/Users/ankit/Downloads/INNOTECH/worldsim/apps/api/app/routers/runs.py).
3. Add domain templates to [scenarioTemplates.ts](file:///c:/Users/ankit/Downloads/INNOTECH/worldsim/apps/web/lib/scenarioTemplates.ts).

---

## 5. Running Tests & Quality Assurance

### Run Python Pytest Suite
```powershell
uv run pytest -v
```
All tests should pass (14+ test assertions covering determinism, pack registration, agent fallbacks, and API endpoints).

### Check Frontend TypeScript & Build
```powershell
cd apps/web
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npm run build
cd ../..
```
Ensures zero type errors and validates Next.js static and dynamic routing.
