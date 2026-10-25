import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { SPECIES } from "@digiworld/content";

import type { PlayerView } from "../net/world-client";
import { NameTag } from "./NameTag";

const JACKETS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#a855f7",
  "#f59e0b",
  "#14b8a6",
];

function jacketFor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return JACKETS[hash % JACKETS.length]!;
}

export function TamerAvatar({
  view,
  isLocal,
  showTag = true,
}: {
  view: PlayerView;
  isLocal: boolean;
  showTag?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);

  const species = SPECIES[view.species] ?? SPECIES.agumon!;
  const jacket = jacketFor(view.name);
  const skin = "#e7b48b";
  const pants = "#26303d";
  const hair = "#1b2430";

  useEffect(() => {
    group.current?.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
      }
    });
  }, []);

  useFrame((state) => {
    const root = group.current;
    if (!root) {
      return;
    }
    root.position.set(view.x, 0, view.z);
    root.rotation.y = view.rot;

    const rig = body.current;
    if (!rig) {
      return;
    }

    const time = state.clock.elapsedTime;
    const speed = view.running ? 14 : 9;
    const swing = view.moving ? Math.sin(time * speed) * 0.55 : 0;

    if (leftLeg.current) {
      leftLeg.current.rotation.x = swing;
    }
    if (rightLeg.current) {
      rightLeg.current.rotation.x = -swing;
    }
    if (leftArm.current) {
      leftArm.current.rotation.x = -swing * 0.8;
    }
    if (rightArm.current) {
      rightArm.current.rotation.x = swing * 0.8;
    }

    rig.position.y = view.moving
      ? Math.abs(Math.sin(time * speed)) * 0.05
      : Math.sin(time * 2) * 0.012;
    rig.rotation.x = view.running ? -0.05 : 0;
  });

  return (
    <group ref={group}>
      {isLocal && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
          <ringGeometry args={[0.38, 0.5, 28]} />
          <meshBasicMaterial
            color="#8bffbf"
            transparent
            opacity={0.8}
            depthWrite={false}
          />
        </mesh>
      )}

      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[0.34, 18]} />
        <meshBasicMaterial
          color="#04120b"
          transparent
          opacity={0.25}
          depthWrite={false}
        />
      </mesh>

      <group ref={body}>
        <group ref={leftLeg} position={[-0.11, 0.68, 0]}>
          <mesh position-y={-0.3}>
            <cylinderGeometry args={[0.075, 0.065, 0.6, 6]} />
            <meshStandardMaterial color={pants} flatShading roughness={1} />
          </mesh>
          <mesh position={[0, -0.61, 0.06]}>
            <boxGeometry args={[0.16, 0.09, 0.26]} />
            <meshStandardMaterial color="#111827" flatShading />
          </mesh>
        </group>

        <group ref={rightLeg} position={[0.11, 0.68, 0]}>
          <mesh position-y={-0.3}>
            <cylinderGeometry args={[0.075, 0.065, 0.6, 6]} />
            <meshStandardMaterial color={pants} flatShading roughness={1} />
          </mesh>
          <mesh position={[0, -0.61, 0.06]}>
            <boxGeometry args={[0.16, 0.09, 0.26]} />
            <meshStandardMaterial color="#111827" flatShading />
          </mesh>
        </group>

        <mesh position={[0, 1.0, 0]}>
          <cylinderGeometry args={[0.25, 0.21, 0.6, 7]} />
          <meshStandardMaterial color={jacket} flatShading roughness={0.9} />
        </mesh>

        <mesh position={[0, 0.72, 0]}>
          <boxGeometry args={[0.44, 0.14, 0.28]} />
          <meshStandardMaterial color={pants} flatShading />
        </mesh>

        <group ref={leftArm} position={[-0.29, 1.24, 0]}>
          <mesh position-y={-0.24}>
            <cylinderGeometry args={[0.062, 0.055, 0.5, 6]} />
            <meshStandardMaterial color={jacket} flatShading roughness={1} />
          </mesh>
          <mesh position-y={-0.52}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color={skin} flatShading />
          </mesh>
        </group>

        <group ref={rightArm} position={[0.29, 1.24, 0]}>
          <mesh position-y={-0.24}>
            <cylinderGeometry args={[0.062, 0.055, 0.5, 6]} />
            <meshStandardMaterial color={jacket} flatShading roughness={1} />
          </mesh>
          <mesh position-y={-0.52}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color={skin} flatShading />
          </mesh>
        </group>

        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.2, 10, 10]} />
          <meshStandardMaterial color={skin} flatShading roughness={0.9} />
        </mesh>

        <mesh position={[0, 1.59, -0.015]} scale={[1.05, 0.65, 1.05]}>
          <sphereGeometry args={[0.205, 10, 10]} />
          <meshStandardMaterial color={hair} flatShading />
        </mesh>

        <mesh position={[-0.075, 1.51, 0.185]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshBasicMaterial color="#111827" />
        </mesh>
        <mesh position={[0.075, 1.51, 0.185]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshBasicMaterial color="#111827" />
        </mesh>

        <mesh position={[0, 1.02, -0.24]}>
          <boxGeometry args={[0.32, 0.38, 0.16]} />
          <meshStandardMaterial color={species.accent} flatShading />
        </mesh>
      </group>

      {showTag && (
        <NameTag
          title={view.name}
          subtitle="Domador"
          isLocal={isLocal}
          y={2.18}
          scale={1}
        />
      )}
    </group>
  );
}
