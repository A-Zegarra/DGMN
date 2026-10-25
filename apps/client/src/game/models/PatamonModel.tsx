import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { SPECIES } from "@digiworld/content";

import { Eye } from "./parts";

export function PatamonModel({
  speciesId,
  moving,
  running,
}: {
  speciesId: string;
  moving: boolean;
  running: boolean;
}) {
  const species = SPECIES[speciesId] ?? SPECIES.patamon!;
  const champion = speciesId === "angemon";

  const root = useRef<THREE.Group>(null);
  const leftEar = useRef<THREE.Group>(null);
  const rightEar = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);

  const body = "#fff7ed";
  const accent = species.color;
  const marking = species.color;
  const iris = "#3b82f6";

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const speed = running ? 13 : 8;
    const flap = Math.sin(time * (moving ? speed : 2.8)) * (moving ? 0.22 : 0.1);

    if (root.current) {
      root.current.position.y = moving
        ? 0.08 + Math.abs(Math.sin(time * speed)) * 0.08
        : 0.05 + Math.sin(time * 2.8) * 0.035;
    }
    if (leftEar.current) {
      leftEar.current.rotation.z = -0.62 + flap;
    }
    if (rightEar.current) {
      rightEar.current.rotation.z = 0.62 - flap;
    }
    if (tail.current) {
      tail.current.rotation.y = Math.sin(time * 3) * 0.2;
    }
    if (head.current) {
      head.current.rotation.y = Math.sin(time * 1.5) * 0.06;
    }
  });

  return (
    <group ref={root}>
      {/* patas */}
      <mesh position={[-0.13, 0.1, 0.04]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial color={accent} flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0.13, 0.1, 0.04]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial color={accent} flatShading roughness={0.9} />
      </mesh>

      {/* cuerpo */}
      <mesh position={[0, 0.55, 0]} scale={[0.34, 0.36, 0.3]}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color={body} flatShading roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.52, 0.18]} scale={[0.18, 0.2, 0.1]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color={accent} flatShading roughness={0.9} />
      </mesh>

      {/* bracitos */}
      <mesh position={[-0.3, 0.62, 0.02]} rotation-z={0.6}>
        <cylinderGeometry args={[0.045, 0.04, 0.2, 5]} />
        <meshStandardMaterial color={body} flatShading roughness={0.95} />
      </mesh>
      <mesh position={[0.3, 0.62, 0.02]} rotation-z={-0.6}>
        <cylinderGeometry args={[0.045, 0.04, 0.2, 5]} />
        <meshStandardMaterial color={body} flatShading roughness={0.95} />
      </mesh>

      {/* cola */}
      <group ref={tail} position={[0, 0.45, -0.27]}>
        <mesh rotation-x={-Math.PI / 2}>
          <coneGeometry args={[0.09, 0.24, 5]} />
          <meshStandardMaterial color={accent} flatShading />
        </mesh>
      </group>

      {/* cabeza */}
      <group ref={head} position={[0, 1.0, 0]}>
        <mesh scale={[0.32, 0.31, 0.29]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color={body} flatShading roughness={0.95} />
        </mesh>

        {/* marca naranja de la frente */}
        <mesh position={[0, 0.17, 0.22]} scale={[0.16, 0.08, 0.06]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color={marking} flatShading roughness={0.9} />
        </mesh>

        <Eye position={[-0.115, 0.02, 0.265]} size={0.075} iris={iris} />
        <Eye position={[0.115, 0.02, 0.265]} size={0.075} iris={iris} />

        <mesh position={[-0.215, -0.035, 0.225]} scale={[0.04, 0.022, 0.02]}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshStandardMaterial color={accent} flatShading />
        </mesh>
        <mesh position={[0.215, -0.035, 0.225]} scale={[0.04, 0.022, 0.02]}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshStandardMaterial color={accent} flatShading />
        </mesh>

        <mesh position={[0, -0.12, 0.32]}>
          <boxGeometry args={[0.08, 0.02, 0.03]} />
          <meshBasicMaterial color="#4b2a33" />
        </mesh>

        {/* orejas-alas */}
        <group ref={leftEar} position={[-0.3, 0.16, -0.02]}>
          <mesh rotation-z={-0.62} scale={[1, 1, 0.32]}>
            <coneGeometry args={[0.2, 0.55, 4]} />
            <meshStandardMaterial color={body} flatShading roughness={0.95} />
          </mesh>
          <mesh
            position={[-0.03, 0, 0.045]}
            rotation-z={-0.62}
            scale={[0.62, 0.82, 0.16]}
          >
            <coneGeometry args={[0.2, 0.55, 4]} />
            <meshStandardMaterial color={accent} flatShading roughness={0.9} />
          </mesh>
        </group>

        <group ref={rightEar} position={[0.3, 0.16, -0.02]}>
          <mesh rotation-z={0.62} scale={[1, 1, 0.32]}>
            <coneGeometry args={[0.2, 0.55, 4]} />
            <meshStandardMaterial color={body} flatShading roughness={0.95} />
          </mesh>
          <mesh
            position={[0.03, 0, 0.045]}
            rotation-z={0.62}
            scale={[0.62, 0.82, 0.16]}
          >
            <coneGeometry args={[0.2, 0.55, 4]} />
            <meshStandardMaterial color={accent} flatShading roughness={0.9} />
          </mesh>
        </group>

        {champion && (
          <>
            <mesh position={[0, 0.55, 0]} rotation-x={Math.PI / 2}>
              <torusGeometry args={[0.28, 0.025, 6, 24]} />
              <meshStandardMaterial
                color="#ffe066"
                emissive="#ffe066"
                emissiveIntensity={0.4}
                flatShading
              />
            </mesh>
            <mesh position={[-0.45, 0.05, -0.18]} rotation-z={0.5}>
              <coneGeometry args={[0.1, 0.55, 4]} />
              <meshStandardMaterial color="#f8fbff" flatShading />
            </mesh>
            <mesh position={[0.45, 0.05, -0.18]} rotation-z={-0.5}>
              <coneGeometry args={[0.1, 0.55, 4]} />
              <meshStandardMaterial color="#f8fbff" flatShading />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
}
