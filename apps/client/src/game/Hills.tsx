import { useEffect, useMemo } from "react";
import * as THREE from "three";

const HILL_COUNT = 18;

function buildHills(): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1, 1, 7),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 1,
    }),
    HILL_COUNT,
  );

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const color = new THREE.Color();

  for (let index = 0; index < HILL_COUNT; index += 1) {
    const angle = (index / HILL_COUNT) * Math.PI * 2 + 0.16;
    const radius = 82 + (index % 3) * 9;
    const height = 10 + ((index * 7) % 14);
    const width = 16 + ((index * 5) % 12);

    position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
    scale.set(width, height, width);
    quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, angle * 0.4);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(
      index,
      color.set("#5d7f68").offsetHSL(0, 0, (index % 4) * 0.018),
    );
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

export function Hills() {
  const hills = useMemo(buildHills, []);

  useEffect(() => {
    return () => {
      hills.geometry.dispose();
      const material = hills.material;
      if (Array.isArray(material)) {
        for (const entry of material) {
          entry.dispose();
        }
      } else {
        material.dispose();
      }
      hills.dispose();
    };
  }, [hills]);

  return <primitive object={hills} />;
}
