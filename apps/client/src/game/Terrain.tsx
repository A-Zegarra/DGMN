import { useEffect, useMemo } from "react";
import * as THREE from "three";

const PALETTE = ["#3d7a4f", "#356e47", "#448455", "#2f6540", "#3a744b"];

function createGroundGeometry(): THREE.BufferGeometry {
  const plane = new THREE.PlaneGeometry(120, 120, 32, 32);
  plane.rotateX(-Math.PI / 2);

  const geometry = plane.toNonIndexed();
  plane.dispose();

  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < positions.count; i += 3) {
    const x =
      (positions.getX(i) + positions.getX(i + 1) + positions.getX(i + 2)) / 3;
    const z =
      (positions.getZ(i) + positions.getZ(i + 1) + positions.getZ(i + 2)) / 3;
    const noise = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
    color.set(PALETTE[Math.floor(noise * PALETTE.length)] ?? PALETTE[0]!);

    for (let vertex = 0; vertex < 3; vertex += 1) {
      const offset = (i + vertex) * 3;
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
    }
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function Terrain({ onPick }: { onPick: (x: number, z: number) => void }) {
  const geometry = useMemo(createGroundGeometry, []);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return (
    <group>
      <mesh
        geometry={geometry}
        onPointerDown={(event) => {
          event.stopPropagation();
          onPick(event.point.x, event.point.z);
        }}
      >
        <meshStandardMaterial
          vertexColors
          flatShading
          roughness={1}
          metalness={0}
        />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <planeGeometry args={[6, 112]} />
        <meshStandardMaterial color="#a9895f" roughness={1} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position-y={0.025}>
        <planeGeometry args={[112, 6]} />
        <meshStandardMaterial color="#a9895f" roughness={1} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position-y={0.035}>
        <circleGeometry args={[9.2, 48]} />
        <meshStandardMaterial color="#b99a6b" roughness={1} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position-y={0.045}>
        <ringGeometry args={[9.2, 9.7, 48]} />
        <meshStandardMaterial color="#8a6a45" roughness={1} />
      </mesh>
    </group>
  );
}
