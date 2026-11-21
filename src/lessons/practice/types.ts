import type { Bounds, Terrain, Vehicle, VehicleStart } from '../../game/vehicle';

export type ExerciseId = 'moving-off' | 'reversing' | 'u-turn' | 'parallel-parking' | 'hill-start';

export type LineKind = 'boundary' | 'mark' | 'stop' | 'dashed';

/** Scene helpers an exercise uses to paint its training layout. */
export interface BuildContext {
  line(x1: number, z1: number, x2: number, z2: number, width: number, kind: LineKind): void;
  cone(x: number, z: number): void;
  kerb(x1: number, z1: number, x2: number, z2: number): void;
  /** Raised ramp following `profile(d)` where d = -z, between z = -dStart and z = -dEnd, across |x| <= halfWidth. */
  ramp(profile: (d: number) => number, dStart: number, dEnd: number, halfWidth: number): void;
  /** A painted line along z that follows the terrain height. */
  terrainLine(x: number, z1: number, z2: number, width: number, kind: LineKind): void;
}

export type Cue = 'reverse' | 'parkingBrake' | null;

/** Per-attempt rule checker. Pure logic: reads the vehicle, never renders. */
export interface Judge {
  update(car: Vehicle, dt: number): void;
  readonly done: boolean;
  /** True while the car is currently over a boundary (lines flash). */
  readonly violating: boolean;
  /** Which control to highlight next, if any. */
  cue(car: Vehicle): Cue;
  checklist(): Record<string, boolean>;
}

export interface CameraProfile {
  distance: number;
  height: number;
  reach: number;
}

export interface ExerciseSpec {
  id: ExerciseId;
  checklist: readonly string[];
  start: VehicleStart;
  camera: CameraProfile;
  bounds: Bounds;
  terrain?: Terrain;
  build(ctx: BuildContext): void;
  createJudge(): Judge;
}
