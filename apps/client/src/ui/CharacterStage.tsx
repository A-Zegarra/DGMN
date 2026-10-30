import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";

import { SPECIES } from "@digiworld/content";

import { DsSpriteActor } from "../game/models/DsSpriteActor";

function SpeciesModel({ speciesId }: { speciesId: string }) {
  const species = SPECIES[speciesId] ?? SPECIES.agumon!;
    return (
      <DsSpriteActor
        kind="digimon"
        speciesId={speciesId}
        primaryColor={species.color}
        accentColor={species.accent}
        moving={true}
        running={false}
        worldSize={2.1}
        planeY={1.0}
      />
    );
}

function Studio({ speciesId }: { speciesId: string }) {
  return (
    <>
      <ambientLight intensity={0.48} />
      <directionalLight
        castShadow
        color="#fff1d2"
        intensity={2.3}
        position={[3.4, 5.6, 3.8]}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
      />
      <directionalLight
        color="#b9e4ff"
        intensity={1.55}
        position={[-4, 2.6, 2.4]}
      />
      <directionalLight
        color="#d8ffe9"
        intensity={0.95}
        position={[0, 3.2, -4.6]}
      />

      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          color="#fff4dd"
          intensity={4}
          position={[0, 4, 2.5]}
          scale={[5, 4, 1]}
          target={[0, 1, 0]}
        />
        <Lightformer
          form="rect"
          color="#bfeaff"
          intensity={2.6}
          position={[-4, 2.2, 1.5]}
          scale={[3, 4, 1]}
          target={[0, 1, 0]}
        />
        <Lightformer
          form="rect"
          color="#ffd89b"
          intensity={2.2}
          position={[4, 1.6, 0.5]}
          scale={[2.5, 4, 1]}
          target={[0, 1, 0]}
        />
        <Lightformer
          form="ring"
          color="#7cffb2"
          intensity={0.6}
          position={[0, 1.8, -4]}
          scale={2.4}
        />
      </Environment>

      <mesh rotation-x={-Math.PI / 2} position-y={-0.015} receiveShadow>
        <circleGeometry args={[1.55, 72]} />
        <meshStandardMaterial color="#0c1812" roughness={0.86} metalness={0.04} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.005}>
        <ringGeometry args={[1.38, 1.46, 72]} />
        <meshBasicMaterial color="#6dffb0" transparent opacity={0.3} />
      </mesh>

      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.48}
        scale={4}
        blur={2.6}
        far={2.7}
        resolution={512}
        color="#04120b"
      />

      <group scale={SPECIES[speciesId]?.scale ?? 1} position-y={0.015}>
        <SpeciesModel speciesId={speciesId} />
      </group>

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={1.2}
        target={[0, 0.92, 0]}
        minPolarAngle={0.95}
        maxPolarAngle={1.45}
        minDistance={2.6}
        maxDistance={4.2}
      />
    </>
  );
}

export function CharacterStage({ speciesId }: { speciesId: string }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [1.45, 1.65, 3.55], fov: 33, near: 0.1, far: 30 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <Studio speciesId={speciesId} />
    </Canvas>
  );
}
