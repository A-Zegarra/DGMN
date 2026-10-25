import { SPECIES } from "@digiworld/content";

import { DigimonModel } from "./models/DigimonModel";

export function DigimonBody({
  speciesId,
  moving,
  running,
  isLocal,
}: {
  speciesId: string;
  moving: boolean;
  running: boolean;
  isLocal: boolean;
}) {
  const species = SPECIES[speciesId] ?? SPECIES.agumon!;
  const scale = species.scale;

  return (
    <group>
      {isLocal && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.035}>
          <ringGeometry args={[0.55 * scale, 0.72 * scale, 32]} />
          <meshBasicMaterial
            color="#8bffbf"
            transparent
            opacity={0.8}
            depthWrite={false}
          />
        </mesh>
      )}

      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[0.5 * scale, 20]} />
        <meshBasicMaterial
          color="#04120b"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>

      <group scale={scale}>
        <DigimonModel
          speciesId={speciesId}
          moving={moving}
          running={running}
        />
      </group>
    </group>
  );
}
