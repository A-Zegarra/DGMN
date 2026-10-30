import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import { SPECIES } from "@digiworld/content";
import type { PlayerView } from "../net/world-client";
import { DsSpriteActor } from "./models/DsSpriteActor";
import { NameTag } from "./NameTag";

const JACKETS = ["#3b82f6", "#ef4444", "#10b981", "#a855f7", "#f59e0b", "#14b8a6"];
function jacketFor(name: string): string {
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return JACKETS[hash % JACKETS.length]!;
}

export function TamerAvatar({view, isLocal, showTag = true, onSelect}: {
  view: PlayerView; isLocal: boolean; showTag?: boolean; onSelect?: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [motion, setMotion] = useState({moving: view.moving, running: view.running});
  const species = SPECIES[view.species] ?? SPECIES.agumon!;
  useFrame(() => {
    if (group.current) { group.current.position.set(view.x, 0, view.z); group.current.rotation.y = view.rot; }
    if (motion.moving !== view.moving || motion.running !== view.running) setMotion({moving: view.moving, running: view.running});
  });
  return <group ref={group} onClick={event => {
    if (!onSelect || event.button !== 0 || event.delta > 4) return;
    event.stopPropagation(); onSelect();
  }}>
    {isLocal && <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
      <ringGeometry args={[0.38, 0.5, 28]} />
      <meshBasicMaterial color="#8bffbf" transparent opacity={0.8} depthWrite={false} />
    </mesh>}
    <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
      <circleGeometry args={[0.34, 18]} /><meshBasicMaterial color="#04120b" transparent opacity={0.28} depthWrite={false} />
    </mesh>
    <DsSpriteActor kind="tamer" speciesId="tamer" primaryColor={jacketFor(view.name)} accentColor={species.color}
      moving={motion.moving} running={motion.running} worldSize={2.7} planeY={1.12} />
    {showTag && <NameTag title={view.name} subtitle="Domador" isLocal={isLocal} y={2.18} scale={1} />}
  </group>;
}
