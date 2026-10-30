import bpy
from pathlib import Path
from mathutils import Vector

SRC = r"C:\Users\argzz\Desktop\ROJECTDGMN\MODELOS DE SPRITES\ENTRADA\digimon-linkz-agumon\extracted\Agumon BlackAgumon\chr050 With Animations.fbx"
OUT = Path(r"C:\Users\argzz\Desktop\ROJECTDGMN\MODELOS DE SPRITES\ENTRADA\digimon-linkz-agumon\adapted")
OUT.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC, use_anim=True)
bpy.context.view_layer.update()

meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
armature = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")

# Renombrar acciones para que el GLB tenga nombres limpios.
seen = set()
for action in list(bpy.data.actions):
    base = action.name.split("|")[1] if "|" in action.name else action.name
    if base in seen:
        bpy.data.actions.remove(action)
        continue
    seen.add(base)
    action.name = base

print("ACTIONS", sorted(a.name for a in bpy.data.actions))

# Postura inicial: idle.
idle = bpy.data.actions.get("idle")
if idle:
    armature.animation_data_create()
    armature.animation_data.action = idle
    if hasattr(armature.animation_data, "action_slot") and len(idle.slots):
        armature.animation_data.action_slot = idle.slots[0]
bpy.context.scene.frame_set(1)

# Escalar a 1,75 y apoyar los pies en el suelo.
points = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
mn = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
mx = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
height = mx.z - mn.z
s = 1.75 / height
print("ORIGINAL HEIGHT", height, "SCALE", s)

armature.scale *= s
bpy.context.view_layer.update()

points = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
mn = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
mx = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
armature.location.z -= mn.z
bpy.context.view_layer.update()

points = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
mn = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
mx = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
print("FINAL BOUNDS", tuple(round(v, 3) for v in mn), tuple(round(v, 3) for v in mx))
print("ARM SCALE", tuple(round(v, 4) for v in armature.scale), "LOC", tuple(round(v, 3) for v in armature.location))

# Empaquetar texturas y guardar el .blend.
for image in bpy.data.images:
    if image.source == "FILE" and image.filepath:
        image.pack()

blend_path = OUT / "agumon_linkz.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

# Exportar solo el personaje.
bpy.ops.object.select_all(action="DESELECT")
armature.select_set(True)
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = armature

glb_path = OUT / "agumon_linkz.glb"
bpy.ops.export_scene.gltf(
    filepath=str(glb_path),
    export_format="GLB",
    use_selection=True,
    export_apply=False,
    export_yup=True,
    export_materials="EXPORT",
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_skins=True,
    export_def_bones=False,
    export_optimize_animation_size=True,
    export_anim_slide_to_zero=True,
)
print("GLB", glb_path, glb_path.stat().st_size)
print("BLEND", blend_path)
