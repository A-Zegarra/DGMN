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

interface TreeTransform {
  x: number;
  z: number;
  scale: number;
  rotation: number;
  tone: number;
}

interface PropTransform {
  x: number;
  z: number;
  scale: number;
  rotation: number;
  tone: number;
}

interface ForestMeshes {
  trunks: THREE.InstancedMesh;
  foliage: THREE.InstancedMesh;
  rocks: THREE.InstancedMesh;
  bushes: THREE.InstancedMesh;
}

function buildTrees(random: () => number): TreeTransform[] {
  const trees: TreeTransform[] = [];
  let attempts = 0;

  while (trees.length < 68 && attempts < 600) {
    attempts += 1;
    const angle = random() * Math.PI * 2;
    const radius = 13 + random() * 41;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    if (Math.abs(x) < 5 || Math.abs(z) < 5) {
      continue;
    }

    trees.push({
      x,
      z,
      scale: 0.75 + random() * 0.7,
      rotation: random() * Math.PI * 2,
      tone: random(),
    });
  }

  return trees;
}

function buildProps(random: () => number, count: number): PropTransform[] {
  const props: PropTransform[] = [];
  let attempts = 0;

  while (props.length < count && attempts < 500) {
    attempts += 1;
    const angle = random() * Math.PI * 2;
    const radius = 8 + random() * 46;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    if (Math.hypot(x, z) < 9.8) {
      continue;
    }

    props.push({
      x,
      z,
      scale: 0.6 + random() * 0.9,
      rotation: random() * Math.PI * 2,
      tone: random(),
    });
  }

  return props;
}

function buildForest(): ForestMeshes {
  const random = mulberry32(20261025);
  const trees = buildTrees(random);
  const rocks = buildProps(random, 24);
  const bushes = buildProps(random, 32);

  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.16, 0.32, 3.6, 10),
    new THREE.MeshStandardMaterial({
      color: 0x6b4b2a,
      flatShading: true,
      roughness: 1,
    }),
    trees.length,
  );

  const foliage = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1.25, 2),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: false,
      roughness: 1,
    }),
    trees.length * 5,
  );

  const rocksMesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.7, 1),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 1,
    }),
    rocks.length,
  );

  const bushesMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.85, 2),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 1,
    }),
    bushes.length,
  );

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const color = new THREE.Color();

  trees.forEach((tree, index) => {
    quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, tree.rotation);

    position.set(tree.x, 1.8 * tree.scale, tree.z);
    scale.setScalar(tree.scale);
    matrix.compose(position, quaternion, scale);
    trunks.setMatrixAt(index, matrix);
    trunks.setColorAt(
      index,
      color.set("#6b4b2a").offsetHSL(0, 0, (tree.tone - 0.5) * 0.08),
    );

    for (let crown = 0; crown < 5; crown += 1) {
      const angle = crown * 2.4 + tree.rotation;
      const spread = crown === 0 ? 0 : 0.85 * tree.scale;
      position.set(tree.x + Math.cos(angle) * spread,
        (crown === 0 ? 4.2 : 3.25 + crown * 0.12) * tree.scale,
        tree.z + Math.sin(angle) * spread);
      scale.set(tree.scale * 1.05, tree.scale * 0.85, tree.scale);
      matrix.compose(position, quaternion, scale);
      foliage.setMatrixAt(index * 5 + crown, matrix);
      foliage.setColorAt(index * 5 + crown,
        color.set("#3f7157").offsetHSL(0.015 * crown, 0, (tree.tone - 0.5) * 0.1 + crown * 0.015));
    }
  });

  rocks.forEach((rock, index) => {
    euler.set(rock.tone * 0.5, rock.rotation, rock.tone * 0.3);
    quaternion.setFromEuler(euler);

    position.set(rock.x, 0.22 * rock.scale, rock.z);
    scale.set(rock.scale * 1.25, rock.scale * 0.8, rock.scale);
    matrix.compose(position, quaternion, scale);
    rocksMesh.setMatrixAt(index, matrix);
    rocksMesh.setColorAt(
      index,
      color.set("#6b7280").offsetHSL(0, 0, (rock.tone - 0.5) * 0.16),
    );
  });

  bushes.forEach((bush, index) => {
    quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, bush.rotation);

    position.set(bush.x, 0.38 * bush.scale, bush.z);
    scale.set(bush.scale, bush.scale * 0.8, bush.scale);
    matrix.compose(position, quaternion, scale);
    bushesMesh.setMatrixAt(index, matrix);
    bushesMesh.setColorAt(
      index,
      color.set("#3f8f55").offsetHSL(0, 0, (bush.tone - 0.5) * 0.12),
    );
  });

  for (const mesh of [trunks, foliage, rocksMesh, bushesMesh]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }

  foliage.userData.noCameraCollision = true;
  bushesMesh.userData.noCameraCollision = true;

  return { trunks, foliage, rocks: rocksMesh, bushes: bushesMesh };
}

export function Forest() {
  const meshes = useMemo(buildForest, []);

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
      <primitive object={meshes.trunks} />
      <primitive object={meshes.foliage} />
      <primitive object={meshes.rocks} />
      <primitive object={meshes.bushes} />
    </group>
  );
}
