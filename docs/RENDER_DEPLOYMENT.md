# WorldSim AI — Render + Vercel Deployment Guide

This guide explains how to deploy **WorldSim AI** with the **FastAPI + SimPy Backend on Render** and the **Next.js Web Studio on Vercel**.

---

## Architecture Overview
- **Frontend**: [Vercel](https://vercel.com) (Next.js 16, Turbopack, App Router)
- **Backend**: [Render](https://render.com) (FastAPI, SimPy, Multi-agent LLM pipeline, Docker container)
- **CORS**: Automatically configured for all `*.vercel.app` domains.

---

## Step 1: Deploy Backend to Render (3 Minutes)

1. Sign in to [Render.com](https://render.com) (free account).
2. Click **New +** → **Web Service**.
3. Select **Build and deploy from a Git repository**, then choose your GitHub repo:
   `https://github.com/Alexx3890/WorldSim`
4. Configure the service settings:
   - **Name**: `worldsim-api`
   - **Runtime**: **Docker** (Render will automatically detect the root `Dockerfile`)
   - **Instance Type**: **Free**
5. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: *(Your Google Gemini API Key)*
   - `WS_ENVIRONMENT`: `production`
6. Click **Deploy Web Service**.
7. Once deployment finishes, copy your Render public URL (e.g., `https://worldsim-api-xxxx.onrender.com`).
   - You can test it by visiting: `https://your-url.onrender.com/health` in your browser.

---

## Step 2: Deploy Frontend to Vercel (1 Minute)

1. Go to [vercel.com/new](https://vercel.com/new) and select `Alexx3890/WorldSim`.
2. Under **Project Settings**:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click **Edit** → select `apps/web`
3. Under **Environment Variables**, add:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://worldsim-api-xxxx.onrender.com` (your Render URL from Step 1)
4. Click **Deploy**.

---

## Step 3: Verification
1. Open your Vercel deployment URL (e.g. `https://worldsim.vercel.app`).
2. The green badge in the header will read `● BACKEND CONNECTED (worldsim-api)`.
3. Try any template (Emergency Department, Inpatient Bed Surge, College, Policy, or Crowd Safety):
   - Click **Review & Configure Scenario →**
   - Click **Proceed to Strategy Review →**
   - Click **Run Simulation →**
   - View truth-verified Pareto rankings and KPI graphs generated live!
