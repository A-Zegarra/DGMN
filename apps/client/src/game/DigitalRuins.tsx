import { Sparkles } from "@react-three/drei";

/** Monumentos decorativos fuera de las rutas principales de combate. */
export function DigitalRuins() {
  return <group>
    {[-1, 1].flatMap((side) => [0, 1, 2, 3].map((index) => (
      <group key={`${side}-${index}`} position={[side * 12, 0, index * 12 - 18]}>
        <mesh receiveShadow castShadow position-y={0.22}><cylinderGeometry args={[1.2, 1.4, 0.44, 8]} /><meshStandardMaterial color="#6e7c78" roughness={0.88} /></mesh>
        <mesh castShadow position-y={1.6} rotation-y={index * 0.6}><boxGeometry args={[0.8, 2.7, 0.8]} /><meshStandardMaterial color="#536864" roughness={0.75} metalness={0.2} /></mesh>
        <mesh position={[0, 1.8, -0.415]}><boxGeometry args={[0.12, 1.8, 0.025]} /><meshStandardMaterial color="#7ef3ed" emissive="#20d5cf" emissiveIntensity={2} /></mesh>
        <mesh position-y={3.25} rotation-z={0.2}><octahedronGeometry args={[0.5]} /><meshStandardMaterial color="#98eee4" metalness={0.45} roughness={0.18} emissive="#218e99" emissiveIntensity={0.6} /></mesh>
      </group>
    )))}
    <group position={[0, 0, -32]}>
      {[-1, 1].map((side) => <mesh key={side} position={[side * 3.7, 3.2, 0]} castShadow receiveShadow><boxGeometry args={[1.5, 6.4, 1.7]} /><meshStandardMaterial color="#61736e" roughness={0.85} /></mesh>)}
      <mesh position={[0, 6.5, 0]} castShadow><boxGeometry args={[9, 1.1, 2]} /><meshStandardMaterial color="#819088" roughness={0.8} /></mesh>
      <mesh position={[0, 3.2, 0]}><torusGeometry args={[2.55, 0.055, 8, 64]} /><meshBasicMaterial color="#7cf9e8" toneMapped={false} /></mesh>
      <Sparkles count={35} scale={[6, 6, 3]} position={[0, 3, 0]} size={3} speed={0.35} color="#99ffe9" />
    </group>
    {[0, 1, 2, 3, 4, 5].map((index) => <group key={index} position={[Math.cos(index * 2.4) * 43, 0, Math.sin(index * 2.4) * 43]}>
      {[0, 1, 2].map((shard) => <mesh key={shard} position={[shard * 0.65, 0.9 + shard * 0.3, 0]} rotation={[0.1 * shard, shard, 0.2 * shard]} castShadow scale={[0.65, 1.8 + shard * 0.5, 0.65]}><octahedronGeometry args={[1]} /><meshStandardMaterial color="#82b9cc" metalness={0.35} roughness={0.22} emissive="#226f93" emissiveIntensity={0.4} /></mesh>)}
    </group>)}
  </group>;
}
