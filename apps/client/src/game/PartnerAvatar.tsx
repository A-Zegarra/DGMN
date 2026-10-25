import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";

import { SPECIES } from "@digiworld/content";

import type { PlayerView } from "../net/world-client";
import { DigimonBody } from "./DigimonBody";
import { NameTag } from "./NameTag";

const TARGET = new THREE.Vector3();
const FOLLOW_RADIUS = 2.8;
const FOLLOW_MAX = 4.8;
const MIN_DISTANCE = 2.0;
const PARTNER_SPEED = 3.6;
const CATCHUP_SPEED = 5.4;

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
  const target = useRef(new THREE.Vector3());
  const lastTamer = useRef({ x: view.x, z: view.z });
  const heading = useRef(view.rot);
  const nextWanderAt = useRef(2.5 + Math.random() * 2);
  const movingRef = useRef(false);
  const [partnerMoving, setPartnerMoving] = useState(false);

  const species = SPECIES[view.species] ?? SPECIES.agumon!;

  useFrame((state, delta) => {
    const root = group.current;
    if (!root) {
      return;
    }

    const dt = Math.min(delta, 0.1);
    const now = state.clock.elapsedTime;

    if (!initialized.current) {
      const startYaw = view.rot;
      const rightX = -Math.cos(startYaw);
      const rightZ = Math.sin(startYaw);
      target.current.set(
        view.x - Math.sin(startYaw) * FOLLOW_RADIUS + rightX * 0.8,
        0,
        view.z - Math.cos(startYaw) * FOLLOW_RADIUS + rightZ * 0.8,
      );
      root.position.copy(target.current);
      root.rotation.y = startYaw;
      initialized.current = true;
    }

    const tamerDx = view.x - lastTamer.current.x;
    const tamerDz = view.z - lastTamer.current.z;
    const tamerMoved = Math.hypot(tamerDx, tamerDz);

    if (tamerMoved > 0.003) {
      heading.current = Math.atan2(tamerDx, tamerDz);
      lastTamer.current = { x: view.x, z: view.z };
    }

    const distanceToTamer = Math.hypot(
      root.position.x - view.x,
      root.position.z - view.z,
    );
    const targetDistanceToTamer = Math.hypot(
      target.current.x - view.x,
      target.current.z - view.z,
    );

    // Si el tamer se aleja, el compañero busca un nuevo punto cercano.
    if (tamerMoved > 0.003 && targetDistanceToTamer > 3.8) {
      const angle =
        heading.current + Math.PI + (Math.random() * 1.4 - 0.7);
      const radius = 2.4 + Math.random() * 0.8;
      target.current.set(
        view.x + Math.sin(angle) * radius,
        0,
        view.z + Math.cos(angle) * radius,
      );
    }

    // Sin moverse, deambula cada pocos segundos alrededor del tamer.
    if (tamerMoved <= 0.003 && now >= nextWanderAt.current) {
      const currentAngle = Math.atan2(
        root.position.x - view.x,
        root.position.z - view.z,
      );
      const direction = Math.random() < 0.5 ? 1 : -1;
      const angle =
        currentAngle + direction * (0.8 + Math.random() * 1.1);
      const radius = 2.1 + Math.random() * 1.2;
      target.current.set(
        view.x + Math.sin(angle) * radius,
        0,
        view.z + Math.cos(angle) * radius,
      );
      nextWanderAt.current = now + 2.8 + Math.random() * 2.4;
    }

    // Correa: nunca se aleja demasiado.
    if (distanceToTamer > FOLLOW_MAX) {
      const angle = Math.atan2(
        root.position.x - view.x,
        root.position.z - view.z,
      );
      target.current.set(
        view.x + Math.sin(angle) * FOLLOW_RADIUS,
        0,
        view.z + Math.cos(angle) * FOLLOW_RADIUS,
      );
    }

    const dx = target.current.x - root.position.x;
    const dz = target.current.z - root.position.z;
    const distance = Math.hypot(dx, dz);
    const speed = distanceToTamer > FOLLOW_MAX ? CATCHUP_SPEED : PARTNER_SPEED;
    let didMove = false;

    if (distance > 0.12) {
      const step = Math.min(distance, speed * dt);
      root.position.x += (dx / distance) * step;
      root.position.z += (dz / distance) * step;
      didMove = true;
    }

    // Separación mínima para no meterse dentro del tamer.
    let awayX = root.position.x - view.x;
    let awayZ = root.position.z - view.z;
    let awayDistance = Math.hypot(awayX, awayZ);
    if (awayDistance < MIN_DISTANCE) {
      if (awayDistance < 0.001) {
        awayX = 1;
        awayZ = 0;
        awayDistance = 1;
      }
      root.position.x = view.x + (awayX / awayDistance) * MIN_DISTANCE;
      root.position.z = view.z + (awayZ / awayDistance) * MIN_DISTANCE;
    }

    if (didMove !== movingRef.current) {
      movingRef.current = didMove;
      setPartnerMoving(didMove);
    }

    const desiredYaw = didMove
      ? Math.atan2(dx, dz)
      : Math.atan2(view.x - root.position.x, view.z - root.position.z);
    const turnSpeed = 1 - Math.exp(-9 * dt);
    root.rotation.y = lerpAngle(root.rotation.y, desiredYaw, turnSpeed);
  });

  const tagScale = Math.max(1, species.scale * 0.95) * 0.85;

  return (
    <group ref={group}>
      <DigimonBody
        speciesId={view.species}
        moving={partnerMoving}
        running={false}
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
