export function Eye({
  position,
  size = 0.075,
  iris = "#2f7d4a",
}: {
  position: [number, number, number];
  size?: number;
  iris?: string;
}) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[size, 10, 10]} />
        <meshStandardMaterial color="#f8fff9" flatShading roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, size * 0.72]}>
        <sphereGeometry args={[size * 0.58, 8, 8]} />
        <meshStandardMaterial color={iris} flatShading roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, size * 1.08]}>
        <sphereGeometry args={[size * 0.28, 6, 6]} />
        <meshBasicMaterial color="#07110b" />
      </mesh>
      <mesh position={[-size * 0.24, size * 0.24, size * 1.02]}>
        <sphereGeometry args={[size * 0.13, 6, 6]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

export function Claws({
  position,
  rotation = [0, 0, 0],
  color = "#f4ead2",
  size = 1,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  size?: number;
}) {
  return (
    <group position={position} rotation={rotation}>
      {[-1, 0, 1].map((offset) => (
        <mesh
          key={offset}
          position={[offset * 0.065 * size, 0, 0]}
          rotation-x={Math.PI / 2}
        >
          <coneGeometry args={[0.028 * size, 0.12 * size, 4]} />
          <meshStandardMaterial color={color} flatShading roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}
