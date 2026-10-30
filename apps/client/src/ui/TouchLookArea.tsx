import { useEffect, useRef } from "react";

import type { WorldClient } from "../net/world-client";

/**
 * Zona táctil dedicada para mirar. Está por encima del canvas pero por debajo
 * del HUD, así que no compite con el joystick ni con los botones.
 */
export function TouchLookArea({ client }: { client: WorldClient }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const area = areaRef.current;
    if (!area) {
      return;
    }

    const reset = () => {
      const id = pointerId.current;
      pointerId.current = null;
      if (id !== null && area.hasPointerCapture(id)) area.releasePointerCapture(id);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || client.inputBlocked) {
        return;
      }
      if (pointerId.current !== null) {
        return;
      }

      pointerId.current = event.pointerId;
      last.current = { x: event.clientX, y: event.clientY };
      try {
        area.setPointerCapture(event.pointerId);
      } catch {
        // Captura no disponible.
      }
      event.preventDefault();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId.current) {
        return;
      }
      client.addLook(
        event.clientX - last.current.x,
        event.clientY - last.current.y,
      );
      last.current = { x: event.clientX, y: event.clientY };
      event.preventDefault();
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId === pointerId.current) {
        reset();
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        reset();
      }
    };

    area.addEventListener("pointerdown", handlePointerDown, { passive: false });
    const unsubscribe = client.subscribeInputReset(reset);
    area.addEventListener("pointermove", handlePointerMove, { passive: false });
    area.addEventListener("pointerup", handlePointerEnd);
    area.addEventListener("pointercancel", handlePointerEnd);
    area.addEventListener("lostpointercapture", handlePointerEnd);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", handleVisibility);
    area.addEventListener("contextmenu", preventDefault);

    return () => {
      unsubscribe();
      reset();
      area.removeEventListener("pointerdown", handlePointerDown);
      area.removeEventListener("pointermove", handlePointerMove);
      area.removeEventListener("pointerup", handlePointerEnd);
      area.removeEventListener("pointercancel", handlePointerEnd);
      area.removeEventListener("lostpointercapture", handlePointerEnd);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", handleVisibility);
      area.removeEventListener("contextmenu", preventDefault);
      pointerId.current = null;
    };
  }, [client]);

  return <div ref={areaRef} className="touch-look-area" aria-hidden="true" />;
}

function preventDefault(event: Event): void {
  event.preventDefault();
}
