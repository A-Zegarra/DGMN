import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect } from "react";

import { getZone } from "@digiworld/content";

import type { WorldClient } from "../net/world-client";
import { Hud } from "../ui/Hud";
import { CameraRig } from "./CameraRig";
import { Forest } from "./Forest";
import { Players } from "./Players";
import { Terrain } from "./Terrain";

const ZONE = getZone("bosque-digital");

const MOVEMENT_KEYS = [
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "shift",
];

function Simulation({ client }: { client: WorldClient }) {
  useFrame(() => {
    client.update();
  }, -100);
  return null;
}

function Scene({ client }: { client: WorldClient }) {
  return (
    <>
      <color attach="background" args={[ZONE.groundColor]} />
      <fog attach="fog" args={[ZONE.fogColor, 52, 118]} />

      <ambientLight intensity={1.15} />
      <hemisphereLight args={["#e8fff2", "#24402f", 0.7]} />
      <directionalLight position={[18, 30, 12]} intensity={2.1} />

      <Terrain onPick={(x, z) => client.setMoveTarget(x, z)} />
      <Forest />
      <Players client={client} />
      <CameraRig client={client} />
    </>
  );
}

export function Game({
  client,
  onExit,
}: {
  client: WorldClient;
  onExit: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (MOVEMENT_KEYS.includes(key)) {
        client.setKey(key, true);
        event.preventDefault();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      client.setKey(event.key.toLowerCase(), false);
    };

    const handleBlur = () => client.clearKeys();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [client]);

  return (
    <div className="game-root">
      <Canvas
        flat
        dpr={[1, 1.8]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [20, 24, 20], fov: 30, near: 0.1, far: 240 }}
      >
        <Simulation client={client} />
        <Scene client={client} />
      </Canvas>
      <Hud client={client} onExit={onExit} />
    </div>
  );
}
