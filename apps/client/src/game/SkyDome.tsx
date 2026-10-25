import * as THREE from "three";

const vertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  varying vec3 vWorldPosition;

  void main() {
    vec3 direction = normalize(vWorldPosition);
    float height = clamp(direction.y * 0.5 + 0.5, 0.0, 1.0);

    vec3 horizon = vec3(0.69, 0.82, 0.72);
    vec3 zenith = vec3(0.30, 0.55, 0.82);
    vec3 color = mix(horizon, zenith, smoothstep(0.47, 0.96, height));

    vec3 sunDirection = normalize(vec3(0.45, 0.55, 0.28));
    float sun = pow(max(dot(direction, sunDirection), 0.0), 48.0);
    color += vec3(1.0, 0.82, 0.52) * sun * 0.55;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function SkyDome() {
  return (
    <mesh scale={[600, 600, 600]} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  );
}
