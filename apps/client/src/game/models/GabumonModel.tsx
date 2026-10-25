import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { SPECIES } from "@digiworld/content";

import { Claws, Eye } from "./parts";

export function GabumonModel({
  speciesId,
  moving,
  running,
}: {
  speciesId: string;
  moving: boolean;
  running: boolean;
}) {
  const species = SPECIES[speciesId] ?? SPECIES.gabumon!;
  const champion = speciesId === "garurumon";

  const root = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const leftEar = useRef<THREE.Group>(null);
  const rightEar = useRef<THREE.Group>(null);

  const body = species.color;
  const accent = species.accent;
  const fur = "#eef7ff";
  const horn = "#facc15";
  const claws = "#f4ead2";

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const speed = running ? 14 : 9;
    const swing = moving ? Math.sin(time * speed) * 0.5 : 0;

    if (root.current) {
      root.current.position.y = moving
        ? Math.abs(Math.sin(time * speed)) * 0.055
        : Math.sin(time * 2) * 0.012;
    }
    if (leftLeg.current) {
      leftLeg.current.rotation.x = swing;
    }
    if (rightLeg.current) {
      rightLeg.current.rotation.x = -swing;
    }
    if (leftArm.current) {
      leftArm.current.rotation.x = -swing * 0.6;
    }
    if (rightArm.current) {
      rightArm.current.rotation.x = swing * 0.6;
    }
    if (tail.current) {
      tail.current.rotation.y =
        Math.sin(time * (moving ? 6.5 : 2.4)) * (moving ? 0.26 : 0.14);
    }
    if (head.current) {
      head.current.rotation.y = Math.sin(time * 1.2) * 0.04;
    }
    if (leftEar.current) {
      leftEar.current.rotation.z = -0.6 + Math.sin(time * 2.2) * 0.06;
    }
    if (rightEar.current) {
      rightEar.current.rotation.z = 0.6 - Math.sin(time * 2.2) * 0.06;
    }
  });

  return (
    <group ref={root}>
      {/* patas */}
      <group ref={leftLeg} position={[-0.2, 0.48, 0]}>
        <mesh position-y={-0.23}>
          <cylinderGeometry args={[0.11, 0.12, 0.45, 6]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.43, 0.08]}>
          <boxGeometry args={[0.26, 0.12, 0.34]} />
          <meshStandardMaterial color={fur} flatShading roughness={0.95} />
        </mesh>
        <Claws position={[0, -0.4, 0.25]} size={0.75} color={claws} />
      </group>

      <group ref={rightLeg} position={[0.2, 0.48, 0]}>
        <mesh position-y={-0.23}>
          <cylinderGeometry args={[0.11, 0.12, 0.45, 6]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.43, 0.08]}>
          <boxGeometry args={[0.26, 0.12, 0.34]} />
          <meshStandardMaterial color={fur} flatShading roughness={0.95} />
        </mesh>
        <Claws position={[0, -0.4, 0.25]} size={0.75} color={claws} />
      </group>

      {/* pelaje */}
      <mesh position={[0, 0.92, -0.03]} scale={[0.41, 0.48, 0.38]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={fur} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 0.88, 0.18]} scale={[0.2, 0.28, 0.14]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color={body} flatShading roughness={0.9} />
      </mesh>

      {/* brazos */}
      <group ref={leftArm} position={[-0.36, 1.02, 0.02]} rotation-z={0.25}>
        <mesh position-y={-0.2}>
          <cylinderGeometry args={[0.07, 0.06, 0.4, 6]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <mesh position-y={-0.42}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <Claws position={[0, -0.44, 0.07]} size={0.65} color={claws} />
      </group>

      <group ref={rightArm} position={[0.36, 1.02, 0.02]} rotation-z={-0.25}>
        <mesh position-y={-0.2}>
          <cylinderGeometry args={[0.07, 0.06, 0.4, 6]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <mesh position-y={-0.42}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <Claws position={[0, -0.44, 0.07]} size={0.65} color={claws} />
      </group>

      {/* cola */}
      <group ref={tail} position={[0, 0.72, -0.3]}>
        <mesh position={[0, -0.02, -0.32]} rotation-x={-Math.PI / 2}>
          <coneGeometry args={[0.15, 0.72, 6]} />
          <meshStandardMaterial color={fur} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, -0.02, -0.7]}>
          <sphereGeometry args={[0.07, 6, 6]} />
          <meshStandardMaterial color={body} flatShading />
        </mesh>
      </group>

      {/* cabeza */}
      <group ref={head} position={[0, 1.42, 0]}>
        <mesh scale={[0.33, 0.32, 0.32]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>

        <mesh position={[0, 0.03, -0.14]} scale={[0.37, 0.32, 0.32]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color={fur} flatShading roughness={1} />
        </mesh>

        <mesh position={[0, -0.07, 0.27]} scale={[0.21, 0.15, 0.26]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color={fur} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, -0.02, 0.5]}>
          <sphereGeometry args={[0.055, 6, 6]} />
          <meshBasicMaterial color="#16202e" />
        </mesh>
        <mesh position={[0, -0.15, 0.42]}>
          <boxGeometry args={[0.16, 0.022, 0.04]} />
          <meshBasicMaterial color="#4b2a33" />
        </mesh>

        <Eye position={[-0.13, 0.05, 0.27]} size={0.065} iris="#2f6fed" />
        <Eye position={[0.13, 0.05, 0.27]} size={0.065} iris="#2f6fed" />

        {/* cuerno */}
        <mesh position={[0, 0.26, 0.16]} rotation-x={0.32}>
          <coneGeometry args={[0.075, 0.4, 5]} />
          <meshStandardMaterial color={horn} flatShading roughness={0.7} />
        </mesh>

        {/* orejas */}
        <group ref={leftEar} position={[-0.27, 0.16, -0.02]}>
          <mesh rotation-z={-0.6}>
            <coneGeometry args={[0.11, 0.42, 5]} />
            <meshStandardMaterial color={body} flatShading roughness={0.9} />
          </mesh>
        </group>
        <group ref={rightEar} position={[0.27, 0.16, -0.02]}>
          <mesh rotation-z={0.6}>
            <coneGeometry args={[0.11, 0.42, 5]} />
            <meshStandardMaterial color={body} flatShading roughness={0.9} />
          </mesh>
        </group>

        {champion && (
          <>
            <mesh position={[0, -0.08, 0.42]} scale={[0.24, 0.13, 0.3]}>
              <sphereGeometry args={[1, 10, 8]} />
              <meshStandardMaterial color={fur} flatShading roughness={1} />
            </mesh>
            <mesh position={[0, 0.34, 0.02]} rotation-x={0.1}>
              <coneGeometry args={[0.08, 0.55, 5]} />
              <meshStandardMaterial color={horn} flatShading />
            </mesh>
          </>
        )}
      </group>

      {champion && (
        <mesh position={[0, 1.15, -0.28]} scale={[0.32, 0.24, 0.22]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={fur} flatShading roughness={1} />
        </mesh>
      )}
    </group>
  );
}
