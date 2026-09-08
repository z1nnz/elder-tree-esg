"""Verify saved Blender stream vertices and bank-to-waterfall seams.

Run Blender with the saved 生命樹庭園_母稿.blend and --python this file.
This checks geometry, not visual quality or runtime performance.
"""

import json
import unittest

import bpy
from mathutils.bvhtree import BVHTree


def verify():
    island = bpy.data.objects["浮島_中央生命島"]
    island.data.calc_loop_triangles()
    terrain = BVHTree.FromPolygons(
        [island.matrix_world @ vertex.co for vertex in island.data.vertices],
        [tuple(triangle.vertices) for triangle in island.data.loop_triangles],
        all_triangles=True,
    )
    checked = 0
    max_clearance = 0.0
    max_seam = 0.0
    for suffix in ("中央左", "中央右"):
        stream = bpy.data.objects[f"溪流_{suffix}"]
        waterfall = bpy.data.objects[f"瀑布_{suffix}"]
        vertices = [stream.matrix_world @ vertex.co for vertex in stream.data.vertices]
        for vertex in vertices:
            hit, _, _, _ = terrain.ray_cast((vertex.x, vertex.y, 3), (0, 0, -1), 10)
            assert hit is not None, f"溪流離地：{suffix} {tuple(vertex)}"
            clearance = vertex.z - hit.z
            max_clearance = max(max_clearance, clearance)
            assert .059 < clearance < .42, f"溪流未貼合地形：{suffix} {clearance}"
            checked += 1
        stream.data.calc_loop_triangles()
        for triangle in stream.data.loop_triangles:
            a, b, c = [vertices[index] for index in triangle.vertices]
            for weights in ((1/3, 1/3, 1/3), (.6, .2, .2), (.2, .6, .2), (.2, .2, .6)):
                sample = a * weights[0] + b * weights[1] + c * weights[2]
                hit, _, _, _ = terrain.ray_cast((sample.x, sample.y, 3), (0, 0, -1), 10)
                assert hit is not None and sample.z > hit.z + .005, f"溪流面穿入地形：{suffix}"
        # The shared seam uses the same width and ground offset. Compare the
        # bank endpoints, independent of the two meshes' tessellation density.
        lip = [waterfall.matrix_world @ vertex.co for vertex in waterfall.data.vertices[:9]]
        for endpoint in (vertices[-5], vertices[-1]):
            distance = min((endpoint - candidate).length for candidate in (lip[0], lip[-1]))
            max_seam = max(max_seam, distance)
            assert distance < .001, f"溪流與瀑布接縫：{suffix} {distance}"
    assert checked >= 400, "溪流採樣不足"
    print(json.dumps({"檢查溪流頂點": checked, "最大離地間距": max_clearance,
                      "最大端點接縫": max_seam, "結果": "通過"}, ensure_ascii=False))


class StreamGroundingTests(unittest.TestCase):
    def test_beds_and_banks_have_valid_surface_layers(self):
        for suffix in ("中央左", "中央右"):
            stream = bpy.data.objects[f"溪流_{suffix}"]
            bed = bpy.data.objects[f"河床_{suffix}"]
            self.assertEqual(len(stream.data.vertices), len(bed.data.vertices))
            for water, floor in zip(stream.data.vertices, bed.data.vertices, strict=True):
                self.assertAlmostEqual(water.co.z - floor.co.z, .035, places=5)
            for obj in (bed, bpy.data.objects[f"溪岸_{suffix}_0"], bpy.data.objects[f"溪岸_{suffix}_1"]):
                self.assertTrue(all(face.normal.z > 0 for face in obj.data.polygons), obj.name)
                colors = obj.data.color_attributes["溪岸混合"]
                self.assertEqual(len(colors.data), len(obj.data.vertices))
                if obj != bed:
                    weights = [color.color[0] for color in colors.data]
                    self.assertAlmostEqual(min(weights), 0)
                    self.assertAlmostEqual(max(weights), 1)

    def test_saved_geometry(self):
        verify()

    def test_rejects_floating_stream_vertex(self):
        vertex = bpy.data.objects["溪流_中央左"].data.vertices[10]
        original = vertex.co.copy()
        try:
            vertex.co.z += .8
            with self.assertRaisesRegex(AssertionError, "未貼合地形"):
                verify()
        finally:
            vertex.co = original

    def test_rejects_detached_waterfall_seam(self):
        vertex = bpy.data.objects["瀑布_中央右"].data.vertices[0]
        original = vertex.co.copy()
        try:
            vertex.co.y -= .2
            with self.assertRaisesRegex(AssertionError, "接縫"):
                verify()
        finally:
            vertex.co = original


suite = unittest.defaultTestLoader.loadTestsFromTestCase(StreamGroundingTests)
result = unittest.TextTestRunner(verbosity=2).run(suite)
if not result.wasSuccessful():
    raise RuntimeError("溪流貼地檢查失敗")
