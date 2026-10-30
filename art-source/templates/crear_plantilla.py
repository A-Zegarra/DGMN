"""Genera la plantilla de Blender de DIGIWORLD ONLINE.

Uso:
    blender -b --factory-startup --python art-source/templates/crear_plantilla.py

Opcional:
    ... -- --render   también guarda una vista previa en la misma carpeta.

La plantilla fija las reglas del proyecto: 1 unidad = 1 metro, suelo en Z=0,
personaje mirando hacia -Y y colecciones separadas para entrega, referencia y
estudio. No contiene geometría de personaje: eso lo modela el artista en
ENTREGA.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
BLEND_PATH = os.path.join(HERE, "plantilla_digimon.blend")
PREVIEW_PATH = os.path.join(HERE, "plantilla_digimon.png")

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
DO_RENDER = "--render" in ARGS


def link_only(obj, collection):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def new_material(name, color, roughness=0.8, metallic=0.0, alpha=1.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*color, alpha)
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf is not None:
        bsdf.inputs["Base Color"].default_value = (*color, alpha)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if alpha < 1.0:
            bsdf.inputs["Alpha"].default_value = alpha
            material.surface_render_method = "DITHERED"
    return material


def add_box(bm, center, size):
    result = bmesh.ops.create_cube(bm, size=1.0)
    for vert in result["verts"]:
        vert.co.x = vert.co.x * size[0] + center[0]
        vert.co.y = vert.co.y * size[1] + center[1]
        vert.co.z = vert.co.z * size[2] + center[2]


def add_text(name, body, location, size, material, rotation=(0.0, 0.0, 0.0), align="LEFT"):
    data = bpy.data.curves.new(name, type="FONT")
    data.body = body
    data.size = size
    data.align_x = align
    data.align_y = "CENTER"
    data.extrude = 0.0005
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    obj.rotation_euler = rotation
    data.materials.append(material)
    return obj


def aim_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


# ---------------------------------------------------------------------------
# Escena base
# ---------------------------------------------------------------------------

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0
scene.unit_settings.length_unit = "METERS"

world = bpy.data.worlds.new("Estudio")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.012, 0.014, 0.016, 1.0)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
scene.world = world

def make_collection(name):
    collection = bpy.data.collections.new(name)
    scene.collection.children.link(collection)
    return collection


col_entrega = make_collection("ENTREGA")
col_referencia = make_collection("REFERENCIA")
col_estudio = make_collection("ESTUDIO")

# Materiales de referencia
mat_floor = new_material("RefSuelo", (0.10, 0.11, 0.12), roughness=0.92)
mat_ruler = new_material("RefRegla", (0.62, 0.64, 0.66), roughness=0.5, metallic=0.2)
mat_text = new_material("RefTexto", (0.85, 0.87, 0.90), roughness=0.6)
mat_arrow = new_material("RefFlecha", (0.95, 0.45, 0.15), roughness=0.55)

# Suelo de 8 x 8 m con cuadrícula de 1 m
bpy.ops.mesh.primitive_plane_add(size=8.0, location=(0.0, 0.0, 0.0))
floor = bpy.context.object
floor.name = "Suelo"
floor.data.materials.append(mat_floor)
link_only(floor, col_referencia)

if floor.data.materials:
    nodes = mat_floor.node_tree.nodes
    links = mat_floor.node_tree.links
    checker = nodes.new("ShaderNodeTexChecker")
    checker.inputs["Scale"].default_value = 8.0
    checker.inputs["Color1"].default_value = (0.105, 0.115, 0.125, 1.0)
    checker.inputs["Color2"].default_value = (0.085, 0.095, 0.105, 1.0)
    links.new(checker.outputs["Color"], nodes["Principled BSDF"].inputs["Base Color"])

# Regla vertical de 1,80 m con marcas cada 10 cm
bm = bmesh.new()
add_box(bm, (-1.35, 0.0, 0.9), (0.03, 0.03, 1.8))
for index in range(19):
    z = index * 0.1
    length = 0.18 if index % 5 == 0 else 0.1
    add_box(
        bm,
        (-1.35 + 0.015 + length / 2.0, 0.0, z),
        (length, 0.012, 0.012),
    )
mesh = bpy.data.meshes.new("ReglaAltura")
bm.to_mesh(mesh)
bm.free()
ruler = bpy.data.objects.new("ReglaAltura", mesh)
ruler.location = (0.0, 0.0, 0.0)
mesh.materials.append(mat_ruler)
col_referencia.objects.link(ruler)

# Etiquetas de altura
for value in (0.5, 1.0, 1.5):
    label = add_text(
        f"Altura_{value:.1f}",
        f"{value:.1f} m".replace(".", ","),
        (-1.10, -0.02, value),
        0.075,
        mat_text,
        rotation=(math.pi / 2.0, 0.0, 0.0),
    )
    col_referencia.objects.link(label)

top_label = add_text(
    "Altura_1.8",
    "1,80 m",
    (-1.10, -0.02, 1.85),
    0.085,
    mat_text,
    rotation=(math.pi / 2.0, 0.0, 0.0),
)
col_referencia.objects.link(top_label)

# Flecha de orientación: el personaje mira hacia -Y
bpy.ops.mesh.primitive_cylinder_add(
    vertices=24, radius=0.025, depth=0.5, location=(1.5, -0.9, 0.03), rotation=(math.pi / 2.0, 0.0, 0.0)
)
arrow_shaft = bpy.context.object
arrow_shaft.name = "FlechaFrente_Cuerpo"
arrow_shaft.data.materials.append(mat_arrow)
link_only(arrow_shaft, col_referencia)

bpy.ops.mesh.primitive_cone_add(
    vertices=24, radius1=0.08, radius2=0.0, depth=0.18, location=(1.5, -1.23, 0.03), rotation=(math.pi / 2.0, 0.0, 0.0)
)
arrow_tip = bpy.context.object
arrow_tip.name = "FlechaFrente_Punta"
arrow_tip.data.materials.append(mat_arrow)
link_only(arrow_tip, col_referencia)

front_text = add_text(
    "TextoFrente",
    "FRENTE  (-Y)",
    (1.5, -0.45, 0.02),
    0.11,
    mat_arrow,
    align="CENTER",
)
col_referencia.objects.link(front_text)

# Origen de entrega
root = bpy.data.objects.new("ROOT_ENTREGA", None)
root.empty_display_type = "PLAIN_AXES"
root.empty_display_size = 0.35
root.location = (0.0, 0.0, 0.0)
col_entrega.objects.link(root)

# Luces de estudio
def add_area(name, location, energy, size, color, target=(0.0, 0.0, 0.9)):
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    aim_at(obj, target)
    col_estudio.objects.link(obj)
    return obj


add_area("Luz_Clave", (3.4, -3.6, 4.6), 550.0, 3.5, (1.0, 0.96, 0.9))
add_area("Luz_Relleno", (-4.2, -2.4, 2.4), 260.0, 5.0, (0.75, 0.85, 1.0))
add_area("Luz_Contra", (-0.5, 4.2, 3.4), 420.0, 3.0, (0.9, 0.95, 1.0))

# Cámara 3/4
camera_data = bpy.data.cameras.new("Camara_Estudio")
camera_data.lens = 58.0
camera = bpy.data.objects.new("Camara_Estudio", camera_data)
camera.location = (4.6, -7.0, 3.6)
aim_at(camera, (0.0, 0.0, 0.85))
col_estudio.objects.link(camera)
scene.camera = camera

# Texto de apoyo visible en el editor de texto de Blender
notes = bpy.data.texts.new("LEEME")
notes.write(
    "PLANTILLA DIGIWORLD ONLINE\n"
    "==========================\n\n"
    "Reglas:\n"
    "- 1 unidad de Blender = 1 metro.\n"
    "- Altura de un Rookie: 1,5-1,9 m (Agumon ~1,8 m).\n"
    "- Los pies apoyan en Z = 0.\n"
    "- El personaje mira hacia -Y en Blender.\n"
    "- Modela dentro de la colección ENTREGA.\n"
    "- Aplica las transformaciones antes de exportar.\n\n"
    "Para guardar tu trabajo:\n"
    "  File > Save As > art-source/<personaje>/<personaje>_v01.blend\n\n"
    "Para exportar:\n"
    "  File > Export > glTF 2.0 (.glb/.gltf)\n"
    "  Formato: glTF Binary (.glb)\n"
    "  +Y Up, Apply Modifiers, Include > Selected Objects\n"
    "  Exporta SOLO la colección ENTREGA (sin suelo, luces ni cámara).\n\n"
    "La colección REFERENCIA contiene la regla de 1,80 m, el suelo y la flecha\n"
    "de orientación. Se puede ocultar sin miedo: no forma parte del personaje.\n"
)

# Configuración de render y vista
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
try:
    scene.eevee.taa_render_samples = 32
except AttributeError:
    pass
try:
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
except (AttributeError, TypeError):
    pass

# La colección ENTREGA queda activa: los objetos nuevos caen ahí.
def activate_collection(collection):
    def walk(layer_collection):
        if layer_collection.collection == collection:
            return layer_collection
        for child in layer_collection.children:
            found = walk(child)
            if found is not None:
                return found
        return None

    layer = walk(bpy.context.view_layer.layer_collection)
    if layer is not None:
        bpy.context.view_layer.active_layer_collection = layer


activate_collection(col_entrega)
for obj in bpy.context.view_layer.objects:
    obj.select_set(False)

# Guardar
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
print(f"PLANTILLA_GUARDADA {BLEND_PATH}")

if DO_RENDER:
    scene.render.filepath = PREVIEW_PATH
    bpy.ops.render.render(write_still=True)
    print(f"PREVIEW_GUARDADA {PREVIEW_PATH}")
