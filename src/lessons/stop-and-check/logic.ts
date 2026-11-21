/**
 * Pure lesson logic for "Stop and check": car kinematics, a fixed traffic
 * timeline, the safety hold, and the practice checklist. No rendering here.
 *
 * World axes: the learner drives toward -z in the right-hand lane (+x).
 * The cross road runs along x. Heading 0 = facing -z; positive = turning left.
 */

export const LAYOUT = {
  laneX: 1.75,
  roadHalfWidth: 3.5,
  carHalfLength: 2.1,
  carHalfWidth: 0.9,
  startZ: 46,
  /** Near edge of the stop line (the learner's side). The line is painted toward -z. */
  stopLineZ: 0,
  stopLineDepth: 0.4,
  /** A full stop with the front bumper within this distance of the line counts as "at the line". */
  stopZoneLength: 6,
  /** Small allowance for the bumper slightly overlapping the painted line. */
  stopLineTolerance: 0.15,
  /** Furthest the front bumper may go while the crossing is held. Just short of the cross road. */
  holdFrontZ: -1.0,
  crossNearZ: -1.6,
  crossFarZ: -8.6,
  crossLaneFromLeftZ: -3.35,
  crossLaneFromRightZ: -6.85,
  zebraZ: -12.5,
  zebraDepth: 3,
  exitZ: -46,
} as const;

const PHYS = {
  accel: 3.2,
  brake: 7.5,
  rolling: 0.6,
  drag: 0.02,
  maxSpeed: 14,
  wheelBase: 2.6,
  maxSteer: 0.42,
  steerRate: 2.4,
  maxHeading: 0.35,
  holdDecel: 9,
  /** Look-around pan speed (fraction of full turn per second). */
  lookRate: 3.2,
  /** Look extent needed to register a check. */
  lookThreshold: 0.85,
  /** Below this speed a look counts as a check at the junction. */
  checkMaxSpeed: 0.3,
} as const;

/**
 * Fixed traffic timeline, in seconds since the learner reached the line.
 * One vehicle from the left, a pedestrian on the crossing ahead, then one
 * vehicle from the right. After CLEAR_AT nothing else comes.
 */
export const TRAFFIC = {
  fromLeft: { startX: -52, speed: 11 },
  fromRight: { startX: 80, speed: 11 },
  pedestrian: { startX: 5.4, endX: -5.4, delay: 0.6, speed: 1.5 },
  clearAt: 8.0,
} as const;

export interface DriveControls {
  accelerate: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  lookLeft: boolean;
  lookRight: boolean;
}

export type Phase = 'approach' | 'atJunction' | 'crossing' | 'done';
export type HoldReason = 'unsafe' | 'checks' | null;

export interface ChecklistState {
  stoppedBeforeLine: boolean;
  checkedBothWays: boolean;
  waitedWhileUnsafe: boolean;
  proceededWhenClear: boolean;
}

export interface ActorPose {
  x: number;
  z: number;
  visible: boolean;
  moving: boolean;
}

export class StopCheckLogic {
  // Car state
  x: number = LAYOUT.laneX;
  z: number = LAYOUT.startZ;
  heading = 0;
  speed = 0;
  steer = 0;
  /** -1 = looking fully right, +1 = fully left. */
  look = 0;

  phase: Phase = 'approach';
  /** null until decided: true once fully stopped at the line, false if the line was passed first. */
  stopDecision: boolean | null = null;
  trafficTime: number | null = null;
  checkedLeft = false;
  checkedRight = false;
  hold: HoldReason = null;

  private attemptedWhileUnsafe = false;
  private attemptedBeforeChecks = false;
  private enteredWhenClear = false;
  private stoppedInsideJunction = false;

  get frontZ(): number {
    return this.z - Math.cos(this.heading) * LAYOUT.carHalfLength;
  }

  get rearZ(): number {
    return this.z + Math.cos(this.heading) * LAYOUT.carHalfLength;
  }

  get isSafe(): boolean {
    return this.trafficTime !== null && this.trafficTime >= TRAFFIC.clearAt;
  }

  get checkedBoth(): boolean {
    return this.checkedLeft && this.checkedRight;
  }

  step(dt: number, c: DriveControls): void {
    if (this.phase === 'done') return;

    if (this.trafficTime !== null) this.trafficTime += dt;

    this.updateLook(dt, c);
    this.updateSteering(dt, c);
    const throttle = this.updateSpeed(dt, c);
    this.applyHold(throttle);
    this.integrate(dt);
    this.evaluate(c);
  }

  private updateLook(dt: number, c: DriveControls): void {
    const target = (c.lookLeft ? 1 : 0) - (c.lookRight ? 1 : 0);
    const delta = target - this.look;
    const maxStep = PHYS.lookRate * dt;
    this.look += Math.max(-maxStep, Math.min(maxStep, delta));
  }

  private updateSteering(dt: number, c: DriveControls): void {
    const target = ((c.left ? 1 : 0) - (c.right ? 1 : 0)) * PHYS.maxSteer;
    const delta = target - this.steer;
    const maxStep = PHYS.steerRate * dt;
    this.steer += Math.max(-maxStep, Math.min(maxStep, delta));
  }

  /** Returns whether the learner is pressing the accelerator (and not the brake). */
  private updateSpeed(dt: number, c: DriveControls): boolean {
    const throttle = c.accelerate && !c.brake;
    let a = -PHYS.rolling - PHYS.drag * this.speed * this.speed;
    if (throttle) a += PHYS.accel + PHYS.rolling;
    if (c.brake) a -= PHYS.brake;
    this.speed = Math.max(0, Math.min(PHYS.maxSpeed, this.speed + a * dt));
    return throttle;
  }

  /**
   * While the crossing is not yet allowed, the car cannot enter it: speed is
   * capped so it always comes to rest at holdFrontZ. Pushing against the hold
   * is recorded for the checklist.
   */
  private applyHold(throttle: boolean): void {
    this.hold = null;
    if (this.phase !== 'atJunction') return;

    if (!this.isSafe) this.hold = 'unsafe';
    else if (!this.checkedBoth) this.hold = 'checks';
    if (!this.hold) return;

    const distance = Math.max(0, this.frontZ - LAYOUT.holdFrontZ);
    const cap = Math.sqrt(2 * PHYS.holdDecel * distance);
    const pushing = (throttle && distance < 0.3) || this.speed > cap + 0.05;
    if (this.speed > cap) this.speed = cap;
    if (distance <= 0.001) this.speed = 0;

    if (pushing) {
      if (!this.isSafe) this.attemptedWhileUnsafe = true;
      if (!this.checkedBoth) this.attemptedBeforeChecks = true;
    }
  }

  private integrate(dt: number): void {
    const yawRate = (this.speed / PHYS.wheelBase) * Math.tan(this.steer);
    this.heading = Math.max(-PHYS.maxHeading, Math.min(PHYS.maxHeading, this.heading + yawRate * dt));

    this.x -= Math.sin(this.heading) * this.speed * dt;
    this.z -= Math.cos(this.heading) * this.speed * dt;

    // Kerbs: keep the car on the carriageway and ease it back to straight.
    const limit = LAYOUT.roadHalfWidth - LAYOUT.carHalfWidth - 0.05;
    if (this.x > limit || this.x < -limit) {
      this.x = Math.max(-limit, Math.min(limit, this.x));
      this.heading *= 0.85;
    }

    if (this.phase === 'atJunction' && this.hold && this.frontZ < LAYOUT.holdFrontZ) {
      this.z = LAYOUT.holdFrontZ + Math.cos(this.heading) * LAYOUT.carHalfLength;
      this.speed = 0;
    }
  }

  private evaluate(c: DriveControls): void {
    const front = this.frontZ;
    const stopped = this.speed <= 0.001;

    // 1. Full stop before the line?
    if (this.stopDecision === null) {
      const inZone =
        front >= LAYOUT.stopLineZ - LAYOUT.stopLineTolerance &&
        front <= LAYOUT.stopLineZ + LAYOUT.stopZoneLength;
      if (stopped && inZone) this.decideStop(true);
      else if (front < LAYOUT.stopLineZ - LAYOUT.stopLineTolerance) this.decideStop(false);
    }

    // 2. Looks only count at the junction, with the car (nearly) still.
    if (this.phase === 'atJunction' && this.speed < PHYS.checkMaxSpeed) {
      if (c.lookLeft && this.look >= PHYS.lookThreshold) this.checkedLeft = true;
      if (c.lookRight && this.look <= -PHYS.lookThreshold) this.checkedRight = true;
    }

    // 3. Entering the cross road.
    if (this.phase === 'atJunction' && front < LAYOUT.crossNearZ) {
      this.phase = 'crossing';
      this.enteredWhenClear = this.isSafe && this.checkedBoth;
    }

    // 4. Stopping again inside the junction or on the crossing beyond it.
    if (this.phase === 'crossing' && stopped && this.rearZ > LAYOUT.zebraZ - LAYOUT.zebraDepth) {
      this.stoppedInsideJunction = true;
    }

    if (front < LAYOUT.exitZ) this.phase = 'done';
  }

  private decideStop(stoppedAtLine: boolean): void {
    this.stopDecision = stoppedAtLine;
    this.trafficTime = 0;
    this.phase = 'atJunction';
  }

  checklist(): ChecklistState {
    return {
      stoppedBeforeLine: this.stopDecision === true,
      checkedBothWays: this.checkedBoth && !this.attemptedBeforeChecks,
      waitedWhileUnsafe: this.trafficTime !== null && !this.attemptedWhileUnsafe,
      proceededWhenClear: this.enteredWhenClear && !this.stoppedInsideJunction,
    };
  }

  // Traffic poses (deterministic functions of trafficTime).

  vehicleFromLeft(): ActorPose {
    const t = this.trafficTime;
    const x = TRAFFIC.fromLeft.startX + TRAFFIC.fromLeft.speed * (t ?? 0);
    return { x, z: LAYOUT.crossLaneFromLeftZ, visible: t !== null && x < 140, moving: t !== null };
  }

  vehicleFromRight(): ActorPose {
    const t = this.trafficTime;
    const x = TRAFFIC.fromRight.startX - TRAFFIC.fromRight.speed * (t ?? 0);
    return { x, z: LAYOUT.crossLaneFromRightZ, visible: t !== null && x > -140, moving: t !== null };
  }

  pedestrian(): ActorPose {
    const p = TRAFFIC.pedestrian;
    const walked = Math.max(0, ((this.trafficTime ?? 0) - p.delay) * p.speed);
    const x = Math.max(p.endX, p.startX - walked);
    return { x, z: LAYOUT.zebraZ, visible: true, moving: walked > 0 && x > p.endX };
  }
}
