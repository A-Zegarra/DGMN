import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import type { WorldClient } from "../net/world-client";

const CAMERA_OFFSET = new THREE.Vector3(20, 24, 20);
const LOOK_TARGET = new THREE.Vector3();
const DESIRED_POSITION = new THREE.Vector3();

export function CameraRig({ client }: { client: WorldClient }) {
  const { camera } = useThree();
  const initialized = useRef(false);

  useFrame((_, delta) => {
    const local = client.players.get(client.localId);
    if (!local) {
      return;
    }

    LOOK_TARGET.set(local.x, 0.9, local.z);
    DESIRED_POSITION.copy(LOOK_TARGET).add(CAMERA_OFFSET);

    if (!initialized.current) {
      camera.position.copy(DESIRED_POSITION);
      initialized.current = true;
    } else {
      const smoothing = 1 - Math.exp(-8 * Math.min(delta, 0.1));
      camera.position.lerp(DESIRED_POSITION, smoothing);
    }

    camera.lookAt(LOOK_TARGET);
  });

  return null;
}
