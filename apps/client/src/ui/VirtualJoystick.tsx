import { useCallback, useEffect, useRef, useState } from "react";

import type { WorldClient } from "../net/world-client";

export function VirtualJoystick({ client }: { client: WorldClient }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const updateFromPointer = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) {
      return;
    }

    const rect = base.getBoundingClientRect();
    const radius = Math.max(1, (rect.width - 48) / 2);
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);

    if (distance > radius) {
      dx = (dx / distance) * radius;
      dy = (dy / distance) * radius;
    }

    setKnob({ x: dx, y: dy });
    // Zona muerta: apoyar el dedo no debe producir deriva.
    const strength = Math.min(1, Math.max(0, (distance / radius - 0.12) / 0.88));
    client.setTouchMove(distance ? dx / Math.min(distance, radius) * strength : 0,
      distance ? -dy / Math.min(distance, radius) * strength : 0);
  };

  const reset = useCallback(() => {
    const id = pointerId.current;
    pointerId.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    client.setTouchMove(0, 0);
    if (id !== null && baseRef.current?.hasPointerCapture(id)) baseRef.current.releasePointerCapture(id);
  }, [client]);

  useEffect(() => {
    const end = (event: PointerEvent) => { if (event.pointerId === pointerId.current) reset(); };
    const unsubscribe = client.subscribeInputReset(reset);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      unsubscribe();
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      reset();
    };
  }, [client, reset]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (client.inputBlocked || pointerId.current !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointerId.current = event.pointerId;
    setActive(true);
    try {
      baseRef.current?.setPointerCapture(event.pointerId);
    } catch {
      // Algunos navegadores no permiten capturar este puntero.
    }
    updateFromPointer(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerId.current) {
      return;
    }
    event.preventDefault();
    updateFromPointer(event.clientX, event.clientY);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerId.current) {
      return;
    }
    reset();
  };

  return (
    <div
      ref={baseRef}
      className={`virtual-joystick ${active ? "is-active" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onContextMenu={(event) => event.preventDefault()}
      role="presentation"
    >
      <span className="virtual-joystick-ring" aria-hidden="true" />
      <span
        className="virtual-joystick-knob"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        aria-hidden="true"
      />
      <span className="virtual-joystick-label">MOVER</span>
    </div>
  );
}
