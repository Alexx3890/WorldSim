"""
Pack Registry — auto-discovers and validates installed packs.
"""
from __future__ import annotations

from worldsim_engine.pack_interface import BasePack
from hospital_pack import HospitalPack
from college_pack import CollegePack
from office_pack import OfficePack
from policy_pack import PolicyPack
from social_pack import SocialPack


class PackRegistry:
    """Holds all registered BasePack instances, keyed by pack ID."""

    def __init__(self) -> None:
        self._packs: dict[str, BasePack] = {}

    def discover(self) -> None:
        """Register all known packs. Fails fast on manifest/schema validation errors."""
        candidates: list[BasePack] = [
            HospitalPack(),
            CollegePack(),
            OfficePack(),
            PolicyPack(),
            SocialPack(),
        ]
        for pack in candidates:
            self._validate_and_register(pack)

    def _validate_and_register(self, pack: BasePack) -> None:
        manifest = pack.manifest
        # Validate manifest fields (Pydantic already validates on construction)
        if manifest.id in self._packs:
            raise RuntimeError(f"Duplicate pack id: {manifest.id}")
        # Validate schema — ensure all required fields are present
        _ = pack.schema
        self._packs[manifest.id] = pack

    def get(self, pack_id: str) -> BasePack:
        if pack_id not in self._packs:
            raise KeyError(f"Pack not found: {pack_id}")
        return self._packs[pack_id]

    def list_all(self) -> list[BasePack]:
        return list(self._packs.values())

    def all(self) -> list[BasePack]:
        return self.list_all()


# Module-level singleton
registry = PackRegistry()
