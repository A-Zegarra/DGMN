import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

import type { WorldClient } from "../net/world-client";

export function MouseLookControls({ client }: { client: WorldClient }) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;

    const handleClick = () => {
      if (document.pointerLockElement !== canvas) {
        const request = canvas.requestPointerLock();
        if (request && typeof request.catch === "function") {
          request.catch(() => {
            // El navegador puede bloquear el puntero.
          });
        }
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        client.addLook(event.movementX, event.movementY);
      }
    };

    canvas.addEventListener("click", handleClick);
    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      canvas.removeEventListener("click", handleClick);
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [client, gl]);

  return null;
}
