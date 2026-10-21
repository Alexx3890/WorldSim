# WorldSim AI — Frontend Web Application

Modern Next.js web application for WorldSim AI: discrete-event decision simulation, LangGraph multi-agent orchestration, and Pareto ranking.

## Quick Start (Running Frontend)

Ensure Node.js is available in your terminal path, then start the development server:

### PowerShell
```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npm run dev
```

### Command Prompt (`cmd.exe`)
```cmd
set PATH=C:\Program Files\nodejs;%PATH%
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running the Complete System (Both Backend & Frontend)

To run the full WorldSim AI platform with real-time Monte Carlo simulations and AI multi-agent planning:

### 1. Terminal 1: Start the Backend (FastAPI / SimPy)
Run from `worldsim` (or `INNOTECH`):

```powershell
uv run python run_api.py
```

- API will be live at: [http://localhost:8000](http://localhost:8000)
- Interactive Swagger docs: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

### 2. Terminal 2: Start the Frontend (Next.js)
Run from the `worldsim` root folder (or `apps/web`):

```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npm run dev
```
- Web Application: [http://localhost:3000](http://localhost:3000)

---

## Useful Commands

| Task | Command |
| :--- | :--- |
| **Start Frontend** | `npm run dev` |
| **Start Backend** | `npm run backend` (or `uv run uvicorn app.main:app --app-dir apps/api --host 127.0.0.1 --port 8000 --reload`) |
| **Build Web App** | `npm run build` |
| **Run Python Tests** | `uv run pytest` |
| **Type Check** | `npx pyright packages tests apps/api` |
