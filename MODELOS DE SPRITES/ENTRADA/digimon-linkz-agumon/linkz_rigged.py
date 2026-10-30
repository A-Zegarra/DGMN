import bpy
from pathlib import Path
from mathutils import Vector

SRC = r"C:\Users\argzz\Desktop\ROJECTDGMN\MODELOS DE SPRITES\ENTRADA\digimon-linkz-agumon\extracted\Agumon BlackAgumon\chr050 With Animations.fbx"
OUT = Path(r"C:\Users\argzz\Desktop\ROJECTDGMN\MODELOS DE SPRITES\ENTRADA\digimon-linkz-agumon\adapted")
OUT.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC, use_anim=False, automatic_bone_orientation=True)
armature = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
mesh = meshes[0]

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
print("BONES", [b.name for b in armature.data.bones])

# Material limpio.
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    mat.name = "BodyVinyl"
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    used_images = {
        link.from_node.name
        for link in mat.node_tree.links
        if link.from_node.type == "TEX_IMAGE"
    }
    for node in list(mat.node_tree.nodes):
        if node.type == "TEX_IMAGE" and node.name not in used_images:
            mat.node_tree.nodes.remove(node)
    if bsdf:
        bsdf.inputs["Roughness"].default_value = 0.55
        bsdf.inputs["Metallic"].default_value = 0.0
        alpha = bsdf.inputs.get("Alpha")
        if alpha and alpha.is_linked:
            for link in list(alpha.links):
                mat.node_tree.links.remove(link)
            alpha.default_value = 1.0
    mat.blend_method = "OPAQUE"

for image in bpy.data.images:
    if image.source == "FILE" and image.filepath:
        image.pack()

blend_path = OUT / "agumon_linkz_rigged.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

bpy.ops.object.select_all(action="DESELECT")
armature.select_set(True)
mesh.select_set(True)
bpy.context.view_layer.objects.active = armature

glb_path = OUT / "agumon_linkz_rigged.glb"
bpy.ops.export_scene.gltf(
    filepath=str(glb_path),
    export_format="GLB",
    use_selection=True,
    export_apply=False,
    export_yup=True,
    export_materials="EXPORT",
    export_animations=False,
    export_skins=True,
    export_def_bones=False,
)
print("GLB", glb_path, glb_path.stat().st_size)
print("BLEND", blend_path)
