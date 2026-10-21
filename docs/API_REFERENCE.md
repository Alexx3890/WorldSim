# WorldSim AI — API Reference Manual

The WorldSim API is built on FastAPI and exposes RESTful endpoints for discovering scenario packs, running direct Monte Carlo simulations, and executing the full autonomous multi-agent simulation pipeline.

- **Base URL**: `http://localhost:8000/api/v1`
- **Interactive Swagger Docs**: `http://localhost:8000/api/docs`
- **ReDoc Schema Documentation**: `http://localhost:8000/api/redoc`
- **OpenAPI JSON**: `http://localhost:8000/api/openapi.json`

---

## 1. Authentication & Headers

Standard requests require:
```http
Content-Type: application/json
Accept: application/json
```
*(Optional tracing header: `X-Request-ID: <uuid>`)*

---

## 2. Endpoints Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health/live` | Liveness check confirming server process is running |
| `GET` | `/health/ready` | Readiness check confirming registered packs and engine availability |
| `GET` | `/packs` | List all discovered and registered scenario packs |
| `GET` | `/packs/{pack_id}` | Retrieve detailed schema, parameters, and manifest for a specific pack |
| `POST` | `/runs` | Execute a direct Monte Carlo simulation for a specific pack and parameter set |
| `POST` | `/simulations/ai-plan` | Execute the end-to-end multi-agent pipeline (Routing $\rightarrow$ Strategies $\rightarrow$ Simulation $\rightarrow$ Scorer $\rightarrow$ Plain-English Report $\rightarrow$ Critic) |

---

## 3. Endpoint Specifications

### 3.1 Autonomous Multi-Agent Simulation Pipeline
`POST /api/v1/simulations/ai-plan`

Runs the autonomous intelligence workflow from natural language description to verified report.

#### Request Body Schema (`AISimulationRequest`):
```json
{
  "prompt": "Emergency department with 4 doctors and 8 nurses has 60 minute wait times during winter flu surges.",
  "pack_id": "hospital",
  "strategy_count": 3,
  "replications_per_strategy": 5
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | string | **Yes** | Natural language description of the operational decision or bottleneck ($\ge 5$ characters). |
| `pack_id` | string | No | Optional manual override to bypass semantic routing (`hospital`, `college`, `office`, `policy`, `social`). |
| `strategy_count` | integer | No | Number of counterfactual strategies to formulate (Default: 3, Min: 1, Max: 5). |
| `replications_per_strategy` | integer | No | Monte Carlo replications per strategy for statistical confidence (Default: 10, Min: 3, Max: 50). |

#### Response Body Schema (`AISimulationResponse`):
```json
{
  "pack_id": "hospital",
  "pack_name": "Emergency Department Operational Simulation",
  "objectives": [
    "Reduce patient wait times below 30 minutes",
    "Maintain doctor and nurse utilization below burnout thresholds"
  ],
  "constraints": [
    "Capital budget cap of $50,000",
    "Physical emergency room bed limit of 24"
  ],
  "assumptions": [
    "Arrival rate follows historical Poisson distribution with flu surge peaks"
  ],
  "strategies": [
    {
      "name": "Fast-Track Triage Clinic",
      "description": "Dedicate 1 doctor and 2 nurses to a separate low-acuity stream.",
      "parameter_deltas": {
        "enable_fast_track": true
      },
      "hypothesis": "Diverts 40% of patients from main queue, reducing bottleneck.",
      "expected_tradeoff": "Slightly higher nurse overtime cost."
    }
  ],
  "strategy_scores": [
    {
      "strategy_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "strategy_name": "Fast-Track Triage Clinic",
      "composite_score": 0.842,
      "axis_scores": [
        { "axis": "time", "score": 0.91, "weight": 0.25 },
        { "axis": "risk", "score": 0.88, "weight": 0.25 },
        { "axis": "efficiency", "score": 0.79, "weight": 0.25 },
        { "axis": "cost", "score": 0.79, "weight": 0.25 }
      ],
      "is_pareto_optimal": true,
      "rank": 1
    }
  ],
  "simulation_results": {
    "Fast-Track Triage Clinic": {
      "avg_wait_minutes": {
        "mean": 21.4,
        "median": 19.8,
        "std_dev": 4.1,
        "ci_lower": 17.8,
        "ci_upper": 25.0,
        "min": 15.2,
        "max": 28.6
      },
      "p95_wait_minutes": { "mean": 42.1 },
      "bed_utilization": { "mean": 0.76 },
      "cost_per_patient_usd": { "mean": 138.5 }
    }
  },
  "report": {
    "title": "WorldSim Executive Simulation Brief & Decision Analysis",
    "executive_summary": "Across 4 simulated operating policies, 'Fast-Track Triage Clinic' emerged as the most effective decision with a composite rating of 84.2/100. Delays are reduced by 48.5% (from 41.5 to 21.4 minutes). Estimated operational cost is $138.50 per patient.",
    "key_findings": [
      "Simulated 4 alternative operational configurations using deterministic Monte Carlo replications.",
      "'Fast-Track Triage Clinic' ranked #1 overall with a composite decision score of 84.2/100.",
      "Queue & Delay Impact: Delays are reduced by 48.5% (from 41.5 to 21.4 minutes).",
      "Budget & Expenditure: Estimated operational cost is $138.50 per patient."
    ],
    "recommended_strategy": "Fast-Track Triage Clinic",
    "recommendation_rationale": "Strategy 'Fast-Track Triage Clinic' targets the primary queue bottleneck directly, avoiding under-staffing queues while maintaining high bed productivity.",
    "tradeoff_analysis": "Choosing 'Fast-Track Triage Clinic' trades a modest operational staffing expenditure for a 48.5% reduction in patient waiting times.",
    "degradations_and_limitations": "Deterministic simulation analytics verified by programmatic critic."
  },
  "critic": {
    "passed": true,
    "score": 1.0,
    "discrepancies": [],
    "notes": "Programmatic critic confirmed recommended strategy exists in simulated strategy set and numerical values correspond faithfully."
  },
  "degradations": []
}
```

---

### 3.2 Direct Monte Carlo Run
`POST /api/v1/runs`

Directly runs a Monte Carlo simulation for a specific pack and parameter set.

#### Request Body (`RunCreate`):
```json
{
  "pack_id": "hospital",
  "parameters": {
    "num_doctors": 5,
    "num_nurses": 10,
    "num_beds": 24,
    "patient_arrival_rate_per_hour": 14.0
  },
  "replications": 10,
  "seed": 42
}
```

#### Response Body (`RunResponse`):
```json
{
  "run_id": "e6a0d268-23d4-4bb0-b74c-4a34bcfb1f23",
  "pack_id": "hospital",
  "status": "COMPLETED",
  "metrics": {
    "avg_wait_minutes": {
      "mean": 18.2,
      "median": 17.9,
      "std_dev": 2.8,
      "ci_lower": 16.2,
      "ci_upper": 20.2,
      "p95": 28.5
    },
    "bed_utilization": {
      "mean": 0.72
    },
    "cost_per_patient_usd": {
      "mean": 142.1
    }
  },
  "replications_completed": 10,
  "elapsed_seconds": 0.48
}
```

---

### 3.3 List Scenario Packs
`GET /api/v1/packs`

Returns a list of all currently discovered packs.

#### Response:
```json
[
  {
    "id": "hospital",
    "name": "Hospital Emergency Department",
    "version": "1.0.0",
    "domain": "Healthcare Operations"
  },
  {
    "id": "college",
    "name": "University Course Allocation",
    "version": "1.0.0",
    "domain": "Higher Education"
  },
  {
    "id": "office",
    "name": "Workplace Hybrid Scheduling",
    "version": "1.0.0",
    "domain": "Corporate Facilities"
  },
  {
    "id": "policy",
    "name": "Municipal Permitting Bureau",
    "version": "1.0.0",
    "domain": "Public Sector"
  },
  {
    "id": "social",
    "name": "Public Event Crowd Safety",
    "version": "1.0.0",
    "domain": "Crowd Safety"
  }
]
```

---

## 4. Error Handling (`APIError`)

When a request fails, the API returns a structured error response:
```json
{
  "code": "PACK_NOT_FOUND",
  "message": "Pack 'invalid_pack_id' is not registered.",
  "request_id": "req-89a12c4",
  "retryable": false
}
```

Standard HTTP status codes:
- `200 OK`: Successful execution.
- `400 Bad Request`: Invalid parameter boundaries or malformed syntax.
- `404 Not Found`: Scenario pack does not exist.
- `422 Unprocessable Entity`: Validation error against Pydantic schema constraints.
- `500 Internal Server Error`: Unhandled simulation exception.
