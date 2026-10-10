import * as THREE from 'three';
import { mulberry32 } from './math.ts';
import { type TerrainField, WATER_LEVEL } from './terrain.ts';

const CHUNK = 400;
const SEGMENTS = 32;
const VIEW_RADIUS = 3;
const TREES_PER_CHUNK = 70;

interface Chunk {
  key: string;
  group: THREE.Group;
  geometry: THREE.BufferGeometry;
}

const SAND = new THREE.Color(0xd9c98f);
const GRASS = new THREE.Color(0x5d9a46);
const GRASS2 = new THREE.Color(0x3f7a3a);
const ROCK = new THREE.Color(0x7d7268);
const SNOW = new THREE.Color(0xf4f6f8);

function terrainColor(h: number, jitter: number, out: THREE.Color): THREE.Color {
  if (h < WATER_LEVEL + 3) return out.copy(SAND);
  if (h < 70) return out.copy(GRASS).lerp(GRASS2, 0.5 + jitter * 0.5);
  if (h < 130) return out.copy(GRASS2).lerp(ROCK, Math.min(1, (h - 70) / 40));
  if (h < 160) return out.copy(ROCK);
  return out.copy(ROCK).lerp(SNOW, Math.min(1, (h - 160) / 15));
}

/** Streams terrain chunks (with trees) around the player, plus a water plane that follows it. */
export class World {
  readonly group = new THREE.Group();
  private chunks = new Map<string, Chunk>();
  private terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private treeGeo = new THREE.ConeGeometry(3.2, 11, 6).translate(0, 5.5, 0);
  private treeMat = new THREE.MeshLambertMaterial({ color: 0x2f6b34, flatShading: true });
  private water: THREE.Mesh;

  constructor(private readonly field: TerrainField) {
    const waterGeo = new THREE.PlaneGeometry(
      CHUNK * (VIEW_RADIUS * 2 + 3),
      CHUNK * (VIEW_RADIUS * 2 + 3),
    );
    waterGeo.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(
      waterGeo,
      new THREE.MeshLambertMaterial({ color: 0x2f8fd8, transparent: true, opacity: 0.88 }),
    );
    this.water.position.y = WATER_LEVEL;
    this.group.add(this.water);
  }

  /** Load chunks around (x, z). Generates at most `budget` chunks per call to avoid frame hitches. */
  update(x: number, z: number, budget = 2): void {
    const cx = Math.round(x / CHUNK);
    const cz = Math.round(z / CHUNK);
    this.water.position.set(x, WATER_LEVEL, z);

    const wanted: { key: string; i: number; j: number; d: number }[] = [];
    for (let i = cx - VIEW_RADIUS; i <= cx + VIEW_RADIUS; i++) {
      for (let j = cz - VIEW_RADIUS; j <= cz + VIEW_RADIUS; j++) {
        const key = `${i},${j}`;
        if (!this.chunks.has(key)) wanted.push({ key, i, j, d: (i - cx) ** 2 + (j - cz) ** 2 });
      }
    }
    wanted.sort((a, b) => a.d - b.d);
    for (const w of wanted.slice(0, budget))
      this.chunks.set(w.key, this.buildChunk(w.key, w.i, w.j));

    for (const [key, chunk] of this.chunks) {
      const [i, j] = key.split(',').map(Number) as [number, number];
      if (Math.abs(i - cx) > VIEW_RADIUS + 1 || Math.abs(j - cz) > VIEW_RADIUS + 1) {
        this.group.remove(chunk.group);
        chunk.geometry.dispose();
        this.chunks.delete(key);
      }
    }
  }

  /** Load every chunk around (x, z) right now (used at start). */
  prime(x: number, z: number): void {
    this.update(x, z, Infinity);
  }

  private buildChunk(key: string, i: number, j: number): Chunk {
    const geometry = new THREE.PlaneGeometry(CHUNK, CHUNK, SEGMENTS, SEGMENTS);
    geometry.rotateX(-Math.PI / 2);
    const ox = i * CHUNK;
    const oz = j * CHUNK;
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let v = 0; v < pos.count; v++) {
      const wx = pos.getX(v) + ox;
      const wz = pos.getZ(v) + oz;
      const h = this.field.height(wx, wz);
      pos.setY(v, h);
      const jitter = Math.sin(wx * 0.05) * Math.cos(wz * 0.07);
      terrainColor(h, jitter, c).toArray(colors, v * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const group = new THREE.Group();
    group.position.set(ox, 0, oz);
    const mesh = new THREE.Mesh(geometry, this.terrainMat);
    mesh.receiveShadow = true;
    group.add(mesh);

    const rng = mulberry32((i * 73856093) ^ (j * 19349663) ^ this.field.seed);
    const trees = new THREE.InstancedMesh(this.treeGeo, this.treeMat, TREES_PER_CHUNK);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    let count = 0;
    for (let t = 0; t < TREES_PER_CHUNK * 2 && count < TREES_PER_CHUNK; t++) {
      const lx = (rng() - 0.5) * CHUNK;
      const lz = (rng() - 0.5) * CHUNK;
      const h = this.field.height(lx + ox, lz + oz);
      if (h < WATER_LEVEL + 4 || h > 90) continue;
      const scale = 0.7 + rng() * 0.8;
      m.compose(p.set(lx, h - 0.5, lz), q, s.set(scale, scale * (0.8 + rng() * 0.6), scale));
      trees.setMatrixAt(count++, m);
    }
    trees.count = count;
    trees.instanceMatrix.needsUpdate = true;
    group.add(trees);

    this.group.add(group);
    return { key, group, geometry };
  }

  dispose(): void {
    for (const chunk of this.chunks.values()) chunk.geometry.dispose();
    this.chunks.clear();
    this.terrainMat.dispose();
    this.treeGeo.dispose();
    this.treeMat.dispose();
    this.water.geometry.dispose();
    (this.water.material as THREE.Material).dispose();
  }
}
