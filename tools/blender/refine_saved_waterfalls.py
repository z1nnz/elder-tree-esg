"""Refine only waterfalls in the loaded mother model, preserving tree assets.

Run with the saved BLEND followed by --python-exit-code 1 --python this file.
Exports use the existing project paths; Blender retains its normal .blend1 backup.
"""
import importlib.util
from pathlib import Path

import bpy

root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("tree_builder", Path(__file__).with_name("build_life_tree.py"))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
targets = [obj for obj in bpy.context.scene.objects
           if obj.name.startswith(("瀑布_", "水沫內光_"))]
assert len(targets) == 4, "Expected two waterfalls and two foam meshes"
for obj in targets:
    original_inlet = [vertex.co.copy() for vertex in obj.data.vertices[:9]]
    builder.shape_waterfall_drop(obj)
    assert all((point - vertex.co).length < 1e-7
               for point, vertex in zip(original_inlet, obj.data.vertices[:9]))
builder.export_assets(root / "apps/life-tree-unity/Assets/Art/Generated", root / "art-source/blender",
                      render_preview=False)
