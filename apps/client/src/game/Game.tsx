import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect } from "react";

import { getZone } from "@digiworld/content";

import type { WorldClient } from "../net/world-client";
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
import { Wilds } from "./Wilds";
import { DigitalRuins } from "./DigitalRuins";
import { CombatEffects } from "./CombatEffects";

const ZONE = getZone("bosque-digital");

const MOVEMENT_KEYS = [
  "w",
  "a",
  "s",
  "d",
  "q",
  "e",
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
      <Environment resolution={64} frames={1} environmentIntensity={0.18}>
        <Lightformer
          form="rect"
          color="#e8f5ff"
          intensity={1.3}
          scale={[24, 24, 1]}
          position={[0, 10, -12]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          color="#9bc5a7"
          intensity={0.7}
          scale={[24, 24, 1]}
          position={[0, -7, 0]}
          target={[0, 0, 0]}
        />
      </Environment>

      <group userData={{ cameraSolid: true }}>
      <Terrain />
      <Forest />
      <Hills />
      <DigitalRuins />
      </group>
      <Meadow />
      <Players client={client} />
      <Wilds client={client} />
      <CombatEffects client={client} />
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
    const stopControls = client.startControls();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (client.inputBlocked || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = /^Key[A-Z]$/.test(event.code) ? event.code.slice(3).toLowerCase() : event.key.toLowerCase();
      if(key==="r"&&!event.repeat){event.preventDefault();client.recallCompanion();return;}
      if (key === "escape") {
        client.cancelApproach();
        client.clearTarget();
        return;
      }
      if (event.repeat && ["1", "2", "3", "tab"].includes(key)) return;
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
      if (MOVEMENT_KEYS.includes(key)) {
        client.setKey(key, true, event.repeat);
        event.preventDefault();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = /^Key[A-Z]$/.test(event.code) ? event.code.slice(3).toLowerCase() : event.key.toLowerCase();
      client.setKey(key, false);
    };

    const handleBlur = () => {
      client.resetControls();
    };
    const handleVisibility = () => { if (document.hidden) handleBlur(); };
    const handleFocus = (event: FocusEvent) => {
      if ((event.target as HTMLElement)?.matches('input, textarea, select, [contenteditable="true"]')) handleBlur();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("pagehide", handleBlur);
    window.addEventListener("orientationchange", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("focusin", handleFocus);

    return () => {
      stopControls();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pagehide", handleBlur);
      window.removeEventListener("orientationchange", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("focusin", handleFocus);
      handleBlur();
    };
  }, [client]);

  return (
    <div className="game-root">
      <Canvas
        shadows
        dpr={[1, 1.8]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 3, -6], fov: 65, near: 0.1, far: 600 }}
      >
        <Simulation client={client} />
        <Scene client={client} />
      </Canvas>
      <Hud client={client} onExit={onExit} />
    </div>
  );
}
