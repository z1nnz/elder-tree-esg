"""建立樹伴第一版可拆分生命樹資產。

用法：
  blender --background --python tools/blender/build_life_tree.py -- \
    --output apps/life-tree-unity/Assets/Art/Generated \
    --source art-source/blender

輸出包含 Unity 可直接匯入的 FBX、通用 GLB、可編輯 BLEND 與品質預覽圖。
所有幾何均由固定參數產生，重跑不會改變紀念掛點位置。
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector


SEED = 20260830


def parse_args() -> argparse.Namespace:
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--source", required=True)
    return parser.parse_args(arguments)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def collection(name: str) -> bpy.types.Collection:
    item = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(item)
    return item


def move_to_collection(obj: bpy.types.Object, target: bpy.types.Collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    target.objects.link(obj)


def material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    roughness: float = 0.72,
    metallic: float = 0.0,
) -> bpy.types.Material:
    item = bpy.data.materials.new(name)
    item.diffuse_color = color
    item.use_nodes = True
    shader = item.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return item


def curve_branch(
    name: str,
    points: list[tuple[float, float, float]],
    radii: list[float],
    branch_material: bpy.types.Material,
    target: bpy.types.Collection,
    *,
    bevel: float,
) -> bpy.types.Object:
    origin = Vector(points[0])
    data = bpy.data.curves.new(name, type="CURVE")
    data.dimensions = "3D"
    data.resolution_u = 3
    data.bevel_depth = bevel
    data.bevel_resolution = 3
    data.resolution_u = 5
    data.use_fill_caps = True
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for index, (coordinate, radius) in enumerate(zip(points, radii, strict=True)):
        point = spline.bezier_points[index]
        point.co = Vector(coordinate) - origin
        point.radius = radius
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, data)
    obj.location = origin
    obj.data.materials.append(branch_material)
    target.objects.link(obj)
    return obj


def leaf_cluster(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    leaf_material: bpy.types.Material,
    target: bpy.types.Collection,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple(value * 0.84 for value in scale)
    obj.rotation_euler = (
        random.uniform(-0.15, 0.15),
        random.uniform(-0.15, 0.15),
        random.uniform(-0.35, 0.35),
    )
    obj.data.materials.append(leaf_material)
    move_to_collection(obj, target)
    return obj


def leaf_blade(
    name: str,
    location: Vector,
    rotation: tuple[float, float, float],
    scale: tuple[float, float, float],
    leaf_material: bpy.types.Material,
    target: bpy.types.Collection,
    parent: bpy.types.Object,
) -> bpy.types.Object:
    """Create a small faceted leaf that breaks up the round canopy silhouette."""
    vertices = [
        (-0.34, 0.0, 0.0),
        (-0.05, 0.15, 0.045),
        (0.38, 0.0, 0.0),
        (-0.05, -0.15, 0.045),
        (-0.04, 0.0, 0.11),
        (-0.34, 0.0, -0.012),
        (-0.05, 0.15, -0.025),
        (0.38, 0.0, -0.012),
        (-0.05, -0.15, -0.025),
    ]
    faces = [
        (0, 1, 4),
        (1, 2, 4),
        (2, 3, 4),
        (3, 0, 4),
        (8, 7, 5),
        (7, 6, 5),
        (0, 5, 6, 1),
        (1, 6, 7, 2),
        (2, 7, 8, 3),
        (3, 8, 5, 0),
    ]
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    obj.rotation_euler = rotation
    obj.scale = scale
    obj.data.materials.append(leaf_material)
    target.objects.link(obj)
    bpy.context.view_layer.update()
    world_matrix = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world_matrix
    return obj


def add_cluster_edge_leaves(
    cluster: bpy.types.Object,
    index: int,
    leaf_materials: tuple[bpy.types.Material, ...],
    target: bpy.types.Collection,
    layer_name: str,
) -> None:
    directions: list[Vector] = []
    leaf_count = 18
    golden_angle = math.pi * (3.0 - math.sqrt(5.0))
    for leaf_index in range(leaf_count):
        vertical = 1.0 - 2.0 * ((leaf_index + 0.5) / leaf_count)
        radial = math.sqrt(max(0.0, 1.0 - vertical * vertical))
        angle = leaf_index * golden_angle
        directions.append(
            Vector(
                (
                    math.cos(angle) * radial,
                    math.sin(angle) * radial * 0.72,
                    vertical,
                )
            )
        )
    center = cluster.location.copy()
    for leaf_index, direction in enumerate(directions, start=1):
        jitter = Vector(
            (
                random.uniform(-0.06, 0.06),
                random.uniform(-0.04, 0.04),
                random.uniform(-0.05, 0.05),
            )
        )
        position = center + Vector(
            (
                direction.x * cluster.scale.x,
                direction.y,
                direction.z * cluster.scale.z,
            )
        ) * 0.90 + jitter
        rotation = direction.to_track_quat("Z", "Y").to_euler()
        rotation.rotate_axis("Z", random.uniform(-0.55, 0.55))
        leaf_blade(
            f"{layer_name}葉片_{index:02d}_{leaf_index:02d}",
            position,
            tuple(rotation),
            (
                random.uniform(0.62, 0.86),
                random.uniform(0.62, 0.88),
                random.uniform(0.58, 0.78),
            ),
            leaf_materials[(index + leaf_index) % len(leaf_materials)],
            target,
            cluster,
        )


def build_tree() -> bpy.types.Object:
    random.seed(SEED)
    trunk_material = material("樹皮暖棕", (0.24, 0.095, 0.035, 1))
    trunk_light = material("樹皮光面", (0.42, 0.19, 0.07, 1))
    leaf_dark = material("深林葉", (0.025, 0.22, 0.12, 1))
    leaf_mid = material("同行葉", (0.08, 0.42, 0.22, 1))
    leaf_light = material("新芽葉", (0.30, 0.68, 0.30, 1))
    leaf_warm = material("日照葉", (0.22, 0.58, 0.22, 1))
    ground_material = material("暖土", (0.25, 0.14, 0.07, 1))

    root_collection = collection("生命樹_主體")
    branch_collection = collection("生命樹_主枝")
    leaf_back_collection = collection("生命樹_後景葉冠")
    leaf_front_collection = collection("生命樹_前景葉冠")
    socket_collection = collection("生命樹_紀念掛點")
    ground_collection = collection("生命樹_地表")

    root = bpy.data.objects.new("生命樹_根節點", None)
    root_collection.objects.link(root)
    root["資產版本"] = 1
    root["生長階段數"] = 6
    root["紀念掛點數"] = 12

    trunk = curve_branch(
        "主幹",
        [
            (0.0, 0.0, 0.05),
            (-0.08, 0.02, 0.95),
            (0.10, -0.02, 2.0),
            (-0.04, 0.04, 3.05),
            (0.10, 0.02, 4.05),
            (0.02, 0.0, 4.7),
        ],
        [1.0, 0.92, 0.78, 0.60, 0.38, 0.12],
        trunk_material,
        root_collection,
        bevel=0.42,
    )
    trunk.parent = root

    # A second slimmer highlight makes the trunk read as painted form instead
    # of one uniformly shaded tube on small phone screens.
    highlight = curve_branch(
        "主幹_暖光紋理",
        [
            (-0.24, -0.30, 0.12),
            (-0.29, -0.30, 1.1),
            (-0.10, -0.29, 2.2),
            (-0.18, -0.24, 3.15),
        ],
        [0.45, 0.34, 0.22, 0.05],
        trunk_light,
        root_collection,
        bevel=0.11,
    )
    highlight.parent = root

    branch_specs = [
        ((-0.02, 0.0, 1.45), (-1.35, 0.06, 2.00), (-2.30, 0.08, 2.52)),
        ((0.05, 0.0, 1.72), (1.25, -0.02, 2.20), (2.30, 0.12, 2.65)),
        ((0.06, 0.0, 2.15), (-1.20, -0.14, 2.72), (-2.08, -0.18, 3.25)),
        ((0.04, 0.0, 2.45), (1.12, 0.16, 3.00), (2.05, 0.20, 3.38)),
        ((-0.02, 0.0, 2.85), (-0.92, 0.22, 3.46), (-1.62, 0.26, 3.95)),
        ((0.02, 0.0, 3.10), (0.92, -0.18, 3.65), (1.62, -0.20, 4.10)),
        ((0.05, 0.0, 3.48), (-0.72, -0.08, 4.05), (-1.16, -0.04, 4.52)),
        ((0.06, 0.0, 3.72), (0.70, 0.12, 4.22), (1.08, 0.14, 4.66)),
    ]
    branch_ends: list[Vector] = []
    for index, points in enumerate(branch_specs, start=1):
        branch = curve_branch(
            f"主枝_{index:02d}",
            list(points),
            [0.82, 0.45, 0.08],
            trunk_material,
            branch_collection,
            bevel=max(0.11, 0.20 - index * 0.009),
        )
        branch.parent = root
        branch["風動相位"] = round((index * 0.17) % 1, 3)
        branch["風動幅度"] = round(0.35 + index * 0.035, 3)
        branch_ends.append(Vector(points[-1]))

    # Roots anchor the silhouette and keep the tree from looking like a toy
    # planted on top of a disk.
    for index, angle in enumerate((0.15, 1.4, 2.7, 3.8, 5.15), start=1):
        end = (math.cos(angle) * 1.55, math.sin(angle) * 0.68, -0.06)
        root_branch = curve_branch(
            f"樹根_{index:02d}",
            [(0.0, 0.0, 0.12), (end[0] * 0.55, end[1] * 0.55, 0.02), end],
            [0.72, 0.34, 0.04],
            trunk_material,
            ground_collection,
            bevel=0.18,
        )
        root_branch.parent = root

    back_centers = [
        (-1.95, 0.24, 2.76),
        (1.95, 0.22, 2.93),
        (-1.58, 0.36, 3.70),
        (1.55, 0.35, 3.78),
        (-0.70, 0.42, 4.43),
        (0.70, 0.40, 4.52),
        (0.0, 0.46, 4.84),
        (0.0, 0.50, 3.70),
    ]
    for index, center in enumerate(back_centers, start=1):
        cluster = leaf_cluster(
            f"後景葉簇_{index:02d}",
            center,
            (0.78 + (index % 3) * 0.10, 0.56, 0.60 + (index % 2) * 0.11),
            leaf_dark if index % 3 else leaf_mid,
            leaf_back_collection,
        )
        cluster.parent = root
        cluster["風動相位"] = round((index * 0.13) % 1, 3)
        add_cluster_edge_leaves(
            cluster,
            index,
            (leaf_dark, leaf_mid, leaf_light),
            leaf_back_collection,
            "後景",
        )

    front_centers = [
        (-2.18, -0.18, 2.62),
        (2.14, -0.22, 2.82),
        (-1.66, -0.35, 3.35),
        (1.68, -0.30, 3.52),
        (-0.80, -0.42, 4.15),
        (0.86, -0.39, 4.24),
        (0.0, -0.46, 4.62),
        (0.05, -0.48, 3.62),
    ]
    for index, center in enumerate(front_centers, start=1):
        cluster = leaf_cluster(
            f"前景葉簇_{index:02d}",
            center,
            (0.72 + (index % 2) * 0.14, 0.48, 0.56 + (index % 3) * 0.09),
            leaf_light if index in (5, 7) else leaf_mid,
            leaf_front_collection,
        )
        cluster.parent = root
        cluster["風動相位"] = round((0.41 + index * 0.11) % 1, 3)
        add_cluster_edge_leaves(
            cluster,
            index,
            (leaf_mid, leaf_light, leaf_warm),
            leaf_front_collection,
            "前景",
        )

    socket_positions = [
        (-1.55, -0.54, 2.72),
        (1.48, -0.50, 2.88),
        (-1.22, -0.63, 3.32),
        (1.18, -0.60, 3.47),
        (-0.72, -0.69, 3.90),
        (0.72, -0.67, 4.02),
        (-0.22, -0.70, 4.42),
        (0.30, -0.68, 4.50),
        (-1.86, -0.45, 2.48),
        (1.82, -0.43, 2.64),
        (-1.44, -0.48, 3.70),
        (1.43, -0.46, 3.78),
    ]
    for index, position in enumerate(socket_positions, start=1):
        socket = bpy.data.objects.new(f"紀念掛點_{index:02d}", None)
        socket.empty_display_type = "SPHERE"
        socket.empty_display_size = 0.10
        socket.location = position
        socket.parent = root
        socket["掛點序號"] = index - 1
        socket_collection.objects.link(socket)

    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=2.6, depth=0.16, location=(0, 0, -0.15))
    ground = bpy.context.object
    ground.name = "同行土地"
    ground.scale.y = 0.62
    ground.data.materials.append(ground_material)
    move_to_collection(ground, ground_collection)
    ground.parent = root

    return root


def add_preview_scene(root: bpy.types.Object) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.018, 0.055, 0.040)

    bpy.ops.object.light_add(type="AREA", location=(-4.2, -4.5, 7.2))
    key = bpy.context.object
    key.name = "預覽_暖陽主光"
    key.data.energy = 1050
    key.data.shape = "DISK"
    key.data.size = 5.0
    key.data.color = (1.0, 0.72, 0.42)
    key.rotation_euler = (math.radians(28), 0, math.radians(-36))

    bpy.ops.object.light_add(type="AREA", location=(4.0, 1.5, 5.4))
    fill = bpy.context.object
    fill.name = "預覽_葉冠補光"
    fill.data.energy = 720
    fill.data.size = 4.0
    fill.data.color = (0.42, 0.76, 0.58)
    fill.rotation_euler = (math.radians(58), 0, math.radians(140))

    bpy.ops.object.light_add(type="POINT", location=(0, 1.8, 1.2))
    rim = bpy.context.object
    rim.name = "預覽_根部微光"
    rim.data.energy = 280
    rim.data.color = (0.98, 0.50, 0.18)

    bpy.ops.object.camera_add(location=(7.8, -10.8, 5.9))
    camera = bpy.context.object
    camera.name = "預覽_相機"
    camera.data.lens = 58
    direction = Vector((0, 0, 2.55)) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    root["預覽相機距離"] = round(camera.location.length, 2)


def convert_curves_for_export() -> None:
    bpy.ops.object.select_all(action="DESELECT")
    curves = [obj for obj in bpy.context.scene.objects if obj.type == "CURVE"]
    for obj in curves:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target="MESH")
        obj.select_set(False)


def write_asset_stats(output: Path) -> None:
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    stats = {
        "資產版本": 1,
        "網格物件數": len(mesh_objects),
        "頂點數": sum(len(obj.data.vertices) for obj in mesh_objects),
        "三角面數": sum(
            max(0, len(polygon.vertices) - 2)
            for obj in mesh_objects
            for polygon in obj.data.polygons
        ),
        "主枝數": sum(obj.name.startswith("主枝_") for obj in bpy.context.scene.objects),
        "葉冠群組數": sum(
            obj.name.startswith("前景葉簇_") or obj.name.startswith("後景葉簇_")
            for obj in bpy.context.scene.objects
        ),
        "獨立葉片數": sum("葉片_" in obj.name for obj in bpy.context.scene.objects),
        "紀念掛點數": sum(obj.name.startswith("紀念掛點_") for obj in bpy.context.scene.objects),
    }
    with (output / "生命樹庭園_資產統計.json").open("w", encoding="utf-8") as handle:
        json.dump(stats, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"生命樹資產統計：{json.dumps(stats, ensure_ascii=False)}")


def export_assets(output: Path, source: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    source.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene

    scene.render.filepath = str(output / "生命樹庭園_品質預覽.png")
    bpy.ops.render.render(write_still=True)

    # Preserve the editable curve source before converting for game export.
    bpy.ops.wm.save_as_mainfile(filepath=str(source / "生命樹庭園_母稿.blend"))
    convert_curves_for_export()
    write_asset_stats(output)

    excluded = {"預覽_暖陽主光", "預覽_葉冠補光", "預覽_根部微光", "預覽_相機"}
    for obj in bpy.context.scene.objects:
        obj.hide_render = obj.name in excluded
        obj.select_set(obj.name not in excluded)

    bpy.ops.export_scene.fbx(
        filepath=str(output / "生命樹庭園.fbx"),
        use_selection=True,
        apply_unit_scale=True,
        add_leaf_bones=False,
        bake_anim=False,
        mesh_smooth_type="FACE",
        axis_forward="-Z",
        axis_up="Y",
    )
    bpy.ops.export_scene.gltf(
        filepath=str(output / "生命樹庭園.glb"),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_extras=True,
    )


def main() -> None:
    args = parse_args()
    reset_scene()
    tree = build_tree()
    add_preview_scene(tree)
    export_assets(Path(args.output).resolve(), Path(args.source).resolve())


if __name__ == "__main__":
    main()
