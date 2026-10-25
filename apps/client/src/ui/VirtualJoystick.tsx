import { useRef, useState } from "react";

import type { WorldClient } from "../net/world-client";

const BASE_SIZE = 118;
const KNOB_SIZE = 52;
const RADIUS = (BASE_SIZE - KNOB_SIZE) / 2;

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
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);

    if (distance > RADIUS) {
      dx = (dx / distance) * RADIUS;
      dy = (dy / distance) * RADIUS;
    }

    setKnob({ x: dx, y: dy });
    client.setTouchMove(dx / RADIUS, -dy / RADIUS);
  };

  const reset = () => {
    pointerId.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    client.setTouchMove(0, 0);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    pointerId.current = event.pointerId;
    setActive(true);
    baseRef.current?.setPointerCapture(event.pointerId);
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
