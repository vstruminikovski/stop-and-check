import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Shape,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type WebGLRenderer,
} from 'three';
import { createCar, type CarModel } from '../../game/carModel';
import { CAR_DIMENSIONS, type Vehicle } from '../../game/vehicle';
import type { BuildContext, ExerciseSpec, LineKind } from './types';

const COLORS = {
  sky: 0xdde9f3,
  grass: 0xc7d9b4,
  pad: 0x8d929a,
  marking: 0xf6f6f1,
  stop: 0xffffff,
  violation: 0xff5a36,
  player: 0x2f6fde,
  concrete: 0xc9ccd1,
  rampTop: 0x60656d,
};

/** Car model is 4.2 m long; the practice car is the supplied 4 m. */
const CAR_SCALE = CAR_DIMENSIONS.length / 4.2;

export class PracticeScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(60, 1, 0.1, 400);

  private car: CarModel;
  private boundaryMaterial = new MeshBasicMaterial({ color: COLORS.marking });
  private camPos = new Vector3();
  private camTarget = new Vector3();
  private camYaw = 0;
  private initialised = false;
  private aspect = 1;

  constructor(
    private renderer: WebGLRenderer,
    private spec: ExerciseSpec,
  ) {
    this.scene.background = new Color(COLORS.sky);
    this.scene.fog = new Fog(COLORS.sky, 70, 200);
    this.scene.add(new HemisphereLight(0xf4f8ff, 0xb9c4a6, 1.9));
    const sun = new DirectionalLight(0xffffff, 1.5);
    sun.position.set(-30, 60, 25);
    this.scene.add(sun);

    this.buildGround();
    spec.build(this.context());

    this.car = createCar(COLORS.player);
    this.car.group.scale.setScalar(CAR_SCALE);
    this.car.group.rotation.order = 'YXZ';
    this.scene.add(this.car.group);
  }

  private add(geometry: BufferGeometry, material: Material, x: number, y: number, z: number): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    return mesh;
  }

  private buildGround(): void {
    const flat = (g: PlaneGeometry) => g.rotateX(-Math.PI / 2);
    this.add(flat(new PlaneGeometry(600, 600)), new MeshLambertMaterial({ color: COLORS.grass }), 0, 0, 0);
    this.add(flat(new PlaneGeometry(124, 124)), new MeshLambertMaterial({ color: COLORS.pad }), 0, 0.005, 0);

    // Perimeter kerb of the practice ground
    const kerb = new MeshLambertMaterial({ color: 0xd9dade });
    for (const s of [-1, 1]) {
      this.add(new BoxGeometry(124, 0.18, 0.4), kerb, 0, 0.09, s * 62);
      this.add(new BoxGeometry(0.4, 0.18, 124), kerb, s * 62, 0.09, 0);
    }

    // Trees and a few low buildings around the ground (fictional)
    const trunk = new MeshLambertMaterial({ color: 0x8a6f55 });
    const leaves = [0x8fb27a, 0x7ea56d, 0x9cbc86].map((color) => new MeshLambertMaterial({ color }));
    const trunkGeo = new CylinderGeometry(0.12, 0.16, 1.4, 8);
    const crownGeo = new SphereGeometry(1.4, 14, 10);
    let n = 0;
    for (let p = -58; p <= 58; p += 9) {
      for (const [x, z] of [
        [p, -68],
        [p + 4, 68],
        [-68, p],
        [68, p + 4],
      ] as const) {
        this.add(trunkGeo, trunk, x, 0.7, z);
        this.add(crownGeo, leaves[n++ % leaves.length], x, 2.4, z);
      }
    }
    const walls = [0xe9e3d8, 0xdfe6ee, 0xeee0d3].map((color) => new MeshLambertMaterial({ color }));
    const roof = new MeshLambertMaterial({ color: 0xb9bcc2 });
    (
      [
        [-82, -30, 14, 10, 7],
        [84, 20, 12, 14, 6],
        [-30, 84, 18, 10, 8],
        [36, -86, 14, 12, 9],
      ] as const
    ).forEach(([x, z, w, d, h], i) => {
      this.add(new BoxGeometry(w, h, d), walls[i % walls.length], x, h / 2, z);
      this.add(new BoxGeometry(w + 0.4, 0.35, d + 0.4), roof, x, h + 0.17, z);
    });
  }

  private context(): BuildContext {
    const markMaterial = new MeshBasicMaterial({ color: COLORS.marking });
    const stopMaterial = new MeshBasicMaterial({ color: COLORS.stop });
    const materialFor = (kind: LineKind): Material =>
      kind === 'boundary' ? this.boundaryMaterial : kind === 'stop' ? stopMaterial : markMaterial;
    const terrain = this.spec.terrain;

    const strip = (x1: number, z1: number, x2: number, z2: number, width: number, material: Material, y = 0.02) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const geo = new PlaneGeometry(width, len).rotateX(-Math.PI / 2);
      const mesh = this.add(geo, material, (x1 + x2) / 2, y, (z1 + z2) / 2);
      mesh.rotation.y = Math.atan2(dx, dz);
    };

    return {
      line: (x1, z1, x2, z2, width, kind) => {
        const material = materialFor(kind);
        if (kind !== 'dashed') return strip(x1, z1, x2, z2, width, material);
        const len = Math.hypot(x2 - x1, z2 - z1);
        const count = Math.floor(len / 1.5);
        for (let i = 0; i < count; i += 2) {
          const a = i / count;
          const b = (i + 1) / count;
          strip(x1 + (x2 - x1) * a, z1 + (z2 - z1) * a, x1 + (x2 - x1) * b, z1 + (z2 - z1) * b, width, material);
        }
      },
      cone: (x, z) => {
        const cone = new Group();
        const orange = new MeshLambertMaterial({ color: 0xf07a2a });
        const body = new Mesh(new ConeGeometry(0.22, 0.7, 16), orange);
        body.position.y = 0.37;
        const band = new Mesh(new CylinderGeometry(0.115, 0.15, 0.12, 16), new MeshLambertMaterial({ color: 0xffffff }));
        band.position.y = 0.42;
        const base = new Mesh(new BoxGeometry(0.5, 0.04, 0.5), orange);
        base.position.y = 0.02;
        cone.add(body, band, base);
        cone.position.set(x, 0, z);
        this.scene.add(cone);
      },
      kerb: (x1, z1, x2, z2) => {
        const len = Math.hypot(x2 - x1, z2 - z1);
        const mesh = this.add(
          new BoxGeometry(0.3, 0.15, len),
          new MeshLambertMaterial({ color: 0xd9dade }),
          (x1 + x2) / 2 + 0.15,
          0.075,
          (z1 + z2) / 2,
        );
        mesh.rotation.y = Math.atan2(x2 - x1, z2 - z1);
      },
      ramp: (profile, dStart, dEnd, halfWidth) => {
        const shape = new Shape();
        shape.moveTo(dStart, 0);
        for (let d = dStart; d <= dEnd; d += 0.5) shape.lineTo(d, profile(d));
        shape.lineTo(dEnd, 0);
        shape.closePath();
        const body = new ExtrudeGeometry(shape, { depth: halfWidth * 2, bevelEnabled: false });
        body.rotateY(Math.PI / 2).translate(-halfWidth, 0, 0);
        this.add(body, new MeshLambertMaterial({ color: COLORS.concrete }), 0, 0, 0);
        // Asphalt top surface following the profile
        const len = dEnd - dStart;
        const top = new PlaneGeometry(halfWidth * 2, len, 1, Math.ceil(len * 2)).rotateX(-Math.PI / 2);
        const pos = top.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const z = pos.getZ(i) - (dStart + dEnd) / 2;
          pos.setY(i, profile(-z) + 0.01);
          pos.setZ(i, z);
        }
        top.computeVertexNormals();
        this.add(top, new MeshLambertMaterial({ color: COLORS.rampTop }), 0, 0, 0);
      },
      terrainLine: (x, z1, z2, width, kind) => {
        const len = Math.abs(z2 - z1);
        const geo = new PlaneGeometry(width, len, 1, Math.ceil(len * 2)).rotateX(-Math.PI / 2);
        const pos = geo.attributes.position;
        const mid = (z1 + z2) / 2;
        for (let i = 0; i < pos.count; i++) {
          const z = pos.getZ(i) + mid;
          pos.setY(i, (terrain ? terrain.heightAt(x, z) : 0) + 0.025);
          pos.setZ(i, z);
          pos.setX(i, pos.getX(i) + x);
        }
        this.add(geo, materialFor(kind), 0, 0, 0);
      },
    };
  }

  resize(width: number, height: number): void {
    const aspect = width / Math.max(1, height);
    const hfov = (72 * Math.PI) / 180;
    const vfov = (2 * Math.atan(Math.tan(hfov / 2) / aspect) * 180) / Math.PI;
    this.camera.fov = Math.max(48, Math.min(88, vfov));
    this.camera.aspect = aspect;
    this.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  update(car: Vehicle, violating: boolean, dt: number): void {
    const g = this.car.group;
    g.position.set(car.x, car.y, car.z);
    g.rotation.set(car.pitch, car.heading, 0);
    for (const w of this.car.wheels) w.rotation.x -= (car.speed / 0.34) * dt;
    for (const fw of this.car.frontWheels) fw.rotation.y = car.steer;

    const flash = violating && Math.floor(performance.now() / 180) % 2 === 0;
    this.boundaryMaterial.color.setHex(violating ? (flash ? COLORS.violation : 0xffb199) : COLORS.marking);

    this.updateCamera(car, dt);
  }

  private updateCamera(car: Vehicle, dt: number): void {
    const cam = this.spec.camera;
    // When reverse is selected the camera turns to look out of the back, like a shoulder check.
    const targetYaw = car.heading + (car.gear === 'R' ? Math.PI : 0);
    if (!this.initialised) this.camYaw = targetYaw;
    else if (dt > 0) {
      let diff = targetYaw - this.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.camYaw += diff * (1 - Math.exp(-dt * 4));
    }
    const narrow = Math.min(1.7, Math.max(1, 0.95 / this.aspect));
    const dirX = -Math.sin(this.camYaw);
    const dirZ = -Math.cos(this.camYaw);
    const dist = cam.distance * narrow;
    const height = cam.height * (1 + (narrow - 1) * 0.7);
    const desired = new Vector3(car.x - dirX * dist, car.y + height, car.z - dirZ * dist);
    const reach = cam.reach * narrow;
    const target = new Vector3(car.x + dirX * reach, car.y + 0.6, car.z + dirZ * reach);
    if (!this.initialised) {
      this.camPos.copy(desired);
      this.camTarget.copy(target);
      this.initialised = true;
    } else if (dt > 0) {
      const k = 1 - Math.exp(-dt * 6);
      this.camPos.lerp(desired, k);
      this.camTarget.lerp(target, k);
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    this.scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        geometries.add(obj.geometry);
        (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m: Material) => materials.add(m));
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  }
}
