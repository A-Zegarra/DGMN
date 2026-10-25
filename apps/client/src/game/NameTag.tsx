import { useEffect, useMemo } from "react";
import * as THREE from "three";

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function createNameTexture(
  name: string,
  level: number,
  isLocal: boolean,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No se pudo crear el contexto 2D para la etiqueta");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  roundRect(context, 10, 10, 492, 108, 54);
  context.fillStyle = isLocal
    ? "rgba(4, 28, 18, 0.94)"
    : "rgba(4, 14, 9, 0.82)";
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = isLocal
    ? "rgba(124, 255, 178, 0.95)"
    : "rgba(230, 255, 240, 0.28)";
  context.stroke();

  context.textAlign = "center";
  context.textBaseline = "middle";

  context.font =
    "700 42px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
  context.fillStyle = "#f2fff8";
  context.fillText(name.slice(0, 16), 256, 52);

  context.font =
    "700 30px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
  context.fillStyle = "#8bffbf";
  context.fillText(`Nv. ${level}`, 256, 94);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function NameTag({
  name,
  level,
  isLocal,
  y,
  scale,
}: {
  name: string;
  level: number;
  isLocal: boolean;
  y: number;
  scale: number;
}) {
  const texture = useMemo(
    () => createNameTexture(name, level, isLocal),
    [name, level, isLocal],
  );

  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  return (
    <sprite position={[0, y, 0]} scale={[2.7 * scale, 0.675 * scale, 1]} renderOrder={20}>
      <spriteMaterial
        map={texture}
        transparent
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </sprite>
  );
}
