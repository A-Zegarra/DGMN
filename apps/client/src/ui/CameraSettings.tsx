import { useEffect, useReducer, useState } from "react";
import type { WorldClient } from "../net/world-client";
import { CAMERA_DEFAULTS, type CameraSettings as Settings } from "../game/camera-settings";
import { exitPointerLockSafe } from "../pointer-lock";
import { createPortal } from "react-dom";
import { useGameInputBlock } from "./use-game-input-block";

const sliders = [
  ["sensitivityX", "Sensibilidad horizontal", 0.0005, 0.01, 0.0001],
  ["sensitivityY", "Sensibilidad vertical", 0.0005, 0.01, 0.0001],
  ["distance", "Distancia preferida (m)", 1.5, 40, 0.5],
  ["maxDistance", "Distancia máxima (m)", 6, 40, 1],
  ["zoomSpeed", "Velocidad del zoom", 0.2, 3, 0.1],
  ["fov", "Campo de visión (°)", 40, 90, 1],
  ["focusRatio", "Altura de enfoque (proporción)", 0.3, 0.9, 0.05],
  ["initialPitch", "Inclinación elevada DS (°)", 20, 65, 1],
] as const;

export function CameraSettings({ client }: { client: WorldClient }) {
  const [open, setOpen] = useState(false);
  useGameInputBlock(client, open);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => client.subscribeRoster(bump), [client]);
  const settings = client.cameraSettings;
  const update = (patch: Partial<Settings>) => client.updateCameraSettings(patch);
  return <>
    <button type="button" className="camera-button" onClick={() => {
      client.releaseMouse(); client.clearKeys(); client.cancelApproach();
      exitPointerLockSafe(); setOpen(!open);
    }}>Ajustes cámara</button>
    {open && createPortal(<div className="evolution-overlay"><section className="camera-settings panel" role="dialog" aria-modal="true" aria-label="Ajustes de cámara"
      onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") setOpen(false); }}>
      <header><strong>Cámara MMORPG</strong><button type="button" autoFocus onClick={() => setOpen(false)} aria-label="Cerrar ajustes">×</button></header>
      <label>Modo de cámara<select value={settings.mode} onChange={e => update({mode: e.target.value as Settings["mode"]})}>
        <option value="classic">Clásico · orientación libre</option>
        <option value="follow">Seguimiento</option>
        <option value="combat">Combate · perspectiva elevada</option>
      </select></label>
      {sliders.map(([key, label, min, max, step]) => <label key={key}>
        <span>{label} <output>{settings[key]}</output></span>
        <input aria-label={label} type="range" min={min} max={key === "distance" ? settings.maxDistance : max} step={step}
          value={settings[key]} onChange={e => update({[key]: Number(e.target.value)})} />
      </label>)}
      {([["invertY", "Invertir eje vertical"], ["follow", "Volver detrás al moverse (seguimiento/combate)"],
        ["targetLock", "Orientar hacia el objetivo en modo combate"]] as const).map(([key, label]) =>
        <label className="camera-check" key={key}><input type="checkbox" checked={settings[key]} onChange={e => update({[key]: e.target.checked})} />{label}</label>)}
      <p>Izquierdo: orbitar · Derecho: orientar · Ambos: avanzar · Rueda: zoom.<br />W/S: avanzar/retroceder · A/D: girar · Q/E: lateral. Derecho + A/D: lateral.</p>
      <button type="button" onClick={() => { update(CAMERA_DEFAULTS); client.pitch = (CAMERA_DEFAULTS.initialPitch * Math.PI) / 180; }}>Restablecer vista DS (38°)</button>
    </section></div>, document.body)}
  </>;
}
