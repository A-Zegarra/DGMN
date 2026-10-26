import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  Component,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import * as THREE from "three";

const ASSET_VERSION = import.meta.env.DEV ? String(Date.now()) : "20261026";

const MODEL_URLS: Record<string, string> = {
  agumon: `/models/agumon.glb?v=${ASSET_VERSION}`,
};

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
    material.roughness = 0.14;
    material.clearcoat = 0.9;
    material.clearcoatRoughness = 0.1;
    material.envMapIntensity = 1.55;
  } else if (name.startsWith("EyePupil")) {
    material.roughness = 0.08;
    material.clearcoat = 1;
    material.envMapIntensity = 1.6;
  } else if (name.startsWith("EyeGlint")) {
    material.roughness = 0.05;
    material.clearcoat = 1;
    material.emissive = new THREE.Color("#ffffff");
    material.emissiveIntensity = 0.06;
  } else if (name.startsWith("EyeSocket")) {
    material.roughness = 0.58;
    material.clearcoat = 0;
    material.envMapIntensity = 0.6;
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

  const scene = source.clone(true);
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
    const root = prepared.clone(true);
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

  useFrame((state) => {
    const time = state.clock.elapsedTime + timeOffset.current;
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
      nodes.jaw.rotation.x = 0.015 + Math.sin(time * 1.8) * 0.012;
    }
  });

  return <primitive object={nodes.root} />;
}

export function DetailedDigimon({
  speciesId,
  moving,
  running,
  preview = false,
}: {
  speciesId: string;
  moving: boolean;
  running: boolean;
  preview?: boolean;
}) {
  const url = MODEL_URLS[speciesId];
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
