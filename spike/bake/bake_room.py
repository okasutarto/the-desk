# Spike: build a simplified corner of the room in Blender, bake its lighting into textures and
# export it for three.js. Run headless:
#   blender --background --factory-startup --python spike/bake/bake_room.py -- spike/bake/out
# Blender works in metres with Z up; the glTF exporter turns that into Y up. three.js scales the
# result by 10 to get the room's units (1 unit = 10 cm).
import math
import os
import sys
import time

import bpy

OUT = os.path.abspath(sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "spike/bake/out")
SIZE = int(os.environ.get("BAKE_SIZE", 1024))
SAMPLES = int(os.environ.get("BAKE_SAMPLES", 512))
os.makedirs(OUT, exist_ok=True)
started = time.time()

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# ---------- geometry ----------
def material(name, rgb):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = 0.9
    return mat


def box(name, size, center, mat, bevel=0.004):
    bpy.ops.mesh.primitive_cube_add(location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width, mod.segments, mod.limit_method = bevel, 2, "ANGLE"
    obj.data.materials.append(mat)
    return obj


def cylinder(name, radius, depth, center, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=radius, depth=depth, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


wood = material("wood", (0.55, 0.32, 0.18))
wall = material("wall", (0.2, 0.2, 0.22))
floor = material("floor", (0.42, 0.3, 0.2))
metal = material("metal", (0.35, 0.36, 0.38))
screen = material("screen", (0.05, 0.05, 0.07))
books = [material(f"book{i}", c) for i, c in enumerate([(0.7, 0.2, 0.2), (0.2, 0.4, 0.7), (0.85, 0.7, 0.2), (0.25, 0.55, 0.3)])]
mug = material("mug", (0.9, 0.9, 0.88))

# the corner: floor, back wall (y = 1.05) and the left wall (x = -1.65) with a window
box("floor", (3.4, 3.0, 0.02), (0, -0.4, -0.01), floor, 0)
box("wall_back", (3.4, 0.1, 2.6), (0, 1.1, 1.3), wall, 0)
WIN = dict(y0=0.0, y1=0.85, z0=0.95, z1=1.95)
box("wall_left_low", (0.1, 3.0, WIN["z0"]), (-1.75, -0.4, WIN["z0"] / 2), wall, 0)
box("wall_left_high", (0.1, 3.0, 2.6 - WIN["z1"]), (-1.75, -0.4, (2.6 + WIN["z1"]) / 2), wall, 0)
box("wall_left_front", (0.1, WIN["y0"] + 1.9, WIN["z1"] - WIN["z0"]), (-1.75, (WIN["y0"] - 1.9) / 2, (WIN["z0"] + WIN["z1"]) / 2), wall, 0)
box("wall_left_back", (0.1, 1.05 - WIN["y1"], WIN["z1"] - WIN["z0"]), (-1.75, (WIN["y1"] + 1.05) / 2, (WIN["z0"] + WIN["z1"]) / 2), wall, 0)
box("window_sill", (0.2, WIN["y1"] - WIN["y0"] + 0.1, 0.04), (-1.66, (WIN["y0"] + WIN["y1"]) / 2, WIN["z0"]), wood)

# the desk: 160 × 80 cm, its top at 74 cm
box("desk_top", (1.6, 0.8, 0.03), (-0.1, 0.6, 0.725), wood)
for x in (-0.86, 0.66):
    for y in (0.26, 0.94):
        box("desk_leg", (0.05, 0.05, 0.71), (x, y, 0.355), metal)
# the riser and the monitor on it
box("riser_top", (0.9, 0.24, 0.02), (-0.1, 0.86, 0.85), wood)
for x in (-0.5, 0.3):
    box("riser_leg", (0.036, 0.21, 0.1), (x, 0.86, 0.79), wood)
box("monitor_foot", (0.22, 0.16, 0.01), (-0.1, 0.86, 0.865), metal)
box("monitor_neck", (0.05, 0.025, 0.3), (-0.1, 0.9, 1.02), metal)
box("monitor", (0.62, 0.03, 0.37), (-0.1, 0.87, 1.2), screen)
# a mug and a closed laptop on the desk
cylinder("mug", 0.045, 0.1, (0.45, 0.45, 0.79), mug)
box("laptop", (0.32, 0.22, 0.015), (-0.55, 0.45, 0.748), metal)

# the bookcase right of the desk, against the back wall
SX, SW, SD, SH = 1.15, 0.6, 0.3, 1.4
for x in (SX - SW / 2, SX + SW / 2):
    box("shelf_side", (0.02, SD, SH), (x, 1.05 - SD / 2, SH / 2), wood)
for i in range(5):
    box("shelf_board", (SW, SD, 0.02), (SX, 1.05 - SD / 2, 0.02 + i * (SH - 0.04) / 4), wood)
for i in range(4):
    for j in range(5):
        h = 0.2 + 0.03 * ((i + j) % 3)
        box("book", (0.04, 0.2, h), (SX - 0.22 + j * 0.05 + i * 0.02, 0.92, 0.03 + i * (SH - 0.04) / 4 + h / 2), books[(i + j) % 4], 0.002)

# one mesh, so one lightmap atlas covers it all
for obj in scene.objects:
    obj.select_set(obj.type == "MESH")
bpy.context.view_layer.objects.active = scene.objects["desk_top"]
bpy.ops.object.convert(target="MESH")
bpy.ops.object.join()
room = bpy.context.object
room.name = "room_static"

# ---------- lightmap UVs ----------
# (the only UV map here: a real prop would keep its texture UVs as UV0 and add this as UV1)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004, scale_to_bounds=False)
bpy.ops.object.mode_set(mode="OBJECT")
built = time.time()

# ---------- lights ----------
sun_data = bpy.data.lights.new("sun", "SUN")
sun_data.energy, sun_data.angle, sun_data.color = 4.0, math.radians(1.5), (1.0, 0.95, 0.85)
sun = bpy.data.objects.new("sun", sun_data)
sun.rotation_euler = (math.radians(-12), math.radians(-58), 0)
scene.collection.objects.link(sun)
lamp_data = bpy.data.lights.new("lamp", "POINT")
lamp_data.energy, lamp_data.shadow_soft_size, lamp_data.color = 25.0, 0.04, (1.0, 0.72, 0.45)
lamp = bpy.data.objects.new("lamp", lamp_data)
lamp.location = (-0.62, 0.78, 1.15)
scene.collection.objects.link(lamp)
world = bpy.data.worlds.new("world")
world.use_nodes = True
scene.world = world
background = world.node_tree.nodes["Background"]

# ---------- bake ----------
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
for kind in ("METAL", "CUDA", "OPTIX", "HIP"):
    try:
        prefs.compute_device_type = kind
        break
    except TypeError:
        continue
prefs.get_devices()
for device in prefs.devices:
    device.use = True
scene.cycles.device = "GPU" if any(d.use and d.type != "CPU" for d in prefs.devices) else "CPU"
scene.cycles.samples = SAMPLES
scene.view_settings.view_transform = "Standard"
scene.world.light_settings.distance = 0.35

image_node = {}
for mat in room.data.materials:
    node = mat.node_tree.nodes.new("ShaderNodeTexImage")
    mat.node_tree.nodes.active = node
    image_node[mat.name] = node


# Lightmaps hold light above 1 (a sunlit patch); 8-bit files can't. They're stored at a quarter
# of their value and sRGB-encoded, so the dark end keeps its steps; three.js reads them as sRGB
# and multiplies by RANGE (lightMapIntensity). AO stays linear: it never goes past 1.
RANGE = 4.0


def save_8bit(source, name, light):
    import numpy as np

    pixels = np.empty(SIZE * SIZE * 4, dtype=np.float32)
    source.pixels.foreach_get(pixels)
    rgb = pixels.reshape(-1, 4)[:, :3]
    if light:
        rgb = np.clip(rgb / RANGE, 0, 1)
        rgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * np.power(rgb, 1 / 2.4) - 0.055)
    pixels.reshape(-1, 4)[:, :3] = np.clip(rgb, 0, 1)
    out = bpy.data.images.new(name + "_8bit", SIZE, SIZE)
    out.colorspace_settings.name = "Non-Color"
    out.pixels.foreach_set(pixels)
    out.filepath_raw = os.path.join(OUT, f"{name}.png")
    out.file_format = "PNG"
    out.save()
    clipped = float((pixels.reshape(-1, 4)[:, :3] >= 1).mean())
    print(f"[bake] {name}: {clipped * 100:.2f}% of texels at the top of the range")


def bake(name, kind, light, sky, sky_strength, **settings):
    t = time.time()
    image = bpy.data.images.new(name, SIZE, SIZE, float_buffer=True)
    for node in image_node.values():
        node.image = image
    sun.hide_render = light != "sun"
    lamp.hide_render = light != "lamp"
    background.inputs["Color"].default_value = (*sky, 1)
    background.inputs["Strength"].default_value = sky_strength
    bpy.ops.object.select_all(action="DESELECT")
    room.select_set(True)
    bpy.context.view_layer.objects.active = room
    bpy.ops.object.bake(type=kind, margin=6, use_clear=True, **settings)
    print(f"[bake] {name}: {time.time() - t:.1f}s")
    save_8bit(image, name, kind != "AO")


# light only (no surface colour): the colours stay in three.js, so a finish can change
bake("lm_day", "DIFFUSE", "sun", (0.55, 0.7, 1.0), 0.35, pass_filter={"DIRECT", "INDIRECT"})
bake("lm_night", "DIFFUSE", "lamp", (0.1, 0.12, 0.25), 0.02, pass_filter={"DIRECT", "INDIRECT"})
bake("ao", "AO", None, (1, 1, 1), 1)

# ---------- export ----------
for node in image_node.values():
    node.image = None
bpy.ops.object.select_all(action="DESELECT")
room.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "room.glb"), export_format="GLB", use_selection=True, export_apply=True)
print(f"[bake] build {built - started:.1f}s · total {time.time() - started:.1f}s · {len(room.data.polygons)} faces · {SIZE}px · {SAMPLES} samples · {scene.cycles.device}")
