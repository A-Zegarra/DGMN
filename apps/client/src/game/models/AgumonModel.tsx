import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { SPECIES } from "@digiworld/content";

import { Claws, Eye } from "./parts";

export function AgumonModel({
  speciesId,
  moving,
  running,
}: {
  speciesId: string;
  moving: boolean;
  running: boolean;
}) {
  const species = SPECIES[speciesId] ?? SPECIES.agumon!;
  const champion = speciesId === "greymon";

  const root = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);

  const body = species.color;
  const accent = species.accent;
  const belly = "#f6e7c9";
  const claws = "#f4ead2";

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const speed = running ? 14 : 9;
    const swing = moving ? Math.sin(time * speed) * 0.55 : 0;

    if (root.current) {
      root.current.position.y = moving
        ? Math.abs(Math.sin(time * speed)) * 0.06
        : Math.sin(time * 2) * 0.012;
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
        Math.sin(time * (moving ? 6 : 2.6)) * (moving ? 0.22 : 0.13);
    }
    if (head.current) {
      head.current.rotation.y = Math.sin(time * 1.4) * 0.035;
      head.current.rotation.x = moving ? -0.04 : Math.sin(time * 2) * 0.012;
    }
  });

  return (
    <group ref={root}>
      {/* patas */}
      <group ref={leftLeg} position={[-0.23, 0.55, 0]}>
        <mesh position-y={-0.25}>
          <cylinderGeometry args={[0.13, 0.15, 0.5, 6]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.5, 0.08]}>
          <boxGeometry args={[0.3, 0.14, 0.4]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <Claws position={[0, -0.47, 0.29]} size={0.9} color={claws} />
      </group>

      <group ref={rightLeg} position={[0.23, 0.55, 0]}>
        <mesh position-y={-0.25}>
          <cylinderGeometry args={[0.13, 0.15, 0.5, 6]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.5, 0.08]}>
          <boxGeometry args={[0.3, 0.14, 0.4]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <Claws position={[0, -0.47, 0.29]} size={0.9} color={claws} />
      </group>

      {/* cuerpo */}
      <mesh position={[0, 0.95, 0]} scale={[0.42, 0.5, 0.36]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color={body} flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.88, 0.18]} scale={[0.25, 0.32, 0.17]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color={belly} flatShading roughness={0.95} />
      </mesh>

      {/* brazos */}
      <group ref={leftArm} position={[-0.42, 1.08, 0.03]} rotation-z={0.28}>
        <mesh position-y={-0.22}>
          <cylinderGeometry args={[0.075, 0.065, 0.45, 6]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <mesh position-y={-0.46}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <Claws position={[0, -0.48, 0.08]} size={0.7} color={claws} />
      </group>

      <group ref={rightArm} position={[0.42, 1.08, 0.03]} rotation-z={-0.28}>
        <mesh position-y={-0.22}>
          <cylinderGeometry args={[0.075, 0.065, 0.45, 6]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <mesh position-y={-0.46}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <Claws position={[0, -0.48, 0.08]} size={0.7} color={claws} />
      </group>

      {/* cola */}
      <group ref={tail} position={[0, 0.78, -0.28]}>
        <mesh position={[0, -0.02, -0.34]} rotation-x={-Math.PI / 2}>
          <coneGeometry args={[0.17, 0.82, 6]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.03, -0.76]}>
          <sphereGeometry args={[0.07, 6, 6]} />
          <meshStandardMaterial color={accent} flatShading />
        </mesh>
      </group>

      {/* cabeza */}
      <group ref={head} position={[0, 1.5, 0]}>
        <mesh scale={[0.38, 0.36, 0.36]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>

        <mesh position={[0, -0.09, 0.28]} scale={[0.24, 0.18, 0.27]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color={body} flatShading roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.18, 0.29]} scale={[0.22, 0.1, 0.23]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color={belly} flatShading roughness={0.95} />
        </mesh>
        <mesh position={[0, -0.14, 0.5]}>
          <boxGeometry args={[0.2, 0.025, 0.05]} />
          <meshBasicMaterial color="#4a2c18" />
        </mesh>

        <mesh position={[-0.06, -0.02, 0.52]}>
          <sphereGeometry args={[0.018, 6, 6]} />
          <meshBasicMaterial color="#3a2416" />
        </mesh>
        <mesh position={[0.06, -0.02, 0.52]}>
          <sphereGeometry args={[0.018, 6, 6]} />
          <meshBasicMaterial color="#3a2416" />
        </mesh>

        <Eye position={[-0.15, 0.06, 0.29]} size={0.075} iris="#2f7d4a" />
        <Eye position={[0.15, 0.06, 0.29]} size={0.075} iris="#2f7d4a" />

        {champion && (
          <>
            <mesh position={[0, 0.19, 0.02]} scale={[0.4, 0.17, 0.36]}>
              <sphereGeometry args={[1, 8, 6]} />
              <meshStandardMaterial color="#8b5a2b" flatShading roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.0, 0.5]} rotation-x={Math.PI / 2}>
              <coneGeometry args={[0.07, 0.32, 5]} />
              <meshStandardMaterial color={accent} flatShading />
            </mesh>
          </>
        )}
      </group>

      {champion && (
        <>
          {[
            [0, 1.38, -0.16],
            [0, 1.22, -0.28],
            [0, 1.06, -0.38],
          ].map((position, index) => (
            <mesh
              key={index}
              position={position as [number, number, number]}
              rotation-x={-0.35}
            >
              <coneGeometry args={[0.09, 0.22, 4]} />
              <meshStandardMaterial color={accent} flatShading />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}
