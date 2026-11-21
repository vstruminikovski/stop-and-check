import { CAR_DIMENSIONS, wrapAngle, type Point, type Vehicle } from '../../game/vehicle';
import { CRITERIA, SIMULATION } from './criteria';
import type { Cue, ExerciseSpec, Judge } from './types';

const PAD: ExerciseSpec['bounds'] = { minX: -55, maxX: 55, minZ: -55, maxZ: 55 };
const HALF_LEN = CAR_DIMENSIONS.length / 2;

/** Counts how long the car has been standing still. */
class StillTimer {
  t = 0;
  update(car: Vehicle, dt: number): number {
    this.t = car.stopped ? this.t + dt : 0;
    return this.t;
  }
}

// ---------------------------------------------------------------------------
// 1 & 2. Straight training lane (36 m × 2.5 m) along -z from z = 0.
// ---------------------------------------------------------------------------

const LANE = {
  length: CRITERIA.movingOff.laneLength,
  halfWidth: CRITERIA.movingOff.laneWidth / 2,
  startZ: 0,
  get endZ() {
    return -this.length;
  },
};

function buildLane(ctx: Parameters<ExerciseSpec['build']>[0], stopLineAtEnd: boolean): void {
  const { halfWidth: w, startZ, endZ } = LANE;
  ctx.line(-w, startZ, -w, endZ, 0.12, 'boundary');
  ctx.line(w, startZ, w, endZ, 0.12, 'boundary');
  if (stopLineAtEnd) {
    ctx.line(-w, endZ - 0.15, w, endZ - 0.15, 0.3, 'stop');
    ctx.line(-w, startZ, w, startZ, 0.1, 'mark');
  } else {
    ctx.line(-w, startZ + 0.15, w, startZ + 0.15, 0.3, 'stop');
    ctx.line(-w, endZ, w, endZ, 0.1, 'mark');
  }
  for (const x of [-w - 0.6, w + 0.6]) {
    ctx.cone(x, startZ);
    ctx.cone(x, endZ);
  }
}

function outsideLane(car: Vehicle): boolean {
  return car.corners().some((c) => Math.abs(c.x) > LANE.halfWidth);
}

class MovingOffJudge implements Judge {
  done = false;
  violating = false;
  private movedOff = false;
  private leftLane = false;
  private crossedLine = false;
  private stoppedAtLine = false;
  private startZ: number;
  private still = new StillTimer();

  constructor(startZ: number) {
    this.startZ = startZ;
  }

  update(car: Vehicle, dt: number): void {
    if (this.done) return;
    if (car.gear === 'D' && this.startZ - car.z >= 2) this.movedOff = true;
    this.violating = outsideLane(car);
    if (this.violating) this.leftLane = true;

    const front = car.front.z;
    if (front < LANE.endZ) this.crossedLine = true;
    const still = this.still.update(car, dt);
    if (still >= SIMULATION.settleTime && this.movedOff) {
      if (this.crossedLine) this.done = true;
      else if (front <= LANE.endZ + SIMULATION.stopZoneLength) {
        this.stoppedAtLine = Math.abs(car.x) <= LANE.halfWidth;
        this.done = true;
      }
    }
  }

  cue(): Cue {
    return null;
  }

  checklist(): Record<string, boolean> {
    return {
      movedOff: this.movedOff,
      stayedInLane: !this.leftLane,
      stoppedBeforeLine: this.stoppedAtLine && !this.crossedLine,
    };
  }
}

class ReversingJudge implements Judge {
  done = false;
  violating = false;
  private leftLane = false;
  private crossedLine = false;
  private stoppedAtLine = false;
  private reversedDistance = 0;
  private still = new StillTimer();

  update(car: Vehicle, dt: number): void {
    if (this.done) return;
    this.reverseOk = car.reverseSelected && !car.reverseRefusedWhileMoving;
    if (car.speed < 0) this.reversedDistance += -car.speed * dt;
    this.violating = outsideLane(car);
    if (this.violating) this.leftLane = true;

    // Reversing toward +z: the rear bumper must stay short of the line at z = 0.
    const rear = Math.max(car.rear.z, car.front.z);
    if (rear > LANE.startZ) this.crossedLine = true;
    const still = this.still.update(car, dt);
    if (still >= SIMULATION.settleTime && this.reversedDistance >= 2) {
      if (this.crossedLine) this.done = true;
      else if (rear >= LANE.startZ - SIMULATION.stopZoneLength) {
        this.stoppedAtLine = Math.abs(car.x) <= LANE.halfWidth;
        this.done = true;
      }
    }
  }

  cue(car: Vehicle): Cue {
    return car.gear === 'D' && this.reversedDistance < 0.5 ? 'reverse' : null;
  }

  checklist(): Record<string, boolean> {
    return {
      selectedReverseWhileStopped: this.reverseOk,
      stayedInLane: !this.leftLane,
      stoppedBeforeLine: this.stoppedAtLine && !this.crossedLine,
    };
  }

  private reverseOk = false;
}

// ---------------------------------------------------------------------------
// 3. U-turn inside a 6 m wide marked area (long edges at z = ±3).
// ---------------------------------------------------------------------------

const UTURN = { halfWidth: CRITERIA.uTurn.areaWidth / 2, halfLength: 14 };
const UTURN_START_HEADING = Math.PI / 2; // facing -x
const UTURN_TARGET = wrapAngle(UTURN_START_HEADING + Math.PI);

class UTurnJudge implements Judge {
  done = false;
  violating = false;
  private leftArea = false;
  private facingOpposite = false;
  private maneuvers = 0;
  private lastDir = 0;
  private pendingDir = 0;
  private pendingTravel = 0;
  private alignedForward = 0;

  update(car: Vehicle, dt: number): void {
    if (this.done) return;
    this.violating = car
      .corners()
      .some((c) => Math.abs(c.z) > UTURN.halfWidth || Math.abs(c.x) > UTURN.halfLength);
    if (this.violating) this.leftArea = true;

    // A maneuver is one continuous movement in a single direction.
    if (Math.abs(car.speed) > 0.05) {
      const dir = Math.sign(car.speed);
      if (dir === this.lastDir) {
        this.pendingTravel = 0;
      } else {
        if (dir !== this.pendingDir) {
          this.pendingDir = dir;
          this.pendingTravel = 0;
        }
        this.pendingTravel += Math.abs(car.speed) * dt;
        if (this.pendingTravel >= 0.25) {
          this.maneuvers += 1;
          this.lastDir = dir;
          this.pendingTravel = 0;
        }
      }
    }

    this.facingOpposite = Math.abs(wrapAngle(car.heading - UTURN_TARGET)) <= SIMULATION.headingTolerance;
    if (this.facingOpposite && car.speed > 0) this.alignedForward += car.speed * dt;
    else if (!this.facingOpposite) this.alignedForward = 0;

    const finished = this.facingOpposite && this.alignedForward >= 2.5;
    const gaveUp = car.stopped && car.parkingBrake;
    const farOut = Math.abs(car.z) > UTURN.halfWidth + 3 || Math.abs(car.x) > UTURN.halfLength + 3;
    if (finished || gaveUp || farOut) this.done = true;
  }

  cue(): Cue {
    return null;
  }

  checklist(): Record<string, boolean> {
    return {
      stayedInArea: !this.leftArea,
      finishedOpposite: this.facingOpposite,
      maxThreeManeuvers: this.facingOpposite && this.maneuvers <= CRITERIA.uTurn.maxManeuvers,
    };
  }
}

// ---------------------------------------------------------------------------
// 4. Reverse parallel parking: space 2 m × 6 m against the kerb at x = 3.5.
// ---------------------------------------------------------------------------

const SPACE = {
  outerX: 3.5,
  innerX: 3.5 - CRITERIA.parallelParking.spaceWidth,
  halfLength: CRITERIA.parallelParking.spaceLength / 2,
};

function insideSpace(p: Point): boolean {
  return p.x >= SPACE.innerX && p.x <= SPACE.outerX && Math.abs(p.z) <= SPACE.halfLength;
}

class ParkingJudge implements Judge {
  done = false;
  violating = false;
  private entered: boolean | null = null;
  private touched = false;
  private stoppedInside = false;
  private still = new StillTimer();

  update(car: Vehicle, dt: number): void {
    if (this.done) return;
    const corners = car.corners();
    const overKerb = corners.some((c) => c.x > SPACE.outerX);
    const overEnds = corners.some((c) => c.x > SPACE.innerX && Math.abs(c.z) > SPACE.halfLength);
    const overCorners = [SPACE.innerX, SPACE.outerX].some((x) =>
      [-SPACE.halfLength, SPACE.halfLength].some((z) => car.contains({ x, z })),
    );
    this.violating = overKerb || overEnds || overCorners;
    if (this.violating) this.touched = true;

    if (this.entered === null && insideSpace(car)) this.entered = car.speed < 0;

    const allInside = corners.every(insideSpace);
    const still = this.still.update(car, dt);
    if (car.stopped && (car.parkingBrake || (allInside && still >= 1))) {
      this.stoppedInside = allInside;
      this.done = true;
    }
  }

  cue(): Cue {
    return null;
  }

  checklist(): Record<string, boolean> {
    return {
      reversedIntoSpace: this.entered === true,
      didNotTouchBoundaries: !this.touched,
      stoppedInsideSpace: this.stoppedInside,
    };
  }
}

// ---------------------------------------------------------------------------
// 5. Hill start on a 12 % practice ramp.
// ---------------------------------------------------------------------------

const HILL = { upStart: 10, upEnd: 22, topEnd: 30, downEnd: 42, halfWidth: 2, laneHalf: 1.5 };
const RISE = (HILL.upEnd - HILL.upStart) * SIMULATION.hillGrade;

function hillProfile(d: number): number {
  if (d <= HILL.upStart || d >= HILL.downEnd) return 0;
  if (d <= HILL.upEnd) return (d - HILL.upStart) * SIMULATION.hillGrade;
  if (d <= HILL.topEnd) return RISE;
  return RISE - (d - HILL.topEnd) * SIMULATION.hillGrade;
}

class HillJudge implements Judge {
  done = false;
  violating = false;
  private stoppedOnIncline = false;
  private appliedOnIncline = false;
  private windowRef: number | null = null;
  private windowOpen = false;
  private prevParkingBrake = false;
  private rolledBack = false;
  private reachedTop = false;
  private still = new StillTimer();

  private onIncline(car: Vehicle): boolean {
    const a = -car.front.z;
    const b = -car.rear.z;
    const inUp = (d: number) => d >= HILL.upStart && d <= HILL.upEnd;
    return inUp(a) && inUp(b);
  }

  update(car: Vehicle, dt: number): void {
    if (this.done) return;
    const onIncline = this.onIncline(car);
    const still = this.still.update(car, dt);

    if (onIncline && car.stopped && (still >= 0.3 || car.parkingBrake)) {
      if (!this.stoppedOnIncline) {
        this.stoppedOnIncline = true;
        this.openWindow(car.z);
      }
      if (car.parkingBrake) this.appliedOnIncline = true;
    }
    // While the parking brake holds the car the check pauses; releasing it starts the move-off check.
    if (car.parkingBrake) this.windowOpen = false;
    else if (this.prevParkingBrake && this.appliedOnIncline && !this.reachedTop) this.openWindow(car.z);
    this.prevParkingBrake = car.parkingBrake;

    // Uphill is -z, so moving back down means z grows.
    if (this.windowOpen && this.windowRef !== null) {
      if (car.z - this.windowRef > SIMULATION.rollbackTolerance) this.rolledBack = true;
      if (this.windowRef - car.z >= 2) this.windowOpen = false;
    }

    if (-car.z >= HILL.topEnd - 1) {
      this.reachedTop = true;
      this.done = true;
    }
  }

  private openWindow(z: number): void {
    this.windowRef = z;
    this.windowOpen = true;
  }

  cue(car: Vehicle): Cue {
    return this.onIncline(car) && car.stopped && !car.parkingBrake && !this.appliedOnIncline ? 'parkingBrake' : null;
  }

  checklist(): Record<string, boolean> {
    return {
      stoppedOnIncline: this.stoppedOnIncline,
      appliedParkingBrake: this.appliedOnIncline,
      movedOffWithoutRollback: this.stoppedOnIncline && this.reachedTop && !this.rolledBack,
    };
  }
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

const LANE_CAMERA = { distance: 8, height: 3.6, reach: 10 };
const OVERVIEW_CAMERA = { distance: 8.5, height: 8.5, reach: 6 };

const movingOffStartZ = LANE.startZ - HALF_LEN - 0.6;

export const EXERCISES: readonly ExerciseSpec[] = [
  {
    id: 'moving-off',
    checklist: ['movedOff', 'stayedInLane', 'stoppedBeforeLine'],
    start: { x: 0, z: movingOffStartZ, heading: 0 },
    camera: LANE_CAMERA,
    bounds: PAD,
    build: (ctx) => buildLane(ctx, true),
    createJudge: () => new MovingOffJudge(movingOffStartZ),
  },
  {
    id: 'reversing',
    checklist: ['selectedReverseWhileStopped', 'stayedInLane', 'stoppedBeforeLine'],
    start: { x: 0, z: LANE.endZ + HALF_LEN + 0.6, heading: 0 },
    camera: LANE_CAMERA,
    bounds: PAD,
    build: (ctx) => buildLane(ctx, false),
    createJudge: () => new ReversingJudge(),
  },
  {
    id: 'u-turn',
    checklist: ['stayedInArea', 'finishedOpposite', 'maxThreeManeuvers'],
    start: { x: 6, z: -1.5, heading: UTURN_START_HEADING },
    camera: OVERVIEW_CAMERA,
    bounds: PAD,
    build: (ctx) => {
      const { halfWidth: w, halfLength: l } = UTURN;
      ctx.line(-l, -w, l, -w, 0.15, 'boundary');
      ctx.line(-l, w, l, w, 0.15, 'boundary');
      ctx.line(-l, -w, -l, w, 0.1, 'mark');
      ctx.line(l, -w, l, w, 0.1, 'mark');
      ctx.line(-l + 1, 0, l - 1, 0, 0.1, 'dashed');
      for (const x of [-l, l]) for (const z of [-w - 0.6, w + 0.6]) ctx.cone(x, z);
    },
    createJudge: () => new UTurnJudge(),
  },
  {
    id: 'parallel-parking',
    checklist: ['reversedIntoSpace', 'didNotTouchBoundaries', 'stoppedInsideSpace'],
    start: { x: 0.1, z: 9, heading: 0 },
    camera: OVERVIEW_CAMERA,
    bounds: { minX: -6, maxX: 6, minZ: -40, maxZ: 40 },
    build: (ctx) => {
      const { innerX, outerX, halfLength: h } = SPACE;
      ctx.kerb(outerX, 30, outerX, -30);
      ctx.line(outerX - 0.06, 30, outerX - 0.06, -30, 0.12, 'boundary');
      ctx.line(innerX, -h, outerX, -h, 0.12, 'boundary');
      ctx.line(innerX, h, outerX, h, 0.12, 'boundary');
      ctx.line(innerX, -h, innerX, h, 0.1, 'dashed');
      ctx.line(-2.2, 30, -2.2, -30, 0.1, 'mark');
      ctx.cone(outerX + 0.6, -h);
      ctx.cone(outerX + 0.6, h);
    },
    createJudge: () => new ParkingJudge(),
  },
  {
    id: 'hill-start',
    checklist: ['stoppedOnIncline', 'appliedParkingBrake', 'movedOffWithoutRollback'],
    start: { x: 0, z: 3, heading: 0 },
    camera: LANE_CAMERA,
    bounds: { minX: -1.05, maxX: 1.05, minZ: -50, maxZ: 12 },
    terrain: {
      heightAt: (x, z) => (Math.abs(x) <= HILL.halfWidth ? hillProfile(-z) : 0),
    },
    build: (ctx) => {
      ctx.ramp(hillProfile, HILL.upStart, HILL.downEnd, HILL.halfWidth);
      ctx.terrainLine(-HILL.laneHalf, 8, -46, 0.12, 'mark');
      ctx.terrainLine(HILL.laneHalf, 8, -46, 0.12, 'mark');
      for (const x of [-HILL.halfWidth - 0.6, HILL.halfWidth + 0.6]) {
        ctx.cone(x, -HILL.upStart);
        ctx.cone(x, -HILL.topEnd);
      }
    },
    createJudge: () => new HillJudge(),
  },
];

export function findExercise(id: string): ExerciseSpec | undefined {
  return EXERCISES.find((e) => e.id === id);
}
