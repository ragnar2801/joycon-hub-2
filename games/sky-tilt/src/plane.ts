import * as THREE from 'three';

export interface PlaneModel {
  root: THREE.Group;
  propeller: THREE.Object3D;
  dispose(): void;
}

/** A small low-poly propeller plane facing -Z. */
export function buildPlane(): PlaneModel {
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: 0.6,
      ...extra,
    });
    mats.push(m);
    return m;
  };
  const red = mat(0xe8433a);
  const white = mat(0xf3f1ea);
  const dark = mat(0x2b2d42);
  const glass = mat(0x7fd6ff, { metalness: 0.3, roughness: 0.15 });

  const add = (
    geo: THREE.BufferGeometry,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = root,
  ) => {
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  add(new THREE.BoxGeometry(2.2, 2, 8), red, 0, 0, 0);
  const nose = add(new THREE.CylinderGeometry(0.7, 1.1, 1.4, 8), white, 0, 0, -4.6);
  nose.rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(14, 0.35, 2.6), white, 0, 0.25, -0.8);
  add(new THREE.BoxGeometry(1.2, 0.36, 2.62), red, 6.4, 0.25, -0.8);
  add(new THREE.BoxGeometry(1.2, 0.36, 2.62), red, -6.4, 0.25, -0.8);
  add(new THREE.BoxGeometry(5, 0.3, 1.4), white, 0, 0.3, 3.6);
  add(new THREE.BoxGeometry(0.3, 2.2, 1.6), red, 0, 1.3, 3.7);
  add(new THREE.BoxGeometry(1.4, 0.9, 1.8), glass, 0, 1.25, -1);
  add(new THREE.BoxGeometry(0.4, 1, 0.4), dark, 1.6, -1.2, -1.4);
  add(new THREE.BoxGeometry(0.4, 1, 0.4), dark, -1.6, -1.2, -1.4);

  const propeller = new THREE.Group();
  propeller.position.set(0, 0, -5.4);
  root.add(propeller);
  add(new THREE.BoxGeometry(0.25, 5, 0.25), dark, 0, 0, 0, propeller);
  add(new THREE.BoxGeometry(0.5, 0.5, 0.5), red, 0, 0, 0, propeller);

  return {
    root,
    propeller,
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}
