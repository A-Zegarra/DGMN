import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import type { WorldClient } from "../net/world-client";
import { SPECIES } from "@digiworld/content";
import { angleDelta, cameraFraming, smoothFactor } from "./camera-settings";
import { CameraCollision } from "./camera-collision";

export function CameraRig({ client }: { client: WorldClient }) {
  const { camera, scene } = useThree();
  const rig = useMemo(() => ({
    pivot: new THREE.Vector3(), desiredPivot: new THREE.Vector3(), direction: new THREE.Vector3(),
    projection: new THREE.Vector3(), collision: new CameraCollision(),
    solids: [] as THREE.Object3D[], nextScan: 0, height: 1.8, width: 1,
    distance: 6, zoom: 6, pitch: client.pitch, yaw: client.yaw, initialized: false,
  }), [client]);

  useFrame((state, delta) => {
    const local = client.players.get(client.localId);
    if (!local) return;
    const dt = Math.min(delta, 0.1);
    const settings = client.cameraSettings;
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, settings.fov, smoothFactor(8, dt));
      camera.updateProjectionMatrix();
    }
    if (client.cameraMode === "first-person") {
      camera.position.set(local.x, 1.62, local.z);
      camera.rotation.set(client.pitch, client.yaw + Math.PI, 0, "YXZ");
      rig.initialized = false;
      return;
    }

    // Solo se inspeccionan los estáticos y el modelo local dos veces por segundo.
    if (state.clock.elapsedTime >= rig.nextScan) {
      rig.nextScan = state.clock.elapsedTime + 0.5;
      rig.solids.length = 0;
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || object.userData.noCameraCollision) return;
        let ancestor: THREE.Object3D | null = object;
        while (ancestor) {
          if (ancestor.userData.cameraSolid) { rig.solids.push(object); break; }
          ancestor = ancestor.parent;
        }
      });
      const scale = SPECIES[local.species]?.scale ?? 1;
      // El rectángulo del sprite es estable: la órbita y el retroceso no deben
      // cambiar el zoom como ocurría al medir su caja rotada cada medio segundo.
      rig.height = Math.max(1.8, 2 * scale);
      rig.width = 2 * scale;
    }

    const manual = client.mouseLeft || client.mouseRight || performance.now() - client.lastCameraInputAt < 1200;
    if (!manual && !client.touchMoving && !client.inputBlocked && settings.mode !== "classic") {
      let heading = local.rot;
      let follow = settings.follow && local.moving;
      if (settings.mode === "combat" && settings.targetLock) {
        const id = local.duelOpponent || client.targetWildId || client.targetId;
        const target = id ? client.players.get(id) ?? client.wilds.get(id) : undefined;
        if (target && target.hp > 0) {
          heading = Math.atan2(target.x - local.x, target.z - local.z);
          follow = true;
        }
      }
      if (follow) client.yaw += angleDelta(client.yaw, heading) * smoothFactor(4.2, dt);
    }
    const framing = cameraFraming(rig.height, rig.width, settings);
    const separation = Math.hypot(local.partnerX - local.x, local.partnerZ - local.z);
    // Mantener a ambos visibles también al explorar, especialmente en vertical.
    const weight = local.inCombat ? 0.5 : 0.3;
    rig.desiredPivot.set(local.x + (local.partnerX - local.x) * weight, framing.focus,
      local.z + (local.partnerZ - local.z) * weight);
    if (local.inCombat) {
      // Encuadrar al equipo, no fijar la orientación sobre un enemigo.
      rig.desiredPivot.x = (local.x + local.partnerX) * 0.5;
      rig.desiredPivot.z = (local.z + local.partnerZ) * 0.5;
      framing.distance = Math.min(settings.maxDistance, Math.max(framing.distance, separation * 1.1 + 4));
    }
    if (camera instanceof THREE.PerspectiveCamera && camera.aspect < 1) {
      const horizontalFit = (3 + separation * 0.35) / (Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
      framing.distance = Math.min(settings.maxDistance, Math.max(framing.distance, horizontalFit));
    }
    const pitch = settings.mode === "combat" && !manual ? Math.max(client.pitch, 25 * Math.PI / 180) : client.pitch;
    if (!rig.initialized) {
      rig.pivot.copy(rig.desiredPivot);
      rig.yaw = client.yaw;
      rig.pitch = pitch;
      rig.zoom = framing.distance;
      rig.distance = framing.distance;
      rig.initialized = true;
    }
    rig.pivot.lerp(rig.desiredPivot, smoothFactor(12, dt));
    rig.yaw += angleDelta(rig.yaw, client.yaw) * smoothFactor(22, dt);
    rig.pitch = THREE.MathUtils.lerp(rig.pitch, pitch, smoothFactor(16, dt));
    rig.zoom = THREE.MathUtils.lerp(rig.zoom, framing.distance, smoothFactor(6, dt));
    rig.direction.set(-Math.sin(rig.yaw) * Math.cos(rig.pitch), Math.sin(rig.pitch), -Math.cos(rig.yaw) * Math.cos(rig.pitch));
    // Limitar el suelo antes del raycast (incluso en mapas sin malla de terreno).
    let desired = rig.zoom;
    if (rig.direction.y < 0) desired = Math.min(desired, Math.max(0.15, (rig.pivot.y - 0.25) / -rig.direction.y));
    const allowed = rig.collision.distance(rig.pivot, rig.direction, desired, rig.solids);
    // Entrar inmediatamente evita atravesar sólidos; salir es suave y conserva el zoom pedido.
    rig.distance = allowed < rig.distance ? allowed : THREE.MathUtils.lerp(rig.distance, allowed, smoothFactor(5, dt));
    camera.position.copy(rig.pivot).addScaledVector(rig.direction, rig.distance);
    camera.lookAt(rig.pivot);
    camera.updateMatrixWorld();
    rig.projection.set(local.x, 1, local.z).project(camera);
    const tamer = {x:rig.projection.x,y:rig.projection.y};
    rig.projection.set(local.partnerX, 0.8, local.partnerZ).project(camera);
    const partner = {x:rig.projection.x,y:rig.projection.y};
    client.cameraTelemetry = { distance: rig.distance, requestedDistance: framing.distance,
      focusHeight: rig.pivot.y, obstructed: allowed < rig.zoom - 0.05, tamer, partner };
  });
  return null;
}
