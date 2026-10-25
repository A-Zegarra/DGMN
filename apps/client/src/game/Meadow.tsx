import { useEffect, useMemo } from "react";
import * as THREE from "three";

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

interface MeadowMeshes {
  grass: THREE.InstancedMesh;
  flowers: THREE.InstancedMesh;
}

function buildMeadow(): MeadowMeshes {
  const random = mulberry32(80231);
  const grassTransforms: Array<{ x: number; z: number; scale: number; rotation: number; tone: number }> = [];
  const flowerTransforms: Array<{ x: number; z: number; scale: number; rotation: number; tone: number }> = [];

  let attempts = 0;
  while (grassTransforms.length < 420 && attempts < 1400) {
    attempts += 1;
    const angle = random() * Math.PI * 2;
    const radius = 9.5 + random() * 44;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    if (Math.abs(x) < 4.2 || Math.abs(z) < 4.2) {
      continue;
    }

    grassTransforms.push({
      x,
      z,
      scale: 0.65 + random() * 1.1,
      rotation: random() * Math.PI * 2,
      tone: random(),
    });
  }

  attempts = 0;
  while (flowerTransforms.length < 70 && attempts < 700) {
    attempts += 1;
    const angle = random() * Math.PI * 2;
    const radius = 10 + random() * 40;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    if (Math.abs(x) < 4.4 || Math.abs(z) < 4.4) {
      continue;
    }

    flowerTransforms.push({
      x,
      z,
      scale: 0.7 + random() * 1.1,
      rotation: random() * Math.PI * 2,
      tone: random(),
    });
  }

  const grass = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.055, 0.4, 3),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 1,
    }),
    grassTransforms.length,
  );

  const flowers = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.09, 0),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 0.9,
    }),
    flowerTransforms.length,
  );

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const color = new THREE.Color();

  grassTransforms.forEach((tuft, index) => {
    quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, tuft.rotation);
    position.set(tuft.x, 0.2 * tuft.scale, tuft.z);
    scale.set(tuft.scale, tuft.scale, tuft.scale);
    matrix.compose(position, quaternion, scale);
    grass.setMatrixAt(index, matrix);
    grass.setColorAt(
      index,
      color.set("#4f8a55").offsetHSL(0, 0, (tuft.tone - 0.5) * 0.16),
    );
  });

  flowerTransforms.forEach((flower, index) => {
    quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, flower.rotation);
    position.set(flower.x, 0.16, flower.z);
    scale.set(flower.scale, flower.scale, flower.scale);
    matrix.compose(position, quaternion, scale);
    flowers.setMatrixAt(index, matrix);

    const palette = ["#ffe066", "#ff9db0", "#f4f1de", "#c9a7ff"];
    flowers.setColorAt(
      index,
      color.set(palette[Math.floor(flower.tone * palette.length)] ?? palette[0]!),
    );
  });

  for (const mesh of [grass, flowers]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  }

  return { grass, flowers };
}

export function Meadow() {
  const meshes = useMemo(buildMeadow, []);

  useEffect(() => {
    return () => {
      for (const mesh of Object.values(meshes)) {
        mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) {
          for (const entry of material) {
            entry.dispose();
          }
        } else {
          material.dispose();
        }
        mesh.dispose();
      }
    };
  }, [meshes]);

  return (
    <group>
      <primitive object={meshes.grass} />
      <primitive object={meshes.flowers} />
    </group>
  );
}
