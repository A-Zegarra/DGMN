import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  Component,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { RETRO_MODE } from "../../retro";

const ASSET_VERSION = import.meta.env.DEV ? String(Date.now()) : "20261027";

// En desarrollo usamos el modelo Linkz rigueado para arte. En el build público
// usamos el Agumon original de Blender: el de Linkz es material de terceros y
// no debe publicarse.
const AGUMON_MODEL = import.meta.env.DEV
  ? "/models/agumon_linkz_rigged.glb"
  : "/models/agumon.glb";

const MODEL_URLS: Record<string, string> = {
  agumon: `${AGUMON_MODEL}?v=${ASSET_VERSION}`,
};

// Variante de exhibición: en desarrollo, el rigueado; en público, el original.
const SHOWCASE_URLS: Record<string, string> = {
  agumon: `${AGUMON_MODEL}?v=${ASSET_VERSION}`,
};

// Empieza la descarga al cargar el módulo: evita el parpadeo del modelo
// procedural mientras llega el GLB. En modo 8-bit no se descarga nada de esto.
if (!RETRO_MODE) {
  for (const url of new Set([
    ...Object.values(MODEL_URLS),
    ...Object.values(SHOWCASE_URLS),
  ])) {
    useGLTF.preload(url);
  }
}

export function hasDetailedModel(speciesId: string): boolean {
  return Boolean(MODEL_URLS[speciesId]);
}

const preparedScenes = new Map<string, THREE.Group>();

function physicalMaterial(original: THREE.Material): THREE.Material {
  if (!(original instanceof THREE.MeshStandardMaterial)) {
    return original;
  }

  const name = original.name ?? "";
  const material = new THREE.MeshPhysicalMaterial({
    color: original.color.clone(),
    map: original.map,
    normalMap: original.normalMap,
    normalScale: original.normalScale?.clone(),
    roughnessMap: original.roughnessMap,
    metalnessMap: original.metalnessMap,
    aoMap: original.aoMap,
    emissiveMap: original.emissiveMap,
    emissive: original.emissive.clone(),
    emissiveIntensity: original.emissiveIntensity,
    transparent: original.transparent,
    opacity: original.opacity,
    vertexColors: original.vertexColors,
    roughness: 0.46,
    metalness: 0.015,
    clearcoat: 0.38,
    clearcoatRoughness: 0.34,
    envMapIntensity: 0.95,
  });
  material.name = name;

  if (name.startsWith("EyeWhite")) {
    material.roughness = 0.12;
    material.clearcoat = 1;
    material.clearcoatRoughness = 0.08;
    material.envMapIntensity = 1.5;
  } else if (name.startsWith("EyeIris")) {
    material.roughness = 0.2;
    material.clearcoat = 0.9;
    material.clearcoatRoughness = 0.1;
    material.envMapIntensity = 0.95;
  } else if (name.startsWith("EyePupil")) {
    material.roughness = 0.12;
    material.clearcoat = 1;
    material.envMapIntensity = 0.55;
  } else if (name.startsWith("EyeGlint")) {
    material.roughness = 0.05;
    material.clearcoat = 1;
    material.emissive = new THREE.Color("#ffffff");
    material.emissiveIntensity = 0.06;
  } else if (name.startsWith("EyeSocket")) {
    material.roughness = 0.58;
    material.clearcoat = 0;
    material.envMapIntensity = 0.6;
  } else if (name.startsWith("BodyVinyl") || name.startsWith("BellyVinyl")) {
    // Acabado de figura de vinilo: satinado, sin reflejos verdes del estudio.
    material.roughness = name.startsWith("BellyVinyl") ? 0.52 : 0.485;
    material.clearcoat = 0.24;
    material.clearcoatRoughness = 0.4;
    material.envMapIntensity = 0.55;
  } else if (name.startsWith("ClawIvory")) {
    material.roughness = 0.3;
    material.clearcoat = 0.35;
    material.clearcoatRoughness = 0.3;
  } else if (name.startsWith("Mouth")) {
    material.roughness = 0.5;
    material.clearcoat = 0;
  } else if (name.startsWith("Tongue")) {
    material.roughness = 0.32;
    material.clearcoat = 0.3;
  } else if (name.startsWith("Nostril")) {
    material.roughness = 0.55;
    material.clearcoat = 0;
  }

  return material;
}

function prepareScene(url: string, source: THREE.Group): THREE.Group {
  const cached = preparedScenes.get(url);
  if (cached) {
    return cached;
  }

  const scene = cloneSkeleton(source) as THREE.Group;
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }
    object.castShadow = true;
    object.receiveShadow = true;
    object.material = Array.isArray(object.material)
      ? object.material.map(physicalMaterial)
      : physicalMaterial(object.material);
  });
  preparedScenes.set(url, scene);
  return scene;
}

interface ModelNodes {
  root: THREE.Group;
  body: THREE.Object3D | null;
  head: THREE.Object3D | null;
  jaw: THREE.Object3D | null;
  armL: THREE.Object3D | null;
  armR: THREE.Object3D | null;
  legL: THREE.Object3D | null;
  legR: THREE.Object3D | null;
  tail: THREE.Object3D | null;
}

function useModel(url: string): ModelNodes {
  const { scene } = useGLTF(url);
  const prepared = useMemo(() => prepareScene(url, scene), [scene, url]);
  const nodes = useMemo<ModelNodes>(() => {
    const root = cloneSkeleton(prepared) as THREE.Group;
    return {
      root,
      body: root.getObjectByName("body") ?? null,
      head: root.getObjectByName("head") ?? null,
      jaw: root.getObjectByName("jaw") ?? null,
      armL: root.getObjectByName("armL") ?? null,
      armR: root.getObjectByName("armR") ?? null,
      legL: root.getObjectByName("legL") ?? null,
      legR: root.getObjectByName("legR") ?? null,
      tail: root.getObjectByName("tail") ?? null,
    };
  }, [prepared]);

  return nodes;
}

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

interface BoneAxes {
  x: THREE.Vector3;
  y: THREE.Vector3;
  z: THREE.Vector3;
}

interface Rig {
  bones: Record<string, THREE.Bone>;
  rest: Record<string, THREE.Quaternion>;
  axes: Record<string, BoneAxes>;
  armSwing: { l: THREE.Vector3; r: THREE.Vector3 };
}

function findRig(root: THREE.Object3D): Rig | null {
  const bones: Record<string, THREE.Bone> = {};
  root.traverse((object) => {
    if ((object as THREE.Bone).isBone) {
      bones[object.name] = object as THREE.Bone;
    }
  });
  if (!bones.J_leg_l || !bones.J_leg_r || !bones.J_arm_l || !bones.J_arm_r) {
    return null;
  }
  root.updateMatrixWorld(true);
  const rest: Record<string, THREE.Quaternion> = {};
  const axes: Record<string, BoneAxes> = {};
  for (const [name, bone] of Object.entries(bones)) {
    rest[name] = bone.quaternion.clone();
    const world = new THREE.Quaternion();
    bone.getWorldQuaternion(world);
    const inverse = world.clone().invert();
    axes[name] = {
      x: AXIS_X.clone().applyQuaternion(inverse).normalize(),
      y: AXIS_Y.clone().applyQuaternion(inverse).normalize(),
      z: AXIS_Z.clone().applyQuaternion(inverse).normalize(),
    };
  }

  // Eje de balanceo de los brazos en world X después de la pose base.
  const baseL = new THREE.Quaternion().setFromAxisAngle(AXIS_X, ARM_BASE_L);
  const baseR = new THREE.Quaternion().setFromAxisAngle(AXIS_X, ARM_BASE_R);
  bones.J_arm_l.quaternion.copy(rest.J_arm_l).multiply(baseL);
  bones.J_arm_r.quaternion.copy(rest.J_arm_r).multiply(baseR);
  root.updateMatrixWorld(true);
  const worldQuat = new THREE.Quaternion();
  bones.J_arm_l.getWorldQuaternion(worldQuat);
  const swingL = AXIS_X.clone()
    .applyQuaternion(worldQuat.clone().invert())
    .normalize();
  bones.J_arm_r.getWorldQuaternion(worldQuat);
  const swingR = AXIS_X.clone()
    .applyQuaternion(worldQuat.clone().invert())
    .normalize();
  bones.J_arm_l.quaternion.copy(rest.J_arm_l);
  bones.J_arm_r.quaternion.copy(rest.J_arm_r);
  root.updateMatrixWorld(true);

  return { bones, rest, axes, armSwing: { l: swingL, r: swingR } };
}

const _qBase = new THREE.Quaternion();
const _qSwing = new THREE.Quaternion();
const _qDelta = new THREE.Quaternion();

const ARM_BASE_L = THREE.MathUtils.degToRad(-72);
const ARM_BASE_R = THREE.MathUtils.degToRad(72);

function setBoneDelta(
  bone: THREE.Bone | undefined,
  rest: THREE.Quaternion | undefined,
  axis: THREE.Vector3 | undefined,
  angle: number,
): void {
  if (!bone || !rest || !axis) {
    return;
  }
  bone.quaternion.copy(rest).multiply(_qDelta.setFromAxisAngle(axis, angle));
}

function setArm(
  bone: THREE.Bone | undefined,
  rest: THREE.Quaternion | undefined,
  baseAngle: number,
  swingAxis: THREE.Vector3 | undefined,
  swingAngle: number,
): void {
  if (!bone || !rest || !swingAxis) {
    return;
  }
  bone.quaternion
    .copy(rest)
    .multiply(_qBase.setFromAxisAngle(AXIS_X, baseAngle))
    .multiply(_qSwing.setFromAxisAngle(swingAxis, swingAngle));
}

function animateRig(
  rig: Rig,
  time: number,
  moving: boolean,
  running: boolean,
): void {
  const phase = time * (running ? 11 : 7.5);
  const swing = moving ? Math.sin(phase) * (running ? 0.36 : 0.22) : 0;

  setBoneDelta(
    rig.bones.J_leg_l,
    rig.rest.J_leg_l,
    AXIS_X,
    swing,
  );
  setBoneDelta(
    rig.bones.J_leg_r,
    rig.rest.J_leg_r,
    AXIS_X,
    -swing,
  );

  const kneeL = moving
    ? Math.max(0, Math.sin(phase)) * (running ? 0.55 : 0.32)
    : 0.02;
  const kneeR = moving
    ? Math.max(0, -Math.sin(phase)) * (running ? 0.55 : 0.32)
    : 0.02;
  setBoneDelta(
    rig.bones.J_knee_l,
    rig.rest.J_knee_l,
    AXIS_X,
    kneeL,
  );
  setBoneDelta(
    rig.bones.J_knee_r,
    rig.rest.J_knee_r,
    AXIS_X,
    kneeR,
  );

  setBoneDelta(
    rig.bones.J_foot_l,
    rig.rest.J_foot_l,
    AXIS_X,
    -kneeL * 0.3,
  );
  setBoneDelta(
    rig.bones.J_foot_r,
    rig.rest.J_foot_r,
    AXIS_X,
    -kneeR * 0.3,
  );

  const armSwing = moving
    ? -swing * 0.4
    : Math.sin(time * 1.6) * 0.012;
  setArm(
    rig.bones.J_arm_l,
    rig.rest.J_arm_l,
    ARM_BASE_L,
    rig.armSwing.l,
    armSwing,
  );
  setArm(
    rig.bones.J_arm_r,
    rig.rest.J_arm_r,
    ARM_BASE_R,
    rig.armSwing.r,
    -armSwing,
  );

  if (rig.bones.J_head && rig.rest.J_head) {
    rig.bones.J_head.quaternion
      .copy(rig.rest.J_head)
      .multiply(
        _qDelta.setFromAxisAngle(
          AXIS_Y,
          Math.sin(time * 1.25) * 0.035,
        ),
      )
      .multiply(
        _qSwing.setFromAxisAngle(
          AXIS_X,
          moving ? -0.02 : Math.sin(time * 2) * 0.01,
        ),
      );
  }

  setBoneDelta(
    rig.bones.J_tail,
    rig.rest.J_tail,
    rig.axes.J_tail?.y,
    Math.sin(time * (moving ? 5.5 : 2.2)) * (moving ? 0.22 : 0.1),
  );
}

function LoadedDetailedDigimon({
  url,
  moving,
  running,
  preview = false,
}: {
  url: string;
  moving: boolean;
  running: boolean;
  preview?: boolean;
}) {
  const nodes = useModel(url);
  const timeOffset = useRef(Math.random() * 10);
  const groupRef = useRef<THREE.Group>(null);
  const rig = useMemo(() => findRig(nodes.root), [nodes.root]);

  // El rig de Linkz viene con una escala heredada muy grande. Se normaliza a
  // 1,75 de alto y se apoya en el suelo midiendo su caja real.
  const calibration = useMemo(() => {
    if (!rig) {
      return null;
    }
    nodes.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(nodes.root);
    const height = box.max.y - box.min.y;
    if (!Number.isFinite(height) || height <= 0.0001) {
      return null;
    }
    const scale = 1.75 / height;
    return {
      scale,
      position: new THREE.Vector3(
        -((box.min.x + box.max.x) / 2) * scale,
        -box.min.y * scale,
        -((box.min.z + box.max.z) / 2) * scale,
      ),
    };
  }, [nodes.root, rig]);

  useFrame((state) => {
    const time = state.clock.elapsedTime + timeOffset.current;

    if (rig) {
      animateRig(rig, time, moving, running);
      if (groupRef.current) {
        const speed = running ? 11 : 7.5;
        const phase = time * speed;
        groupRef.current.position.y = moving
          ? Math.abs(Math.sin(phase)) * (running ? 0.024 : 0.012)
          : Math.sin(time * 2.1) * 0.006;
        groupRef.current.rotation.z = moving
          ? Math.sin(phase * 0.5) * 0.018
          : Math.sin(time * 1.2) * 0.005;
        groupRef.current.rotation.x = moving
          ? running
            ? -0.05
            : -0.02
          : 0;
      }
      return;
    }

    const speed = running ? 12 : 8.5;
    const swing = moving ? Math.sin(time * speed) * (running ? 0.58 : 0.42) : 0;

    if (nodes.body) {
      const bob = moving
        ? Math.abs(Math.sin(time * speed)) * (running ? 0.055 : 0.032)
        : Math.sin(time * 2.1) * 0.008;
      nodes.body.position.y = bob;
      nodes.body.rotation.z = moving
        ? Math.sin(time * speed * 0.5) * 0.025
        : Math.sin(time * 1.2) * 0.006;
      nodes.body.rotation.x = moving ? (running ? -0.07 : -0.035) : 0;
    }

    if (nodes.legL) {
      nodes.legL.rotation.x = swing;
    }
    if (nodes.legR) {
      nodes.legR.rotation.x = -swing;
    }
    if (nodes.armL) {
      nodes.armL.rotation.x = -swing * 0.62;
      nodes.armL.rotation.z = preview ? 0.05 : 0;
    }
    if (nodes.armR) {
      nodes.armR.rotation.x = swing * 0.62;
      nodes.armR.rotation.z = preview ? -0.05 : 0;
    }
    if (nodes.tail) {
      nodes.tail.rotation.y =
        Math.sin(time * (moving ? 5.5 : 2.2)) * (moving ? 0.24 : 0.12);
    }
    if (nodes.head) {
      nodes.head.rotation.y = Math.sin(time * 1.25) * (moving ? 0.015 : 0.035);
      nodes.head.rotation.x = moving ? -0.03 : Math.sin(time * 2) * 0.012;
    }
    if (nodes.jaw) {
      // El modelo está esculpido con la boca entreabierta: se mantiene un
      // ángulo base para no cerrarla contra los dientes.
      nodes.jaw.rotation.x = 0.18 + Math.sin(time * 1.8) * 0.03;
    }
  });

  return (
    <group ref={groupRef}>
      <group
        scale={calibration?.scale ?? 1}
        position={calibration?.position}
      >
        <primitive object={nodes.root} />
      </group>
    </group>
  );
}

export function DetailedDigimon({
  speciesId,
  moving,
  running,
  preview = false,
  variant = "default",
}: {
  speciesId: string;
  moving: boolean;
  running: boolean;
  preview?: boolean;
  variant?: "default" | "showcase";
}) {
  const url =
    variant === "showcase" ? SHOWCASE_URLS[speciesId] : MODEL_URLS[speciesId];
  if (!url) {
    return null;
  }
  return (
    <LoadedDetailedDigimon
      url={url}
      moving={moving}
      running={running}
      preview={preview}
    />
  );
}

export class ModelErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error("No se pudo cargar el modelo detallado", error);
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
