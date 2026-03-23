"""Level-running kcal from mass × distance; theoretical fat equivalent."""

from __future__ import annotations

KCAL_PER_KG_FAT_THEORY = 7700.0

# Empirical level running: commonly quoted ~0.9–1.1 kcal per kg body mass per km.
KCAL_PER_KG_KM_RUNNING = 1.0


def kcal_running_mass_distance(weight_kg: float, distance_km: float) -> float:
    return weight_kg * distance_km * KCAL_PER_KG_KM_RUNNING


def fat_equiv_kg_from_kcal(kcal: float) -> float:
    return kcal / KCAL_PER_KG_FAT_THEORY


def distance_km_from_speed(speed_kmh: float, duration_seconds: float) -> float:
    return speed_kmh * (duration_seconds / 3600.0)
