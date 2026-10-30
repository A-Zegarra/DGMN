"""Renderiza 8 direcciones x 5 poses del Agumon para una hoja de sprites 8-bit.

Salida: MODELOS DE SPRITES/ENTRADA/digimon-linkz-agumon/sprites_raw/
"""

import bpy
import math
from pathlib import Path
from mathutils import Vector, Quaternion

ROOT = Path(r"C:\Users\argzz\Desktop\ROJECTDGMN")
SRC = ROOT / "apps/client/public/models/agumon_linkz_rigged.glb"
OUT = ROOT / "MODELOS DE SPRITES/ENTRADA/digimon-linkz-agumon/sprites_raw"
OUT.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SRC))
bpy.context.view_layer.update()

armature = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
mesh = next(o for o in bpy.context.scene.objects if o.type == "MESH")

# --- Escalar y centrar el modelo -------------------------------------------
points = [mesh.matrix_world @ Vector(c) for c in mesh.bound_box]
mn = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
mx = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
armature.scale *= 1.75 / (mx.z - mn.z)
bpy.context.view_layer.update()

# Pose base de brazos.
for name, angle in (("J_arm_l", -72.0), ("J_arm_r", 72.0)):
    pb = armature.pose.bones.get(name)
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = Quaternion(Vector((1, 0, 0)), math.radians(angle))
bpy.context.view_layer.update()

deps = bpy.context.evaluated_depsgraph_get()
eval_mesh = mesh.evaluated_get(deps)
points = [eval_mesh.matrix_world @ Vector(c) for c in eval_mesh.bound_box]
mn = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
mx = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
center = (mn + mx) * 0.5
armature.location.x -= center.x
armature.location.y -= center.y
armature.location.z -= mn.z
bpy.context.view_layer.update()
print("BOUNDS", tuple(round(v, 3) for v in mn), tuple(round(v, 3) for v in mx))

# --- Material emisivo con la textura --------------------------------------
image = None
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    for node in mat.node_tree.nodes:
        if node.type == "TEX_IMAGE" and node.image is not None:
            image = node.image
            break
    if image:
        break
print("TEXTURE", image.name if image else None, image.size[:] if image else None)

sprite_mat = bpy.data.materials.new("SpriteEmission")
sprite_mat.use_nodes = True
nodes = sprite_mat.node_tree.nodes
nodes.clear()
output = nodes.new("ShaderNodeOutputMaterial")
emission = nodes.new("ShaderNodeEmission")
texture = nodes.new("ShaderNodeTexImage")
texture.image = image
texture.interpolation = "Closest"
sprite_mat.node_tree.links.new(texture.outputs["Color"], emission.inputs["Color"])
sprite_mat.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
mesh.data.materials.clear()
mesh.data.materials.append(sprite_mat)

# --- Cámara y render -------------------------------------------------------
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 4
scene.cycles.use_denoising = False
try:
    scene.cycles.filter_width = 0.01
except AttributeError:
    pass
scene.render.film_transparent = True
scene.render.resolution_x = 96
scene.render.resolution_y = 96
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.compression = 100
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0.0

cam_data = bpy.data.cameras.new("SpriteCam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = 2.0
cam = bpy.data.objects.new("SpriteCam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
target = Vector((0, 0, 0.9))

# Pose de caminar.
def set_walk(phase: float) -> None:
    swing = math.sin(phase) * 0.30
    knee_l = max(0.0, math.sin(phase)) * 0.42
    knee_r = max(0.0, -math.sin(phase)) * 0.42

    for name, angle in (("J_leg_l", swing), ("J_leg_r", -swing)):
        pb = armature.pose.bones.get(name)
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion(Vector((1, 0, 0)), angle)

    for name, angle in (("J_knee_l", knee_l), ("J_knee_r", knee_r)):
        pb = armature.pose.bones.get(name)
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion(Vector((1, 0, 0)), angle)

    for name, angle in (("J_foot_l", -knee_l * 0.3), ("J_foot_r", -knee_r * 0.3)):
        pb = armature.pose.bones.get(name)
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion(Vector((1, 0, 0)), angle)

    # Brazos: base + balanceo en world X después de la base.
    arm_swing = -swing * 0.55
    for name, base_angle, swing_angle in (
        ("J_arm_l", -72.0, arm_swing),
        ("J_arm_r", 72.0, -arm_swing),
    ):
        pb = armature.pose.bones.get(name)
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion(
            Vector((1, 0, 0)), math.radians(base_angle)
        )
        bpy.context.view_layer.update()
        q_world = (armature.matrix_world @ pb.matrix).to_quaternion()
        axis = (q_world.inverted() @ Vector((1, 0, 0))).normalized()
        pb.rotation_quaternion = pb.rotation_quaternion @ Quaternion(
            axis, swing_angle
        )

    bpy.context.view_layer.update()


def reset_pose() -> None:
    for pb in armature.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion()
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    for name, angle in (("J_arm_l", -72.0), ("J_arm_r", 72.0)):
        pb = armature.pose.bones.get(name)
        pb.rotation_quaternion = Quaternion(
            Vector((1, 0, 0)), math.radians(angle)
        )
    bpy.context.view_layer.update()


frames = [
    ("idle", reset_pose),
    ("walk0", lambda: (reset_pose(), set_walk(0.0))),
    ("walk1", lambda: (reset_pose(), set_walk(math.pi * 0.5))),
    ("walk2", lambda: (reset_pose(), set_walk(math.pi))),
    ("walk3", lambda: (reset_pose(), set_walk(math.pi * 1.5))),
]

for dir_index in range(8):
    angle = 2 * math.pi * dir_index / 8
    cam.location = Vector((5 * math.sin(angle), -5 * math.cos(angle), 0.9))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()

    for frame_index, (frame_name, pose_fn) in enumerate(frames):
        pose_fn()
        scene.render.filepath = str(OUT / f"f{frame_index}_d{dir_index}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDER", frame_index, dir_index, frame_name)

print("DONE")
