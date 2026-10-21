"""
WorldSim Agents — Prompt Loader
================================
Loads and formats versioned YAML prompts from packages/agents/prompts/.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any
import yaml


_PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


class PromptTemplate:
    def __init__(self, agent_name: str, version: str, data: dict[str, Any]):
        self.agent_name = agent_name
        self.version = version
        self.system = data.get("system", "")
        self.user_template = data.get("user_template", "")
        self.few_shot_examples = data.get("few_shot_examples", [])
        self.changelog = data.get("changelog", "")

    def format_system(self, **kwargs: Any) -> str:
        return self.system.format(**kwargs)

    def format_user(self, **kwargs: Any) -> str:
        return self.user_template.format(**kwargs)


@lru_cache(maxsize=32)
def load_prompt(agent_name: str, version: str = "v1") -> PromptTemplate:
    """Load a versioned prompt YAML."""
    path = _PROMPTS_DIR / agent_name / f"{version}.yaml"
    if not path.is_file():
        raise FileNotFoundError(f"Prompt file not found at: {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    return PromptTemplate(agent_name, version, data)
