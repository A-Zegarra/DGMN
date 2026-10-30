import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { CombatEffect, WorldClient } from "../net/world-client";

const numberTextureCache = new Map<string, THREE.CanvasTexture>();

function getNumberTexture(text: string, color: string): THREE.CanvasTexture {
  const key = `${text}:${color}`;
  const cached = numberTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.font = "900 40px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#111827";
    ctx.strokeText(text, 80, 34);
    ctx.fillStyle = color;
    ctx.fillText(text, 80, 34);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  numberTextureCache.set(key, texture);
  return texture;
}

function Impact({ effect }: { effect: CombatEffect }) {
  const root = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const projectile = useRef<THREE.Mesh>(null);
  const color = effect.style === "evolution" ? "#fff397" : effect.style === "fire" ? "#ff9c49" : effect.style === "ice" || effect.style === "energy" ? "#7addff" : effect.heal ? "#77ffba" : "#ffd18a";
  const label = effect.style === "evolution" ? "¡Digievolución!" : effect.style === "defeat" ? "KO" : effect.style === "level" ? "¡Nv.!" : `${effect.heal ? "+" : "−"}${Math.round(effect.amount)}${effect.style === "energy" ? " EP" : ""}`;
  const texture = useMemo(() => getNumberTexture(label, color), [label, color]);
  const sparks = useRef<THREE.InstancedMesh>(null);
  const sparkTransform = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const age = (performance.now() - effect.at) / 1000;
    if (root.current) root.current.position.y = 2.1 + age * 1.3;
    if (ring.current) {
      ring.current.scale.setScalar(0.5 + age * 2);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        1 - age * 2,
      );
    }
    if (projectile.current) {
      const t = Math.min(1, age / 0.18);
      projectile.current.position.set(
        THREE.MathUtils.lerp(effect.fromX, effect.x, t),
        1,
        THREE.MathUtils.lerp(effect.fromZ, effect.z, t),
      );
      projectile.current.visible = t < 1 && !effect.heal && effect.style !== "defeat";
    }
    if (sparks.current) {
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        sparkTransform.position.set(Math.cos(angle) * age * 1.5, 0.7 + Math.sin(age * Math.PI) * 0.7, Math.sin(angle) * age * 1.5);
        sparkTransform.scale.setScalar(Math.max(0, 1 - age));
        sparkTransform.updateMatrix();
        sparks.current.setMatrixAt(i, sparkTransform.matrix);
      }
      sparks.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <mesh ref={projectile}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh
        ref={ring}
        position={[effect.x, 0.12, effect.z]}
        rotation-x={-Math.PI / 2}
      >
        <ringGeometry args={[0.5, 0.65, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <group ref={root} position={[effect.x, 2.1, effect.z]}>
        <Billboard>
          <mesh>
            <planeGeometry args={[1.25, 0.5]} />
            <meshBasicMaterial
              map={texture}
              transparent
              depthWrite={false}
              depthTest={false}
              toneMapped={false}
            />
          </mesh>
        </Billboard>
      </group>
      <instancedMesh ref={sparks} args={[undefined, undefined, 8]} position={[effect.x, 0, effect.z]} frustumCulled={false}>
        <octahedronGeometry args={[effect.style === "fire" ? 0.13 : 0.08]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

export function CombatEffects({ client }: { client: WorldClient }) {
  const [effects, setEffects] = useState<CombatEffect[]>([]);
  const signature = useRef("");
  useFrame(() => {
    const next = client.effects.map((effect) => effect.id).join(",");
    if (next !== signature.current) {
      signature.current = next;
      setEffects([...client.effects]);
    }
  });
  return (
    <>
      {effects.map((effect) => (
        <Impact key={effect.id} effect={effect} />
      ))}
    </>
  );
}
