# WorldSim AI — Scenario Packs Reference Manual

WorldSim AI organizes operational domains into modular **Scenario Packs**. Each pack defines a discrete-event system model implemented in SimPy, parameterized with Pydantic schemas, and calibrated with realistic stochastic distributions.

---

## 1. Scenario Pack Architecture

Each pack inside `packages/packs/<pack_name>` conforms to the standard WorldSim Scenario Pack interface:

```
packages/packs/<pack_name>/
├── manifest.toml          # Pack metadata, parameter definitions, and metric registry
├── pyproject.toml         # Standalone package definition
├── data/
│   └── distributions.toml # Calibrated empirical distributions (lognormal, gamma, triangular, normal)
└── <pack_name>_pack/
    ├── __init__.py        # Exports Pack class conforming to BaseScenarioPack
    ├── schema.py          # Pydantic v2 validation models for inputs and outputs
    └── model.py           # SimPy discrete-event simulation implementation
```

---

## 2. The 5 Domain Scenario Packs

### Pack 1: Hospital Emergency Department (`hospital`)
*Simulates patient triage, doctor/nurse resource constraints, ICU bed contention, and clinical throughput.*

- **Key Input Parameters**:
  - `num_doctors` (int, default: 4, range: 1–20)
  - `num_nurses` (int, default: 8, range: 2–40)
  - `num_beds` (int, default: 20, range: 5–100)
  - `patient_arrival_rate_per_hour` (float, default: 12.0)
  - `enable_fast_track` (bool, default: false)
  - `triage_nurse_count` (int, default: 2)
  - `doctor_cost_per_hour` (float, default: 150.0)
  - `nurse_cost_per_hour` (float, default: 45.0)

- **Calibrated Distributions**:
  - Triage Duration: Triangular ($\text{min}=3$, $\text{mode}=5$, $\text{max}=12$ minutes)
  - Doctor Examination: LogNormal ($\mu=2.8$, $\sigma=0.45$ minutes)
  - Bed Treatment Time: Gamma ($\alpha=3.0$, $\beta=0.05$ minutes)

- **Output Metrics**:
  - `avg_wait_minutes`: Mean patient waiting time before physician consultation.
  - `p95_wait_minutes`: 95th percentile waiting time (peak risk indicator).
  - `bed_utilization`: Average proportion of emergency beds occupied.
  - `cost_per_patient_usd`: Total staffing and bed operational cost divided by treated patients.

---

### Pack 2: University Course Registration & Scheduling (`college`)
*Simulates departmental course demand, student waitlists, classroom capacity constraints, and faculty teaching loads.*

- **Key Input Parameters**:
  - `student_count` (int, default: 2500, range: 500–10000)
  - `faculty_count` (int, default: 120, range: 20–500)
  - `lecture_hall_count` (int, default: 35, range: 5–150)
  - `average_course_capacity` (int, default: 45, range: 15–250)
  - `courses_requested_per_student` (int, default: 4)
  - `online_course_pct` (float, default: 0.15)
  - `tuition_revenue_per_student` (float, default: 7500.0)

- **Calibrated Distributions**:
  - Course Registration Attempt Timing: Normal ($\mu=10.0$, $\sigma=2.5$ hours)
  - Advising Appointment Duration: Triangular ($\text{min}=10$, $\text{mode}=20$, $\text{max}=45$ minutes)

- **Output Metrics**:
  - `avg_waitlist_days`: Average days a waitlisted student waits for course placement.
  - `unfulfilled_course_pct`: Percentage of requested classes unable to be scheduled.
  - `seat_utilization`: Proportion of classroom desk hours occupied.
  - `cost_per_enrolled_student`: Instructional and facility cost per enrolled student.

---

### Pack 3: Workplace Hybrid Scheduling & Hot-Desking (`office`)
*Simulates return-to-office peak mid-week attendance, hot-desk contention, meeting room rejections, and corporate real estate overhead.*

- **Key Input Parameters**:
  - `total_employees` (int, default: 400, range: 50–2000)
  - `desk_count` (int, default: 260, range: 30–1500)
  - `meeting_room_count` (int, default: 14, range: 2–60)
  - `focus_booth_count` (int, default: 8, range: 1–30)
  - `remote_work_policy_days` (int, default: 2, range: 0–5)
  - `peak_day_attendance_pct` (float, default: 0.85)
  - `lease_cost_per_desk_monthly` (float, default: 350.0)

- **Calibrated Distributions**:
  - Arrival Wave: Normal ($\mu=8.75$, $\sigma=0.65$ hours)
  - Meeting Room Booking Duration: LogNormal ($\mu=3.6$, $\sigma=0.35$ minutes)
  - Focus Booth Usage Duration: Triangular ($\text{min}=15$, $\text{mode}=45$, $\text{max}=120$ minutes)

- **Output Metrics**:
  - `desk_contention_minutes`: Time employees spend searching or waiting for an open workspace on peak days.
  - `meeting_room_rejection_pct`: Percentage of collaborative room booking requests rejected due to 100% occupancy.
  - `desk_utilization`: Overall percentage of office desks occupied during business hours.
  - `facility_cost_per_desk`: Normalized real estate lease and operations expenditure per active desk.

---

### Pack 4: Municipal Construction & Commercial Permitting (`policy`)
*Simulates public sector bureau plan review, engineering inspections, zoning approvals, and regulatory backlogs.*

- **Key Input Parameters**:
  - `intake_clerks` (int, default: 3, range: 1–10)
  - `plan_reviewers` (int, default: 6, range: 1–25)
  - `field_inspectors` (int, default: 8, range: 2–35)
  - `daily_permit_applications` (int, default: 24, range: 5–100)
  - `commercial_share_pct` (float, default: 0.35)
  - `fast_track_enabled` (bool, default: false)
  - `reviewer_hourly_rate` (float, default: 65.0)

- **Calibrated Distributions**:
  - Intake Document Check: Triangular ($\text{min}=15$, $\text{mode}=30$, $\text{max}=90$ minutes)
  - Engineering Plan Review: LogNormal ($\mu=1.8$, $\sigma=0.5$ business days)
  - On-site Field Inspection: Gamma ($\alpha=2.5$, $\beta=0.4$ hours)

- **Output Metrics**:
  - `avg_permit_processing_days`: Calendar days required from submission to final permit issuance.
  - `backlog_growth_pct`: Net increase or decrease in pending unreviewed permit files over the period.
  - `first_pass_approval_pct`: Proportion of submitted applications approved without secondary revision cycles.
  - `inspection_cost_per_permit`: Direct municipal administrative and inspection cost incurred per application.

---

### Pack 5: Public Event Crowd Safety & Ingress (`social`)
*Simulates sports stadium and concert venue entrance bottlenecks, ticket scanning turnstiles, magnetometer security lanes, and crowd crush risk.*

- **Key Input Parameters**:
  - `total_attendees` (int, default: 15000, range: 1000–80000)
  - `security_magnetometer_lanes` (int, default: 18, range: 4–60)
  - `turnstile_scanners` (int, default: 24, range: 6–80)
  - `arrival_window_hours` (float, default: 2.0, range: 0.5–5.0)
  - `bag_check_probability` (float, default: 0.40)
  - `peak_surge_concentration` (float, default: 0.55)
  - `staff_hourly_rate` (float, default: 28.0)

- **Calibrated Distributions**:
  - Magnetometer Walk-through: LogNormal ($\mu=2.2$, $\sigma=0.3$ seconds)
  - Secondary Bag Check: Triangular ($\text{min}=20$, $\text{mode}=45$, $\text{max}=120$ seconds)
  - Ticket Barcode Scan: Triangular ($\text{min}=2$, $\text{mode}=4$, $\text{max}=10$ seconds)

- **Output Metrics**:
  - `max_ingress_wait_minutes`: Longest queue delay experienced by attendees arriving during peak door rush.
  - `overcrowding_hazard_index`: Standardized risk index (0–100) measuring crowd density at outer perimeter barricades.
  - `turnstile_throughput_per_min`: Sustained attendee flow rate successfully processed into the venue per minute.
  - `operational_cost_per_attendee`: Direct gate security, scanning, and crowd management expenditure per attendee.
