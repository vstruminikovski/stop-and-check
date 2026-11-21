import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
} from 'three';

const wheelGeometry = new CylinderGeometry(0.36, 0.36, 0.26, 16);
wheelGeometry.rotateZ(Math.PI / 2);
const wheelMaterial = new MeshLambertMaterial({ color: 0x2a2c30 });
const glassMaterial = new MeshLambertMaterial({ color: 0x1f2a36 });
const lightMaterial = new MeshBasicMaterial({ color: 0xfff6dc });
const tailMaterial = new MeshBasicMaterial({ color: 0xd2232a });
const shadowMaterial = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.14, depthWrite: false });

export interface CarModel {
  group: Group;
  wheels: Mesh[];
  frontWheels: Group[];
}

/**
 * Simple original car built from boxes. Faces -z in local space,
 * length ≈ 4.2, width ≈ 1.8; origin at ground level, centre of the car.
 */
export function createCar(color: number): CarModel {
  const group = new Group();
  const paint = new MeshLambertMaterial({ color });

  const body = new Mesh(new BoxGeometry(1.8, 0.62, 4.2), paint);
  body.position.y = 0.62;
  group.add(body);

  const cabin = new Mesh(new BoxGeometry(1.56, 0.56, 2.1), paint);
  cabin.position.set(0, 1.2, 0.25);
  group.add(cabin);

  const windscreen = new Mesh(new BoxGeometry(1.46, 0.46, 0.06), glassMaterial);
  windscreen.position.set(0, 1.2, -0.82);
  windscreen.rotation.x = -0.28;
  group.add(windscreen);

  const rearScreen = windscreen.clone();
  rearScreen.position.z = 1.32;
  rearScreen.rotation.x = 0.28;
  group.add(rearScreen);

  for (const side of [-1, 1]) {
    const sideGlass = new Mesh(new BoxGeometry(0.04, 0.38, 1.7), glassMaterial);
    sideGlass.position.set(side * 0.79, 1.22, 0.25);
    group.add(sideGlass);

    const head = new Mesh(new BoxGeometry(0.4, 0.14, 0.04), lightMaterial);
    head.position.set(side * 0.6, 0.72, -2.11);
    group.add(head);

    const tail = new Mesh(new BoxGeometry(0.42, 0.14, 0.04), tailMaterial);
    tail.position.set(side * 0.6, 0.76, 2.11);
    group.add(tail);
  }

  const wheels: Mesh[] = [];
  const frontWheels: Group[] = [];
  for (const [x, z] of [
    [-0.86, -1.35],
    [0.86, -1.35],
    [-0.86, 1.35],
    [0.86, 1.35],
  ] as const) {
    const pivot = new Group();
    pivot.position.set(x, 0.36, z);
    const wheel = new Mesh(wheelGeometry, wheelMaterial);
    pivot.add(wheel);
    group.add(pivot);
    wheels.push(wheel);
    if (z < 0) frontWheels.push(pivot);
  }

  const shadow = new Mesh(new CircleGeometry(1, 24), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1.1, 2.3, 1);
  shadow.position.y = 0.015;
  group.add(shadow);

  return { group, wheels, frontWheels };
}
