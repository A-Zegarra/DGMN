import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import { SPECIES } from "@digiworld/content";
import type { PlayerView } from "../net/world-client";
import { DigimonBody } from "./DigimonBody";
import { NameTag } from "./NameTag";

/** La representación sigue exclusivamente la posición autoritativa del Digimon. */
export function PartnerAvatar({ view, isLocal, showTag = true, onSelect }: {
  view: PlayerView; isLocal: boolean; showTag?: boolean; onSelect?: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const health = useRef<THREE.Mesh>(null);
  const [motion, setMotion] = useState({moving: view.partnerMoving, defeated: view.hp <= 0});
  const species = SPECIES[view.species] ?? SPECIES.agumon!;
  useFrame(() => {
    if (motion.moving !== view.partnerMoving || motion.defeated !== (view.hp <= 0)) {
      setMotion({moving: view.partnerMoving, defeated: view.hp <= 0});
    }
    if (group.current) {
      group.current.position.set(view.partnerX, 0, view.partnerZ);
      group.current.rotation.y = view.partnerRot;
    }
    if (health.current) {
      const ratio = Math.max(0, view.hp / view.maxHp);
      health.current.scale.x = ratio;
      health.current.position.x = (ratio - 1) * 0.6;
    }
  });
  return <group ref={group} name={isLocal ? "local-partner" : undefined}
    onClick={event => {
      if (!onSelect || event.button !== 0 || event.delta > 4) return;
      event.stopPropagation(); onSelect();
    }}>
    <group name="partner-body">
      <DigimonBody speciesId={view.species} moving={motion.moving} running={false}
        isLocal={isLocal} combat={view} defeated={motion.defeated} />
    </group>
    {(showTag || isLocal) && <NameTag title={species.name}
      subtitle={view.hp <= 0 ? "Debilitado · recuperándose" : `Nv. ${view.level}${isLocal ? " · Tu Digimon" : ""}`}
      isLocal={isLocal} y={2.25 * species.scale} scale={Math.max(1, species.scale) * 0.85} />}
    <Billboard position={[0, 1.95 * species.scale, 0]}>
      <mesh><planeGeometry args={[1.28, 0.13]} /><meshBasicMaterial color="#13222c" depthTest={false} /></mesh>
      <mesh ref={health} position-z={0.01}><planeGeometry args={[1.2, 0.07]} /><meshBasicMaterial color="#73efb3" depthTest={false} toneMapped={false} /></mesh>
    </Billboard>
  </group>;
}
