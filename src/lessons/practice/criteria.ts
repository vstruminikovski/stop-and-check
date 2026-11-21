/**
 * Training-layout criteria for the practice-area module.
 *
 * Source note: dimensions and rules below were supplied in the project brief as
 * training criteria based on the MVR 2025 rulebook
 * (https://portal.mdt.gov.mk/post-body-files/podzakonski-akti-mvr-file-T7nu.pdf).
 * This is a learning simulation: it does not reproduce the official examination
 * and does not award official (negative) points.
 */
export const CRITERIA_SOURCE =
  'Training criteria supplied in the project brief, based on the MVR 2025 rulebook. Learning simulation only.';

export const CRITERIA = {
  car: { length: 4 },
  movingOff: { laneLength: 36, laneWidth: 2.5 },
  reversing: { laneLength: 36, laneWidth: 2.5 },
  uTurn: { areaWidth: 6, maxManeuvers: 3 },
  parallelParking: { spaceWidth: 2, spaceLength: 6 },
  hillStart: { requiresParkingBrake: true },
} as const;

/**
 * Simulation settings chosen for the app (not taken from the rulebook).
 * They only decide when the practice checklist marks an item.
 */
export const SIMULATION = {
  /** A full stop within this distance before the line counts as "stopped before the line". */
  stopZoneLength: 3,
  /** Heading tolerance for "facing the opposite direction" (radians, 15°). */
  headingTolerance: (15 * Math.PI) / 180,
  /** Backward movement on the hill above this distance counts as rolling back (m). */
  rollbackTolerance: 0.15,
  /** Gradient of the practice ramp (12 %). */
  hillGrade: 0.12,
  /** Seconds the car must stay still for an automatic finish. */
  settleTime: 0.6,
} as const;
