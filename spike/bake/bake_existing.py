# Bake spike: bake a shadow mask for the live room, from what export_room.cjs wrote.
#   blender --background --factory-startup --python spike/bake/bake_existing.py -- spike/bake/existing-out
# Reads room.json (meshes and key lights) and room.bin (each mesh's triangles, world space, in
# the room's own units and axes), unwraps every lit mesh into one atlas and bakes:
#   R  the sun's shadow    G  the window light's shadow    B  the desk lamp's shadow
#   A  ambient occlusion (16 cm reach, as N8AO has it)
# Writes mask.png (RGBA, 8-bit, linear) and uvs.bin / uvs.json: each lit mesh's atlas
# coordinates, one per corner of each triangle, in the exported order.
import json
import math
import os
import sys
import time

import bpy
import numpy as np

OUT = os.path.abspath(sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "spike/bake/existing-out")
SIZE = int(os.environ.get("BAKE_SIZE", 4096))
SAMPLES = int(os.environ.get("BAKE_SAMPLES", 32))
started = time.time()

header = json.load(open(os.path.join(OUT, "room.json")))
positions = np.fromfile(os.path.join(OUT, "room.bin"), dtype=np.float32)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
collection = scene.collection

bake_mat = bpy.data.materials.new("bake")
bake_mat.use_nodes = True
bake_mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.6, 0.6, 0.6, 1)
image_node = bake_mat.node_tree.nodes.new("ShaderNodeTexImage")
bake_mat.node_tree.nodes.active = image_node

# Two objects: every lit mesh's triangles in one (in the exported order, so each mesh's corners
# can be cut back out of it), everything that only casts in the other. Cycles bakes object by
# object, each pass over the whole atlas, so 1,754 separate objects took over 20 minutes for one
# light without finishing.
def triangles(name, co):
    count = len(co) // 3
    mesh = bpy.data.meshes.new(name)
    mesh.vertices.add(count)
    mesh.vertices.foreach_set("co", co)
    mesh.loops.add(count)
    mesh.loops.foreach_set("vertex_index", np.arange(count, dtype=np.int32))
    mesh.polygons.add(count // 3)
    mesh.polygons.foreach_set("loop_start", np.arange(0, count, 3, dtype=np.int32))
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    return obj


lit, cast = [], []
# The room's floor and walls are planes 10 to 20 m across, reaching well past the view: 97% of
# the lit area. Their atlas share is cut to a fifth across (GIANT_SCALE) so the props keep theirs.
GIANT_EXTENT = 60
GIANT_SCALE = float(os.environ.get("BAKE_GIANT_SCALE", 0.2))
giants = []
at = 0
lit_tris = 0
for entry in header["meshes"]:
    count = entry["count"]
    co = positions[at * 3:(at + count) * 3]
    (lit if entry["receiver"] else cast).append(co)
    if entry["receiver"]:
        extent = co.reshape(-1, 3).max(0) - co.reshape(-1, 3).min(0)
        if extent.max() > GIANT_EXTENT:
            giants.append((lit_tris, lit_tris + count // 3))
        lit_tris += count // 3
    at += count
room = triangles("lit", np.concatenate(lit))
# Each triangle keeps its exported number, so its corners' atlas coordinates find their way back
# after the welding below drops and renumbers faces
orig = room.data.attributes.new("orig", "INT", "FACE")
orig.data.foreach_set("value", np.arange(lit_tris, dtype=np.int32))
giant_face = np.zeros(lit_tris, dtype=bool)
for start, end in giants:
    giant_face[start:end] = True
room.data.uv_layers.new(name="mask")
room.data.materials.append(bake_mat)
if cast:
    triangles("cast", np.concatenate(cast))
receivers = [room]
built = time.time()
print(f"[bake] built {len(lit)} lit and {len(cast)} casting meshes ({len(room.data.polygons)} lit triangles) in {built - started:.1f}s", flush=True)

# ---------- one atlas for every lit mesh ----------
for obj in scene.objects:
    obj.select_set(obj == room)
bpy.context.view_layer.objects.active = room
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
# The export gives every triangle corners of its own; unwelded, each triangle is an island of its
# own, and half a million islands' margins leave the atlas empty. Welded, a box side is one.
bpy.ops.mesh.remove_doubles(threshold=0.0005)
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0005, scale_to_bounds=False)
import bmesh  # noqa: E402

edit = bmesh.from_edit_mesh(room.data)
orig_layer = edit.faces.layers.int["orig"]
uv_layer = edit.loops.layers.uv["mask"]
sides = {}
for face in edit.faces:
    n = face[orig_layer]
    if giant_face[n]:
        # each flat side of a giant plane is one island: shrink it about its own middle
        sides.setdefault((int(np.searchsorted([s for s, _ in giants], n, side="right")), tuple(np.round(face.normal, 2))), []).append(face)
if sides:
    for faces in sides.values():
        loops = [loop for face in faces for loop in face.loops]
        middle = sum((loop[uv_layer].uv for loop in loops), loops[0][uv_layer].uv * 0) / len(loops)
        for loop in loops:
            loop[uv_layer].uv = middle + (loop[uv_layer].uv - middle) * GIANT_SCALE
bmesh.update_edit_mesh(room.data)
# Smart UV Project leaves the islands on a corner of the atlas; packed again they fill it
bpy.ops.uv.pack_islands(udim_source="CLOSEST_UDIM", rotate=True, margin_method="FRACTION", margin=0.0008, shape_method="AABB")
bpy.ops.object.mode_set(mode="OBJECT")
unwrapped = time.time()
print(f"[bake] unwrapped in {unwrapped - built:.1f}s", flush=True)

# ---------- lights: only where each one stands matters, its shadows are all the mask keeps ----------
lights = {}
for light in header["lights"]:
    data = bpy.data.lights.new(light["key"], "POINT")
    data.energy = 1000
    data.shadow_soft_size = light["soft"]
    obj = bpy.data.objects.new(light["key"], data)
    obj.location = light["position"]
    collection.objects.link(obj)
    lights[light["key"]] = obj

scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "METAL"
prefs.get_devices()
for device in prefs.devices:
    device.use = True
scene.cycles.device = "GPU"
scene.cycles.samples = SAMPLES
# A shadow or AO mask from a few dozen samples is smooth enough; Cycles' denoiser otherwise runs
# on the CPU over the whole atlas after every bake (over half an hour at 4096²)
scene.cycles.use_denoising = False
scene.world = bpy.data.worlds.new("world")
scene.world.light_settings.distance = 1.6

channels = []


def bake(kind, key=None):
    t = time.time()
    image = bpy.data.images.new(f"{kind}_{key}", SIZE, SIZE, float_buffer=True)
    image_node.image = image
    for name, obj in lights.items():
        obj.hide_render = name != key
    bpy.ops.object.bake(type=kind, margin=4, use_clear=True)
    pixels = np.empty(SIZE * SIZE * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    channels.append(pixels.reshape(-1, 4)[:, 0].copy())
    print(f"[bake] {kind} {key or ''}: {time.time() - t:.1f}s", flush=True)


for obj in scene.objects:
    obj.select_set(obj in receivers)
bake("SHADOW", "sun")
bake("SHADOW", "window")
bake("SHADOW", "lamp")
# occlusion is cheap to bake and grainy at a few dozen samples, so it gets more
scene.cycles.samples = int(os.environ.get("BAKE_AO_SAMPLES", 256))
bake("AO")

# Two files, no alpha: an RGBA save divides colour by alpha, which blew the shadows up to white
# wherever the occlusion was dark
def save(name, rgb):
    image = bpy.data.images.new(name, SIZE, SIZE, alpha=False)
    image.colorspace_settings.name = "Non-Color"
    pixels = np.ones((SIZE * SIZE, 4), dtype=np.float32)
    pixels[:, :3] = np.clip(rgb, 0, 1)
    image.pixels.foreach_set(pixels.reshape(-1))
    image.filepath_raw = os.path.join(OUT, f"{name}.png")
    image.file_format = "PNG"
    image.save()


save("shadow", np.stack(channels[:3], axis=1))
save("ao", np.repeat(channels[3][:, None], 3, axis=1))

# ---------- each lit mesh's atlas coordinates, corner by corner ----------
# (by each face's exported number; welding keeps a triangle's corners in their order. Faces the
# weld dropped, having no area, keep (0, 0).)
mesh = room.data
loop_uv = np.empty(len(mesh.loops) * 2, dtype=np.float32)
mesh.uv_layers["mask"].data.foreach_get("uv", loop_uv)
loop_start = np.empty(len(mesh.polygons), dtype=np.int32)
mesh.polygons.foreach_get("loop_start", loop_start)
face_orig = np.empty(len(mesh.polygons), dtype=np.int32)
mesh.attributes["orig"].data.foreach_get("value", face_orig)
corners = np.zeros((lit_tris, 3, 2), dtype=np.float32)
loop_uv = loop_uv.reshape(-1, 2)
for k in range(3):
    corners[face_orig, k] = loop_uv[loop_start + k]
corners.reshape(-1).tofile(os.path.join(OUT, "uvs.bin"))
print(f"[bake] {len(mesh.polygons)} of {lit_tris} triangles kept after welding", flush=True)
json.dump({"meshes": header["meshes"], "size": SIZE}, open(os.path.join(OUT, "uvs.json"), "w"))
print(f"[bake] total {time.time() - started:.1f}s · {SIZE}px · {SAMPLES} samples")
