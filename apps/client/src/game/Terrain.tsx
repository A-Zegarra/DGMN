import { useEffect, useMemo } from "react";
import * as THREE from "three";

function createGrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No se pudo crear la textura de césped");
  }

  context.fillStyle = "#4d8054";
  context.fillRect(0, 0, 256, 256);

  for (let index = 0; index < 2600; index += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const length = 2 + Math.random() * 7;
    const shade = Math.random();
    context.strokeStyle =
      shade < 0.34
        ? "rgba(30, 70, 38, 0.28)"
        : shade < 0.68
          ? "rgba(110, 150, 95, 0.25)"
          : "rgba(68, 110, 62, 0.3)";
    context.lineWidth = 0.7 + Math.random();
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + (Math.random() - 0.5) * 2, y - length);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(40, 40);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createDirtTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No se pudo crear la textura de tierra");
  }

  context.fillStyle = "#a9895f";
  context.fillRect(0, 0, 256, 256);

  for (let index = 0; index < 1400; index += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const radius = 0.7 + Math.random() * 2.4;
    context.fillStyle =
      Math.random() < 0.5
        ? "rgba(88, 65, 42, 0.22)"
        : "rgba(202, 174, 128, 0.22)";
    context.beginPath();
    context.ellipse(x, y, radius, radius * 0.55, 0, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createGroundGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(400, 400, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function Terrain() {
  const geometry = useMemo(createGroundGeometry, []);
  const grassTexture = useMemo(createGrassTexture, []);
  const dirtTexture = useMemo(createDirtTexture, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      grassTexture.dispose();
      dirtTexture.dispose();
    };
  }, [geometry, grassTexture, dirtTexture]);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial map={grassTexture} roughness={1} metalness={0} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position-y={0.02} receiveShadow>
        <planeGeometry args={[6, 112]} />
        <meshStandardMaterial map={dirtTexture} roughness={1} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position-y={0.025} receiveShadow>
        <planeGeometry args={[112, 6]} />
        <meshStandardMaterial map={dirtTexture} roughness={1} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position-y={0.035} receiveShadow>
        <circleGeometry args={[9.2, 48]} />
        <meshStandardMaterial map={dirtTexture} roughness={1} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position-y={0.045} receiveShadow>
        <ringGeometry args={[9.2, 9.7, 48]} />
        <meshStandardMaterial color="#7a5c3b" roughness={1} />
      </mesh>
    </group>
  );
}
