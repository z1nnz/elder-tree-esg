"""Refine only lower cliff geometry in a loaded mother model; retain the river deck."""
import importlib.util
from pathlib import Path

import bmesh
import bpy

root = Path(__file__).resolve().parents[2]
island = bpy.data.objects["浮島_中央生命島"]
if island.get("lower_cliff_refined_v1"):
    raise RuntimeError("Lower cliff already refined; refusing cumulative smoothing")
protected = [v.co.copy() for v in island.data.vertices if v.co.z >= -.8]
bm = bmesh.new()
bm.from_mesh(island.data)
edges = [e for e in bm.edges if all(v.co.z < -.8 for v in e.verts)]
bmesh.ops.subdivide_edges(bm, edges=edges, cuts=1, use_grid_fill=True)
# Keep the transition ring untouched; relax long angular lower spans locally.
moving = [v for v in bm.verts if v.co.z < -1.35]
for _ in range(2):
    bmesh.ops.smooth_vert(bm, verts=moving, factor=.22,
                          use_axis_x=True, use_axis_y=True, use_axis_z=False)
bm.normal_update()
bm.to_mesh(island.data)
bm.free()
island.data.update()
for point in protected:
    assert any((v.co - point).length < 1e-7 for v in island.data.vertices), "Protected deck moved"
island["lower_cliff_refined_v1"] = True
print(f"Protected deck vertices: {len(protected)}; refined island vertices: {len(island.data.vertices)}")
spec = importlib.util.spec_from_file_location("builder", Path(__file__).with_name("build_life_tree.py"))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
builder.export_assets(root / "apps/life-tree-unity/Assets/Art/Generated", root / "art-source/blender",
                      render_preview=False)
