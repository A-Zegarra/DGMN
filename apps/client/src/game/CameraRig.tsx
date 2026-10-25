import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import type { CameraMode, WorldClient } from "../net/world-client";

const ISO_OFFSET = new THREE.Vector3(14, 25, 14);
const LOOK_TARGET = new THREE.Vector3();
const DESIRED_POSITION = new THREE.Vector3();

const EYE_HEIGHT = 1.62;
const FP_FOV = 72;
const ISO_FOV = 34;

export function CameraRig({ client }: { client: WorldClient }) {
  const { camera } = useThree();
  const initialized = useRef(false);
  const lastMode = useRef<CameraMode | null>(null);
  const bobTime = useRef(0);

  useFrame((_, delta) => {
    const local = client.players.get(client.localId);
    if (!local) {
      return;
    }

    const mode = client.cameraMode;
    if (mode !== lastMode.current) {
      lastMode.current = mode;
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = mode === "first-person" ? FP_FOV : ISO_FOV;
        camera.updateProjectionMatrix();
      }
    }

    if (mode === "first-person") {
      bobTime.current += Math.min(delta, 0.1);
      const bob = local.moving
        ? Math.sin(bobTime.current * (local.running ? 15 : 10)) * 0.025
        : 0;

      camera.position.set(local.x, EYE_HEIGHT + bob, local.z);
      camera.rotation.set(
        client.pitch,
        client.yaw + Math.PI,
        0,
        "YXZ",
      );
      initialized.current = false;
      return;
    }

    LOOK_TARGET.set(local.x, 0.9, local.z);
    DESIRED_POSITION.copy(LOOK_TARGET).add(ISO_OFFSET);

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
