# WorldSim AI — Vercel Deployment Guide

This guide walks you through deploying the **WorldSim AI Web Studio** to [Vercel](https://vercel.com) and connecting it to your simulation backend.

---

## 1. Architecture for Production

WorldSim AI is designed as a decoupled full-stack platform:
- **Frontend (Web Studio)**: Next.js 16 (App Router, Turbopack, React 19) hosted on **Vercel** for edge caching, asset delivery, and responsive UI.
- **Backend (Simulation Engine)**: FastAPI, SimPy, and multiprocessing Monte Carlo hosted on a container runtime like **Railway**, **Render**, **Fly.io**, or **AWS ECS/EC2**.
- **Resilient Fallback Mode**: If the backend is cold-starting or not yet linked, the Vercel deployment automatically runs in **Client Simulation Mode**, allowing visitors to interact with all 15 scenario templates, graphs, and live sliders.

---

## 2. Deploying to Vercel (Step-by-Step)

### Option A: Using the Vercel Web Dashboard (Recommended)

1. **Push your code to GitHub / GitLab / Bitbucket**:
   ```powershell
   git init
   git add .
   git commit -m "feat: complete worldsim platform"
   git branch -M main
   git remote add origin https://github.com/your-username/worldsim.git
   git push -u origin main
   ```

2. **Import into Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Select your repository
   - Under **Project Settings**:
     - **Framework Preset**: `Next.js`
     - **Root Directory**: Click `Edit` and select `apps/web` (or leave at root; the included root [vercel.json](file:///c:/Users/ankit/Downloads/INNOTECH/worldsim/vercel.json) handles monorepo routing automatically).

3. **Configure Environment Variables** (Optional for live backend link):
   - `NEXT_PUBLIC_API_URL`: Your hosted FastAPI backend URL (e.g., `https://worldsim-api.up.railway.app`).
   - `BACKEND_URL`: Same backend URL (used by Next.js server-side proxy rewrites).

4. **Click Deploy**:
   - Vercel will install dependencies and build the static and serverless bundles using Next.js Turbopack.
   - Your site will be live at `https://your-project.vercel.app` in ~45 seconds.

---

### Option B: Deploying via Vercel CLI

1. Install the Vercel CLI globally (if not already installed):
   ```powershell
   npm install -g vercel
   ```

2. Log in and deploy from the root directory:
   ```powershell
   vercel
   ```

3. For production deployments:
   ```powershell
   vercel --prod
   ```

---

## 3. Deploying the Python Simulation Backend

Because SimPy discrete-event Monte Carlo simulations use Python multiprocessing (`ProcessPoolExecutor`), the backend runs best in a containerized environment:

### Option 1: Railway (Easiest & Fastest)
1. Go to [railway.app](https://railway.app) $\rightarrow$ New Project $\rightarrow$ Deploy from GitHub repo.
2. Under Settings:
   - **Root Directory**: Leave blank or set to `/`
   - **Build Command**: `uv sync --all-packages`
   - **Start Command**: `uv run python run_api.py`
3. Under Variables:
   - `GEMINI_API_KEY`: Your Gemini API key
   - `WS_CORS_ORIGINS`: `["https://*.vercel.app", "http://localhost:3000"]`
   - `WS_ENVIRONMENT`: `production`
4. Copy the generated Railway public URL (e.g., `https://worldsim-api.up.railway.app`).

### Option 2: Render.com
1. Create a **New Web Service** connected to your repo.
2. Select **Python** runtime:
   - **Build Command**: `pip install uv && uv sync --all-packages`
   - **Start Command**: `uv run python run_api.py`
   - **Environment Variables**: Add `GEMINI_API_KEY` and `WS_CORS_ORIGINS`.

---

## 4. Connecting the Vercel Frontend to the Backend

1. In the Vercel Project Dashboard, navigate to **Settings $\rightarrow$ Environment Variables**.
2. Add:
   ```env
   NEXT_PUBLIC_API_URL=https://your-backend-service.up.railway.app
   BACKEND_URL=https://your-backend-service.up.railway.app
   ```
3. Trigger a redeploy (or push a commit).
4. In your backend environment settings, ensure `WS_CORS_ORIGINS` includes your Vercel domain:
   ```env
   WS_CORS_ORIGINS=["https://your-project.vercel.app", "http://localhost:3000"]
   ```

---

## 5. Built-in Client Simulation Fallback

If you deploy to Vercel **before** setting up the Python backend:
- The Web Studio gracefully detects when the backend API is unreachable.
- Instead of showing an error or a blank page, it executes a high-fidelity **Client Simulation Fallback**.
- Visitors can immediately interact with:
  - All 15 pre-configured scenario templates
  - Dynamic interactive Recharts (Time vs. Cost, Delta %, Scatter, Leaderboard)
  - Plain-English executive summaries and 4 KPI cards
  - Real-time multi-criteria weight sliders (Time, Risk, Efficiency, Cost)
  - What-If parameter modification sandbox
