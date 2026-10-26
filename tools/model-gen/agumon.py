"""Genera un Digimon detallado (estilo figura de vinilo) y lo exporta a GLB.

No usa programas externos: construye campos de distancia con numpy, extrae la
superficie con marching cubes, la suaviza y la exporta con trimesh.

Uso:
    python tools/model-gen/agumon.py
"""

from __future__ import annotations

import json
import os
import struct
from pathlib import Path

import numpy as np
import trimesh
from skimage import measure
from trimesh.visual.material import PBRMaterial

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps" / "client" / "public" / "models" / "agumon.glb"
OUT.parent.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Utilidades de color y materiales
# ---------------------------------------------------------------------------


def srgb_to_linear(channel: float) -> float:
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def linear_color(hex_color: str) -> np.ndarray:
    value = hex_color.lstrip("#")
    rgb = np.array([int(value[i : i + 2], 16) / 255.0 for i in (0, 2, 4)])
    return np.array([srgb_to_linear(float(c)) for c in rgb])


BODY = linear_color("#d8a32c")
BODY_LIGHT = linear_color("#edc958")
CLAW = linear_color("#efe5cf")
EYE_WHITE = linear_color("#f7f4e9")
EYE_GREEN = linear_color("#2e9b62")
EYE_DARK = linear_color("#0b1410")
EYE_GLINT = linear_color("#ffffff")
EYE_SOCKET = linear_color("#3d2b14")
MOUTH = linear_color("#4a1015")
TONGUE = linear_color("#c75a67")
NOSTRIL = linear_color("#4d3415")


def material(
    name: str,
    color: np.ndarray,
    *,
    roughness: float = 0.35,
    metallic: float = 0.0,
    double_sided: bool = False,
) -> PBRMaterial:
    return PBRMaterial(
        name=name,
        baseColorFactor=[float(c) for c in color] + [1.0],
        roughnessFactor=roughness,
        metallicFactor=metallic,
        doubleSided=double_sided,
    )


BODY_MAT = material("BodyVinyl", BODY, roughness=0.34)
BODY_VERTEX_MAT = material("BodyVinyl", [1.0, 1.0, 1.0], roughness=0.34)
CLAW_MAT = material("ClawIvory", CLAW, roughness=0.3)
EYE_WHITE_MAT = material("EyeWhite", EYE_WHITE, roughness=0.16)
EYE_GREEN_MAT = material("EyeIris", EYE_GREEN, roughness=0.18)
EYE_DARK_MAT = material("EyePupil", EYE_DARK, roughness=0.1)
EYE_GLINT_MAT = material("EyeGlint", EYE_GLINT, roughness=0.05)
EYE_SOCKET_MAT = material("EyeSocket", EYE_SOCKET, roughness=0.58)
MOUTH_MAT = material("Mouth", MOUTH, roughness=0.48)
TONGUE_MAT = material("Tongue", TONGUE, roughness=0.32)
NOSTRIL_MAT = material("Nostril", NOSTRIL, roughness=0.5)


def solid_mesh(mesh: trimesh.Trimesh, mat: PBRMaterial) -> trimesh.Trimesh:
    mesh.visual = trimesh.visual.TextureVisuals(material=mat)
    return mesh


def vertex_colored_mesh(
    mesh: trimesh.Trimesh, colors: np.ndarray, mat: PBRMaterial
) -> trimesh.Trimesh:
    rgba = np.empty((len(colors), 4), dtype=np.uint8)
    rgba[:, :3] = np.clip(colors * 255.0, 0, 255).astype(np.uint8)
    rgba[:, 3] = 255
    mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, vertex_colors=rgba)
    mesh.visual.material = mat
    return mesh


# ---------------------------------------------------------------------------
# SDF: primitivas y operaciones suaves
# ---------------------------------------------------------------------------


def ellipsoid(p: np.ndarray, center, radii) -> np.ndarray:
    q = (p - np.asarray(center, dtype=np.float64)) / np.asarray(
        radii, dtype=np.float64
    )
    k0 = np.linalg.norm(q, axis=1)
    k1 = np.linalg.norm(q / np.asarray(radii, dtype=np.float64), axis=1)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


def capsule(p: np.ndarray, a, b, radius: float) -> np.ndarray:
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    ab = b - a
    denom = float(np.dot(ab, ab))
    t = np.clip(((p - a) @ ab) / max(denom, 1e-12), 0.0, 1.0)
    closest = a + t[:, None] * ab
    return np.linalg.norm(p - closest, axis=1) - radius


def round_box(p: np.ndarray, center, half_extents, radius: float) -> np.ndarray:
    q = np.abs(p - np.asarray(center, dtype=np.float64)) - (
        np.asarray(half_extents, dtype=np.float64) - radius
    )
    outside = np.linalg.norm(np.maximum(q, 0.0), axis=1)
    inside = np.minimum(np.max(q, axis=1), 0.0)
    return outside + inside - radius


def smin(a: np.ndarray, b: np.ndarray, k: float) -> np.ndarray:
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b * (1.0 - h) + a * h - k * h * (1.0 - h)


def smax(a: np.ndarray, b: np.ndarray, k: float) -> np.ndarray:
    return -smin(-a, -b, k)


def sd_body(p: np.ndarray) -> np.ndarray:
    d = ellipsoid(p, (0.0, 0.94, 0.02), (0.34, 0.48, 0.34))
    d = smin(d, ellipsoid(p, (0.0, 0.62, 0.01), (0.32, 0.24, 0.29)), 0.10)
    d = smin(d, ellipsoid(p, (0.0, 1.14, 0.02), (0.30, 0.23, 0.28)), 0.09)
    d = smin(d, ellipsoid(p, (0.0, 1.31, 0.02), (0.19, 0.16, 0.18)), 0.08)
    d = smin(d, ellipsoid(p, (0.0, 0.79, 0.20), (0.27, 0.31, 0.23)), 0.09)
    for side in (-1.0, 1.0):
        d = smin(
            d, ellipsoid(p, (side * 0.34, 1.02, 0.02), (0.145, 0.15, 0.15)), 0.06
        )
        d = smin(
            d, ellipsoid(p, (side * 0.22, 0.52, 0.01), (0.18, 0.16, 0.18)), 0.06
        )
    return d


HEAD_PIVOT = np.array([0.0, 1.31, 0.02])
JAW_PIVOT = np.array([0.0, -0.03, 0.12])


def sd_head(p: np.ndarray) -> np.ndarray:
    d = ellipsoid(p, (0.0, 0.19, 0.00), (0.40, 0.33, 0.36))
    d = smin(
        d,
        round_box(p, (0.0, 0.05, 0.46), (0.245, 0.105, 0.27), 0.075),
        0.035,
    )
    d = smin(d, ellipsoid(p, (0.0, 0.15, 0.34), (0.23, 0.13, 0.26)), 0.06)
    d = smin(d, ellipsoid(p, (0.0, 0.17, -0.12), (0.31, 0.31, 0.29)), 0.08)
    d = smin(d, ellipsoid(p, (0.0, -0.01, 0.24), (0.32, 0.17, 0.27)), 0.065)
    d = smin(d, ellipsoid(p, (0.0, 0.36, 0.16), (0.21, 0.075, 0.19)), 0.07)
    for side in (-1.0, 1.0):
        d = smin(
            d, ellipsoid(p, (side * 0.24, 0.08, 0.17), (0.14, 0.17, 0.17)), 0.07
        )
        d = smin(
            d, ellipsoid(p, (side * 0.17, 0.335, 0.30), (0.16, 0.055, 0.12)), 0.04
        )
    return d


def sd_jaw(p: np.ndarray) -> np.ndarray:
    d = round_box(p, (0.0, -0.21, 0.49), (0.235, 0.075, 0.24), 0.07)
    d = smin(d, ellipsoid(p, (0.0, -0.20, 0.16), (0.235, 0.10, 0.18)), 0.05)
    return d


def sd_arm(p: np.ndarray, side: float) -> np.ndarray:
    # Coordenadas locales con el pivote en el hombro.
    sx = 0.05 * side
    d = capsule(p, (0, 0, 0), (sx, -0.27, 0.06), 0.13)
    d = smin(d, ellipsoid(p, (sx, -0.285, 0.075), (0.125, 0.12, 0.125)), 0.04)
    d = smin(d, capsule(p, (sx, -0.29, 0.08), (0.10 * side, -0.47, 0.20), 0.10), 0.04)
    d = smin(
        d, ellipsoid(p, (0.12 * side, -0.555, 0.28), (0.12, 0.09, 0.135)), 0.04
    )
    hand = np.array([0.12 * side, -0.56, 0.28])
    tips = [
        np.array([0.06 * side, -0.66, 0.39]),
        np.array([0.13 * side, -0.665, 0.37]),
        np.array([0.19 * side, -0.635, 0.32]),
    ]
    for tip in tips:
        d = smin(d, capsule(p, hand, tip, 0.032), 0.025)
    return d


def sd_leg(p: np.ndarray) -> np.ndarray:
    # Coordenadas locales con el pivote en la cadera.
    d = capsule(p, (0, 0, 0), (0, -0.22, 0.02), 0.165)
    d = smin(d, ellipsoid(p, (0, -0.225, 0.02), (0.16, 0.145, 0.16)), 0.04)
    d = smin(d, capsule(p, (0, -0.23, 0.03), (0, -0.36, 0.05), 0.13), 0.04)
    d = smin(d, ellipsoid(p, (0, -0.425, 0.17), (0.17, 0.075, 0.24)), 0.04)
    for x in (-0.09, 0.0, 0.09):
        d = smin(
            d,
            capsule(p, (x, -0.435, 0.25), (x, -0.45, 0.39), 0.04),
            0.025,
        )
    return d


def sd_tail(p: np.ndarray) -> np.ndarray:
    # Coordenadas locales con el pivote en la base de la cola.
    d = capsule(p, (0, 0, 0), (0, -0.08, -0.22), 0.155)
    d = smin(d, capsule(p, (0, -0.08, -0.22), (0, -0.22, -0.44), 0.12), 0.06)
    d = smin(d, capsule(p, (0, -0.22, -0.44), (0, -0.36, -0.63), 0.085), 0.05)
    d = smin(d, capsule(p, (0, -0.36, -0.63), (0, -0.44, -0.76), 0.055), 0.04)
    return d


# ---------------------------------------------------------------------------
# Extracción y suavizado
# ---------------------------------------------------------------------------


def sdf_mesh(
    fn,
    bounds,
    step: float,
    target_faces: int,
    *,
    smooth_iterations: int = 8,
) -> trimesh.Trimesh:
    lo, hi = np.asarray(bounds[0]), np.asarray(bounds[1])
    xs = np.arange(lo[0], hi[0] + step * 0.5, step)
    ys = np.arange(lo[1], hi[1] + step * 0.5, step)
    zs = np.arange(lo[2], hi[2] + step * 0.5, step)
    grid = np.stack(np.meshgrid(xs, ys, zs, indexing="ij"), axis=-1)
    values = fn(grid.reshape(-1, 3)).reshape(len(xs), len(ys), len(zs))

    vertices, faces, _, _ = measure.marching_cubes(values, level=0.0, spacing=(step,) * 3)
    vertices += np.array([xs[0], ys[0], zs[0]])
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=True)
    mesh.merge_vertices()
    mesh.update_faces(mesh.nondegenerate_faces())
    mesh.remove_unreferenced_vertices()
    if smooth_iterations:
        trimesh.smoothing.filter_taubin(
            mesh, lamb=0.45, nu=-0.5, iterations=smooth_iterations
        )
    if not mesh.is_watertight:
        trimesh.repair.fill_holes(mesh)
        mesh.fix_normals()
    if len(mesh.faces) > target_faces:
        mesh = mesh.simplify_quadric_decimation(face_count=target_faces)
    if not mesh.is_watertight:
        trimesh.repair.fill_holes(mesh)
    mesh.fix_normals()
    mesh.remove_unreferenced_vertices()
    if not mesh.is_watertight:
        print(f"  advertencia: malla no estanca ({len(mesh.faces)} caras)")
    return mesh


def color_body(mesh: trimesh.Trimesh) -> np.ndarray:
    p = mesh.vertices
    n = mesh.vertex_normals
    belly_mask = (
        np.clip((n[:, 2] - 0.02) / 0.5, 0.0, 1.0)
        * np.clip((p[:, 1] - 0.50) / 0.16, 0.0, 1.0)
        * np.clip((1.17 - p[:, 1]) / 0.16, 0.0, 1.0)
        * np.clip((0.28 - np.abs(p[:, 0])) / 0.09, 0.0, 1.0)
    )
    factor = (belly_mask**1.25) * 0.95
    return BODY[None, :] * (1.0 - factor[:, None]) + BODY_LIGHT[None, :] * factor[:, None]


# ---------------------------------------------------------------------------
# Piezas auxiliares (ojos, dientes, garras)
# ---------------------------------------------------------------------------


def sphere_like(
    center,
    scale,
    subdiv: int = 3,
    direction=(0.0, 0.0, 1.0),
) -> trimesh.Trimesh:
    mesh = trimesh.creation.icosphere(subdivisions=subdiv, radius=1.0)
    mesh.vertices *= np.asarray(scale, dtype=np.float64)
    direction = np.asarray(direction, dtype=np.float64)
    direction /= np.linalg.norm(direction)
    matrix = trimesh.geometry.align_vectors([0.0, 0.0, 1.0], direction)
    mesh.apply_transform(matrix)
    mesh.apply_translation(center)
    return mesh


def cone_between(
    base,
    tip,
    radius: float,
    *,
    sections: int = 12,
) -> trimesh.Trimesh:
    base = np.asarray(base, dtype=np.float64)
    tip = np.asarray(tip, dtype=np.float64)
    direction = tip - base
    length = np.linalg.norm(direction)
    direction /= max(length, 1e-9)
    mesh = trimesh.creation.cone(radius=radius, height=length, sections=sections)
    matrix = trimesh.geometry.align_vectors([0.0, 0.0, 1.0], direction)
    mesh.apply_transform(matrix)
    mesh.apply_translation(base)
    return mesh


def combine(meshes, mat: PBRMaterial) -> trimesh.Trimesh:
    combined = trimesh.util.concatenate(meshes)
    combined.visual = trimesh.visual.TextureVisuals(material=mat)
    return combined


# ---------------------------------------------------------------------------
# Construcción
# ---------------------------------------------------------------------------

BODY_PIVOT = np.zeros(3)
ARM_PIVOT = {
    -1.0: np.array([-0.35, 1.02, 0.02]),
    1.0: np.array([0.35, 1.02, 0.02]),
}
LEG_PIVOT = {
    -1.0: np.array([-0.22, 0.50, 0.01]),
    1.0: np.array([0.22, 0.50, 0.01]),
}
TAIL_PIVOT = np.array([0.0, 0.72, -0.28])


def build() -> trimesh.Scene:
    print("Generando cuerpo…")
    body = sdf_mesh(sd_body, ((-0.60, 0.20, -0.70), (0.60, 1.60, 0.60)), 0.014, 26000)
    vertex_colored_mesh(body, color_body(body), BODY_VERTEX_MAT)
    print("  cuerpo:", len(body.faces), "caras")

    print("Generando cabeza…")
    head = sdf_mesh(
        sd_head, ((-0.62, -0.48, -0.55), (0.62, 0.78, 0.92)), 0.011, 20000
    )
    solid_mesh(head, BODY_MAT)
    print("  cabeza:", len(head.faces), "caras")

    print("Generando mandíbula…")
    jaw = sdf_mesh(
        sd_jaw, ((-0.36, -0.46, -0.20), (0.36, -0.04, 0.86)), 0.010, 5000
    )
    jaw.apply_translation(-JAW_PIVOT)
    solid_mesh(jaw, BODY_MAT)
    print("  mandíbula:", len(jaw.faces), "caras")

    print("Generando brazos y piernas…")
    arms = {}
    legs = {}
    hand_claws = {}
    foot_claws = {}
    for side in (-1.0, 1.0):
        arm = sdf_mesh(
            lambda p, s=side: sd_arm(p, s),
            ((-0.34, -0.82, -0.16), (0.34, 0.18, 0.52)),
            0.009,
            4200,
        )
        solid_mesh(arm, BODY_MAT)
        arms[side] = arm

        hand = np.array([0.12 * side, -0.56, 0.28])
        finger_tips = [
            np.array([0.06 * side, -0.66, 0.39]),
            np.array([0.13 * side, -0.665, 0.37]),
            np.array([0.19 * side, -0.635, 0.32]),
        ]
        claws = []
        for i, tip in enumerate(finger_tips):
            direction = tip - hand
            direction /= np.linalg.norm(direction)
            claw_tip = tip + direction * 0.145 + np.array([0.0, -0.012, 0.026])
            claws.append(cone_between(tip - direction * 0.015, claw_tip, 0.037))
        hand_claws[side] = combine(claws, CLAW_MAT)

        leg = sdf_mesh(
            sd_leg,
            ((-0.28, -0.54, -0.20), (0.28, 0.24, 0.52)),
            0.010,
            5400,
        )
        solid_mesh(leg, BODY_MAT)
        legs[side] = leg

        toes = []
        for x in (-0.09, 0.0, 0.09):
            toes.append(
                cone_between((x, -0.445, 0.39), (x, -0.46, 0.58), 0.041)
            )
        foot_claws[side] = combine(toes, CLAW_MAT)

    print("Generando cola…")
    tail = sdf_mesh(sd_tail, ((-0.28, -0.58, -0.90), (0.28, 0.24, 0.16)), 0.010, 5000)
    solid_mesh(tail, BODY_MAT)

    print("Generando ojos, boca y dientes…")
    eye_white = []
    eye_iris = []
    eye_pupil = []
    eye_glint = []
    for side in (-1.0, 1.0):
        center = np.array([side * 0.17, 0.24, 0.39])
        normal = np.array([side * 0.16, 0.02, 0.987])
        normal /= np.linalg.norm(normal)
        eye_white.append(
            sphere_like(center, (0.117, 0.135, 0.057), subdiv=3, direction=normal)
        )
        eye_iris.append(
            sphere_like(
                center + normal * 0.046,
                (0.113, 0.138, 0.020),
                subdiv=3,
                direction=normal,
            )
        )
        eye_pupil.append(
            sphere_like(
                center + normal * 0.061,
                (0.046, 0.081, 0.013),
                subdiv=2,
                direction=normal,
            )
        )
        glint_center = center + normal * 0.073 + np.array([-side * 0.018, 0.037, 0.0])
        eye_glint.append(
            sphere_like(
                glint_center,
                (0.023, 0.023, 0.011),
                subdiv=2,
                direction=normal,
            )
        )

    eyes_white = combine(eye_white, EYE_WHITE_MAT)
    eyes_iris = combine(eye_iris, EYE_GREEN_MAT)
    eyes_pupil = combine(eye_pupil, EYE_DARK_MAT)
    eyes_glint = combine(eye_glint, EYE_GLINT_MAT)

    mouth_parts = [
        sphere_like((0.0, -0.135, 0.815), (0.20, 0.016, 0.012), subdiv=3),
        sphere_like((-0.16, -0.115, 0.80), (0.07, 0.015, 0.012), subdiv=3),
        sphere_like((0.16, -0.115, 0.80), (0.07, 0.015, 0.012), subdiv=3),
    ]
    mouth = combine(mouth_parts, MOUTH_MAT)
    tongue = sphere_like((0.0, -0.16, 0.75), (0.10, 0.018, 0.04), subdiv=3)
    solid_mesh(tongue, TONGUE_MAT)

    upper_teeth = []
    for x, length in ((-0.18, 0.045), (-0.06, 0.020), (0.06, 0.020), (0.18, 0.045)):
        upper_teeth.append(
            cone_between((x, -0.13, 0.825), (x, -0.13 - length, 0.825), 0.014)
        )
    teeth_upper = combine(upper_teeth, CLAW_MAT)

    lower_teeth = []
    for x, length in ((-0.12, 0.022), (0.12, 0.022)):
        base_head = np.array([x, -0.19, 0.79])
        base_local = base_head - JAW_PIVOT
        lower_teeth.append(
            cone_between(base_local, base_local + np.array([0.0, length, 0.0]), 0.012)
        )
    teeth_lower = combine(lower_teeth, CLAW_MAT)

    nostrils = []
    for side in (-1.0, 1.0):
        nostrils.append(
            sphere_like(
                (side * 0.07, 0.12, 0.72),
                (0.024, 0.015, 0.009),
                subdiv=2,
                direction=(0.0, 0.25, 1.0),
            )
        )
    nostril_mesh = combine(nostrils, NOSTRIL_MAT)

    # ------------------------------------------------------------------
    # Escena jerárquica
    # ------------------------------------------------------------------
    scene = trimesh.Scene()

    def add(mesh, name, parent=None, translation=None):
        scene.add_geometry(mesh, node_name=name, geom_name=name)
        if parent is not None:
            matrix = (
                trimesh.transformations.translation_matrix(translation)
                if translation is not None
                else np.eye(4)
            )
            scene.graph.update(frame_to=name, frame_from=parent, matrix=matrix)

    add(body, "body")
    add(head, "head", "body", HEAD_PIVOT)
    add(jaw, "jaw", "head", JAW_PIVOT)
    add(eyes_white, "eyesWhite", "head")
    add(eyes_iris, "eyesIris", "head")
    add(eyes_pupil, "eyesPupil", "head")
    add(eyes_glint, "eyesGlint", "head")
    add(teeth_upper, "teethUpper", "head")
    add(teeth_lower, "teethLower", "jaw")
    add(mouth, "mouth", "head")
    add(tongue, "tongue", "head")
    add(nostril_mesh, "nostrils", "head")

    for side, label in ((-1.0, "L"), (1.0, "R")):
        add(arms[side], f"arm{label}", "body", ARM_PIVOT[side])
        add(hand_claws[side], f"clawsHand{label}", f"arm{label}")
        add(legs[side], f"leg{label}", "body", LEG_PIVOT[side])
        add(foot_claws[side], f"clawsFoot{label}", f"leg{label}")

    add(tail, "tail", "body", TAIL_PIVOT)

    return scene


def inspect_glb(path: Path) -> dict:
    data = path.read_bytes()
    _, _, _ = struct.unpack_from("<III", data, 0)
    chunk_len, _ = struct.unpack_from("<II", data, 12)
    js = json.loads(data[20 : 20 + chunk_len].decode("utf-8"))
    return {
        "bytes": len(data),
        "nodes": [node.get("name") for node in js.get("nodes", [])],
        "materials": [mat.get("name") for mat in js.get("materials", [])],
        "meshes": len(js.get("meshes", [])),
        "accessors": len(js.get("accessors", [])),
    }


if __name__ == "__main__":
    scene = build()
    scene.export(str(OUT), include_normals=True)
    info = inspect_glb(OUT)
    print("\nGLB:", OUT)
    print("Tamaño:", round(info["bytes"] / 1024 / 1024, 2), "MB")
    print("Nodos:", ", ".join(info["nodes"]))
    print("Materiales:", ", ".join(info["materials"]))
    print("Mallas:", info["meshes"])
