import * as THREE from "three";

/** Cinco rayos cubren el centro y el margen del plano cercano, sin personajes ni VFX. */
export class CameraCollision {
  private ray = new THREE.Raycaster();
  private origin = new THREE.Vector3();
  private side = new THREE.Vector3();
  private up = new THREE.Vector3();
  private hits: THREE.Intersection[] = [];
  private worldUp = new THREE.Vector3(0, 1, 0);

  distance(pivot: THREE.Vector3, direction: THREE.Vector3, desired: number, objects: THREE.Object3D[], radius = 0.25): number {
    this.side.crossVectors(direction, this.worldUp).normalize().multiplyScalar(radius);
    this.up.crossVectors(this.side, direction).normalize().multiplyScalar(radius);
    let allowed = desired;
    for (let i = 0; i < 5; i++) {
      this.origin.copy(pivot);
      if (i === 1) this.origin.add(this.side);
      if (i === 2) this.origin.sub(this.side);
      if (i === 3) this.origin.add(this.up);
      if (i === 4) this.origin.sub(this.up);
      this.ray.set(this.origin, direction);
      this.ray.far = desired + radius;
      this.hits.length = 0;
      this.ray.intersectObjects(objects, false, this.hits);
      if (this.hits[0]) allowed = Math.min(allowed, Math.max(0.15, this.hits[0].distance - radius));
    }
    return allowed;
  }
}
