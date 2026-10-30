import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { WorldClient } from "../net/world-client";
import { exitPointerLockSafe, requestPointerLockSafe } from "../pointer-lock";

export function MouseLookControls({ client }: { client: WorldClient }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const reset = () => { client.releaseMouse(); canvas.style.cursor = ""; };
    const down = (event: MouseEvent) => {
      const touchMouse = (event as MouseEvent & {sourceCapabilities?: {firesTouchEvents: boolean}}).sourceCapabilities?.firesTouchEvents;
      if (touchMouse || client.inputBlocked) return;
      if (event.button !== 0 && event.button !== 2) return;
      if (event.button === 0) client.mouseLeft = true;
      if (event.button === 2) client.mouseRight = true;
      client.refreshInput();
      client.lastCameraInputAt = performance.now();
      canvas.style.cursor = "grabbing";
      if (client.cameraMode === "first-person") requestPointerLockSafe();
    };
    const up = (event: MouseEvent) => {
      if (event.button === 0) client.mouseLeft = false;
      if (event.button === 2) client.mouseRight = false;
      client.refreshInput();
      if (!client.mouseLeft && !client.mouseRight) canvas.style.cursor = "";
    };
    const move = (event: MouseEvent) => {
      if (client.inputBlocked) { reset(); return; }
      // Si el ratón se soltó fuera de la ventana, no conservar botones fantasma.
      if (!(event.buttons & 1)) client.mouseLeft = false;
      if (!(event.buttons & 2)) client.mouseRight = false;
      if (document.pointerLockElement === canvas && client.cameraMode === "first-person") {
        client.addLook(event.movementX, event.movementY);
      } else if (client.mouseLeft || client.mouseRight) {
        client.addLook(event.movementX, event.movementY);
      }
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
      client.zoomCamera(Math.max(-300, Math.min(300, event.deltaY * units)));
    };
    const prevent = (event: Event) => event.preventDefault();
    const blur = () => { reset(); exitPointerLockSafe(); };
    const visibility = () => { if (document.hidden) blur(); };
    const lock = () => { if (!document.pointerLockElement) reset(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") blur(); };
    const unsubscribe = client.subscribeInputReset(reset);
    canvas.addEventListener("mousedown", down);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("contextmenu", prevent);
    window.addEventListener("mouseup", up);
    window.addEventListener("mousemove", move);
    window.addEventListener("blur", blur);
    window.addEventListener("keydown", key);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("pointerlockchange", lock);
    return () => {
      blur();
      unsubscribe();
      canvas.removeEventListener("mousedown", down);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("contextmenu", prevent);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("blur", blur);
      window.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pointerlockchange", lock);
    };
  }, [client, gl]);
  return null;
}
