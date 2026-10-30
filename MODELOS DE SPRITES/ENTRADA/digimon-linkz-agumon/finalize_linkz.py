import bpy
import math
from pathlib import Path
from mathutils import Vector

SRC = r"C:\Users\argzz\Desktop\PROJECTDGMN\MODELOS DE SPRITES\ENTRADA\digimon-linkz-agumon\extracted\Agumon BlackAgumon\chr050 With Animations.fbx"
SRC = r"C:\Users\argzz\Desktop\ROJECTDGMN\MODELOS DE SPRITES\ENTRADA\digimon-linkz-agumon\extracted\Agumon BlackAgumon\chr050 With Animations.fbx"
OUT = Path(r"C:\Users\argzz\Desktop\ROJECTDGMN\MODELOS DE SPRITES\ENTRADA\digimon-linkz-agumon\adapted")
OUT.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC, use_anim=False, automatic_bone_orientation=True)
armature = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]

# Pose neutra: brazos abajo y ligeramente abiertos.
for bone_name, value in (("J_arm_l", -72.0), ("J_arm_r", 72.0)):
    pb = armature.pose.bones.get(bone_name)
    pb.rotation_mode = "XYZ"
    pb.rotation_euler.x = math.radians(value)
    pb.rotation_euler.y = 0.0
    pb.rotation_euler.z = 0.0
bpy.context.view_layer.update()

# Hornear la pose como reposo del rig.
bpy.context.view_layer.objects.active = armature
bpy.ops.object.mode_set(mode="POSE")
bpy.ops.pose.select_all(action="SELECT")
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode="OBJECT")
bpy.context.view_layer.update()

# Escalar a 1,75 y apoyar los pies.
points = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
mn = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
mx = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
s = 1.75 / (mx.z - mn.z)
armature.scale *= s
bpy.context.view_layer.update()
points = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
mn = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
armature.location.z -= mn.z
bpy.context.view_layer.update()

points = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
mn = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
mx = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
print("FINAL BOUNDS", tuple(round(v, 3) for v in mn), tuple(round(v, 3) for v in mx))
print("ARM SCALE", tuple(round(v, 4) for v in armature.scale), "LOC", tuple(round(v, 3) for v in armature.location))

# Material: una sola textura, opaco, acabado vinilo.
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    mat.name = "BodyVinyl"
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    # Quitar nodos de imagen no conectados.
    used_images = set()
    for link in mat.node_tree.links:
        if link.from_node.type == "TEX_IMAGE":
            used_images.add(link.from_node.name)
    for node in list(mat.node_tree.nodes):
        if node.type == "TEX_IMAGE" and node.name not in used_images:
            mat.node_tree.nodes.remove(node)
    if bsdf:
        bsdf.inputs["Roughness"].default_value = 0.55
        bsdf.inputs["Metallic"].default_value = 0.0
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = 0.35
        # Sin transparencia: la textura no necesita alpha.
        alpha_input = bsdf.inputs.get("Alpha")
        if alpha_input and alpha_input.is_linked:
            for link in list(alpha_input.links):
                mat.node_tree.links.remove(link)
            alpha_input.default_value = 1.0
    mat.blend_method = "OPAQUE"

for image in bpy.data.images:
    if image.source == "FILE" and image.filepath:
        image.pack()

blend_path = OUT / "agumon_linkz_posed.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

bpy.ops.object.select_all(action="DESELECT")
armature.select_set(True)
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = armature

glb_path = OUT / "agumon_linkz_posed.glb"
bpy.ops.export_scene.gltf(
    filepath=str(glb_path),
    export_format="GLB",
    use_selection=True,
    export_apply=False,
    export_yup=True,
    export_materials="EXPORT",
    export_animations=False,
    export_skins=True,
)
print("GLB", glb_path, glb_path.stat().st_size)
print("BLEND", blend_path)
