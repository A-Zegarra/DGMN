import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { WorldClient } from "../net/world-client";

export function SunLight({ client }: { client: WorldClient }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const local = client.players.get(client.localId);
    const sun = light.current;
    if (!local || !sun) {
      return;
    }

    sun.position.set(local.x + 18, 28, local.z + 14);
    target.position.set(local.x, 0, local.z);
    target.updateMatrixWorld();
  });

  return (
    <>
      <directionalLight
        ref={light}
        castShadow
        target={target}
        color="#fff1d2"
        intensity={2.6}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
      />
      <primitive object={target} />
    </>
  );
}
