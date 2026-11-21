import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
  type WebGLRenderer,
} from 'three';
import { createCar, type CarModel } from '../../game/carModel';
import { LAYOUT, type ActorPose, type StopCheckLogic } from './logic';

const COLORS = {
  sky: 0xdde9f3,
  grass: 0xc7d9b4,
  asphalt: 0x6a6f77,
  sidewalk: 0xdcdde1,
  marking: 0xf6f6f1,
  player: 0x2f6fde,
  fromLeft: 0xf2f2f0,
  fromRight: 0xe8833a,
};

const SIDEWALK_W = 2.2;
const SIDEWALK_H = 0.14;
const CROSS_CENTER_Z = (LAYOUT.crossNearZ + LAYOUT.crossFarZ) / 2;
const CROSS_HALF = (LAYOUT.crossNearZ - LAYOUT.crossFarZ) / 2;

function flat(geometry: PlaneGeometry): PlaneGeometry {
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function stopSignTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const octagon = (r: number): void => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      ctx.lineTo(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r);
    }
    ctx.closePath();
  };
  ctx.fillStyle = '#ffffff';
  octagon(128);
  ctx.fill();
  ctx.fillStyle = '#c8202a';
  octagon(116);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 76px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('STOP', size / 2, size / 2 + 4);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

interface Pedestrian {
  group: Group;
  legs: Mesh[];
  arms: Mesh[];
}

function createPedestrian(): Pedestrian {
  const group = new Group();
  const coat = new MeshLambertMaterial({ color: 0x3f6f8f });
  const trousers = new MeshLambertMaterial({ color: 0x34383f });
  const skin = new MeshLambertMaterial({ color: 0xd9ab84 });

  const torso = new Mesh(new BoxGeometry(0.44, 0.62, 0.26), coat);
  torso.position.y = 1.18;
  group.add(torso);
  const head = new Mesh(new SphereGeometry(0.16, 16, 12), skin);
  head.position.y = 1.68;
  group.add(head);

  const legs: Mesh[] = [];
  const arms: Mesh[] = [];
  for (const side of [-1, 1]) {
    const leg = new Mesh(new BoxGeometry(0.16, 0.86, 0.18), trousers);
    leg.geometry.translate(0, -0.43, 0);
    leg.position.set(side * 0.11, 0.88, 0);
    group.add(leg);
    legs.push(leg);
    const arm = new Mesh(new BoxGeometry(0.12, 0.6, 0.14), coat);
    arm.geometry.translate(0, -0.3, 0);
    arm.position.set(side * 0.29, 1.46, 0);
    group.add(arm);
    arms.push(arm);
  }
  const shadow = new Mesh(
    new CircleGeometry(0.35, 16),
    new MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.16, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  group.add(shadow);
  return { group, legs, arms };
}

export class StopCheckScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(60, 1, 0.1, 400);

  private player: CarModel;
  private fromLeft: CarModel;
  private fromRight: CarModel;
  private pedestrian: Pedestrian;
  private camPos = new Vector3();
  private camTarget = new Vector3();
  private walkPhase = 0;
  private initialised = false;
  private aspect = 1;

  constructor(private renderer: WebGLRenderer) {
    this.scene.background = new Color(COLORS.sky);
    this.scene.fog = new Fog(COLORS.sky, 70, 210);

    this.scene.add(new HemisphereLight(0xf4f8ff, 0xb9c4a6, 1.9));
    const sun = new DirectionalLight(0xffffff, 1.5);
    sun.position.set(-30, 60, 25);
    this.scene.add(sun);

    this.buildWorld();

    this.player = createCar(COLORS.player);
    this.fromLeft = createCar(COLORS.fromLeft);
    this.fromRight = createCar(COLORS.fromRight);
    // Cross traffic drives along x: from the left heading +x, from the right heading -x.
    this.fromLeft.group.rotation.y = -Math.PI / 2;
    this.fromRight.group.rotation.y = Math.PI / 2;
    this.pedestrian = createPedestrian();
    this.pedestrian.group.rotation.y = -Math.PI / 2; // walking toward -x
    this.scene.add(this.player.group, this.fromLeft.group, this.fromRight.group, this.pedestrian.group);
  }

  private add(geometry: BufferGeometry, material: Material, x: number, y: number, z: number): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    return mesh;
  }

  private buildWorld(): void {
    const grass = new MeshLambertMaterial({ color: COLORS.grass });
    const asphalt = new MeshLambertMaterial({ color: COLORS.asphalt });
    const sidewalk = new MeshLambertMaterial({ color: COLORS.sidewalk });
    const marking = new MeshBasicMaterial({ color: COLORS.marking });
    const roadW = LAYOUT.roadHalfWidth * 2;

    this.add(flat(new PlaneGeometry(600, 600)), grass, 0, 0, 0);

    // Roads
    this.add(flat(new PlaneGeometry(roadW, 220)), asphalt, 0, 0.01, -10);
    this.add(flat(new PlaneGeometry(360, CROSS_HALF * 2)), asphalt, 0, 0.011, CROSS_CENTER_Z);

    // Sidewalks along the main road (south of and north of the junction)
    const sx = LAYOUT.roadHalfWidth + SIDEWALK_W / 2;
    const southLen = 100 - LAYOUT.crossNearZ;
    const northLen = 120 + LAYOUT.crossFarZ;
    for (const side of [-1, 1]) {
      this.add(new BoxGeometry(SIDEWALK_W, SIDEWALK_H, southLen), sidewalk, side * sx, SIDEWALK_H / 2, LAYOUT.crossNearZ + southLen / 2);
      this.add(new BoxGeometry(SIDEWALK_W, SIDEWALK_H, northLen), sidewalk, side * sx, SIDEWALK_H / 2, LAYOUT.crossFarZ - northLen / 2);
    }
    // Sidewalks along the cross road
    const crossLen = 180 - LAYOUT.roadHalfWidth;
    for (const side of [-1, 1]) {
      const cx = side * (LAYOUT.roadHalfWidth + crossLen / 2);
      this.add(new BoxGeometry(crossLen, SIDEWALK_H, SIDEWALK_W), sidewalk, cx, SIDEWALK_H / 2, LAYOUT.crossNearZ + SIDEWALK_W / 2);
      this.add(new BoxGeometry(crossLen, SIDEWALK_H, SIDEWALK_W), sidewalk, cx, SIDEWALK_H / 2, LAYOUT.crossFarZ - SIDEWALK_W / 2);
    }

    // Stop line across the learner's lane
    this.add(
      flat(new PlaneGeometry(LAYOUT.roadHalfWidth - 0.15, LAYOUT.stopLineDepth)),
      marking,
      LAYOUT.roadHalfWidth / 2,
      0.022,
      LAYOUT.stopLineZ - LAYOUT.stopLineDepth / 2,
    );

    // Centre line: dashed far away, solid on the approach to the stop line.
    const dash = flat(new PlaneGeometry(0.14, 3));
    for (let z = 96; z > 16; z -= 7) this.add(dash, marking, 0, 0.021, z);
    this.add(flat(new PlaneGeometry(0.14, 16)), marking, 0, 0.021, 8);
    for (let z = LAYOUT.zebraZ - LAYOUT.zebraDepth / 2 - 4; z > -120; z -= 7) this.add(dash, marking, 0, 0.021, z);
    const crossDash = flat(new PlaneGeometry(3, 0.14));
    for (let x = 8; x < 180; x += 7) {
      this.add(crossDash, marking, x, 0.021, CROSS_CENTER_Z);
      this.add(crossDash, marking, -x, 0.021, CROSS_CENTER_Z);
    }

    // Pedestrian crossing beyond the junction
    const stripe = flat(new PlaneGeometry(0.5, LAYOUT.zebraDepth));
    for (let x = -LAYOUT.roadHalfWidth + 0.5; x < LAYOUT.roadHalfWidth - 0.3; x += 1) {
      this.add(stripe, marking, x, 0.021, LAYOUT.zebraZ);
    }

    this.buildStopSign();
    this.buildSurroundings();
  }

  private buildStopSign(): void {
    const sign = new Group();
    const pole = new Mesh(new CylinderGeometry(0.05, 0.05, 2.5, 10), new MeshLambertMaterial({ color: 0x9aa0a6 }));
    pole.position.y = 1.25;
    sign.add(pole);
    const face = new Mesh(new CircleGeometry(0.46, 8, Math.PI / 8), new MeshBasicMaterial({ map: stopSignTexture() }));
    face.position.set(0, 2.3, 0.07);
    sign.add(face);
    const back = new Mesh(new CircleGeometry(0.46, 8, Math.PI / 8), new MeshLambertMaterial({ color: 0xa7adb3 }));
    back.position.set(0, 2.3, 0.06);
    back.rotation.y = Math.PI;
    sign.add(back);
    sign.position.set(LAYOUT.roadHalfWidth + 0.8, SIDEWALK_H, LAYOUT.stopLineZ + 0.9);
    this.scene.add(sign);
  }

  private buildSurroundings(): void {
    const palette = [0xe9e3d8, 0xdfe6ee, 0xeee0d3, 0xe2e8dc, 0xe6e1ea];
    const roof = new MeshLambertMaterial({ color: 0xb9bcc2 });
    const materials = palette.map((color) => new MeshLambertMaterial({ color }));

    // Low buildings, set back from the corners so sight lines along the cross road stay open.
    const blocks: [number, number, number, number, number][] = [
      // x, z, width, depth, height
      [17, 22, 9, 12, 6],
      [16, 42, 8, 14, 9],
      [18, 64, 10, 12, 7],
      [-17, 18, 9, 10, 8],
      [-16, 38, 8, 12, 5.5],
      [-18, 60, 10, 14, 10],
      [17, -26, 10, 12, 8],
      [16, -48, 8, 14, 11],
      [-17, -28, 9, 12, 6],
      [-18, -52, 11, 14, 9],
      [44, 16, 12, 10, 7],
      [-46, 18, 12, 10, 8],
      [46, -24, 12, 10, 9],
      [-44, -26, 12, 10, 6],
    ];
    blocks.forEach(([x, z, w, d, ht], i) => {
      this.add(new BoxGeometry(w, ht, d), materials[i % materials.length], x, ht / 2, z);
      this.add(new BoxGeometry(w + 0.4, 0.35, d + 0.4), roof, x, ht + 0.17, z);
    });

    // Trees along the verges, kept clear of the junction.
    const trunk = new MeshLambertMaterial({ color: 0x8a6f55 });
    const leaves = [0x8fb27a, 0x7ea56d, 0x9cbc86].map((color) => new MeshLambertMaterial({ color }));
    const trunkGeo = new CylinderGeometry(0.12, 0.16, 1.4, 8);
    const crownGeo = new SphereGeometry(1.25, 14, 10);
    const coneGeo = new ConeGeometry(1.1, 3, 10);
    let n = 0;
    const tree = (x: number, z: number): void => {
      const leaf = leaves[n % leaves.length];
      this.add(trunkGeo, trunk, x, 0.7, z);
      if (n % 3 === 2) this.add(coneGeo, leaf, x, 2.6, z);
      else this.add(crownGeo, leaf, x, 2.3, z);
      n++;
    };
    const verge = LAYOUT.roadHalfWidth + SIDEWALK_W + 1.6;
    for (let z = 14; z < 100; z += 11) {
      tree(verge, z + 3);
      tree(-verge, z);
    }
    for (let z = -22; z > -110; z -= 11) {
      tree(verge, z);
      tree(-verge, z - 4);
    }
    for (let x = 26; x < 120; x += 13) {
      tree(x, LAYOUT.crossNearZ + SIDEWALK_W + 1.8);
      tree(-x - 4, LAYOUT.crossNearZ + SIDEWALK_W + 1.8);
      tree(x + 5, LAYOUT.crossFarZ - SIDEWALK_W - 1.8);
      tree(-x, LAYOUT.crossFarZ - SIDEWALK_W - 1.8);
    }

    // Soft distant hills
    const hill = new MeshLambertMaterial({ color: 0xb5ca9f });
    for (const [x, z, r] of [
      [-120, -170, 60],
      [40, -200, 75],
      [170, -110, 55],
      [-180, 40, 60],
      [160, 120, 50],
    ] as const) {
      const mesh = this.add(new SphereGeometry(r, 20, 12), hill, x, -r * 0.62, z);
      mesh.scale.y = 0.55;
    }
  }

  resize(width: number, height: number): void {
    const aspect = width / Math.max(1, height);
    // Keep a consistent horizontal field of view, clamped so portrait screens don't distort.
    const hfov = (72 * Math.PI) / 180;
    const vfov = (2 * Math.atan(Math.tan(hfov / 2) / aspect) * 180) / Math.PI;
    this.camera.fov = Math.max(48, Math.min(88, vfov));
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private placeActor(model: CarModel, pose: ActorPose, dt: number): void {
    model.group.visible = pose.visible;
    model.group.position.set(pose.x, 0, pose.z);
    if (pose.moving) for (const w of model.wheels) w.rotation.x -= (11 / 0.36) * dt;
  }

  /** Sync meshes and camera to the logic. dt is 0 while paused. */
  update(logic: StopCheckLogic, dt: number): void {
    const car = this.player;
    car.group.position.set(logic.x, 0, logic.z);
    car.group.rotation.y = logic.heading;
    for (const w of car.wheels) w.rotation.x -= (logic.speed / 0.36) * dt;
    for (const fw of car.frontWheels) fw.rotation.y = logic.steer;

    this.placeActor(this.fromLeft, logic.vehicleFromLeft(), dt);
    this.placeActor(this.fromRight, logic.vehicleFromRight(), dt);

    const ped = logic.pedestrian();
    const p = this.pedestrian;
    p.group.position.set(ped.x, Math.abs(ped.x) > LAYOUT.roadHalfWidth ? SIDEWALK_H : 0, ped.z);
    if (ped.moving) this.walkPhase += dt * 7;
    else this.walkPhase *= 0.8;
    const swing = Math.sin(this.walkPhase) * (ped.moving ? 0.5 : 0);
    p.legs[0].rotation.x = swing;
    p.legs[1].rotation.x = -swing;
    p.arms[0].rotation.x = -swing * 0.8;
    p.arms[1].rotation.x = swing * 0.8;

    this.updateCamera(logic, dt);
  }

  private updateCamera(logic: StopCheckLogic, dt: number): void {
    const look = logic.look;
    const amount = Math.abs(look);
    const viewYaw = logic.heading + look * 1.3;
    const dirX = -Math.sin(viewYaw);
    const dirZ = -Math.cos(viewYaw);
    const fwdX = -Math.sin(logic.heading);
    const fwdZ = -Math.cos(logic.heading);

    // Chase camera behind the car; when looking around it moves up to the cabin and turns.
    // Tall, narrow viewports pull the chase camera back so the STOP sign stays in frame.
    const narrow = Math.min(1.8, Math.max(1, 0.95 / this.aspect));
    const chaseDist = 8.6 * narrow;
    const chaseHeight = 4.1 * (1 + (narrow - 1) * 0.7);
    const dist = chaseDist - (chaseDist - 1) * amount;
    const height = chaseHeight - (chaseHeight - 2.9) * amount;
    const pivotX = logic.x + fwdX * 0.6 * amount;
    const pivotZ = logic.z + fwdZ * 0.6 * amount;
    const desired = new Vector3(pivotX - dirX * dist, height, pivotZ - dirZ * dist);
    const reach = 12 * narrow + (20 - 12 * narrow) * amount;
    const target = new Vector3(pivotX + dirX * reach, 0.6 + 0.6 * amount, pivotZ + dirZ * reach);

    if (!this.initialised) {
      this.camPos.copy(desired);
      this.camTarget.copy(target);
      this.initialised = true;
    } else if (dt > 0) {
      const k = 1 - Math.exp(-dt * 7);
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
    materials.forEach((m) => {
      const map = (m as MeshBasicMaterial).map;
      if (map) map.dispose();
      m.dispose();
    });
  }
}
