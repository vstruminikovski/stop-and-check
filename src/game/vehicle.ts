/**
 * Simple automatic-transmission car for practice exercises: signed speed,
 * D/R selector (reverse only while stopped), parking brake, and gravity on slopes.
 * No physics engine — a kinematic bicycle model plus a few force terms.
 *
 * Axes match the rest of the app: heading 0 faces -z, positive heading turns left.
 */

export interface VehicleControls {
  accelerate: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
}

export interface Terrain {
  heightAt(x: number, z: number): number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type Gear = 'D' | 'R';

export interface VehicleStart {
  x: number;
  z: number;
  heading: number;
  gear?: Gear;
  parkingBrake?: boolean;
}

export const CAR_DIMENSIONS = { length: 4, width: 1.72, wheelBase: 2.5 } as const;

const P = {
  accelD: 2.4,
  accelR: 1.5,
  maxForward: 8,
  maxReverse: 3,
  brake: 7,
  parkingBrake: 8,
  rolling: 0.35,
  drag: 0.02,
  gravity: 9.81,
  maxSteer: 0.7,
  steerRate: 1.8,
} as const;

export interface Point {
  x: number;
  z: number;
}

export class Vehicle {
  x: number;
  z: number;
  heading: number;
  /** Signed speed along the car's nose: + forward, − backward (m/s). */
  speed = 0;
  steer = 0;
  gear: Gear;
  parkingBrake: boolean;
  y = 0;
  pitch = 0;
  /** R was pressed while the car was moving (selection refused). */
  reverseRefusedWhileMoving = false;
  /** Gear was switched to R at least once. */
  reverseSelected = false;

  constructor(start: VehicleStart) {
    this.x = start.x;
    this.z = start.z;
    this.heading = start.heading;
    this.gear = start.gear ?? 'D';
    this.parkingBrake = start.parkingBrake ?? false;
  }

  get stopped(): boolean {
    return Math.abs(this.speed) < 1e-3;
  }

  get forward(): Point {
    return { x: -Math.sin(this.heading), z: -Math.cos(this.heading) };
  }

  get front(): Point {
    const f = this.forward;
    const h = CAR_DIMENSIONS.length / 2;
    return { x: this.x + f.x * h, z: this.z + f.z * h };
  }

  get rear(): Point {
    const f = this.forward;
    const h = CAR_DIMENSIONS.length / 2;
    return { x: this.x - f.x * h, z: this.z - f.z * h };
  }

  /** Footprint corners: front-left, front-right, rear-right, rear-left. */
  corners(): Point[] {
    const f = this.forward;
    const r = { x: -f.z, z: f.x }; // right-hand side
    const hl = CAR_DIMENSIONS.length / 2;
    const hw = CAR_DIMENSIONS.width / 2;
    return [
      { x: this.x + f.x * hl - r.x * hw, z: this.z + f.z * hl - r.z * hw },
      { x: this.x + f.x * hl + r.x * hw, z: this.z + f.z * hl + r.z * hw },
      { x: this.x - f.x * hl + r.x * hw, z: this.z - f.z * hl + r.z * hw },
      { x: this.x - f.x * hl - r.x * hw, z: this.z - f.z * hl - r.z * hw },
    ];
  }

  /** Whether a ground point lies under the car's footprint. */
  contains(p: Point): boolean {
    const f = this.forward;
    const dx = p.x - this.x;
    const dz = p.z - this.z;
    const along = dx * f.x + dz * f.z;
    const side = dx * -f.z + dz * f.x;
    return Math.abs(along) <= CAR_DIMENSIONS.length / 2 && Math.abs(side) <= CAR_DIMENSIONS.width / 2;
  }

  /** Toggle D/R. Only allowed while stopped; returns whether the gear changed. */
  toggleReverse(): boolean {
    if (!this.stopped) {
      this.reverseRefusedWhileMoving = true;
      return false;
    }
    this.gear = this.gear === 'D' ? 'R' : 'D';
    if (this.gear === 'R') this.reverseSelected = true;
    return true;
  }

  toggleParkingBrake(): void {
    this.parkingBrake = !this.parkingBrake;
  }

  step(dt: number, c: VehicleControls, terrain?: Terrain, bounds?: Bounds): void {
    // Steering
    const targetSteer = ((c.left ? 1 : 0) - (c.right ? 1 : 0)) * P.maxSteer;
    const ds = targetSteer - this.steer;
    this.steer += Math.max(-P.steerRate * dt, Math.min(P.steerRate * dt, ds));

    // Slope along the car (from ground height under the front and rear)
    this.updatePitch(terrain);
    const gravityAlong = -P.gravity * Math.sin(this.pitch);

    let drive = 0;
    if (c.accelerate && !c.brake && !this.parkingBrake) drive = this.gear === 'D' ? P.accelD : -P.accelR;
    const applied = drive + gravityAlong;
    const holding = (c.brake ? P.brake : 0) + (this.parkingBrake ? P.parkingBrake : 0);

    if (this.stopped) {
      // Static: brakes (and a little rolling resistance) hold the car until overcome.
      if (Math.abs(applied) <= holding + P.rolling) this.speed = 0;
      else this.speed = Math.sign(applied) * (Math.abs(applied) - holding - P.rolling) * dt;
    } else {
      const before = this.speed;
      this.speed += applied * dt;
      const resist = (holding + P.rolling + P.drag * this.speed * this.speed) * dt;
      if (Math.abs(this.speed) <= resist || Math.sign(this.speed) !== Math.sign(before)) this.speed = 0;
      else this.speed -= Math.sign(this.speed) * resist;
    }
    if (this.gear === 'D') this.speed = Math.min(this.speed, P.maxForward);
    else this.speed = Math.max(this.speed, -P.maxReverse);
    this.speed = Math.max(-P.maxForward, Math.min(P.maxForward, this.speed));

    // Kinematic bicycle model about the rear axle (the rear wheels follow, the nose swings).
    const half = CAR_DIMENSIONS.wheelBase / 2;
    let rx = this.x + Math.sin(this.heading) * half;
    let rz = this.z + Math.cos(this.heading) * half;
    rx -= Math.sin(this.heading) * this.speed * dt;
    rz -= Math.cos(this.heading) * this.speed * dt;
    const yawRate = (this.speed / CAR_DIMENSIONS.wheelBase) * Math.tan(this.steer);
    this.heading = wrapAngle(this.heading + yawRate * dt);
    this.x = rx - Math.sin(this.heading) * half;
    this.z = rz - Math.cos(this.heading) * half;

    if (bounds) {
      const cx = Math.max(bounds.minX, Math.min(bounds.maxX, this.x));
      const cz = Math.max(bounds.minZ, Math.min(bounds.maxZ, this.z));
      if (cz !== this.z) this.speed = 0;
      this.x = cx;
      this.z = cz;
    }
    this.updatePitch(terrain);
  }

  private updatePitch(terrain?: Terrain): void {
    if (!terrain) {
      this.pitch = 0;
      this.y = 0;
      return;
    }
    const f = this.front;
    const r = this.rear;
    const hf = terrain.heightAt(f.x, f.z);
    const hr = terrain.heightAt(r.x, r.z);
    this.pitch = Math.atan2(hf - hr, CAR_DIMENSIONS.length);
    this.y = (hf + hr) / 2;
  }
}

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}
