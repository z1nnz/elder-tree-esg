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
    ("後景左", (-17, 14, -6), (1.25, 1.2, 1.1)),
    ("後景中", (0, 25, -9), (1.5, 1.3, 1.2)),
    ("後景右", (19, 17, -6), (1.3, 1.3, 1.15)),
    ("中景左", (-13, 2, -7), (1.3, 1.1, 1.0)),
    ("中景右", (14, 1, -7.5), (1.2, 1.3, 1.0)),
    ("近景左", (-10, -10, -10), (1.3, 1.15, .9)),
    ("近景右", (11, -9, -11), (1.4, 1.2, 1.0)),
    ("高空左", (-18, 30, 12), (.85, .85, 1.05)),
    ("高空右", (20, 34, 16), (.95, .85, 1.1)),
]
clouds = []
for index, (label, position, scale) in enumerate(layout):
    rng = random.Random(9100 + index)
    # Distinct names prevent Blender metaball families from merging banks.
    data = bpy.data.metaballs.new(f"雲團造型{index}")
    data.resolution = .20
    data.render_resolution = .20
    data.threshold = 1.2
    cloud = bpy.data.objects.new(f"立體雲_{label}", data)
    bpy.context.collection.objects.link(cloud)
    cloud.location, cloud.scale = position, scale
    cloud.parent = root
    # Distinct primary volumes and smaller edge lobes replace the stretched
    # low ridge. A tall off-centre dome creates a legible cumulus silhouette.
    lobes = [(-1.8,0,0,1.65),(0,0,.35,2.05),(1.7,.2,.1,1.5),
             (-.55,.15,1.65,1.85),(.85,.2,1.1,1.4),
             (-1.65,-.85,.35,1.15),(.2,-1.0,.8,1.35),(1.65,-.75,.3,1.0),
             (-1.3,.95,.6,1.15),(.6,1.1,.35,1.25),
             (-2.65,-.15,.1,.9),(2.5,.25,.35,.8),
             (-1.55,.05,1.75,.85),(-.25,-.55,2.6,.95),
             (.8,-.6,1.85,.75),(-.8,-1.35,.4,.85),
             (1.7,.75,1.0,.85),(.15,1.2,1.55,.95)]
    for x, y, z, radius in lobes:
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
    decimate.ratio = min(1, 1800 / max(1, len(cloud.data.polygons)))
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
