import { useRef } from "react";
import * as THREE from "three";

import { SPECIES } from "@digiworld/content";

import { DsSpriteActor } from "./models/DsSpriteActor";
import { useFrame } from "@react-three/fiber";
import type { CombatVisual } from "../net/world-client";

export function DigimonBody({
  speciesId,
  moving,
  running,
  isLocal,
  combat,
  defeated = false,
}: {
  speciesId: string;
  moving: boolean;
  running: boolean;
  isLocal: boolean;
  combat?: CombatVisual;
  defeated?: boolean;
}) {
  const species = SPECIES[speciesId] ?? SPECIES.agumon!;
  const scale = species.scale;
  const modelRoot = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!modelRoot.current) return;
    const now = performance.now();
    const attack = combat ? Math.max(0, 1 - (now - combat.attackAt) / 500) : 0;
    const hit = combat ? Math.max(0, 1 - (now - combat.hitAt) / 350) : 0;
    modelRoot.current.position.z = Math.sin(attack * Math.PI) * 0.35;
    modelRoot.current.position.x = hit > 0 ? Math.sin(now * 0.08) * hit * 0.06 : 0;
    modelRoot.current.rotation.z = defeated ? -Math.PI / 2 : hit * -0.1;
    const evolutionAge = now - (combat?.evolutionAt ?? -10000);
    const pulse = evolutionAge < 3000 ? 1 + Math.sin(evolutionAge / 100) * 0.07 * (1 - evolutionAge / 3000) : 1;
    modelRoot.current.scale.setScalar(scale * pulse);
  });

  return (
    <group>
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
          opacity={0.28}
          depthWrite={false}
        />
      </mesh>

      <group ref={modelRoot} scale={scale}>
          <DsSpriteActor
            kind="digimon"
            speciesId={speciesId}
            primaryColor={species.color}
            accentColor={species.accent}
            moving={moving}
            running={running}
            worldSize={2.0}
            planeY={0.96}
            combat={combat}
            defeated={defeated}
          />
      </group>
    </group>
  );
}
