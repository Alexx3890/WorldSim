# WorldSim AI — Comprehensive System & User Guide

This guide walks through the complete workflow of WorldSim AI, explaining how to run simulations, interpret plain-English reports, analyze dynamic charts, adjust decision criteria in real-time, and run custom what-if experiments.

---

## 1. Core Workflow Overview

WorldSim AI follows a 4-step decision intelligence process:

```
[1. Define Scenario / Select Template]
                 ↓
[2. Multi-Agent Synthesis & Parallel Monte Carlo Simulation]
                 ↓
[3. Dual-Mode Executive Decision Report (Plain-English + Technical)]
                 ↓
[4. Live Weight Adjustment & What-If Sandbox Experimentation]
```

---

## 2. Using the Scenario Template Library

The Studio includes **15 pre-configured scenario templates** across 5 distinct domains.

### How to Load a Template:
1. Navigate to the **Scenario Templates** section at the top of the interface.
2. Select a domain tab:
   - **All Packs (15)**
   - **Hospital ED** (Emergency Department operations)
   - **College** (Course registration & classroom bottlenecks)
   - **Office** (Workplace hybrid scheduling & desk sharing)
   - **Govt Policy** (Municipal construction permitting & backlog)
   - **Event Safety** (Crowd surge, ingress queues & security lanes)
3. Click any template card. The platform automatically:
   - Loads domain-specific prompt descriptions
   - Selects the matching `Pack ID`
   - Configures baseline operational parameters
   - Generates 3 pre-calibrated counterfactual strategies

### Available Templates Summary:

| Domain | Template Title | Core Challenge Simulated |
|---|---|---|
| **Hospital ED** | Code Black Surge Event | 2.5x patient arrival surge with ICU bed contention |
| **Hospital ED** | Lean Staffing Optimization | Evaluating cost savings of -15% staff vs. patient wait times |
| **Hospital ED** | Fast-Track Triage Routing | Dedicated low-acuity clinic vs. standard triage |
| **College** | Admissions Yield Surge | Over-enrollment in computer science with faculty limits |
| **College** | Department Resource Reallocation | Rebalancing seats from under-enrolled to high-demand majors |
| **College** | Hybrid Class Scheduling | Shifting 25% of lectures online to free campus classrooms |
| **Office** | Tuesday Peak Contention | 85% mid-week office attendance vs. hot-desking constraints |
| **Office** | Executive Downsizing Study | Downsizing square footage by 30% under hybrid work rules |
| **Office** | Quiet Booth Reconfiguration | Converting open spaces into soundproof focus pods |
| **Govt Policy** | Commercial Zoning Backlog | Eliminating 6-month commercial building permit backlogs |
| **Govt Policy** | Fast-Track Green Energy Permits | Priority routing for solar and commercial EV installations |
| **Govt Policy** | Inspector Scheduling Optimization | Routing field inspectors dynamically to cut idle travel days |
| **Event Safety** | Stadium Concert Door Surge | Ingress choke point at main gates before headline act |
| **Event Safety** | High-Security Ingress Protocol | Testing magnetometer lane efficiency vs. crowd crush risk |
| **Event Safety** | Staggered Wave Gate Ingress | Staggering attendee arrival waves with mobile incentives |

---

## 3. Running an Autonomous Simulation

1. **Natural Language Prompt**: You can either choose a template or type your own custom operational situation in everyday language (e.g., *"We run a municipal permit office with 6 reviewers. During summer, commercial permit applications spike by 40%, creating huge delays"*).
2. **Configuration Settings**:
   - **Strategy Count**: Choose between 2 to 5 counterfactual policies to compare.
   - **Replications**: Choose between 3 to 20 Monte Carlo iterations per strategy for statistical confidence.
3. Click **Run Autonomous Simulation**.
4. The system executes the multi-agent pipeline:
   - Identifies the domain pack
   - Validates baseline parameters
   - Spawns parallel SimPy simulation runs across all CPU cores
   - Returns Pareto-ranked results within 3 to 8 seconds.

---

## 4. Interpreting the Simulation Results

WorldSim AI provides two purpose-built views designed for both executive leaders and analytical engineers.

### A. Plain-English Brief (Executive View)
The **Plain-English Brief** translates complex simulation data into plain, everyday language:
- **Best Choice For Your Organization**: A clear narrative explaining which strategy won and why.
- **4 Key Impact KPI Cards**:
  1. **Speed & Turnaround**: Displays delay metrics in natural units (e.g., `0.5 days` or `18.4 min`) alongside percentage reduction vs. the current baseline.
  2. **Peak Protection (Risk)**: Details queue protection during sudden volume surges.
  3. **Resource Efficiency**: Summarizes equipment, desk, or staff utilization to prevent burnout.
  4. **Financial Cost**: Net dollar expenditure change per unit/patient/attendee.
- **Why This Is The Best Choice**: Explains the precise bottleneck targeted by the recommended strategy.
- **The Honest Trade-Off**: Transparent disclosure of resource investments or operational costs required to achieve performance gains.
- **Recommended 3-Step Action Plan**: Step-by-step rollout guidance (Pilot $\rightarrow$ Track $\rightarrow$ Fine-tune).

### B. Detailed Analytics (Technical View)
For data analysts and operations directors:
- **Comparative Evaluation Table**: Detailed table listing all evaluated strategies, composite scores, and 95% confidence intervals.
- **Pareto Optimality**: Clear indicators showing which strategies reside on the non-dominated Pareto frontier.
- **Numeric Veracity Audit**: Real-time programmatic report auditing conducted by the `CriticAgent` to verify that every cited metric matches empirical simulation runs.

---

## 5. Visual Simulation Charts

WorldSim includes 4 interactive chart modes built with Recharts:

1. **Time vs Cost Bar Chart**:
   - Visualizes turnaround times, operational budgets, and resource utilization side-by-side across all alternative strategies.
2. **% Delta vs Baseline Bar Chart**:
   - Highlights relative improvements (e.g., `+42% faster turnaround`) directly comparing each counterfactual against the status quo.
3. **Cost vs Risk Scatter Matrix**:
   - Plots financial cost on the X-axis against peak-hour operational risk on the Y-axis.
   - Helps operators immediately identify low-cost, low-risk policies in the bottom-left quadrant.
4. **Overall Score Leaderboard**:
   - Displays composite multi-criteria scores (0–100) ranked from best to worst.

---

## 6. Live Weight Adjuster (Interactive Decision Scoring)

Organizations often have different priorities. WorldSim AI lets you dynamically adjust priority weights:
- **Time Weight (0–100%)**
- **Risk Weight (0–100%)**
- **Efficiency Weight (0–100%)**
- **Cost Weight (0–100%)**

> **Instant Client-Side Recalculation**: Changing any slider immediately re-ranks all strategies, updates the Pareto frontier, and recalculates composite scores without requiring a new simulation run.

---

## 7. What-If Scenario Sandbox

To test your own hypotheses after viewing the results:
1. Click **What-If Sandbox $\rightarrow$** at the top right of the dashboard.
2. Manually adjust parameters (e.g., increase staff from 6 to 8, or change processing speed).
3. Click **Execute What-If Run**.
4. The simulation runs immediately and displays a side-by-side differential comparison against the baseline.

---

## 8. Exporting Results
- **Export CSV**: Downloads the complete comparison matrix with all replications, confidence intervals, and composite scores.
- **Export JSON**: Downloads the full simulation payload including agent reasoning traces, manifests, and raw metric distributions.
