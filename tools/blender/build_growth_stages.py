"""Author five young life-tree silhouettes; the mature master supplies stage six.

Run with Blender --background --python this_file -- --output DIR --source DIR.
Each stage is a separate editable hierarchy, in the same metre-scale origin as
the mature tree. No stage is a scaled copy of another stage.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_life_tree import collection, curve_branch, material, reset_scene, parse_args


def leaf(name, base, tip, width, parent, target, green):
    """A cupped blade with a central ridge, pointed tip and readable midrib."""
    base, tip = Vector(base), Vector(tip)
    axis = tip - base
    side = axis.cross(Vector((0, 0, 1))).normalized()
    vertices, faces = [], []
    rows = 9
    for row in range(rows):
        t = row / (rows - 1)
        center = base + axis * t + Vector((0, 0, math.sin(t * math.pi) * width * .30))
        span = math.sin(math.pi * t) ** .85 * width
        for across in (-1, 0, 1):
            vertices.append(tuple(center + side * span * across
                                  + Vector((0, 0, -abs(across) * span * .22))))
    for row in range(rows - 1):
        for col in range(2):
            a = row * 3 + col
            faces.append((a, a + 1, a + 4, a + 3))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(green)
    colors = mesh.color_attributes.new(name="葉色", type="FLOAT_COLOR", domain="POINT")
    for index, entry in enumerate(colors.data):
        t = (index // 3) / (rows - 1)
        ridge = .08 if index % 3 == 1 else 0
        entry.color = (.10 + t * .16 + ridge, .25 + t * .19 + ridge, .065 + t * .055, 1)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    target.objects.link(obj)
    obj.parent = parent


def seed(parent, target, shell, opened=False):
    # Two asymmetric shell halves retain the same identity after germination.
    for half in range(2):
        vertices, faces = [], []
        rows, columns = 16, 16
        for row in range(rows + 1):
            v = (row + .02) / (rows + .04) * math.pi
            for col in range(columns + 1):
                angle = math.pi * col / columns + half * math.pi
                radius = math.sin(v) * (1 + .10 * math.cos(7 * angle) * math.sin(v))
                x = .33 * radius * math.cos(angle)
                y = .24 * radius * math.sin(angle)
                z = .24 + .25 * math.cos(v)
                if opened:
                    y += (-1 if half else 1) * .12 * (z + .1)
                vertices.append((x, y, z))
        for row in range(rows):
            for col in range(columns):
                a = row * (columns + 1) + col
                faces.append((a + columns + 1, a + columns + 2, a + 1, a))
        mesh = bpy.data.meshes.new(f"種殼_{half}")
        mesh.from_pydata(vertices, [], faces)
        mesh.materials.append(shell)
        obj = bpy.data.objects.new(f"種殼_{parent.name}_{half}", mesh)
        target.objects.link(obj)
        obj.parent = parent
        for face in mesh.polygons:
            face.use_smooth = True
    seam = curve_branch(f"種縫_{parent.name}",
                        [(-.32, 0, .24), (-.22, 0, .43), (0, 0, .49), (.22, 0, .43), (.32, 0, .24)],
                        [1, .8, .7, .8, 1], shell, target, bevel=.013)
    seam.parent = parent


def build():
    args = parse_args()
    output, source = Path(args.output).resolve(), Path(args.source).resolve()
    output.mkdir(parents=True, exist_ok=True)
    source.mkdir(parents=True, exist_ok=True)
    reset_scene()
    target = collection("生命樹_生長造型")
    shell = material("種殼暖栗", (.30, .12, .035, 1), roughness=.68)
    stem = material("嫩莖青綠", (.18, .32, .075, 1), roughness=.8)
    bark = material("幼樹柔棕", (.25, .12, .045, 1), roughness=.86)
    green = material("嫩葉玉綠", (.32, .55, .13, 1), roughness=.85)
    color_node = green.node_tree.nodes.new("ShaderNodeVertexColor")
    color_node.layer_name = "葉色"
    green.node_tree.links.new(color_node.outputs["Color"],
                              green.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])
    labels = ("種子", "發芽", "幼苗", "小樹", "成樹")
    for stage, label in enumerate(labels):
        root = bpy.data.objects.new(f"生長階段_{stage:02d}_{label}", None)
        target.objects.link(root)
        root["生長階段"] = stage
        if stage <= 1:
            seed(root, target, shell, opened=stage == 1)
        if stage == 0:
            continue
        heights = (0, .95, 1.65, 2.8, 4.2)
        height = heights[stage]
        points = [(0, 0, .12), (-.11, .015, height * .32),
                  (-.16, .025, height * .57), (.09, .01, height * .81), (.06, 0, height)]
        trunk = curve_branch(f"成長樹幹_{stage:02d}", points, [1.15, .95, .68, .4, .07],
                             stem if stage < 3 else bark, target,
                             bevel=(.035, .035, .06, .14, .24)[stage])
        trunk.parent = root
        if stage <= 2:
            # First opposing cotyledons, then true leaves at staggered nodes.
            nodes = [(.65, math.pi * .1), (.66, math.pi * 1.1)]
            if stage == 2:
                nodes += [(.86, .8), (.91, 3.8), (.43, 2.0), (.47, 5.1)]
            for index, (level, angle) in enumerate(nodes):
                base = (.02, 0, height * level)
                length = .52 if stage == 1 else .65
                tip = (math.cos(angle) * length, math.sin(angle) * length, height * level + .18)
                leaf(f"嫩葉_{stage}_{index}", base, tip, length * .30, root, target, green)
        else:
            # A small open crown becomes layered boughs; no duplicate mature mesh.
            count = 5 if stage == 3 else 9
            for index in range(count):
                angle = index * 2.399963 + .35
                level = .44 + index / count * .43
                radius = (1 - index / count * .56) * (1.05 if stage == 3 else 1.90)
                start = Vector((-.10, .01, height * level))
                end = Vector((math.cos(angle) * radius, math.sin(angle) * radius,
                              height * level + height * .15))
                branch = curve_branch(f"成長側枝_{stage}_{index}",
                                      [tuple(start), tuple(start.lerp(end, .5) - Vector((0, 0, .1))), tuple(end)],
                                      [1, .6, .08], bark, target, bevel=.055 if stage == 3 else .085)
                branch.parent = root
                for twig in range(3 if stage == 3 else 5):
                    attach = start.lerp(end, .48 + twig * (.16 if stage == 3 else .1))
                    direction = angle + (-1 if twig % 2 else 1) * .8
                    twig_end = attach + Vector((math.cos(direction) * .36,
                                                 math.sin(direction) * .36, .23))
                    twig_obj = curve_branch(f"生長細枝_{stage}_{index}_{twig}",
                                            [tuple(attach), tuple(twig_end)], [1, .1], bark, target, bevel=.022)
                    twig_obj.parent = root
                    for blade in range(5 if stage == 3 else 11):
                        leaf_angle = direction + blade * 2.399963
                        leaf_start = twig_end + Vector((math.sin(blade * 1.7) * .12,
                                                        math.cos(blade * 1.7) * .12, blade * .025))
                        leaf_tip = leaf_start + Vector((math.cos(leaf_angle) * .48,
                                                        math.sin(leaf_angle) * .48, .10 + blade * .02))
                        leaf(f"嫩葉_{stage}_{index}_{twig}_{blade}", leaf_start, leaf_tip,
                             .14, root, target, green)
            for index in range(4):
                angle = index * 1.65
                root_branch = curve_branch(f"成長根系_{stage}_{index}",
                                            [(0, 0, .16), (.3 * math.cos(angle), .3 * math.sin(angle), .03),
                                             (.6 * math.cos(angle), .6 * math.sin(angle), -.04)],
                                            [1, .65, .03], bark, target, bevel=.08 if stage == 3 else .12)
                root_branch.parent = root
    # Mother file preserves curves and individual blades for manual art edits.
    bpy.ops.wm.save_as_mainfile(filepath=str(source / "生命樹生長階段_母稿.blend"))
    for obj in list(bpy.context.scene.objects):
        if obj.type == "CURVE":
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.convert(target="MESH")
    for root in [obj for obj in target.objects if obj.type == "EMPTY"]:
        for prefix in ("嫩葉_", "成長", "生長細枝_"):
            items = [obj for obj in root.children if obj.type == "MESH" and obj.name.startswith(prefix)]
            if len(items) < 2:
                continue
            bpy.ops.object.select_all(action="DESELECT")
            for obj in items:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = items[0]
            bpy.ops.object.join()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.fbx(filepath=str(output / "生命樹生長階段.fbx"), use_selection=True,
                             add_leaf_bones=False, bake_anim=False, axis_forward="-Z", axis_up="Y")
    bpy.ops.export_scene.gltf(filepath=str(output / "生命樹生長階段.glb"), export_format="GLB",
                              use_selection=True, export_extras=True)
    print("五個獨立早期造型已匯出；第六階段沿用生命樹大樹母稿。")


if __name__ == "__main__":
    build()
