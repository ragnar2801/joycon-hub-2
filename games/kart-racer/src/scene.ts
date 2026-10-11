import * as THREE from 'three';
import { EscapeRoute, ROAD_HALF, WALL_OFFSET } from './track.ts';

const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

function box(
  parent: THREE.Object3D,
  mat: THREE.Material,
  size: number[],
  pos: number[],
): THREE.Mesh {
  const mesh = new THREE.Mesh(boxGeometry, mat);
  mesh.scale.set(size[0]!, size[1]!, size[2]!);
  mesh.position.set(pos[0]!, pos[1]!, pos[2]!);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function instances(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  mat: THREE.Material,
  poses: THREE.Object3D[],
): void {
  const mesh = new THREE.InstancedMesh(geometry, mat, poses.length);
  poses.forEach((p, i) => {
    p.updateMatrix();
    mesh.setMatrixAt(i, p.matrix);
  });
  mesh.receiveShadow = true;
  parent.add(mesh);
}

export function buildKart(color = 0xf17761): {
  root: THREE.Group;
  frontWheels: THREE.Group[];
  wheels: THREE.Mesh[];
  bodyMaterial: THREE.MeshStandardMaterial;
} {
  const root = new THREE.Group();
  const coral = material(color);
  const cream = material(0xfff4dc);
  const dark = material(0x34454a);
  const glass = material(0x92c7cd);
  box(root, dark, [1.8, 0.25, 3], [0, 0.47, 0]);
  box(root, coral, [1.75, 0.55, 2.8], [0, 0.85, 0]);
  box(root, cream, [0.25, 0.025, 2.75], [0, 1.14, 0]);
  box(root, dark, [1.35, 0.75, 0.75], [0, 1.35, -0.42]);
  const windshield = box(root, glass, [1.25, 0.5, 0.09], [0, 1.42, 0.12]);
  windshield.rotation.x = -0.24;
  box(root, coral, [2.1, 0.14, 0.45], [0, 1.4, -1.32]);
  for (const x of [-0.62, 0.62]) {
    box(root, cream, [0.34, 0.18, 0.08], [x, 0.91, 1.43]);
    box(root, material(0xd84b4c), [0.3, 0.17, 0.07], [x, 0.85, -1.43]);
  }
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 8), cream);
  helmet.position.set(0, 1.88, -0.4);
  helmet.castShadow = true;
  root.add(helmet);
  box(root, dark, [0.48, 0.12, 0.08], [0, 1.89, -0.06]);
  const wheelGeometry = new THREE.CylinderGeometry(0.43, 0.43, 0.34, 12);
  wheelGeometry.rotateZ(Math.PI / 2);
  const frontWheels: THREE.Group[] = [];
  const wheels: THREE.Mesh[] = [];
  for (const z of [-0.95, 0.95])
    for (const x of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.43, z);
      const tire = new THREE.Mesh(wheelGeometry, dark);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.36, 8), cream);
      hub.rotation.z = Math.PI / 2;
      tire.add(hub);
      tire.castShadow = true;
      pivot.add(tire);
      root.add(pivot);
      wheels.push(tire);
      if (z > 0) frontWheels.push(pivot);
    }
  return { root, frontWheels, wheels, bodyMaterial: coral };
}

export function buildScenery(track: EscapeRoute): THREE.Group {
  const root = new THREE.Group();
  const grass = material(0xc9e2a7);
  const asphalt = material(0x7c9393);
  const white = material(0xfff8e8);
  const coral = material(0xef907a);
  const sand = material(0xe8d9ae);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 3200), grass);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.position.z = 900;
  ground.receiveShadow = true;
  root.add(ground);
  for (const [inner, outer, height, mat] of [
    [-WALL_OFFSET, WALL_OFFSET, 0, sand],
    [-ROAD_HALF, ROAD_HALF, 0.025, asphalt],
    [-ROAD_HALF + 0.35, -ROAD_HALF + 0.5, 0.04, white],
    [ROAD_HALF - 0.5, ROAD_HALF - 0.35, 0.04, white],
  ] as const) {
    const road = new THREE.Mesh(track.ribbon(inner, outer, height), mat);
    road.receiveShadow = true;
    root.add(road);
  }

  const curbs: THREE.Object3D[][] = [[], []];
  const rails: THREE.Object3D[][] = [[], []];
  const marks: THREE.Object3D[] = [];
  const count = Math.ceil(track.length / 3);
  for (let i = 0; i < count; i++) {
    const f = track.frame(((i + 0.5) / count) * track.length);
    for (const side of [-1, 1]) {
      const curb = new THREE.Object3D();
      curb.position.copy(f.center).addScaledVector(f.right, side * (ROAD_HALF + 0.25));
      curb.position.y = 0.08;
      curb.rotation.y = f.heading;
      curb.scale.set(0.85, 0.14, track.length / count + 0.04);
      curbs[i % 2]!.push(curb);
      const rail = curb.clone();
      rail.position.copy(f.center).addScaledVector(f.right, side * WALL_OFFSET);
      rail.position.y = 0.55;
      rail.scale.set(0.55, 1.1, track.length / count + 0.04);
      rails[Math.floor(i / 3) % 2]!.push(rail);
    }
    if (i % 3 === 0) {
      const dash = new THREE.Object3D();
      dash.position.copy(f.center);
      dash.position.y = 0.05;
      dash.rotation.y = f.heading;
      dash.scale.set(0.13, 0.015, 1.9);
      marks.push(dash);
    }
  }
  for (let i = 0; i < 2; i++) {
    instances(root, boxGeometry, i ? coral : white, curbs[i]!);
    instances(root, boxGeometry, i ? material(0x9ccbc3) : white, rails[i]!);
  }
  instances(root, boxGeometry, white, marks);

  // The safe-zone arch is aligned with the final escape checkpoint.
  const start = track.frame(track.escapeDistance);
  const arch = new THREE.Group();
  arch.position.copy(start.center);
  arch.rotation.y = start.heading;
  const checker: THREE.Object3D[][] = [[], []];
  for (let x = 0; x < 18; x++)
    for (let z = 0; z < 3; z++) {
      const tile = new THREE.Object3D();
      tile.position.set(x - 8.5, 0.06, z - 1);
      tile.scale.set(1, 0.025, 1);
      checker[(x + z) % 2]!.push(tile);
    }
  instances(arch, boxGeometry, white, checker[0]!);
  instances(arch, boxGeometry, material(0x3c595b), checker[1]!);
  for (const x of [-10.8, 10.8]) {
    box(arch, white, [0.75, 7, 0.75], [x, 3.5, 0]);
    box(arch, coral, [1.2, 0.45, 1.2], [x, 0.3, 0]);
  }
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 1024;
  signCanvas.height = 128;
  const pen = signCanvas.getContext('2d');
  if (pen) {
    pen.fillStyle = '#fffaeb';
    pen.fillRect(0, 0, 1024, 128);
    pen.fillStyle = '#31565a';
    pen.font = 'bold 62px system-ui';
    pen.textAlign = 'center';
    pen.fillText('SAFE ZONE', 512, 88);
  }
  const texture = new THREE.CanvasTexture(signCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  box(arch, new THREE.MeshStandardMaterial({ map: texture }), [22.4, 1.9, 0.6], [0, 7.1, 0]);
  root.add(arch);

  // Instanced trees keep the scenery inexpensive to draw.
  const trunks: THREE.Object3D[] = [];
  const crowns: THREE.Object3D[][] = [[], []];
  for (let i = 0; i < 240; i++) {
    const f = track.frame((i / 240) * track.length);
    const side = i % 3 === 0 ? -1 : 1;
    const offset = side * (21 + ((i * 17) % 28));
    const tree = new THREE.Object3D();
    tree.position.copy(f.center).addScaledVector(f.right, offset);
    if (Math.abs(track.nearest(tree.position.x, tree.position.z).side) < 18) continue;
    const size = 2.5 + (i % 5) * 0.6;
    tree.position.y = 1.5;
    tree.scale.set(0.5, 3, 0.5);
    trunks.push(tree);
    const crown = tree.clone();
    crown.position.y = size + 2.2;
    crown.scale.set(size, size * 1.1, size);
    crowns[i % 2]!.push(crown);
  }
  instances(root, boxGeometry, material(0xb49577), trunks);
  const leafGeometry = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 2; i++)
    instances(root, leafGeometry, material(i ? 0xa3cc83 : 0x81b79a), crowns[i]!);

  // Pastel hills, clouds, and a roadside pavilion make the route feel like a toy world.
  const hillGeometry = new THREE.ConeGeometry(1, 1, 7);
  for (let i = 0; i < 32; i++) {
    const hill = new THREE.Mesh(hillGeometry, material(i % 2 ? 0xb1d6c1 : 0xbcd9b0));
    const height = 25 + (i % 4) * 12;
    hill.position.set(
      (i % 2 ? -1 : 1) * (180 + (i % 3) * 30),
      height / 2 - 2,
      Math.floor(i / 2) * 130 - 100,
    );
    hill.scale.set(45 + (i % 3) * 18, height, 45 + (i % 3) * 18);
    root.add(hill);
  }
  const cloudGeometry = new THREE.SphereGeometry(1, 8, 6);
  for (let i = 0; i < 32; i++) {
    const cloud = new THREE.Mesh(cloudGeometry, white);
    cloud.position.set((i % 2 ? -1 : 1) * 110, 55 + (i % 4) * 8, Math.floor(i / 2) * 130);
    cloud.scale.set(16 + (i % 5), 3.5, 7);
    root.add(cloud);
  }
  const pavilion = new THREE.Group();
  pavilion.position.set(-35, 0, 38);
  box(pavilion, white, [28, 2, 10], [0, 1, 0]);
  box(pavilion, material(0x9fcac5), [30, 0.5, 12], [0, 6, 0]);
  for (const x of [-12, 0, 12]) box(pavilion, white, [0.5, 4, 0.5], [x, 4, 3.5]);
  root.add(pavilion);
  return root;
}

/** Dispose shared assets once, including the procedural sign texture. */
export function disposeScene(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    for (const mat of Array.isArray(node.material) ? node.material : [node.material])
      materials.add(mat);
    if (node instanceof THREE.InstancedMesh) node.dispose();
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => {
    if (m instanceof THREE.MeshStandardMaterial) m.map?.dispose();
    m.dispose();
  });
}
