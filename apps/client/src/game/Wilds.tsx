import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import { useEffect, useReducer, useRef } from "react";
import * as THREE from "three";

import { SPECIES } from "@digiworld/content";

import type { WildView, WorldClient } from "../net/world-client";
import { DigimonBody } from "./DigimonBody";
import { NameTag } from "./NameTag";

function WildEntity({
  client,
  wild,
}: {
  client: WorldClient;
  wild: WildView;
}) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const health = useRef<THREE.Mesh>(null);
  const castRing = useRef<THREE.Mesh>(null);
  const species = SPECIES[wild.species] ?? SPECIES.agumon!;

  useFrame(() => {
    const root = group.current;
    if (!root) {
      return;
    }

    root.position.set(wild.x, 0, wild.z);
    root.rotation.y = wild.rot;
    root.visible = wild.hp > 0;
    if(castRing.current){
      castRing.current.visible=wild.isBoss&&wild.state==="casting"&&wild.hp>0;
      const material=castRing.current.material as THREE.MeshBasicMaterial;
      material.opacity=0.3+Math.sin(performance.now()/90)*0.1;
    }
    if (health.current) {
      const ratio = Math.max(0, wild.hp / wild.maxHp);
      health.current.scale.x = ratio;
      health.current.position.x = (ratio - 1) * 0.6;
    }

    if (ring.current) {
      ring.current.visible = wild.hp > 0 && client.targetWildId === wild.id;
    }
  });

  return (
    <group
      ref={group}
      onClick={(event) => {
        if (event.button !== 0 || event.delta > 4) return;
        event.stopPropagation();
        client.setWildTarget(wild.id);
      }}
    >
      <DigimonBody
        speciesId={wild.species}
        moving={wild.moving}
        running={false}
        isLocal={false}
        combat={wild}
      />

      <mesh
        ref={ring}
        rotation-x={-Math.PI / 2}
        position-y={0.04}
        visible={false}
        renderOrder={3}
      >
        <ringGeometry args={[0.58 * species.scale, 0.78 * species.scale, 32]} />
        <meshBasicMaterial
          color="#ffb86b"
          transparent
          opacity={0.85}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <NameTag
        title={wild.isBoss?wild.name:`${species.name} salvaje`}
        subtitle={`${wild.isBoss?"JEFE · ":""}Nv. ${wild.level}`}
        isLocal={false}
        y={2.25 * species.scale}
        scale={Math.max(1, species.scale * 0.95) * 0.8}
      />
      <mesh ref={castRing} rotation-x={-Math.PI/2} position-y={0.06} visible={false}>
        <circleGeometry args={[7,48]} />
        <meshBasicMaterial color="#b466ef" transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <Billboard position={[0, 1.95 * species.scale, 0]}>
        <mesh><planeGeometry args={[1.28, 0.13]} /><meshBasicMaterial color="#13222c" depthTest={false} /></mesh>
        <mesh ref={health} position-z={0.01}><planeGeometry args={[1.2, 0.07]} /><meshBasicMaterial color="#ff936e" depthTest={false} toneMapped={false} /></mesh>
      </Billboard>
    </group>
  );
}

export function Wilds({ client }: { client: WorldClient }) {
  const [, bump] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    return client.subscribeWilds(() => bump());
  }, [client]);

  return (
    <>
      {Array.from(client.wilds.values()).map((wild) => (
        <WildEntity key={wild.id} client={client} wild={wild} />
      ))}
    </>
  );
}
