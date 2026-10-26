import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect } from "react";

import { getZone } from "@digiworld/content";

import type { WorldClient } from "../net/world-client";
import { exitPointerLockSafe, requestPointerLockSafe } from "../pointer-lock";
import { Hud } from "../ui/Hud";
import { CameraRig } from "./CameraRig";
import { Forest } from "./Forest";
import { Hills } from "./Hills";
import { Meadow } from "./Meadow";
import { MouseLookControls } from "./MouseLookControls";
import { Players } from "./Players";
import { SkyDome } from "./SkyDome";
import { SunLight } from "./SunLight";
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
      <fog attach="fog" args={["#b7d3bf", 60, 220]} />
      <SkyDome />

      <ambientLight intensity={0.75} />
      <hemisphereLight args={["#d7ecff", "#2d4a33", 0.65]} />
      <SunLight client={client} />

      <Terrain />
      <Meadow />
      <Forest />
      <Hills />
      <Players client={client} />
      <CameraRig client={client} />
      <MouseLookControls client={client} />
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
      if (key === "tab") {
        event.preventDefault();
        client.cycleTarget();
        return;
      }
      if (key === "1" || key === "2" || key === "3") {
        const ability = client.getAbilities()[Number(key) - 1];
        if (ability) {
          event.preventDefault();
          client.useAbility(ability.id);
        }
        return;
      }
      if (key === "v") {
        event.preventDefault();
        const nextMode = client.toggleCameraMode();
        if (nextMode === "first-person") {
          requestPointerLockSafe();
        } else {
          exitPointerLockSafe();
        }
        return;
      }
      if (MOVEMENT_KEYS.includes(key)) {
        client.setKey(key, true);
        event.preventDefault();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      client.setKey(event.key.toLowerCase(), false);
    };

    const handleBlur = () => {
      client.clearKeys();
      client.setTouchMove(0, 0);
    };

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
        shadows
        dpr={[1, 1.8]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 3, -5], fov: 55, near: 0.1, far: 600 }}
      >
        <Simulation client={client} />
        <Scene client={client} />
      </Canvas>
      <Hud client={client} onExit={onExit} />
    </div>
  );
}
