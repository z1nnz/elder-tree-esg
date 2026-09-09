"""Build editable, closed cloud meshes for the single-island environment.

blender --background --python-exit-code 1 --python tools/blender/build_cloud_world.py
Run from the repository root. No background photographs or billboard planes.
"""
import json
import random
from pathlib import Path

import bpy


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
target = Path("apps/life-tree-unity/Assets/Art/Generated").resolve()
source = Path("art-source/blender").resolve()
root = bpy.data.objects.new("雲境_立體雲海", None)
bpy.context.collection.objects.link(root)
material = bpy.data.materials.new("雲境_柔白雲")
material.diffuse_color = (.86, .94, 1, 1)

# Front is Blender -Y, Unity +Z. Leave the central island's silhouette clear.
layout = [
    ("後景左", (-17, 14, -5), (1.8, 1.2, .9)),
    ("後景中", (0, 25, -5.5), (2.6, 1.3, 1.0)),
    ("後景右", (19, 17, -4.5), (2.0, 1.3, 1.05)),
    ("中景左", (-13, 2, -7), (1.8, 1.1, .8)),
    ("中景右", (14, 1, -7.5), (1.7, 1.3, .9)),
    ("近景左", (-10, -10, -10), (1.8, 1.15, .65)),
    ("近景右", (11, -9, -11), (2, 1.2, .75)),
    ("高空左", (-18, 30, 12), (.85, .85, 1.05)),
    ("高空右", (20, 34, 16), (.95, .85, 1.1)),
]
clouds = []
for index, (label, position, scale) in enumerate(layout):
    rng = random.Random(9100 + index)
    # Distinct names prevent Blender metaball families from merging banks.
    data = bpy.data.metaballs.new(f"雲團造型{index}")
    data.resolution = .24
    data.render_resolution = .24
    data.threshold = 1.2
    cloud = bpy.data.objects.new(f"立體雲_{label}", data)
    bpy.context.collection.objects.link(cloud)
    cloud.location, cloud.scale = position, scale
    cloud.parent = root
    for x, y, z, radius in [(-2.8,0,0,1.9),(-.7,-.2,.3,2.3),(1.8,.2,0,1.8),
                           (-1,0,1.7,2.1),(1.2,.3,1.2,1.6),(-3,1,-.5,1.3),
                           (2.8,1,-.3,1.2),(.3,1.2,-.5,2.0)]:
        element = data.elements.new()
        element.co = (x + rng.uniform(-.25,.25), y, z + rng.uniform(-.2,.3))
        element.radius = radius
    data.materials.append(material)
    clouds.append(cloud)

# Keep metaballs in the editable source, export evaluated closed mesh volumes.
bpy.ops.wm.save_as_mainfile(filepath=str(source / "雲境立體雲海_母稿.blend"))
total_triangles = 0
for cloud in clouds:
    bpy.ops.object.select_all(action="DESELECT")
    cloud.select_set(True)
    bpy.context.view_layer.objects.active = cloud
    bpy.ops.object.convert(target="MESH")
    cloud = bpy.context.object
    decimate = cloud.modifiers.new("雲團面數控制", "DECIMATE")
    decimate.ratio = min(1, 2600 / max(1, len(cloud.data.polygons)))
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    for face in cloud.data.polygons:
        face.use_smooth = True
    cloud.data.calc_loop_triangles()
    total_triangles += len(cloud.data.loop_triangles)
    assert min(cloud.dimensions) > 1, f"雲團缺少厚度：{cloud.name}"
assert total_triangles < 40000, total_triangles
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.fbx(filepath=str(target / "雲境立體雲海.fbx"), use_selection=True,
                         add_leaf_bones=False, bake_anim=False, mesh_smooth_type="FACE",
                         axis_forward="-Z", axis_up="Y")
stats = {"雲團數": len(clouds), "三角面數": total_triangles, "背景圖片數": 0}
(target / "雲境立體雲海_資產統計.json").write_text(json.dumps(stats, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(stats, ensure_ascii=False))
