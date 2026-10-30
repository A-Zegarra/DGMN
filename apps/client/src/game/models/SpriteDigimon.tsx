import { useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const SHEET_URL = "/sprites/agumon_sheet.png";
const COLUMNS = 8;
const ROWS = 5;
const CELL_WORLD_SIZE = 2.0;
const PLANE_Y = 0.9;

/**
 * Agumon en formato sprite 8-bit: 8 direcciones y 5 poses (idle + 4 pasos).
 * El plano mira siempre a la cámara y elige la dirección según el ángulo
 * entre la cámara y el rumbo del personaje.
 */
export function SpriteDigimon({
  moving,
  running,
}: {
  moving: boolean;
  running: boolean;
}) {
  const source = useTexture(SHEET_URL);
  const mesh = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const timeOffset = useRef(Math.random() * 10);

  const texture = useMemo(() => {
    const next = source.clone();
    next.colorSpace = THREE.SRGBColorSpace;
    next.magFilter = THREE.NearestFilter;
    next.minFilter = THREE.NearestFilter;
    next.generateMipmaps = false;
    next.wrapS = THREE.ClampToEdgeWrapping;
    next.wrapT = THREE.ClampToEdgeWrapping;
    next.repeat.set(1 / COLUMNS, 1 / ROWS);
    next.offset.set(0, 1 - 1 / ROWS);
    next.needsUpdate = true;
    return next;
  }, [source]);

  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  const worldQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const worldEuler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);

  useFrame((state) => {
    if (!mesh.current) {
      return;
    }
    const time = state.clock.elapsedTime + timeOffset.current;
    mesh.current.getWorldPosition(worldPosition);
    const cameraAngle = Math.atan2(
      camera.position.x - worldPosition.x,
      camera.position.z - worldPosition.z,
    );
    mesh.current.rotation.y = cameraAngle;

    const parent = mesh.current.parent;
    if (parent) {
      parent.getWorldQuaternion(worldQuaternion);
      worldEuler.setFromQuaternion(worldQuaternion, "YXZ");
      const relative = cameraAngle - worldEuler.y;
      const direction =
        ((Math.round(relative / (Math.PI / 4)) % COLUMNS) + COLUMNS) % COLUMNS;
      const frame = moving
        ? 1 + (Math.floor(time * (running ? 10 : 7)) % 4)
        : 0;
      texture.offset.set(
        direction / COLUMNS,
        1 - (frame + 1) / ROWS,
      );
    }

    // En primera persona el compañero puede quedar a centímetros de la
    // cámara: se desvanece al acercarse para no tapar la vista.
    const distance = camera.position.distanceTo(worldPosition);
    const opacity = THREE.MathUtils.clamp((distance - 2.2) / 1.3, 0, 1);
    const material = mesh.current.material as THREE.MeshBasicMaterial;
    material.opacity = opacity;
    material.transparent = true;
    mesh.current.visible = opacity > 0.02;

    mesh.current.position.y =
      PLANE_Y +
      (moving
        ? Math.abs(Math.sin(time * (running ? 11 : 7.5))) * 0.018
        : Math.sin(time * 2.1) * 0.005);
  });

  return (
    <mesh
      ref={mesh}
      position={[0, PLANE_Y, 0]}
      castShadow={false}
      receiveShadow={false}
      userData={{ noShadow: true }}
    >
      <planeGeometry args={[CELL_WORLD_SIZE, CELL_WORLD_SIZE]} />
      <meshBasicMaterial
        map={texture}
        alphaTest={0.5}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}
