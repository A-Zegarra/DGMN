import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { SPECIES } from "@digiworld/content";

import type { PlayerView } from "../net/world-client";
import { DigimonBody } from "./DigimonBody";
import { NameTag } from "./NameTag";

const TARGET = new THREE.Vector3();
const FORWARD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();

const FOLLOW_BACK = 3.0;
const FOLLOW_RIGHT = 0.9;
const MIN_DISTANCE = 2.2;

function lerpAngle(from: number, to: number, t: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * t;
}

export function PartnerAvatar({
  view,
  isLocal,
  showTag = true,
}: {
  view: PlayerView;
  isLocal: boolean;
  showTag?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const initialized = useRef(false);
  const lastTamer = useRef({ x: view.x, z: view.z });
  const heading = useRef(view.rot);
  const species = SPECIES[view.species] ?? SPECIES.agumon!;

  useFrame((_, delta) => {
    const root = group.current;
    if (!root) {
      return;
    }

    const tamerDx = view.x - lastTamer.current.x;
    const tamerDz = view.z - lastTamer.current.z;
    if (Math.hypot(tamerDx, tamerDz) > 0.0008) {
      heading.current = Math.atan2(tamerDx, tamerDz);
      lastTamer.current = { x: view.x, z: view.z };
    }

    const followYaw = heading.current;
    FORWARD.set(Math.sin(followYaw), 0, Math.cos(followYaw));
    // La derecha de la cámara, en un sistema con Y arriba y frente +Z.
    RIGHT.set(-Math.cos(followYaw), 0, Math.sin(followYaw));

    TARGET.set(view.x, 0, view.z)
      .addScaledVector(FORWARD, -FOLLOW_BACK)
      .addScaledVector(RIGHT, FOLLOW_RIGHT);

    if (!initialized.current) {
      root.position.copy(TARGET);
      initialized.current = true;
    } else {
      const smoothing = 1 - Math.exp(-6 * Math.min(delta, 0.1));
      root.position.lerp(TARGET, smoothing);
    }

    let dx = root.position.x - view.x;
    let dz = root.position.z - view.z;
    let distance = Math.hypot(dx, dz);
    if (distance < MIN_DISTANCE) {
      if (distance < 0.001) {
        dx = 1;
        dz = 0;
        distance = 1;
      }
      root.position.x = view.x + (dx / distance) * MIN_DISTANCE;
      root.position.z = view.z + (dz / distance) * MIN_DISTANCE;
    }

    const desiredYaw = view.moving
      ? followYaw
      : Math.atan2(view.x - root.position.x, view.z - root.position.z);
    const turnSpeed = 1 - Math.exp(-9 * Math.min(delta, 0.1));
    root.rotation.y = lerpAngle(root.rotation.y, desiredYaw, turnSpeed);
  });

  const tagScale = Math.max(1, species.scale * 0.95) * 0.85;

  return (
    <group ref={group}>
      <DigimonBody
        speciesId={view.species}
        moving={view.moving}
        running={view.running}
        isLocal={isLocal}
      />
      {showTag && (
        <NameTag
          title={species.name}
          subtitle={`Nv. ${view.level}`}
          isLocal={isLocal}
          y={2.25 * species.scale}
          scale={tagScale}
        />
      )}
    </group>
  );
}
