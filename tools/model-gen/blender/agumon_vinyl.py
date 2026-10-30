"""Genera Agumon en estilo figura de vinilo PBR con Blender.

Construye cada pieza a partir de primitivas suaves (esferas, capsulas y tubos),
las une con un remesh por vóxeles, las alisa y las exporta como GLB con la
jerarquía de nodos que usa DIGIWORLD ONLINE:

    Agumon
      body
        head
          jaw
        armL
        armR
        legL
        legR
        tail

También guarda una versión densa (con Subdivision Surface sin aplicar) para
renders de alta calidad, y una hoja de previsualización con cuatro vistas.

Uso:
    blender -b --python tools/model-gen/blender/agumon_vinyl.py -- [--quick] [--no-render]
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Presupuesto y proporciones
# ---------------------------------------------------------------------------

TOTAL_TRIS = 40_000

TARGET_TRIS = {
    "body": 6_000,
    "head": 8_800,
    "jaw": 2_000,
    "armL": 2_700,
    "armR": 2_700,
    "legL": 4_000,
    "legR": 4_000,
    "tail": 1_100,
    "teethUpper": 1_000,
    "teethLower": 800,
    "tongue": 700,
    "throat": 400,
    "clawHandL": 650,
    "clawHandR": 650,
    "clawFootL": 900,
    "clawFootR": 900,
    "nostrilL": 140,
    "nostrilR": 140,
    "eyeWhiteL": 600,
    "eyeWhiteR": 600,
    "eyeIrisL": 400,
    "eyeIrisR": 400,
    "eyePupilL": 250,
    "eyePupilR": 250,
    "eyeGlintL": 150,
    "eyeGlintR": 150,
    "eyeRimL": 400,
    "eyeRimR": 400,
}
DEFAULT_DETAIL_TRIS = 600


# ---------------------------------------------------------------------------
# Utilidades de escena
# ---------------------------------------------------------------------------


def reset_scene() -> bpy.types.Scene:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.exposure = -0.45
    try:
        scene.view_settings.look = "None"
    except TypeError:
        pass
    return scene


def new_collection(name: str) -> bpy.types.Collection:
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def set_active(obj: bpy.types.Object) -> None:
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_modifier(obj: bpy.types.Object, mod: bpy.types.Modifier) -> None:
    set_active(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def shade_smooth(obj: bpy.types.Object) -> None:
    for poly in obj.data.polygons:
        poly.use_smooth = True


# ---------------------------------------------------------------------------
# Materiales
# ---------------------------------------------------------------------------


def srgb_to_linear(value: float) -> float:
    if value <= 0.04045:
        return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4


def hex_rgba(hex_color: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    value = hex_color.lstrip("#")
    rgb = [int(value[i : i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(srgb_to_linear(c) for c in rgb) + (alpha,)


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    if edge0 == edge1:
        return 0.0
    t = (value - edge0) / (edge1 - edge0)
    t = min(1.0, max(0.0, t))
    return t * t * (3.0 - 2.0 * t)


BODY_COLOR = "#DFA71F"
BELLY_COLOR = "#E9BE44"


def paint_body_colors(obj: bpy.types.Object) -> None:
    """Pinta el degradado de la barriga en un atributo de color por vértice."""
    mesh = obj.data
    existing = mesh.color_attributes.get("Col")
    if existing is not None:
        mesh.color_attributes.remove(existing)
    layer = mesh.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
    body = Vector(hex_rgba(BODY_COLOR)[:3])
    belly = Vector(hex_rgba(BELLY_COLOR)[:3])
    for index, vert in enumerate(mesh.vertices):
        point = vert.co
        distance = math.sqrt(
            (point.x / 0.215) ** 2 + ((point.z - 0.79) / 0.245) ** 2
        )
        front = smoothstep(-0.02, -0.17, point.y)
        inside = smoothstep(1.05, 0.68, distance)
        color = body.lerp(belly, front * inside)
        layer.data[index].color = (color.x, color.y, color.z, 1.0)
    mesh.color_attributes.active_color_index = 0
    mesh.color_attributes.render_color_index = 0
    mesh.update()


def make_material(
    name: str,
    hex_color: str,
    *,
    roughness: float = 0.4,
    metallic: float = 0.0,
    coat: float = 0.0,
    coat_roughness: float = 0.35,
    emission: float = 0.0,
    vertex_color: str | None = None,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = False
    color = hex_rgba(hex_color)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = coat_roughness
    if emission > 0.0:
        bsdf.inputs["Emission Color"].default_value = color
        bsdf.inputs["Emission Strength"].default_value = emission
    if vertex_color:
        attribute = mat.node_tree.nodes.new("ShaderNodeVertexColor")
        attribute.layer_name = vertex_color
        mat.node_tree.links.new(attribute.outputs["Color"], bsdf.inputs["Base Color"])
    mat.diffuse_color = color
    return mat


class Mats:
    pass


def build_materials() -> Mats:
    m = Mats()
    m.body = make_material("BodyVinyl", "#DFA71F", roughness=0.45, coat=0.18, coat_roughness=0.42)
    m.body_belly = make_material(
        "BodyVinylBelly",
        "#FFFFFF",
        roughness=0.45,
        coat=0.18,
        coat_roughness=0.42,
        vertex_color="Col",
    )
    m.belly = make_material("BellyVinyl", "#E9BE44", roughness=0.48, coat=0.12)    m.claw = make_material("ClawIvory", "#EAE3D2", roughness=0.32, coat=0.25)
    m.tooth = make_material("ToothIvory", "#F8F3E5", roughness=0.28, coat=0.2)
    m.eye_white = make_material("EyeWhite", "#F6F1DF", roughness=0.12, coat=1.0, coat_roughness=0.08)
    m.eye_iris = make_material("EyeIris", "#1E9E58", roughness=0.16, coat=0.9, coat_roughness=0.1)
    m.eye_iris_dark = make_material("EyeIrisDark", "#136B3A", roughness=0.16, coat=0.9)
    m.eye_pupil = make_material("EyePupil", "#0A120D", roughness=0.1, coat=1.0)
    m.eye_glint = make_material("EyeGlint", "#FFFFFF", roughness=0.05, emission=0.15)
    m.eye_rim = make_material("EyeSocket", "#2B2111", roughness=0.55)
    m.mouth = make_material("Mouth", "#5C1015", roughness=0.52)
    m.tongue = make_material("Tongue", "#B94A55", roughness=0.36, coat=0.2)
    m.nostril = make_material("Nostril", "#3A2810", roughness=0.55)
    return m


# ---------------------------------------------------------------------------
# Primitivas bmesh
# ---------------------------------------------------------------------------


def bm_sphere(
    bm: bmesh.types.BMesh,
    center,
    scale,
    *,
    rot=None,
    u_segments: int = 32,
    v_segments: int = 16,
) -> list[bmesh.types.BMVert]:
    try:
        ret = bmesh.ops.create_uvsphere(
            bm, u_segments=u_segments, v_segments=v_segments, radius=1.0
        )
    except TypeError:  # Blender < 3.0
        ret = bmesh.ops.create_uvsphere(
            bm, u_segments=u_segments, v_segments=v_segments, diameter=1.0
        )
    matrix = Matrix.Translation(Vector(center))
    if rot is not None:
        matrix = matrix @ rot.to_matrix().to_4x4()
    sx, sy, sz = scale
    matrix = matrix @ Matrix.Diagonal(Vector((sx, sy, sz, 1.0)))
    bmesh.ops.transform(bm, matrix=matrix, verts=ret["verts"])
    return ret["verts"]


def bm_capsule(
    bm: bmesh.types.BMesh,
    a,
    b,
    radius_a: float,
    radius_b: float | None = None,
    *,
    segments: int = 24,
) -> None:
    a = Vector(a)
    b = Vector(b)
    radius_b = radius_a if radius_b is None else radius_b
    direction = b - a
    length = direction.length
    if length < 1e-6:
        bm_sphere(bm, a, (radius_a, radius_a, radius_a), u_segments=segments, v_segments=segments // 2)
        return
    ret = bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=segments,
        radius1=radius_a,
        radius2=radius_b,
        depth=length,
    )
    rot = direction.to_track_quat("Z", "Y").to_matrix().to_4x4()
    matrix = Matrix.Translation(a + direction * 0.5) @ rot
    bmesh.ops.transform(bm, matrix=matrix, verts=ret["verts"])
    bm_sphere(bm, a, (radius_a, radius_a, radius_a), u_segments=segments, v_segments=segments // 2)
    bm_sphere(bm, b, (radius_b, radius_b, radius_b), u_segments=segments, v_segments=segments // 2)


def bm_tube(
    bm: bmesh.types.BMesh,
    points: list[Vector],
    radii: list[float],
    *,
    sides: int = 10,
    cap_start: bool = True,
) -> None:
    rings: list[list[bmesh.types.BMVert]] = []
    for index, point in enumerate(points):
        if index == 0:
            tangent = points[1] - points[0]
        elif index == len(points) - 1:
            tangent = points[-1] - points[-2]
        else:
            tangent = points[index + 1] - points[index - 1]
        tangent.normalize()
        up = Vector((0.0, 0.0, 1.0))
        if abs(tangent.dot(up)) > 0.95:
            up = Vector((0.0, 1.0, 0.0))
        axis_u = tangent.cross(up)
        axis_u.normalize()
        axis_v = tangent.cross(axis_u)
        axis_v.normalize()
        ring = []
        for side in range(sides):
            angle = 2.0 * math.pi * side / sides
            offset = axis_u * (math.cos(angle) * radii[index]) + axis_v * (
                math.sin(angle) * radii[index]
            )
            ring.append(bm.verts.new(point + offset))
        rings.append(ring)

    for index in range(len(rings) - 1):
        for side in range(sides):
            a = rings[index][side]
            b = rings[index][(side + 1) % sides]
            c = rings[index + 1][(side + 1) % sides]
            d = rings[index + 1][side]
            bm.faces.new((a, b, c, d))

    if cap_start:
        bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(tuple(rings[-1]))


def bm_torus(
    bm: bmesh.types.BMesh,
    center,
    normal,
    major_radius: float,
    minor_radius: float,
    *,
    sides: int = 10,
    segments: int = 48,
) -> None:
    center = Vector(center)
    normal = Vector(normal).normalized()
    quat = normal.to_track_quat("Z", "Y")
    axis_u = quat @ Vector((1.0, 0.0, 0.0))
    axis_v = quat @ Vector((0.0, 1.0, 0.0))
    rings = []
    for index in range(segments):
        angle = 2.0 * math.pi * index / segments
        radial = axis_u * math.cos(angle) + axis_v * math.sin(angle)
        ring_center = center + radial * major_radius
        ring = []
        for side in range(sides):
            tube_angle = 2.0 * math.pi * side / sides
            point = (
                ring_center
                + radial * (minor_radius * math.cos(tube_angle))
                + normal * (minor_radius * math.sin(tube_angle))
            )
            ring.append(bm.verts.new(point))
        rings.append(ring)
    for index in range(segments):
        ring_a = rings[index]
        ring_b = rings[(index + 1) % segments]
        for side in range(sides):
            bm.faces.new(
                (
                    ring_a[side],
                    ring_a[(side + 1) % sides],
                    ring_b[(side + 1) % sides],
                    ring_b[side],
                )
            )


def bm_cap(
    bm: bmesh.types.BMesh,
    center,
    direction,
    radius: float,
    rim_radius: float,
    *,
    segments: int = 48,
    rings: int = 10,
) -> None:
    """Casquete esférico orientado: ideal para iris y pupilas pintadas."""
    center = Vector(center)
    direction = Vector(direction).normalized()
    quat = direction.to_track_quat("Z", "Y")
    axis_u = quat @ Vector((1.0, 0.0, 0.0))
    axis_v = quat @ Vector((0.0, 1.0, 0.0))
    cos_limit = math.sqrt(max(0.0, 1.0 - (rim_radius / radius) ** 2))
    phi_max = math.acos(min(1.0, cos_limit))

    pole = bm.verts.new(center + direction * radius)
    ring_list: list[list[bmesh.types.BMVert]] = []
    for index in range(1, rings + 1):
        phi = phi_max * index / rings
        ring_radius = radius * math.sin(phi)
        height = radius * math.cos(phi)
        ring = []
        for side in range(segments):
            angle = 2.0 * math.pi * side / segments
            point = (
                center
                + direction * height
                + axis_u * (ring_radius * math.cos(angle))
                + axis_v * (ring_radius * math.sin(angle))
            )
            ring.append(bm.verts.new(point))
        ring_list.append(ring)

    first = ring_list[0]
    for side in range(segments):
        bm.faces.new((pole, first[side], first[(side + 1) % segments]))
    for index in range(len(ring_list) - 1):
        ring_a = ring_list[index]
        ring_b = ring_list[index + 1]
        for side in range(segments):
            bm.faces.new(
                (
                    ring_a[side],
                    ring_b[side],
                    ring_b[(side + 1) % segments],
                    ring_a[(side + 1) % segments],
                )
            )


def bm_claw(
    bm: bmesh.types.BMesh,
    base,
    direction,
    length: float,
    radius: float,
    bend=(0.0, 0.0, 0.0),
    *,
    sides: int = 12,
    steps: int = 8,
) -> None:
    base = Vector(base)
    direction = Vector(direction).normalized()
    bend = Vector(bend)
    points = []
    radii = []
    for index in range(steps):
        t = index / (steps - 1)
        points.append(base + direction * (length * t) + bend * (t * t))
        radii.append(max(radius * (1.0 - t) ** 0.75, radius * 0.06))
    bm_tube(bm, points, radii, sides=sides)


def finalize(name: str, bm: bmesh.types.BMesh, material, collection) -> bpy.types.Object:
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    mesh.materials.append(material)
    shade_smooth(obj)
    return obj


def organic(
    obj: bpy.types.Object,
    *,
    voxel: float = 0.008,
    smooth_iterations: int = 10,
    smooth_factor: float = 0.55,
) -> None:
    remesh = obj.modifiers.new("VoxelRemesh", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = voxel
    remesh.use_smooth_shade = True
    apply_modifier(obj, remesh)

    if smooth_iterations:
        smooth = obj.modifiers.new("Smooth", "SMOOTH")
        smooth.factor = smooth_factor
        smooth.iterations = smooth_iterations
        apply_modifier(obj, smooth)

    shade_smooth(obj)


def boolean_difference(obj: bpy.types.Object, cutter: bpy.types.Object) -> None:
    mod = obj.modifiers.new("Cut", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    mod.object = cutter
    apply_modifier(obj, mod)
    bpy.data.objects.remove(cutter, do_unlink=True)


def set_origin(obj: bpy.types.Object, pivot) -> None:
    pivot = Vector(pivot)
    obj.data.transform(Matrix.Translation(-pivot))
    obj.location = pivot


def parent_keep_world(child: bpy.types.Object, parent: bpy.types.Object) -> None:
    # matrix_world se cachea: hay que refrescar antes de leerlo.
    bpy.context.view_layer.update()
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()
    bpy.context.view_layer.update()


def triangle_count(obj: bpy.types.Object) -> int:
    return sum(len(poly.vertices) - 2 for poly in obj.data.polygons)


# ---------------------------------------------------------------------------
# Piezas
# ---------------------------------------------------------------------------


def build_body(mats: Mats, col) -> bpy.types.Object:
    bm = bmesh.new()
    # Pelvis y caderas
    bm_sphere(bm, (0.0, 0.015, 0.585), (0.27, 0.225, 0.20))
    # Vientre
    bm_sphere(bm, (0.0, -0.05, 0.78), (0.28, 0.255, 0.25))
    # Pecho
    bm_sphere(bm, (0.0, -0.01, 0.97), (0.25, 0.215, 0.175))
    # Hombros
    bm_sphere(bm, (0.215, 0.0, 1.0), (0.11, 0.11, 0.105))
    bm_sphere(bm, (-0.215, 0.0, 1.0), (0.11, 0.11, 0.105))
    # Cuello corto y grueso
    bm_capsule(bm, (0.0, 0.025, 1.02), (0.0, 0.035, 1.20), 0.16, 0.14)
    # Nalga / base de la cola
    bm_sphere(bm, (0.0, 0.17, 0.60), (0.17, 0.14, 0.15))

    obj = finalize("body", bm, mats.body_belly, col)
    organic(obj, voxel=0.008, smooth_iterations=20, smooth_factor=0.62)

    # La barriga se pinta con un degradado suave por vértices.
    paint_body_colors(obj)
    return obj


def build_head(mats: Mats, col, mouth_center, mouth_radii) -> bpy.types.Object:
    bm = bmesh.new()
    # Cráneo redondeado, un poco más alto que ancho
    bm_sphere(bm, (0.0, 0.045, 1.475), (0.29, 0.27, 0.30))
    bm_sphere(bm, (0.0, 0.085, 1.45), (0.26, 0.24, 0.26))
    bm_sphere(bm, (0.0, 0.03, 1.64), (0.24, 0.22, 0.09))
    # Protuberancias superiores traseras (las "orejas" del reverso)
    bm_sphere(bm, (0.20, 0.13, 1.645), (0.055, 0.06, 0.055))
    bm_sphere(bm, (-0.20, 0.13, 1.645), (0.055, 0.06, 0.055))
    # Mejillas integradas
    bm_sphere(bm, (0.225, -0.05, 1.43), (0.055, 0.08, 0.07))
    bm_sphere(bm, (-0.225, -0.05, 1.43), (0.055, 0.08, 0.07))
    # Arco superciliar que hace de párpado superior
    bm_sphere(bm, (0.13, -0.21, 1.645), (0.085, 0.045, 0.024))
    bm_sphere(bm, (-0.13, -0.21, 1.645), (0.085, 0.045, 0.024))
    # Hocico corto y ancho, más estrecho que el cráneo
    bm_sphere(bm, (0.0, -0.275, 1.385), (0.185, 0.17, 0.125))
    bm_sphere(bm, (0.0, -0.37, 1.40), (0.14, 0.085, 0.095))
    bm_sphere(bm, (0.0, -0.18, 1.43), (0.185, 0.09, 0.10))

    obj = finalize("head", bm, mats.body, col)
    organic(obj, voxel=0.0075, smooth_iterations=13, smooth_factor=0.58)

    # Hueco de la boca: se rebaja la parte inferior del hocico.
    cutter_bm = bmesh.new()
    bm_sphere(cutter_bm, mouth_center, mouth_radii, u_segments=48, v_segments=24)
    cutter = finalize("mouth_cutter", cutter_bm, mats.body, col)
    boolean_difference(obj, cutter)

    # El interior de la boca queda en rojo oscuro.
    obj.data.materials.append(mats.mouth)
    mouth_index = len(obj.data.materials) - 1
    center = Vector(mouth_center)
    radii = Vector(mouth_radii)
    obj.data.update()
    for poly in obj.data.polygons:
        point = poly.center
        distance = (
            ((point.x - center.x) / radii.x) ** 2
            + ((point.y - center.y) / radii.y) ** 2
            + ((point.z - center.z) / radii.z) ** 2
        )
        if distance < 1.02:
            poly.material_index = mouth_index

    # Alisado muy leve del borde de los labios.
    smooth = obj.modifiers.new("LipSmooth", "SMOOTH")
    smooth.factor = 0.3
    smooth.iterations = 2
    apply_modifier(obj, smooth)
    shade_smooth(obj)
    return obj


def build_jaw(mats: Mats, col, mouth_center, mouth_radii) -> bpy.types.Object:
    bm = bmesh.new()
    bm_sphere(bm, (0.0, -0.27, 1.258), (0.175, 0.175, 0.102))
    bm_sphere(bm, (0.0, -0.35, 1.268), (0.12, 0.08, 0.078))
    bm_sphere(bm, (0.0, -0.13, 1.258), (0.15, 0.11, 0.088))
    # Mentón
    bm_sphere(bm, (0.0, -0.31, 1.215), (0.118, 0.11, 0.07))

    obj = finalize("jaw", bm, mats.body, col)
    organic(obj, voxel=0.007, smooth_iterations=8, smooth_factor=0.5)

    # Hueco superior de la mandíbula para la lengua.
    cutter_bm = bmesh.new()
    bm_sphere(
        cutter_bm,
        (mouth_center[0], mouth_center[1], mouth_center[2] - 0.055),
        (mouth_radii[0] * 0.80, mouth_radii[1] * 0.82, mouth_radii[2] * 0.55),
        u_segments=40,
        v_segments=20,
    )
    cutter = finalize("jaw_cutter", cutter_bm, mats.body, col)
    boolean_difference(obj, cutter)

    obj.data.materials.append(mats.mouth)
    mouth_index = len(obj.data.materials) - 1
    obj.data.update()
    center = Vector((mouth_center[0], mouth_center[1], mouth_center[2] - 0.055))
    radii = Vector((mouth_radii[0] * 0.80, mouth_radii[1] * 0.82, mouth_radii[2] * 0.55))
    for poly in obj.data.polygons:
        point = poly.center
        distance = (
            ((point.x - center.x) / radii.x) ** 2
            + ((point.y - center.y) / radii.y) ** 2
            + ((point.z - center.z) / radii.z) ** 2
        )
        if distance < 1.03:
            poly.material_index = mouth_index
    shade_smooth(obj)
    return obj


def build_arm(mats: Mats, col, side: int) -> bpy.types.Object:
    sx = side
    bm = bmesh.new()
    shoulder = Vector((sx * 0.275, 0.0, 1.0))
    elbow = Vector((sx * 0.34, -0.055, 0.865))
    wrist = Vector((sx * 0.375, -0.10, 0.735))
    palm = Vector((sx * 0.38, -0.09, 0.688))

    bm_sphere(bm, shoulder, (0.115, 0.11, 0.115))
    bm_capsule(bm, shoulder, elbow, 0.10, 0.085)
    bm_sphere(bm, elbow, (0.086, 0.086, 0.086))
    bm_capsule(bm, elbow, wrist, 0.085, 0.068)
    bm_sphere(bm, palm, (0.08, 0.09, 0.065))
    # Nudillo / dorso de la mano
    bm_sphere(bm, (sx * 0.38, -0.07, 0.715), (0.07, 0.075, 0.052))

    spread = (-0.047, 0.0, 0.047)
    for index, offset in enumerate(spread):
        base_x = sx * (0.38 + offset)
        bm_capsule(
            bm,
            (base_x, -0.095, 0.675),
            (base_x + sx * offset * 0.6, -0.145, 0.618),
            0.033,
            0.026,
        )

    obj = finalize(f"arm{'L' if side > 0 else 'R'}", bm, mats.body, col)
    organic(obj, voxel=0.007, smooth_iterations=9, smooth_factor=0.55)

    # Garras de la mano
    cb = bmesh.new()
    for index, offset in enumerate(spread):
        base_x = sx * (0.38 + offset)
        tip = Vector((base_x + sx * offset * 0.6, -0.147, 0.618))
        bm_claw(
            cb,
            tip + Vector((0.0, -0.006, 0.0)),
            (sx * 0.12 + sx * offset * 0.5, -0.34, -1.0),
            0.115,
            0.036,
            bend=(sx * 0.016, -0.012, 0.012),
        )
    claws = finalize(f"clawHand{'L' if side > 0 else 'R'}", cb, mats.claw, col)
    return obj, claws


def build_leg(mats: Mats, col, side: int) -> bpy.types.Object:
    sx = side
    bm = bmesh.new()
    hip = Vector((sx * 0.175, 0.02, 0.575))
    knee = Vector((sx * 0.215, -0.075, 0.35))
    ankle = Vector((sx * 0.212, -0.005, 0.135))

    bm_sphere(bm, hip, (0.155, 0.15, 0.155))
    bm_capsule(bm, hip, knee, 0.15, 0.112)
    bm_sphere(bm, knee, (0.112, 0.112, 0.105))
    bm_capsule(bm, knee, ankle, 0.105, 0.09)
    # Pie ancho
    bm_sphere(bm, (sx * 0.212, -0.06, 0.08), (0.125, 0.18, 0.082))
    bm_sphere(bm, (sx * 0.212, 0.08, 0.078), (0.092, 0.092, 0.078))
    bm_sphere(bm, (sx * 0.212, -0.155, 0.065), (0.118, 0.085, 0.065))

    toes = (-0.105, 0.0, 0.105)
    for offset in toes:
        base_x = sx * 0.212 + offset
        bm_capsule(
            bm,
            (base_x, -0.155, 0.058),
            (base_x + offset * 0.35, -0.265, 0.05),
            0.054,
            0.046,
        )

    obj = finalize(f"leg{'L' if side > 0 else 'R'}", bm, mats.body, col)
    organic(obj, voxel=0.0075, smooth_iterations=10, smooth_factor=0.55)

    cb = bmesh.new()
    for offset in toes:
        base_x = sx * 0.212 + offset
        tip = Vector((base_x + offset * 0.35, -0.27, 0.05))
        bm_claw(
            cb,
            tip - Vector((0.0, 0.014, 0.0)),
            (offset * 1.6, -1.0, 0.20),
            0.165 if offset == 0.0 else 0.145,
            0.043,
            bend=(0.0, 0.0, 0.025),
        )
    claws = finalize(f"clawFoot{'L' if side > 0 else 'R'}", cb, mats.claw, col)
    return obj, claws


def build_tail(mats: Mats, col) -> bpy.types.Object:
    bm = bmesh.new()
    points = [
        Vector((0.0, 0.22, 0.63)),
        Vector((0.0, 0.34, 0.575)),
        Vector((0.0, 0.45, 0.49)),
        Vector((0.0, 0.53, 0.40)),
    ]
    radii = [0.15, 0.12, 0.075, 0.02]
    # Tubo cerrado en la base con una esfera y punta redondeada.
    bm_sphere(bm, points[0], (radii[0], radii[0], radii[0]))
    for index in range(len(points) - 1):
        bm_capsule(bm, points[index], points[index + 1], radii[index], radii[index + 1])
    bm_sphere(bm, points[-1], (radii[-1], radii[-1], radii[-1]))

    obj = finalize("tail", bm, mats.body, col)
    organic(obj, voxel=0.008, smooth_iterations=9, smooth_factor=0.55)
    return obj


def build_eye(mats: Mats, col, side: int, root_collection) -> list[bpy.types.Object]:
    sx = side
    center = Vector((sx * 0.128, -0.175, 1.535))
    direction = Vector((sx * 0.03, -1.0, 0.02)).normalized()
    quat = direction.to_track_quat("Z", "Y")
    objects = []

    white_bm = bmesh.new()
    bm_sphere(white_bm, center, (0.080, 0.080, 0.080))
    objects.append(finalize(f"eyeWhite{'L' if side > 0 else 'R'}", white_bm, mats.eye_white, col))

    # Iris y pupila como casquetes esféricos: quedan pintados sobre el globo.
    iris_bm = bmesh.new()
    bm_cap(iris_bm, center, direction, 0.0815, 0.0785, segments=56, rings=12)
    objects.append(finalize(f"eyeIris{'L' if side > 0 else 'R'}", iris_bm, mats.eye_iris, col))

    pupil_bm = bmesh.new()
    bm_cap(pupil_bm, center, direction, 0.0835, 0.032, segments=48, rings=8)
    objects.append(finalize(f"eyePupil{'L' if side > 0 else 'R'}", pupil_bm, mats.eye_pupil, col))

    glint_bm = bmesh.new()
    up = Vector((0.0, 0.0, 1.0))
    side_axis = direction.cross(up).normalized()
    bm_sphere(
        glint_bm,
        center + direction * 0.084 + up * 0.028 + side_axis * 0.018,
        (0.013, 0.013, 0.008),
        rot=quat,
        u_segments=20,
        v_segments=12,
    )
    bm_sphere(
        glint_bm,
        center + direction * 0.086 - up * 0.024 - side_axis * 0.018,
        (0.0065, 0.0065, 0.004),
        rot=quat,
        u_segments=16,
        v_segments=10,
    )
    objects.append(finalize(f"eyeGlint{'L' if side > 0 else 'R'}", glint_bm, mats.eye_glint, col))

    rim_bm = bmesh.new()
    bm_torus(
        rim_bm,
        center + direction * 0.004,
        direction,
        0.080,
        0.0045,
        sides=8,
        segments=48,
    )
    objects.append(finalize(f"eyeRim{'L' if side > 0 else 'R'}", rim_bm, mats.eye_rim, col))

    return objects


def build_teeth(mats: Mats, col) -> tuple[bpy.types.Object, bpy.types.Object]:
    upper = bmesh.new()
    for index in range(7):
        theta = -0.95 + 1.90 * index / 6.0
        x = 0.135 * math.sin(theta)
        y = -0.315 - 0.120 * math.cos(theta)
        z = 1.360
        fang = index in (1, 5)
        bm_claw(
            upper,
            (x, y, z),
            (0.0, 0.0, -1.0),
            0.048 if fang else 0.034,
            0.015 if fang else 0.012,
            bend=(-x * 0.10, 0.0, 0.0),
            sides=8,
            steps=5,
        )

    lower = bmesh.new()
    for index in range(6):
        theta = -0.85 + 1.70 * index / 5.0
        x = 0.125 * math.sin(theta)
        y = -0.312 - 0.112 * math.cos(theta)
        z = 1.335
        bm_claw(
            lower,
            (x, y, z),
            (0.0, 0.0, 1.0),
            0.032,
            0.0115,
            bend=(-x * 0.10, 0.0, 0.0),
            sides=8,
            steps=5,
        )

    upper_obj = finalize("teethUpper", upper, mats.tooth, col)
    lower_obj = finalize("teethLower", lower, mats.tooth, col)
    return upper_obj, lower_obj


def build_mouth_details(mats: Mats, col) -> tuple[bpy.types.Object, bpy.types.Object]:
    tongue_bm = bmesh.new()
    bm_sphere(tongue_bm, (0.0, -0.315, 1.335), (0.074, 0.095, 0.028))
    bm_sphere(tongue_bm, (0.0, -0.235, 1.332), (0.066, 0.07, 0.024))
    tongue = finalize("tongue", tongue_bm, mats.tongue, col)

    throat_bm = bmesh.new()
    bm_sphere(throat_bm, (0.0, -0.21, 1.30), (0.095, 0.09, 0.075))
    throat = finalize("throat", throat_bm, mats.mouth, col)
    return tongue, throat


def build_nostrils(mats: Mats, col) -> list[bpy.types.Object]:
    objects = []
    for side in (-1, 1):
        center = Vector((side * 0.052, -0.375, 1.475))
        surface = Vector((0.0, -0.275, 1.385))
        radii = Vector((0.185, 0.17, 0.125))
        normal = Vector(
            (
                (center.x - surface.x) / radii.x**2,
                (center.y - surface.y) / radii.y**2,
                (center.z - surface.z) / radii.z**2,
            )
        ).normalized()
        bm = bmesh.new()
        bm_sphere(
            bm,
            center - normal * 0.006,
            (0.019, 0.027, 0.009),
            rot=normal.to_track_quat("Z", "Y"),
            u_segments=24,
            v_segments=12,
        )
        objects.append(
            finalize(f"nostril{'L' if side > 0 else 'R'}", bm, mats.nostril, col)
        )
    return objects


# ---------------------------------------------------------------------------
# Duplicado, decimación y exportación
# ---------------------------------------------------------------------------


def duplicate_tree(root: bpy.types.Object, collection, suffix: str) -> dict[str, bpy.types.Object]:
    created: dict[str, bpy.types.Object] = {}

    def walk(source: bpy.types.Object, new_parent):
        copy = source.copy()
        if source.data is not None:
            copy.data = source.data.copy()
        copy.name = source.name + suffix
        if copy.data is not None:
            copy.data.name = source.name + suffix + "_mesh"
        collection.objects.link(copy)
        copy.parent = new_parent
        copy.matrix_parent_inverse = source.matrix_parent_inverse.copy()
        copy.matrix_basis = source.matrix_basis.copy()
        created[source.name] = copy
        for child in source.children:
            walk(child, copy)

    walk(root, None)
    return created


def decimate_to(obj: bpy.types.Object, target: int) -> None:
    current = triangle_count(obj)
    if current <= target * 1.02:
        return
    mod = obj.modifiers.new("GameDecimate", "DECIMATE")
    mod.ratio = max(0.02, min(1.0, target / current))
    mod.use_collapse_triangulate = True
    apply_modifier(obj, mod)
    shade_smooth(obj)


# ---------------------------------------------------------------------------
# Estudio de render
# ---------------------------------------------------------------------------


def build_studio(scene: bpy.types.Scene, mats: Mats) -> dict[str, bpy.types.Object]:
    studio = new_collection("STUDIO")

    # Fondo continuo color oliva, como en las referencias.
    backdrop = make_material("Backdrop", "#6E6A38", roughness=0.85)
    floor_bm = bmesh.new()
    bmesh.ops.create_grid(floor_bm, x_segments=1, y_segments=1, size=20.0)
    floor_mesh = bpy.data.meshes.new("floor")
    floor_bm.to_mesh(floor_mesh)
    floor_bm.free()
    floor = bpy.data.objects.new("floor", floor_mesh)
    floor_mesh.materials.append(backdrop)
    studio.objects.link(floor)

    world = bpy.data.worlds.new("StudioWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = hex_rgba("#6E6A38")
    bg.inputs["Strength"].default_value = 0.55

    def area_light(name, location, energy, size, color="#FFF6E8"):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = hex_rgba(color)[:3]
        obj = bpy.data.objects.new(name, data)
        studio.objects.link(obj)
        obj.location = location
        direction = Vector((0.0, 0.0, 0.95)) - Vector(location)
        obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        return obj

    area_light("Key", (-2.6, -3.4, 3.6), 520, 3.0, "#FFFFFF")
    area_light("Fill", (3.2, -2.6, 2.2), 210, 3.5, "#EAF0FF")
    area_light("Rim", (0.8, 3.6, 3.2), 420, 2.5, "#FFF0D0")

    camera_data = bpy.data.cameras.new("Camera")
    camera_data.lens = 62.0
    camera = bpy.data.objects.new("Camera", camera_data)
    studio.objects.link(camera)
    scene.camera = camera

    scene.render.resolution_x = 620
    scene.render.resolution_y = 780
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    scene.render.fps = 30

    return {"camera": camera, "floor": floor}


def aim_camera(camera: bpy.types.Object, location, target) -> None:
    camera.location = Vector(location)
    direction = Vector(target) - Vector(location)
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_views(scene: bpy.types.Scene, camera: bpy.types.Object, quick: bool, only: set[str] | None = None, prefix: str = "preview") -> list[Path]:
    views = [
        ("front", (0.0, -5.15, 1.02)),
        ("three_quarter", (3.55, -3.55, 1.32)),
        ("side", (5.15, 0.0, 1.02)),
        ("back", (0.0, 5.15, 1.02)),
        ("head", (1.55, -2.25, 1.68)),
    ]
    if only:
        views = [view for view in views if view[0] in only]
    target = Vector((0.0, 0.0, 0.94))
    if quick:
        scene.render.resolution_x = 320
        scene.render.resolution_y = 400
        scene.cycles.samples = 16
    else:
        scene.render.resolution_x = 620
        scene.render.resolution_y = 780
        scene.cycles.samples = 64

    paths = []
    for name, location in views:
        if name == "head":
            aim_camera(camera, location, (0.0, -0.12, 1.47))
        else:
            aim_camera(camera, location, target)
        path = OUT / f"{prefix}_{name}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        paths.append(path)
    return paths


def montage(paths: list[Path], output: Path) -> None:
    import numpy as np

    tiles = []
    for path in paths[:4]:
        image = bpy.data.images.load(str(path))
        width, height = image.size
        pixels = np.array(image.pixels[:], dtype=np.float32).reshape(height, width, 4)
        tiles.append(pixels)
        bpy.data.images.remove(image)
    width = tiles[0].shape[1]
    height = tiles[0].shape[0]
    top = np.concatenate([tiles[2], tiles[3]], axis=1)
    bottom = np.concatenate([tiles[0], tiles[1]], axis=1)
    grid = np.concatenate([top, bottom], axis=0)
    out = bpy.data.images.new("agumon_contact", width=width * 2, height=height * 2, alpha=True)
    out.colorspace_settings.name = "sRGB"
    out.pixels = grid.ravel().tolist()
    out.filepath_raw = str(output)
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)


# ---------------------------------------------------------------------------
# Principal
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--quick", action="store_true")
    parser.add_argument("--no-render", action="store_true")
    parser.add_argument("--views", default="")
    parser.add_argument("--game", action="store_true", help="Renderiza la malla de juego (40k) en vez de la densa")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])

    scene = reset_scene()
    mats = build_materials()
    dense_col = new_collection("DENSE")
    game_col = new_collection("GAME")

    root = bpy.data.objects.new("Agumon", None)
    dense_col.objects.link(root)

    # Cuerpo y cabeza
    body = build_body(mats, dense_col)
    head = build_head(
        mats,
        dense_col,
        mouth_center=(0.0, -0.315, 1.345),
        mouth_radii=(0.160, 0.140, 0.072),
    )
    jaw = build_jaw(
        mats,
        dense_col,
        mouth_center=(0.0, -0.315, 1.345),
        mouth_radii=(0.160, 0.140, 0.072),
    )

    arms = {}
    legs = {}
    for side in (-1, 1):
        arm, claws = build_arm(mats, dense_col, side)
        arms[side] = (arm, claws)
        leg, foot_claws = build_leg(mats, dense_col, side)
        legs[side] = (leg, foot_claws)

    tail = build_tail(mats, dense_col)

    eyes = {}
    for side in (-1, 1):
        eyes[side] = build_eye(mats, dense_col, side, dense_col)

    teeth_upper, teeth_lower = build_teeth(mats, dense_col)
    tongue, throat = build_mouth_details(mats, dense_col)
    nostrils = build_nostrils(mats, dense_col)

    # Orígenes de pivote para la animación por nodos.
    set_origin(head, (0.0, 0.03, 1.15))
    set_origin(jaw, (0.0, -0.02, 1.31))
    for side, (arm, claws) in arms.items():
        set_origin(arm, (side * 0.275, 0.0, 1.0))
        parent_keep_world(claws, arm)
    for side, (leg, foot_claws) in legs.items():
        set_origin(leg, (side * 0.175, 0.02, 0.575))
        parent_keep_world(foot_claws, leg)
    set_origin(tail, (0.0, 0.22, 0.63))

    # Jerarquía de nodos.
    parent_keep_world(body, root)
    parent_keep_world(head, body)
    parent_keep_world(arms[-1][0], body)
    parent_keep_world(arms[1][0], body)
    parent_keep_world(legs[-1][0], body)
    parent_keep_world(legs[1][0], body)
    parent_keep_world(tail, body)

    # Detalles de la cabeza.
    for side in (-1, 1):
        for eye_part in eyes[side]:
            parent_keep_world(eye_part, head)
    parent_keep_world(teeth_upper, head)
    parent_keep_world(throat, head)
    for nostril in nostrils:
        parent_keep_world(nostril, head)

    # La mandíbula cuelga de la cabeza.
    parent_keep_world(jaw, head)

    # Primero se cuelgan los dientes y la lengua (con la mandíbula cerrada),
    # y después se abre un poco la boca.
    parent_keep_world(teeth_lower, jaw)
    parent_keep_world(tongue, jaw)
    jaw.rotation_euler.x = 0.20
    # La cabeza se asienta sobre el cuello, casi sin separación.
    head.location.z -= 0.03

    # Pies exactamente en el suelo.
    bpy.context.view_layer.update()
    min_z = min(
        (obj.matrix_world @ Vector(corner)).z
        for obj in dense_col.objects
        if obj.type == "MESH"
        for corner in obj.bound_box
    )
    root.location.z = -min_z
    bpy.context.view_layer.update()

    # Copia para el juego, decimada al presupuesto.
    game = duplicate_tree(root, game_col, "_GAME")
    bpy.context.view_layer.update()

    # El GLB debe exponer exactamente body, head, jaw, armL...: la colección
    # densa se queda con el sufijo _DENSE para liberar los nombres.
    for original_name, copy in game.items():
        source = bpy.data.objects.get(original_name)
        if source is not None and source is not copy:
            source.name = original_name + "_DENSE"
        copy.name = original_name
        if copy.data is not None:
            copy.data.name = original_name + "_mesh"

    for original_name, copy in game.items():
        if copy.type != "MESH":
            continue
        target = TARGET_TRIS.get(original_name, DEFAULT_DETAIL_TRIS)
        decimate_to(copy, target)
        copy.data.name = copy.name + "_mesh"
        if original_name == "body":
            # La decimación puede interpolar el atributo: se repinta limpio.
            paint_body_colors(copy)

    total = sum(triangle_count(obj) for obj in game_col.objects if obj.type == "MESH")
    if total > TOTAL_TRIS:
        # Ajuste fino: reparte el excedente entre las piezas grandes.
        ratio = TOTAL_TRIS / total
        for name in ("body", "head", "jaw", "armL", "armR", "legL", "legR", "tail"):
            part = game.get(name)
            if part is not None:
                decimate_to(part, int(triangle_count(part) * ratio))
        total = sum(triangle_count(obj) for obj in game_col.objects if obj.type == "MESH")

    print(f"[agumon] triángulos del GLB de juego: {total}")
    print(f"[agumon] malla densa: {sum(triangle_count(o) for o in dense_col.objects if o.type == 'MESH')} triángulos")

    # El GLB exporta solo la copia de juego; los renders usan la malla densa
    # salvo que se pida expresamente --game.
    dense_visible = not args.game
    dense_col.hide_render = not dense_visible
    dense_col.hide_viewport = not dense_visible
    for obj in dense_col.objects:
        obj.hide_render = not dense_visible
    for obj in game_col.objects:
        obj.hide_render = dense_visible

    studio = build_studio(scene, mats)
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"

    if not args.no_render:
        only = {name.strip() for name in args.views.split(",") if name.strip()} or None
        prefix = "preview_game" if args.game else "preview"
        paths = render_views(scene, studio["camera"], args.quick, only, prefix)
        if not args.quick and only is None and not args.game:
            montage(paths, OUT / "agumon_contact.png")

    # Guardar .blend con la malla densa visible para renders y la de juego aparte.
    for obj in game_col.objects:
        obj.hide_render = False
    dense_col.hide_render = True
    dense_col.hide_viewport = True
    for obj in dense_col.objects:
        obj.hide_render = True
    blend_path = OUT / "agumon_vinyl.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    # Exportar GLB.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in game_col.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = game["Agumon"]
    glb_path = OUT / "agumon_vinyl.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_materials="EXPORT",
        export_extras=True,
    )
    print(f"[agumon] GLB: {glb_path}")
    print(f"[agumon] BLEND: {blend_path}")


if __name__ == "__main__":
    main()
