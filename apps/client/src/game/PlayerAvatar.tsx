import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { SPECIES } from "@digiworld/content";

import type { PlayerView } from "../net/world-client";
import { NameTag } from "./NameTag";

export function PlayerAvatar({
  view,
  isLocal,
}: {
  view: PlayerView;
  isLocal: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const species = SPECIES[view.species] ?? SPECIES.agumon!;

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
    if (view.moving) {
      const speed = view.running ? 15 : 10;
      rig.position.y = Math.abs(Math.sin(time * speed)) * 0.12;
      rig.rotation.x = view.running ? -0.12 : -0.06;
      rig.rotation.z = Math.sin(time * speed) * 0.035;
    } else {
      rig.position.y = Math.sin(time * 2) * 0.018;
      rig.rotation.x = 0;
      rig.rotation.z = 0;
    }
  });

  const scale = species.scale;

  return (
    <group ref={group}>
      {isLocal && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.035}>
          <ringGeometry args={[0.55 * scale, 0.72 * scale, 32]} />
          <meshBasicMaterial
            color="#8bffbf"
            transparent
            opacity={0.8}
            depthWrite={false}
          />
        </mesh>
      )}

      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[0.5 * scale, 20]} />
        <meshBasicMaterial
          color="#04120b"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>

      <group ref={body} scale={scale}>
        <mesh position-y={0.85}>
          <capsuleGeometry args={[0.38, 0.75, 4, 10]} />
          <meshStandardMaterial
            color={species.color}
            flatShading
            roughness={0.9}
          />
        </mesh>

        <mesh position={[0, 1.2, 0.36]} rotation-x={Math.PI / 2}>
          <coneGeometry args={[0.17, 0.36, 6]} />
          <meshStandardMaterial color={species.accent} flatShading />
        </mesh>

        <mesh position={[-0.15, 1.13, 0.35]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshBasicMaterial color="#0b1220" />
        </mesh>
        <mesh position={[0.15, 1.13, 0.35]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshBasicMaterial color="#0b1220" />
        </mesh>

        <mesh position={[0, 0.5, -0.5]} rotation-x={-Math.PI / 2}>
          <coneGeometry args={[0.16, 0.62, 5]} />
          <meshStandardMaterial color={species.accent} flatShading />
        </mesh>
      </group>

      <NameTag
        name={view.name}
        level={view.level}
        isLocal={isLocal}
        y={2.25 * scale}
        scale={Math.max(1, scale * 0.95)}
      />
    </group>
  );
}
