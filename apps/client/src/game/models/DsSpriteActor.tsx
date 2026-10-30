import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { REAL_DS_SPRITES } from "./real-ds-sprites";
import type { CombatVisual } from "../../net/world-client";

const COLUMNS = 8;
const ROWS = 5;
const CELL_PX = 48;

export type DsActorKind = "tamer" | "digimon";

const sheetCache = new Map<string, HTMLCanvasElement>();
const sheetTextures = new Map<string, Set<THREE.CanvasTexture>>();
const customSheetAttempted = new Set<string>();

function shadeHex(hex: string, factor: number): string {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  const r = Math.max(0, Math.min(255, Math.round(((num >> 16) & 255) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((num >> 8) & 255) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((num & 255) * factor)));
  return `rgb(${r},${g},${b})`;
}

function fillOval(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  shadowColor?: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
  ctx.fill();

  if (shadowColor) {
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy + ry * 0.22,
      Math.max(1, rx * 0.88),
      Math.max(1, ry * 0.7),
      0,
      0.15 * Math.PI,
      0.85 * Math.PI,
    );
    ctx.fill();
  }
}

function drawOrganicFrame(
  ctx: CanvasRenderingContext2D,
  kind: DsActorKind,
  speciesId: string,
  primaryColor: string,
  accentColor: string,
  dir: number,
  row: number,
) {
  const ox = dir * CELL_PX;
  const oy = row * CELL_PX;
  const cx = ox + CELL_PX / 2;

  // dir: 0=Sur(Frente), 1=SO, 2=Oeste, 3=NO, 4=Norte(Espalda), 5=NE, 6=Este, 7=SE
  const isBack = dir === 3 || dir === 4 || dir === 5;
  const sideSign =
    dir === 1 || dir === 2 || dir === 3
      ? -1
      : dir === 5 || dir === 6 || dir === 7
        ? 1
        : 0;

  const walkCycle =
    row === 0 ? 0 : row === 1 ? -1 : row === 2 ? 0 : row === 3 ? 1 : 0;
  const bob = row === 0 ? 0 : row % 2 === 1 ? -1.5 : 0;
  const leftStep = walkCycle * 2.5;
  const rightStep = -walkCycle * 2.5;

  const dark = shadeHex(primaryColor, 0.72);
  const light = shadeHex(primaryColor, 1.2);

  if (kind === "tamer") {
    const skin = "#f5c69d";
    const skinShadow = "#d9a176";
    const pants = "#28364a";
    const hair = "#1e2638";

    // Mochila en espalda o perfil
    if (isBack || sideSign !== 0) {
      fillOval(ctx, cx - sideSign * 4, oy + 25 + bob, 6, 6, accentColor, shadeHex(accentColor, 0.75));
    }

    // Piernas y botas estilo DS
    fillOval(ctx, cx - 4, oy + 35 + leftStep, 3.2, 5.5, pants);
    fillOval(ctx, cx + 4, oy + 35 + rightStep, 3.2, 5.5, pants);
    fillOval(ctx, cx - 4, oy + 41 + leftStep, 4.2, 2.6, "#e2e8f0", primaryColor);
    fillOval(ctx, cx + 4, oy + 41 + rightStep, 4.2, 2.6, "#e2e8f0", primaryColor);

    // Torso (chaqueta de domador)
    fillOval(ctx, cx, oy + 26 + bob, 7.5, 7.5, primaryColor, dark);
    if (!isBack) {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(Math.round(cx - 1.5 + sideSign), Math.round(oy + 20 + bob), 3, 11);
      // Digivice en el cinturón
      fillOval(ctx, cx - 4 + sideSign, oy + 31 + bob, 2.6, 2.4, "#38bdf8");
    }

    // Brazos y guantes
    fillOval(ctx, cx - 8, oy + 25 + bob + rightStep, 2.8, 5.2, primaryColor, dark);
    fillOval(ctx, cx + 8, oy + 25 + bob + leftStep, 2.8, 5.2, primaryColor, dark);
    fillOval(ctx, cx - 8, oy + 30 + bob + rightStep, 2.5, 2.2, "#f8fafc");
    fillOval(ctx, cx + 8, oy + 30 + bob + leftStep, 2.5, 2.2, "#f8fafc");

    // Cabeza chibi estilo Nintendo DS
    fillOval(ctx, cx, oy + 14 + bob, 9.2, 8.2, skin, skinShadow);
    // Pelo en picos
    fillOval(ctx, cx, oy + 10 + bob, 10, 5.5, hair);
    if (isBack) {
      fillOval(ctx, cx, oy + 14 + bob, 9.5, 7.2, hair);
    }

    // Gorra + Goggles clásicos de Domador Digimon DS
    fillOval(ctx, cx, oy + 8 + bob, 9.5, 4.8, primaryColor, dark);
    if (!isBack) {
      fillOval(ctx, cx + sideSign * 2.5, oy + 10.5 + bob, 8.5, 2.2, dark);
    }
    // Lentes de las gafas (Goggles)
    fillOval(ctx, cx - 4 + sideSign * 1.5, oy + 8.5 + bob, 3.2, 2.4, "#38bdf8", "#0284c7");
    fillOval(ctx, cx + 4 + sideSign * 1.5, oy + 8.5 + bob, 3.2, 2.4, "#38bdf8", "#0284c7");

    // Ojos anime estilo DS
    if (!isBack) {
      const ex = sideSign * 2.2;
      if (dir !== 2) {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(Math.round(cx - 5 + ex), Math.round(oy + 13 + bob), 3, 4);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(Math.round(cx - 5 + ex), Math.round(oy + 13 + bob), 1, 2);
      }
      if (dir !== 6) {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(Math.round(cx + 2 + ex), Math.round(oy + 13 + bob), 3, 4);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(Math.round(cx + 2 + ex), Math.round(oy + 13 + bob), 1, 2);
      }
    }
    return;
  }

  // Respaldos provisionales dibujados por código; no son hojas originales de DS.
  if (speciesId === "koromon") {
    const hop = row === 0 ? 0 : row % 2 ? -3 : 0;
    fillOval(ctx, cx - 8, oy + 12 + hop, 2.8, 10, "#fb9db8", "#d85c87");
    fillOval(ctx, cx + 8, oy + 12 + hop, 2.8, 10, "#fb9db8", "#d85c87");
    fillOval(ctx, cx, oy + 30 + hop, 15, 12, "#fb9db8", "#d85c87");
    if (!isBack) {
      fillOval(ctx, cx - 6 + sideSign * 2, oy + 28 + hop, 2.5, 3.5, "#202233");
      fillOval(ctx, cx + 6 + sideSign * 2, oy + 28 + hop, 2.5, 3.5, "#202233");
      fillOval(ctx, cx + sideSign * 2, oy + 35 + hop, 5, 2.5, "#802c54");
      ctx.fillStyle = "#fff8fa";
      ctx.fillRect(cx - 7 + sideSign * 2, oy + 26 + hop, 2, 2);
      ctx.fillRect(cx + 5 + sideSign * 2, oy + 26 + hop, 2, 2);
    }
    return;
  }

  // DIGIMON SPRITES (estilo Digimon World DS)
  if (speciesId === "patamon") {
    const wingLift = row === 0 ? 0 : row % 2 === 1 ? -3.5 : 2.5;
    // Orejas-ala grandes estilo Patamon DS
    fillOval(ctx, cx - 11, oy + 14 + bob + wingLift, 7.5, 4.8, "#fff7ed", "#fed7aa");
    fillOval(ctx, cx + 11, oy + 14 + bob + wingLift, 7.5, 4.8, "#fff7ed", "#fed7aa");

    // Patitas
    fillOval(ctx, cx - 5, oy + 36 + leftStep * 0.7, 3.5, 3, primaryColor, dark);
    fillOval(ctx, cx + 5, oy + 36 + rightStep * 0.7, 3.5, 3, primaryColor, dark);

    // Cuerpo redondeado
    fillOval(ctx, cx, oy + 26 + bob, 10.5, 9.5, primaryColor, dark);
    if (!isBack) {
      fillOval(ctx, cx + sideSign * 1.5, oy + 30 + bob, 7.2, 5, "#fff7ed");
      const ex = sideSign * 2.2;
      if (dir !== 2) {
        fillOval(ctx, cx - 5 + ex, oy + 24 + bob, 2.4, 3.2, "#0f172a");
        fillOval(ctx, cx - 5 + ex, oy + 24.5 + bob, 1.5, 2, "#38bdf8");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(Math.round(cx - 6 + ex), Math.round(oy + 22 + bob), 2, 2);
      }
      if (dir !== 6) {
        fillOval(ctx, cx + 5 + ex, oy + 24 + bob, 2.4, 3.2, "#0f172a");
        fillOval(ctx, cx + 5 + ex, oy + 24.5 + bob, 1.5, 2, "#38bdf8");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(Math.round(cx + 4 + ex), Math.round(oy + 22 + bob), 2, 2);
      }
    }
    return;
  }

  const isGabumon = speciesId === "gabumon";
  const isGreymon = speciesId === "greymon";
  const isMetal = speciesId === "metalgreymon";
  const isWar = speciesId === "wargreymon";
  const bodyColor = isGabumon ? "#fde047" : primaryColor;
  const bodyDark = shadeHex(bodyColor, 0.75);
  const peltColor = isGabumon ? "#3b82f6" : primaryColor;
  const peltDark = shadeHex(peltColor, 0.72);

  if (isMetal || isWar) {
    ctx.fillStyle = isMetal ? "#927fc6" : "#e6c33d";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * 5, oy + 22 + bob);
      ctx.lineTo(cx + side * 21, oy + 9 + bob);
      ctx.lineTo(cx + side * 17, oy + 29 + bob);
      ctx.lineTo(cx + side * 7, oy + 33 + bob);
      ctx.closePath(); ctx.fill();
    }
  }

  // Cola en espalda o perfil
  if (isBack || sideSign !== 0) {
    fillOval(
      ctx,
      cx - sideSign * 9,
      oy + 31 + bob,
      6.5,
      4.2,
      isGabumon ? peltColor : bodyColor,
      isGabumon ? peltDark : bodyDark,
    );
  }

  // Pies y garras blancas
  fillOval(ctx, cx - 5.5, oy + 37 + leftStep, 4.8, 4.2, bodyColor, bodyDark);
  fillOval(ctx, cx + 5.5, oy + 37 + rightStep, 4.8, 4.2, bodyColor, bodyDark);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(Math.round(cx - 9), Math.round(oy + 39 + leftStep), 2, 3);
  ctx.fillRect(Math.round(cx - 6), Math.round(oy + 39 + leftStep), 2, 3);
  ctx.fillRect(Math.round(cx + 4), Math.round(oy + 39 + rightStep), 2, 3);
  ctx.fillRect(Math.round(cx + 7), Math.round(oy + 39 + rightStep), 2, 3);

  // Torso redondeado
  fillOval(
    ctx,
    cx,
    oy + 28 + bob,
    8.8,
    8.2,
    isGabumon ? peltColor : bodyColor,
    isGabumon ? peltDark : bodyDark,
  );
  if (!isBack) {
    fillOval(
      ctx,
      cx + sideSign * 1.5,
      oy + 29 + bob,
      5.5,
      5.8,
      isGabumon ? "#fde047" : accentColor,
    );
  } else if (isGabumon) {
    ctx.fillStyle = "#1d4ed8";
    ctx.fillRect(Math.round(cx - 6), Math.round(oy + 24 + bob), 12, 2);
    ctx.fillRect(Math.round(cx - 5), Math.round(oy + 28 + bob), 10, 2);
  }

  // Brazos con garras
  fillOval(ctx, cx - 9.5, oy + 26 + bob + rightStep, 3.6, 4.8, isGabumon ? peltColor : bodyColor, bodyDark);
  fillOval(ctx, cx + 9.5, oy + 26 + bob + leftStep, 3.6, 4.8, isGabumon ? peltColor : bodyColor, bodyDark);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(Math.round(cx - 11), Math.round(oy + 29 + bob + rightStep), 2, 2);
  ctx.fillRect(Math.round(cx + 9), Math.round(oy + 29 + bob + leftStep), 2, 2);

  // Cabeza expresiva estilo Digimon World DS
  const headColor = isWar ? "#d0dce5" : isMetal ? "#8299ad" : isGreymon ? "#78350f" : isGabumon ? peltColor : bodyColor;
  fillOval(ctx, cx, oy + 14 + bob, 10.5, 8.8, headColor, shadeHex(headColor, 0.75));
  // Brillo superior
  fillOval(ctx, cx - 2, oy + 9.5 + bob, 5.5, 2.5, isGabumon ? "#60a5fa" : light);

  // Cuernos
  if (isGabumon) {
    fillOval(ctx, cx + sideSign * 2, oy + 4.5 + bob, 2.8, 4.2, "#e9d5ff", "#a855f7");
  } else if (isGreymon || isMetal || isWar) {
    fillOval(ctx, cx - 9, oy + 7 + bob, 3, 4.5, "#fef3c7");
    fillOval(ctx, cx + 9, oy + 7 + bob, 3, 4.5, "#fef3c7");
    fillOval(ctx, cx + sideSign * 3, oy + 4.5 + bob, 3, 4.5, "#fef3c7");
  }

  // Hocico redondeado y ojos grandes estilo DS
  if (!isBack) {
    fillOval(
      ctx,
      cx + sideSign * 3.5,
      oy + 18 + bob,
      8.5,
      4.5,
      bodyColor,
      bodyDark,
    );
    ctx.fillStyle = "#451a03";
    ctx.fillRect(Math.round(cx - 2 + sideSign * 4), Math.round(oy + 16 + bob), 1, 2);
    ctx.fillRect(Math.round(cx + 2 + sideSign * 4), Math.round(oy + 16 + bob), 1, 2);

    const ex = sideSign * 2.5;
    if (dir !== 2) {
      fillOval(ctx, cx - 5 + ex, oy + 13 + bob, 2.8, 3.2, "#0f172a");
      fillOval(ctx, cx - 5 + ex, oy + 13.5 + bob, 1.8, 2.2, isGabumon ? "#ef4444" : "#22c55e");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.round(cx - 6 + ex), Math.round(oy + 11 + bob), 2, 2);
    }
    if (dir !== 6) {
      fillOval(ctx, cx + 5 + ex, oy + 13 + bob, 2.8, 3.2, "#0f172a");
      fillOval(ctx, cx + 5 + ex, oy + 13.5 + bob, 1.8, 2.2, isGabumon ? "#ef4444" : "#22c55e");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.round(cx + 4 + ex), Math.round(oy + 11 + bob), 2, 2);
    }
  }
  if (isMetal) {
    // Brazo mecánico y puertos del Giga Destructor.
    fillOval(ctx, cx - 11, oy + 27 + bob, 5, 7, "#abbfce", "#62798f");
    for (const x of [-3, 3]) {
      fillOval(ctx, cx + x, oy + 26 + bob, 2.5, 2.5, "#394458");
      fillOval(ctx, cx + x, oy + 26 + bob, 1.2, 1.2, "#f66c4d");
    }
  }
  if (isWar) {
    for (const side of [-1, 1]) {
      fillOval(ctx, cx + side * 8, oy + 22 + bob, 5, 3, "#f8cf35", "#b68924");
      fillOval(ctx, cx + side * 11, oy + 29 + bob, 4, 5, "#b9cbd9", "#6a8196");
      for (const claw of [-2, 0, 2]) fillOval(ctx, cx + side * 11 + claw, oy + 35 + bob, 0.8, 4, "#f1f6ff");
    }
    fillOval(ctx, cx, oy + 26 + bob, 6, 4, "#e7bb29", "#9d7822");
  }
}

/**
 * Cuantiza la paleta de colores y añade un contorno exterior limpio de 1px
 * alrededor de toda la silueta, idéntico a los sprites de Nintendo DS.
 */
function applyDsPixelPass(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const alphaCopy = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i += 1) {
    const idx = i * 4;
    if (data[idx + 3]! >= 96) {
      alphaCopy[i] = 1;
      data[idx] = Math.round(data[idx]! / 16) * 16;
      data[idx + 1] = Math.round(data[idx + 1]! / 16) * 16;
      data[idx + 2] = Math.round(data[idx + 2]! / 16) * 16;
      data[idx + 3] = 255;
    } else {
      data[idx + 3] = 0;
    }
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      if (alphaCopy[i]) continue;
      if (
        alphaCopy[i - 1] ||
        alphaCopy[i + 1] ||
        alphaCopy[i - width] ||
        alphaCopy[i + width]
      ) {
        const idx = i * 4;
        data[idx] = 18;
        data[idx + 1] = 22;
        data[idx + 2] = 34;
        data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(image, 0, 0);
}

function getOrCreateAtlasCanvas(
  kind: DsActorKind,
  speciesId: string,
  primaryColor: string,
  accentColor: string,
): { canvas: HTMLCanvasElement; cacheKey: string } {
  const realSprite = REAL_DS_SPRITES[kind === "tamer" ? "tamer" : speciesId];
  // Los originales no se recolorean: compartir su canvas entre jugadores evita
  // decodificar la misma hoja por cada nombre, chaqueta o compañero distinto.
  const cacheKey = realSprite ? `original:${kind}:${speciesId}` : `${kind}:${speciesId}:${primaryColor}:${accentColor}`;
  const cached = sheetCache.get(cacheKey);
  if (cached) {
    return { canvas: cached, cacheKey };
  }

  const canvas = document.createElement("canvas");
  canvas.width = COLUMNS * CELL_PX;
  canvas.height = (realSprite?.rows ?? ROWS) * CELL_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No se pudo inicializar el atlas de sprites DS");
  }
  ctx.imageSmoothingEnabled = false;

  if (!realSprite) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let dir = 0; dir < COLUMNS; dir += 1) {
        drawOrganicFrame(ctx, kind, speciesId, primaryColor, accentColor, dir, row);
      }
    }
    applyDsPixelPass(ctx, canvas.width, canvas.height);
  }
  sheetCache.set(cacheKey, canvas);

  // Si el usuario activa hojas personalizadas (?customsprites=1) y coloca PNGs en /sprites/<id>_ds.png,
  // los cargamos automáticamente sin generar 404 por defecto.
  const customFile = kind === "tamer" ? "tamer_ds.png" : `${speciesId}_ds.png`;
  let allowCustom = false;
  try {
    allowCustom = new URLSearchParams(window.location.search).get("customsprites") === "1" ||
      localStorage.getItem("digiworld:custom-sprites") === "1";
  } catch { /* Almacenamiento bloqueado. */ }
  if ((realSprite || allowCustom) && !customSheetAttempted.has(cacheKey)) {
    customSheetAttempted.add(cacheKey);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (img.width % COLUMNS || img.height % (realSprite?.rows ?? ROWS)) return;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.dataset.spriteSource = realSprite ? `tsr-${realSprite.sheet}` : "custom";
      for (const tex of sheetTextures.get(cacheKey) ?? []) {
        tex.needsUpdate = true;
      }
    };
    img.src = realSprite ? realSprite.url : `/sprites/${customFile}`;
  }

  return { canvas, cacheKey };
}

export function DsSpriteActor({
  kind,
  speciesId,
  primaryColor,
  accentColor,
  moving,
  running,
  worldSize = 2.05,
  planeY = 1.0,
  combat,
  defeated = false,
}: {
  kind: DsActorKind;
  speciesId: string;
  primaryColor: string;
  accentColor: string;
  moving: boolean;
  running: boolean;
  worldSize?: number;
  planeY?: number;
  combat?: CombatVisual;
  defeated?: boolean;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const timeOffset = useRef(Math.random() * 10);
  const atlasRows = REAL_DS_SPRITES[kind === "tamer" ? "tamer" : speciesId]?.rows ?? ROWS;

  const { texture, cacheKey } = useMemo(() => {
    const { canvas, cacheKey: key } = getOrCreateAtlasCanvas(
      kind,
      speciesId,
      primaryColor,
      accentColor,
    );
    const instance = new THREE.CanvasTexture(canvas);
    instance.colorSpace = THREE.SRGBColorSpace;
    instance.magFilter = THREE.NearestFilter;
    instance.minFilter = THREE.NearestFilter;
    instance.generateMipmaps = false;
    instance.wrapS = THREE.ClampToEdgeWrapping;
    instance.wrapT = THREE.ClampToEdgeWrapping;
    instance.repeat.set(1 / COLUMNS, 1 / atlasRows);
    instance.offset.set(0, 1 - 1 / atlasRows);
    instance.needsUpdate = true;
    let set = sheetTextures.get(key);
    if (!set) {
      set = new Set();
      sheetTextures.set(key, set);
    }
    set.add(instance);
    return { texture: instance, cacheKey: key };
  }, [kind, speciesId, primaryColor, accentColor]);

  useEffect(() => {
    sheetTextures.get(cacheKey)?.add(texture);
    texture.needsUpdate = true;
    return () => {
      sheetTextures.get(cacheKey)?.delete(texture);
      texture.dispose();
    };
  }, [cacheKey, texture]);

  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  const worldQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const worldEuler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);

  useFrame((state) => {
    const plane = mesh.current;
    if (!plane) {
      return;
    }

    const time = state.clock.elapsedTime + timeOffset.current;
    plane.getWorldPosition(worldPosition);

    const dx = camera.position.x - worldPosition.x;
    const dz = camera.position.z - worldPosition.z;
    const dy = camera.position.y - worldPosition.y;
    const horizontalDist = Math.max(0.001, Math.hypot(dx, dz));
    const cameraAngle = Math.atan2(dx, dz);

    let parentYaw = 0;
    if (plane.parent) {
      plane.parent.getWorldQuaternion(worldQuaternion);
      worldEuler.setFromQuaternion(worldQuaternion, "YXZ");
      parentYaw = worldEuler.y;
    }

    const elevationTilt = THREE.MathUtils.clamp(
      -Math.atan2(dy, horizontalDist) * 0.55,
      -0.65,
      0.15,
    );
    plane.rotation.order = "YXZ";
    plane.rotation.y = cameraAngle - parentYaw;
    plane.rotation.x = elevationTilt;

    const relative = cameraAngle - parentYaw;
    const direction =
      ((Math.round(relative / (Math.PI / 4)) % COLUMNS) + COLUMNS) % COLUMNS;
    let frame = moving
      ? 1 + (Math.floor(time * (running ? 10 : 7)) % 4)
      : 0;

    const now = performance.now();
    const attacking = combat && now - combat.attackAt < 500;
    const hit = combat && now - combat.hitAt < 350;
    const healing = combat && now - combat.healAt < 700;
    if (atlasRows === 7) {
      if (attacking) frame = 5;
      if (hit) frame = 6;
    }
    texture.offset.set(direction / COLUMNS, 1 - (frame + 1) / atlasRows);
    const material = plane.material as THREE.MeshBasicMaterial;
    const evolving = combat && now - (combat.evolutionAt ?? -10000) < 3000;
    material.color.set(defeated ? "#808894" : evolving ? "#fff49c" : hit ? "#ff7c7c" : healing ? "#88ffbb" : "#ffffff");

    // Si otra criatura pasa pegada a la lente (< 1.8 m), se oculta para no tapar la pantalla.
    const distToCamera = camera.position.distanceTo(worldPosition);
    plane.visible = distToCamera > 1.75;

    plane.position.y =
      planeY +
      (moving
        ? Math.abs(Math.sin(time * (running ? 12 : 8))) * 0.04
        : Math.sin(time * 2.4) * 0.012);
  });

  return (
    <mesh
      ref={mesh}
      position={[0, planeY, 0]}
      castShadow={false}
      receiveShadow={false}
      userData={{ noShadow: true, spriteSpecies: speciesId }}
    >
      <planeGeometry args={[worldSize, worldSize]} />
      <meshBasicMaterial
        map={texture}
        alphaTest={0.5}
        transparent
        depthWrite={true}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}
