"""
College Course Admissions & Scheduling Pack — SimPy Model
=========================================================
Models student course enrollment cohorts, advising bottlenecks,
faculty course section loads, and classroom seating saturation.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Generator

if sys.version_info >= (3, 11):
    import tomllib
else:
    import tomli as tomllib  # type: ignore[no-redef]

import numpy as np
import simpy

from worldsim_engine.pack_interface import BasePack, KnownResultTest, SimPyModel
from worldsim_shared.schemas import (
    MetricAxis,
    MetricDefinition,
    ModellingType,
    PackManifest,
    PackSchema,
    ParameterField,
)

_DATA_FILE = Path(__file__).parent.parent / "data" / "distributions.toml"
with open(_DATA_FILE, "rb") as _f:
    _DATA = tomllib.load(_f)


class CollegeCourseModel(SimPyModel):
    """SimPy simulation model for college admissions and course scheduling."""

    def __init__(
        self,
        env: simpy.Environment,
        rng: np.random.Generator,
        params: dict[str, Any],
        data: dict[str, Any],
    ) -> None:
        super().__init__(env, rng)
        self.params = params
        self.data = data

        self.advisors = simpy.Resource(env, capacity=params["num_advisors"])
        self.lecture_halls = simpy.Resource(env, capacity=params["num_lecture_halls"])

        self._advising_wait_times: list[float] = []
        self._waitlist_days: list[float] = []
        self._unfulfilled_courses = 0
        self._total_course_requests = 0
        self._enrolled_credits = 0

        # Max teaching sections = faculty * 3 sections per term
        self.max_sections = params["num_faculty"] * 3
        self.total_seats = int(self.max_sections * self.data["course_capacity"]["average_section_seats"])
        self.filled_seats = 0

    def run(self) -> Generator[Any, Any, None]:
        cohort_size = self.params["student_cohort_size"]
        advising_prob = self.data["advising"]["advising_probability"]

        for i in range(cohort_size):
            yield self.env.timeout(float(self.rng.exponential(1.0)))  # staggered arrivals during registration day
            self.env.process(self._student_journey(i, advising_prob))

    def _student_journey(self, student_id: int, advising_prob: float) -> Generator[Any, Any, None]:
        # Advising phase if student requests counselor
        if self.rng.random() < advising_prob:
            arrival = self.env.now
            with self.advisors.request() as req:
                yield req
                wait = (self.env.now - arrival) / 60.0  # hours
                self._advising_wait_times.append(wait)
                duration = self.rng.exponential(self.data["advising"]["mean_advising_minutes"])
                yield self.env.timeout(duration)

        # Course Registration
        mean_courses = self.data["registration"]["mean_courses_per_student"]
        num_courses = max(1, int(self.rng.normal(mean_courses, 0.8)))
        self._total_course_requests += num_courses

        for _ in range(num_courses):
            if self.filled_seats < self.total_seats:
                self.filled_seats += 1
                self._enrolled_credits += 3
                self._waitlist_days.append(0.0)
            else:
                self._unfulfilled_courses += 1
                # Waitlist delay penalty: 3 to 14 days
                self._waitlist_days.append(float(self.rng.uniform(3.0, 14.0)))

    def collect_metrics(self) -> dict[str, float]:
        total_requests = max(1, self._total_course_requests)
        unfulfilled_pct = (self._unfulfilled_courses / total_requests) * 100.0
        seat_util = min(100.0, (self.filled_seats / max(1, self.total_seats)) * 100.0)

        faculty_cost = self.params["num_faculty"] * self.data["costs"]["faculty_monthly_salary"]
        advisor_cost = self.params["num_advisors"] * self.data["costs"]["advisor_monthly_salary"]
        total_cost = faculty_cost + advisor_cost
        cost_per_student = total_cost / max(1, self.params["student_cohort_size"])

        avg_waitlist = float(np.mean(self._waitlist_days)) if self._waitlist_days else 0.0
        avg_advising_wait = float(np.mean(self._advising_wait_times)) if self._advising_wait_times else 0.0

        return {
            "avg_waitlist_days": round(avg_waitlist, 2),
            "unfulfilled_course_pct": round(unfulfilled_pct, 2),
            "seat_utilization": round(seat_util, 2),
            "cost_per_enrolled_student": round(cost_per_student, 2),
            "advising_wait_hours": round(avg_advising_wait, 2),
        }


class CollegePack(BasePack):
    """WorldSim College Course Admissions & Scheduling Pack."""

    @property
    def manifest(self) -> PackManifest:
        return PackManifest(
            id="college",
            name="College Admissions & Course Scheduling",
            version="1.0.0",
            modelling_type=ModellingType.DISCRETE_EVENT,
            required_engine_version=">=0.1.0",
            description="Simulates student course registration cohorts, faculty loads, waitlists, and lecture hall capacity.",
            author="Ankit Kumar Singh",
        )

    @property
    def schema(self) -> PackSchema:
        return PackSchema(
            parameters=[
                ParameterField(
                    name="num_faculty",
                    type="int",
                    default=12,
                    description="Total teaching faculty members on staff",
                    unit="faculty",
                    min_value=2,
                    max_value=100,
                ),
                ParameterField(
                    name="num_advisors",
                    type="int",
                    default=4,
                    description="Academic counseling and degree advisors",
                    unit="advisors",
                    min_value=1,
                    max_value=30,
                ),
                ParameterField(
                    name="num_lecture_halls",
                    type="int",
                    default=8,
                    description="Available physical lecture halls and smart classrooms",
                    unit="halls",
                    min_value=1,
                    max_value=50,
                ),
                ParameterField(
                    name="student_cohort_size",
                    type="int",
                    default=350,
                    description="Total matriculating student cohort registering for courses",
                    unit="students",
                    min_value=50,
                    max_value=2000,
                ),
                ParameterField(
                    name="sim_duration_weeks",
                    type="float",
                    default=4.0,
                    description="Duration of course enrollment window",
                    unit="weeks",
                    min_value=1.0,
                    max_value=16.0,
                ),
            ],
            objectives=[
                "Minimize waitlist days for core prerequisites",
                "Maximize lecture hall seat utilization",
                "Minimize cost per enrolled student",
            ],
            constraints=[
                "Student cohort must be at least 4x faculty count",
                "Lecture halls must be >= 1 per 3 faculty members",
            ],
        )

    @property
    def metric_definitions(self) -> list[MetricDefinition]:
        return [
            MetricDefinition(key="avg_waitlist_days", label="Avg Waitlist", axis=MetricAxis.TIME, unit="days", lower_is_better=True),
            MetricDefinition(key="unfulfilled_course_pct", label="Unfulfilled Course %", axis=MetricAxis.RISK, unit="%", lower_is_better=True),
            MetricDefinition(key="seat_utilization", label="Seat Utilization", axis=MetricAxis.EFFICIENCY, unit="%", lower_is_better=False),
            MetricDefinition(key="cost_per_enrolled_student", label="Cost / Student", axis=MetricAxis.COST, unit="USD", lower_is_better=True),
            MetricDefinition(key="advising_wait_hours", label="Advising Wait", axis=MetricAxis.TIME, unit="hours", lower_is_better=True),
        ]

    @property
    def metrics(self) -> list[MetricDefinition]:
        return self.metric_definitions

    @property
    def prompt_pack(self) -> dict[str, Any]:
        return {
            "guidance": (
                "College course operations involve enrollment window queuing, academic advising loads, "
                "section capacities, and faculty teaching assignments. Key levers involve adding adjunct "
                "professors, expanding classroom sections, and cross-listing lecture halls."
            )
        }

    def build(self, params: dict[str, Any], seed: int, env: simpy.Environment | None = None) -> CollegeCourseModel:
        if env is None:
            env = simpy.Environment()
        rng = np.random.default_rng(seed)
        return CollegeCourseModel(env=env, rng=rng, params=params, data=_DATA)

    def validate_params(self, params: dict[str, Any]) -> list[str]:
        errors: list[str] = []
        cohort = params.get("student_cohort_size", 0)
        faculty = params.get("num_faculty", 0)
        if faculty <= 0:
            errors.append("num_faculty must be greater than 0")
        if cohort < faculty:
            errors.append(f"student_cohort_size ({cohort}) cannot be less than faculty ({faculty})")
        return errors

    def validation_tests(self) -> list[KnownResultTest]:
        return [
            KnownResultTest(
                name="Sufficient faculty keeps waitlist low",
                params={
                    "num_faculty": 25,
                    "num_advisors": 6,
                    "num_lecture_halls": 15,
                    "student_cohort_size": 150,
                    "sim_duration_weeks": 4.0,
                },
                seed=42,
                expected_metrics={
                    "unfulfilled_course_pct": 0.0,
                },
                tolerance_fraction=1.0,
            )
        ]
