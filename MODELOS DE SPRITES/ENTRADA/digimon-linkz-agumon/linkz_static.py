import bpy
import math
from pathlib import Path
from mathutils import Vector

SRC = r"C:\Users\argzz\Desktop\ROJECTDGMN\MODELOS DE SPRITES\ENTRADA\digimon-linkz-agumon\extracted\Agumon BlackAgumon\chr050 With Animations.fbx"
OUT = Path(r"C:\Users\argzz\Desktop\ROJECTDGMN\MODELOS DE SPRITES\ENTRADA\digimon-linkz-agumon\adapted")
OUT.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC, use_anim=False, automatic_bone_orientation=True)
armature = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
mesh = next(o for o in bpy.context.scene.objects if o.type == "MESH")

# Pose neutra.
for bone_name, value in (("J_arm_l", -72.0), ("J_arm_r", 72.0)):
    pb = armature.pose.bones.get(bone_name)
    pb.rotation_mode = "XYZ"
    pb.rotation_euler.x = math.radians(value)
bpy.context.view_layer.update()

# Escalar y apoyar.
points = [mesh.matrix_world @ Vector(c) for c in mesh.bound_box]
mn = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
mx = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
s = 1.75 / (mx.z - mn.z)
armature.scale *= s
bpy.context.view_layer.update()
points = [mesh.matrix_world @ Vector(c) for c in mesh.bound_box]
mn = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
armature.location.z -= mn.z
bpy.context.view_layer.update()

# Aplicar la deformación del esqueleto a la malla.
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
for modifier in list(mesh.modifiers):
    if modifier.type == "ARMATURE":
        bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.data.objects.remove(armature, do_unlink=True)

mesh.name = "body"
mesh.data.name = "body_mesh"

# Sombras suaves: limpiar normales personalizadas del FBX y recalcular.
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.shade_smooth()
try:
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
except RuntimeError:
    pass
for poly in mesh.data.polygons:
    poly.use_smooth = True
mesh.data.update()

points = [mesh.matrix_world @ Vector(c) for c in mesh.bound_box]
mn = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
mx = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
print("FINAL BOUNDS", tuple(round(v, 3) for v in mn), tuple(round(v, 3) for v in mx))
print("TRIS", sum(len(p.vertices) - 2 for p in mesh.data.polygons))

# Material.
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

blend_path = OUT / "agumon_linkz_static.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
bpy.context.view_layer.objects.active = mesh
glb_path = OUT / "agumon_linkz_static.glb"
bpy.ops.export_scene.gltf(
    filepath=str(glb_path),
    export_format="GLB",
    use_selection=True,
    export_apply=False,
    export_yup=True,
    export_materials="EXPORT",
    export_animations=False,
    export_skins=False,
)
print("GLB", glb_path, glb_path.stat().st_size)
print("BLEND", blend_path)

# Render de comprobación.
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 32
scene.render.resolution_x = 520
scene.render.resolution_y = 640
scene.view_settings.view_transform = "Standard"
scene.view_settings.exposure = -0.3

world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.16, 0.15, 0.07, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6

center = Vector((0, 0, 0.92))
def light(name, loc, energy, size_light):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.size = size_light
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = (center - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
light("Key", (-2.6, -3.4, 3.6), 600, 3.0)
light("Fill", (3.2, -2.6, 2.2), 250, 3.5)
light("Rim", (0.8, 3.6, 3.2), 450, 2.5)
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))

cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 62
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
views = {
    "front": (0, -5.0, 1.0),
    "three_quarter": (3.5, -3.5, 1.3),
    "side": (5.0, 0, 1.0),
    "back": (0, 5.0, 1.0),
}
for name, loc in views.items():
    cam.location = Vector(loc)
    cam.rotation_euler = (center - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str(OUT / f"static_{name}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDER", name)
