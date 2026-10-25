import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

import type { WorldClient } from "../net/world-client";

export function FirstPersonControls({ client }: { client: WorldClient }) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;

    const handleClick = () => {
      if (client.cameraMode !== "first-person") {
        return;
      }
      if (document.pointerLockElement !== canvas) {
        const request = canvas.requestPointerLock();
        if (request && typeof request.catch === "function") {
          request.catch(() => {
            // El navegador puede bloquear el puntero; el arrastre táctil sigue disponible.
          });
        }
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (
        document.pointerLockElement === canvas &&
        client.cameraMode === "first-person"
      ) {
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

  useEffect(() => {
    const canvas = gl.domElement;
    let movePointer: number | null = null;
    let lookPointer: number | null = null;
    let moveOrigin = { x: 0, y: 0 };
    let lookLast = { x: 0, y: 0 };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || client.cameraMode !== "first-person") {
        return;
      }

      if (event.clientX < window.innerWidth * 0.45 && movePointer === null) {
        movePointer = event.pointerId;
        moveOrigin = { x: event.clientX, y: event.clientY };
        client.setTouchMove(0, 0);
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          // Captura no disponible.
        }
      } else if (lookPointer === null) {
        lookPointer = event.pointerId;
        lookLast = { x: event.clientX, y: event.clientY };
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          // Captura no disponible.
        }
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId === movePointer) {
        const x = (event.clientX - moveOrigin.x) / 55;
        const y = (event.clientY - moveOrigin.y) / 55;
        client.setTouchMove(x, -y);
      } else if (event.pointerId === lookPointer) {
        client.addLook(event.clientX - lookLast.x, event.clientY - lookLast.y);
        lookLast = { x: event.clientX, y: event.clientY };
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId === movePointer) {
        movePointer = null;
        client.setTouchMove(0, 0);
      }
      if (event.pointerId === lookPointer) {
        lookPointer = null;
      }
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      client.setTouchMove(0, 0);
    };
  }, [client, gl]);

  return null;
}
