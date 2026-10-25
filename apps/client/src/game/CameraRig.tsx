import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import type { CameraMode, WorldClient } from "../net/world-client";

const LOOK_TARGET = new THREE.Vector3();
const DESIRED_POSITION = new THREE.Vector3();

const EYE_HEIGHT = 1.62;
const FP_FOV = 72;
const TP_FOV = 58;
const TP_DISTANCE = 5.6;
const TP_BASE_HEIGHT = 2.1;
const TP_LOOK_HEIGHT = 1.35;

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
      initialized.current = false;
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = mode === "first-person" ? FP_FOV : TP_FOV;
        camera.updateProjectionMatrix();
      }
    }

    if (mode === "first-person") {
      bobTime.current += Math.min(delta, 0.1);
      const bob = local.moving
        ? Math.sin(bobTime.current * (local.running ? 15 : 10)) * 0.025
        : 0;

      camera.position.set(local.x, EYE_HEIGHT + bob, local.z);
      camera.rotation.set(client.pitch, client.yaw + Math.PI, 0, "YXZ");
      initialized.current = false;
      return;
    }

    const horizontal = Math.cos(client.pitch) * TP_DISTANCE;
    LOOK_TARGET.set(local.x, TP_LOOK_HEIGHT, local.z);
    DESIRED_POSITION.set(
      local.x - Math.sin(client.yaw) * horizontal,
      Math.max(0.8, TP_BASE_HEIGHT + Math.sin(client.pitch) * TP_DISTANCE),
      local.z - Math.cos(client.yaw) * horizontal,
    );

    if (!initialized.current) {
      camera.position.copy(DESIRED_POSITION);
      initialized.current = true;
    } else {
      const smoothing = 1 - Math.exp(-6 * Math.min(delta, 0.1));
      camera.position.lerp(DESIRED_POSITION, smoothing);
    }

    camera.lookAt(LOOK_TARGET);
  });

  return null;
}
