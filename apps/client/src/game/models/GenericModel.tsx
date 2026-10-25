import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { SPECIES } from "@digiworld/content";

import { Claws, Eye } from "./parts";

export function GenericModel({
  speciesId,
  moving,
  running,
}: {
  speciesId: string;
  moving: boolean;
  running: boolean;
}) {
  const species = SPECIES[speciesId] ?? SPECIES.agumon!;
  const big = ["champion", "ultimate", "mega", "jefe"].includes(species.stage);

  const root = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);

  const body = species.color;
  const accent = species.accent;
  const claws = "#f4ead2";

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const speed = running ? 14 : 9;
    const swing = moving ? Math.sin(time * speed) * 0.55 : 0;

    if (root.current) {
      root.current.position.y = moving
        ? Math.abs(Math.sin(time * speed)) * 0.06
        : Math.sin(time * 2) * 0.014;
    }
    if (leftLeg.current) {
      leftLeg.current.rotation.x = swing;
    }
    if (rightLeg.current) {
      rightLeg.current.rotation.x = -swing;
    }
    if (leftArm.current) {
      leftArm.current.rotation.x = -swing * 0.65;
    }
    if (rightArm.current) {
      rightArm.current.rotation.x = swing * 0.65;
    }
    if (tail.current) {
      tail.current.rotation.y =
        Math.sin(time * (moving ? 6 : 2.5)) * (moving ? 0.24 : 0.12);
    }
    if (head.current) {
      head.current.rotation.y = Math.sin(time * 1.3) * 0.04;
    }
  });

  return (
    <group ref={root}>
      <group ref={leftLeg} position={[-0.22, 0.55, 0]}>
        <mesh position-y={-0.25}>
          <cylinderGeometry args={[0.12, 0.14, 0.5, 6]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.5, 0.07]}>
          <boxGeometry args={[0.28, 0.13, 0.36]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <Claws position={[0, -0.47, 0.26]} size={0.8} color={claws} />
      </group>

      <group ref={rightLeg} position={[0.22, 0.55, 0]}>
        <mesh position-y={-0.25}>
          <cylinderGeometry args={[0.12, 0.14, 0.5, 6]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.5, 0.07]}>
          <boxGeometry args={[0.28, 0.13, 0.36]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <Claws position={[0, -0.47, 0.26]} size={0.8} color={claws} />
      </group>

      <mesh position={[0, 0.95, 0]} scale={[0.4, 0.48, 0.35]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color={body} flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.88, 0.18]} scale={[0.23, 0.3, 0.15]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color={accent} flatShading roughness={0.95} />
      </mesh>

      <group ref={leftArm} position={[-0.4, 1.08, 0.02]} rotation-z={0.3}>
        <mesh position-y={-0.21}>
          <cylinderGeometry args={[0.07, 0.06, 0.42, 6]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <mesh position-y={-0.43}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <Claws position={[0, -0.45, 0.07]} size={0.65} color={claws} />
      </group>

      <group ref={rightArm} position={[0.4, 1.08, 0.02]} rotation-z={-0.3}>
        <mesh position-y={-0.21}>
          <cylinderGeometry args={[0.07, 0.06, 0.42, 6]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <mesh position-y={-0.43}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <Claws position={[0, -0.45, 0.07]} size={0.65} color={claws} />
      </group>

      <group ref={tail} position={[0, 0.78, -0.28]}>
        <mesh position={[0, -0.02, -0.32]} rotation-x={-Math.PI / 2}>
          <coneGeometry args={[0.15, 0.75, 6]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
      </group>

      <group ref={head} position={[0, 1.5, 0]}>
        <mesh scale={[0.36, 0.34, 0.34]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.08, 0.27]} scale={[0.22, 0.16, 0.25]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color={accent} flatShading roughness={0.9} />
        </mesh>
        <Eye position={[-0.14, 0.05, 0.27]} size={0.07} iris={accent} />
        <Eye position={[0.14, 0.05, 0.27]} size={0.07} iris={accent} />

        {big && (
          <>
            <mesh position={[-0.2, 0.28, -0.02]} rotation-z={-0.25}>
              <coneGeometry args={[0.07, 0.38, 5]} />
              <meshStandardMaterial color={accent} flatShading />
            </mesh>
            <mesh position={[0.2, 0.28, -0.02]} rotation-z={0.25}>
              <coneGeometry args={[0.07, 0.38, 5]} />
              <meshStandardMaterial color={accent} flatShading />
            </mesh>
          </>
        )}

        {species.element === "oscuridad" && (
          <>
            <mesh position={[-0.5, 0.05, -0.22]} rotation-z={0.6}>
              <coneGeometry args={[0.12, 0.65, 4]} />
              <meshStandardMaterial color={accent} flatShading />
            </mesh>
            <mesh position={[0.5, 0.05, -0.22]} rotation-z={-0.6}>
              <coneGeometry args={[0.12, 0.65, 4]} />
              <meshStandardMaterial color={accent} flatShading />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
}
