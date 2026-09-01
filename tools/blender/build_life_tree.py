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
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    item = bpy.data.materials.new(name)
    item.diffuse_color = color
    item.use_nodes = True
    shader = item.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if emission is not None:
        emission_input = shader.inputs.get("Emission Color") or shader.inputs.get("Emission")
        strength_input = shader.inputs.get("Emission Strength")
        if emission_input is not None:
            emission_input.default_value = emission
        if strength_input is not None:
            strength_input.default_value = emission_strength
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
    # A cluster is a transform anchor, not a rendered ball. The silhouette is
    # built from leaf blades and visible twig gaps so the crown keeps negative
    # space instead of reading as stacked cauliflower spheres.
    obj = bpy.data.objects.new(name, None)
    obj.name = name
    obj.location = location
    obj.scale = scale
    obj.rotation_euler = (
        random.uniform(-0.15, 0.15),
        random.uniform(-0.15, 0.15),
        random.uniform(-0.35, 0.35),
    )
    obj["葉冠主色"] = leaf_material.name
    target.objects.link(obj)
    return obj


def add_canopy_lobes(
    cluster: bpy.types.Object,
    index: int,
    leaf_materials: tuple[bpy.types.Material, ...],
    target: bpy.types.Collection,
    layer_name: str,
) -> None:
    """Add offset leaf sprays while preserving holes between branch tiers."""
    offsets = (
        Vector((-0.52, 0.02, 0.08)),
        Vector((0.46, -0.04, 0.16)),
        Vector((-0.05, 0.08, 0.48)),
        Vector((0.10, -0.10, -0.30)),
    )
    for lobe_index, offset in enumerate(offsets, start=1):
        location = cluster.location + Vector(
            (
                offset.x * cluster.scale.x,
                offset.y,
                offset.z * cluster.scale.z,
            )
        )
        lobe = bpy.data.objects.new(
            f"{layer_name}葉冠片_{index:02d}_{lobe_index:02d}",
            None,
        )
        lobe.name = f"{layer_name}葉冠片_{index:02d}_{lobe_index:02d}"
        lobe.location = location
        lobe.rotation_euler = (
            random.uniform(-0.18, 0.18),
            random.uniform(-0.18, 0.18),
            random.uniform(-0.48, 0.48),
        )
        target.objects.link(lobe)
        bpy.context.view_layer.update()
        world_matrix = lobe.matrix_world.copy()
        lobe.parent = cluster
        lobe.matrix_world = world_matrix

        leaf_count = 9
        for leaf_index in range(leaf_count):
            angle = math.tau * leaf_index / leaf_count + lobe_index * 0.43
            radial = 0.24 + (leaf_index % 3) * 0.11
            vertical = ((leaf_index % 4) - 1.5) * 0.11
            direction = Vector(
                (
                    math.cos(angle),
                    math.sin(angle) * 0.54,
                    vertical * 2.2,
                )
            ).normalized()
            position = location + Vector(
                (
                    direction.x * cluster.scale.x * radial,
                    direction.y * cluster.scale.y * radial,
                    direction.z * cluster.scale.z * radial,
                )
            )
            rotation = direction.to_track_quat("Z", "Y").to_euler()
            rotation.rotate_axis("Z", random.uniform(-0.45, 0.45))
            leaf_blade(
                f"{layer_name}葉冠片葉片_{index:02d}_{lobe_index:02d}_{leaf_index + 1:02d}",
                position,
                tuple(rotation),
                (
                    random.uniform(0.42, 0.62),
                    random.uniform(0.42, 0.62),
                    random.uniform(0.40, 0.58),
                ),
                leaf_materials[(index + lobe_index + leaf_index) % len(leaf_materials)],
                target,
                lobe,
            )


def add_branch_hierarchy(
    main_branch: bpy.types.Object,
    main_index: int,
    points: tuple[tuple[float, float, float], ...],
    branch_material: bpy.types.Material,
    target: bpy.types.Collection,
) -> None:
    """Grow visible second- and third-order branches from one authored limb."""
    _, middle, end = (Vector(point) for point in points)
    axis = (end - middle).normalized()
    lateral = Vector((-axis.y, axis.x, 0.0))
    if lateral.length < 0.01:
        lateral = Vector((1.0, 0.0, 0.0))
    lateral.normalize()

    for secondary_index, sign in enumerate((-1.0, 1.0), start=1):
        split = 0.28 + secondary_index * 0.18
        secondary_start = middle.lerp(end, split)
        secondary_middle = (
            secondary_start
            + axis * (0.20 + secondary_index * 0.04)
            + lateral * sign * (0.20 + main_index % 3 * 0.035)
            + Vector((0.0, 0.0, 0.08 + secondary_index * 0.03))
        )
        secondary_end = (
            secondary_start
            + axis * (0.40 + secondary_index * 0.05)
            + lateral * sign * (0.42 + main_index % 2 * 0.06)
            + Vector((0.0, 0.0, 0.18 + secondary_index * 0.04))
        )
        secondary = curve_branch(
            f"次枝_{main_index:02d}_{secondary_index:02d}",
            [tuple(secondary_start), tuple(secondary_middle), tuple(secondary_end)],
            [0.58, 0.30, 0.04],
            branch_material,
            target,
            bevel=0.115,
        )
        bpy.context.view_layer.update()
        secondary_world_matrix = secondary.matrix_world.copy()
        secondary.parent = main_branch
        secondary.matrix_world = secondary_world_matrix
        secondary["風動相位"] = round((main_index * 0.19 + secondary_index * 0.23) % 1, 3)

        for twig_index, twig_sign in enumerate((-1.0, 1.0), start=1):
            twig_start = secondary_middle.lerp(secondary_end, 0.42 + twig_index * 0.14)
            twig_axis = (secondary_end - secondary_middle).normalized()
            twig_lateral = Vector((-twig_axis.y, twig_axis.x, 0.0))
            if twig_lateral.length < 0.01:
                twig_lateral = lateral.copy()
            twig_lateral.normalize()
            twig_middle = (
                twig_start
                + twig_axis * 0.12
                + twig_lateral * twig_sign * (0.09 + secondary_index * 0.02)
                + Vector((0.0, 0.0, 0.06))
            )
            twig_end = (
                twig_start
                + twig_axis * 0.24
                + twig_lateral * twig_sign * (0.20 + secondary_index * 0.025)
                + Vector((0.0, 0.0, 0.14))
            )
            twig = curve_branch(
                f"末梢枝_{main_index:02d}_{secondary_index:02d}_{twig_index:02d}",
                [tuple(twig_start), tuple(twig_middle), tuple(twig_end)],
                [0.42, 0.20, 0.025],
                branch_material,
                target,
                bevel=0.070,
            )
            bpy.context.view_layer.update()
            twig_world_matrix = twig.matrix_world.copy()
            twig.parent = secondary
            twig.matrix_world = twig_world_matrix
            twig["紀念掛點禁用"] = True


def floating_island(
    name: str,
    location: tuple[float, float, float],
    radius: tuple[float, float],
    depth: float,
    grass_material: bpy.types.Material,
    rock_material: bpy.types.Material,
    target: bpy.types.Collection,
    parent: bpy.types.Object,
    *,
    seed: int,
    segments: int = 28,
) -> bpy.types.Object:
    """Create a game-ready floating island with a grassy crown and tapered rock keel."""
    island_random = random.Random(seed)
    vertices: list[tuple[float, float, float]] = [(0.0, 0.0, 0.04)]
    rings: list[list[int]] = []
    ring_specs = (
        (1.00, 0.04),
        (0.98, -0.16),
        (0.68, -depth * 0.58),
        (0.20, -depth),
    )
    edge_noise = [island_random.uniform(0.86, 1.13) for _ in range(segments)]
    for ring_index, (scale, z) in enumerate(ring_specs):
        ring: list[int] = []
        for index in range(segments):
            angle = math.tau * index / segments
            noise = edge_noise[index]
            if ring_index > 1:
                noise *= island_random.uniform(0.88, 1.08)
            vertices.append(
                (
                    math.cos(angle) * radius[0] * scale * noise,
                    math.sin(angle) * radius[1] * scale * noise,
                    z + island_random.uniform(-0.025, 0.025),
                )
            )
            ring.append(len(vertices) - 1)
        rings.append(ring)

    faces: list[tuple[int, ...]] = []
    material_indices: list[int] = []
    for index in range(segments):
        faces.append((0, rings[0][index], rings[0][(index + 1) % segments]))
        material_indices.append(0)
    for upper_ring, lower_ring in zip(rings, rings[1:]):
        for index in range(segments):
            faces.append(
                (
                    upper_ring[index],
                    lower_ring[index],
                    lower_ring[(index + 1) % segments],
                    upper_ring[(index + 1) % segments],
                )
            )
            material_indices.append(1)
    faces.append(tuple(reversed(rings[-1])))
    material_indices.append(1)

    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.materials.append(grass_material)
    data.materials.append(rock_material)
    for polygon, material_index in zip(data.polygons, material_indices, strict=True):
        polygon.material_index = material_index
        polygon.use_smooth = material_index == 1
    data.update()

    island = bpy.data.objects.new(name, data)
    island.location = location
    island.parent = parent
    target.objects.link(island)
    return island


def waterfall_ribbon(
    name: str,
    location: tuple[float, float, float],
    width: float,
    height: float,
    water_material: bpy.types.Material,
    target: bpy.types.Collection,
    parent: bpy.types.Object,
) -> bpy.types.Object:
    row_specs = (
        (0.00, 1.00, 0.00),
        (0.24, 0.92, 0.03),
        (0.50, 0.78, 0.09),
        (0.76, 0.86, 0.15),
        (1.00, 0.68, 0.21),
    )
    vertices: list[tuple[float, float, float]] = []
    for vertical, width_scale, forward in row_specs:
        half_width = width * width_scale * 0.5
        sway = math.sin(vertical * math.pi) * width * 0.10
        vertices.extend(
            [
                (-half_width + sway, forward, -height * vertical),
                (half_width + sway, forward, -height * vertical),
            ]
        )
    faces = [
        (index * 2, index * 2 + 1, index * 2 + 3, index * 2 + 2)
        for index in range(len(row_specs) - 1)
    ]
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.materials.append(water_material)
    data.update()
    waterfall = bpy.data.objects.new(name, data)
    waterfall.location = location
    waterfall.parent = parent
    target.objects.link(waterfall)
    return waterfall


def island_path(
    name: str,
    points: tuple[tuple[float, float, float], ...],
    width: float,
    path_material: bpy.types.Material,
    target: bpy.types.Collection,
    parent: bpy.types.Object,
) -> bpy.types.Object:
    """Create a slightly uneven ground ribbon that gives the island human scale."""
    vertices: list[tuple[float, float, float]] = []
    for index, point in enumerate(points):
        current = Vector(point)
        previous = Vector(points[max(0, index - 1)])
        following = Vector(points[min(len(points) - 1, index + 1)])
        tangent = following - previous
        lateral = Vector((-tangent.y, tangent.x, 0.0)).normalized()
        local_width = width * (0.82 + 0.18 * math.sin(index * 1.7 + 0.4))
        vertices.append(tuple(current - lateral * local_width * 0.5))
        vertices.append(tuple(current + lateral * local_width * 0.5))
    faces = [
        (index * 2, index * 2 + 1, index * 2 + 3, index * 2 + 2)
        for index in range(len(points) - 1)
    ]
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.materials.append(path_material)
    data.update()
    path = bpy.data.objects.new(name, data)
    path.parent = parent
    target.objects.link(path)
    return path


def add_central_island_details(
    rock_material: bpy.types.Material,
    path_material: bpy.types.Material,
    target: bpy.types.Collection,
    parent: bpy.types.Object,
) -> None:
    island_path(
        "中央島_同行步道",
        (
            (-0.48, -1.92, -0.095),
            (-0.20, -1.48, -0.085),
            (0.34, -1.02, -0.075),
            (0.18, -0.58, -0.065),
            (-0.12, -0.18, -0.055),
        ),
        0.46,
        path_material,
        target,
        parent,
    )
    rock_specs = (
        ((-2.45, -0.62, -0.03), (0.42, 0.24, 0.24), 0.22),
        ((-2.05, 0.96, -0.02), (0.34, 0.27, 0.30), -0.18),
        ((-1.25, 1.64, -0.04), (0.30, 0.22, 0.24), 0.44),
        ((1.54, 1.28, -0.03), (0.40, 0.25, 0.28), -0.30),
        ((2.48, 0.24, -0.04), (0.38, 0.24, 0.26), 0.16),
        ((2.12, -1.12, -0.05), (0.46, 0.28, 0.30), -0.48),
        ((1.10, -1.72, -0.02), (0.28, 0.20, 0.22), 0.34),
        ((-1.55, -1.58, -0.04), (0.36, 0.22, 0.24), -0.12),
    )
    for index, (location, scale, rotation) in enumerate(rock_specs, start=1):
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=1,
            radius=1,
            location=location,
            rotation=(0.0, 0.0, rotation),
        )
        rock = bpy.context.object
        rock.name = f"中央島_岩塊_{index:02d}"
        rock.scale = scale
        rock.data.materials.append(rock_material)
        move_to_collection(rock, target)
        rock.parent = parent


def leaf_blade(
    name: str,
    location: Vector,
    rotation: tuple[float, float, float],
    scale: tuple[float, float, float],
    leaf_material: bpy.types.Material,
    target: bpy.types.Collection,
    parent: bpy.types.Object,
) -> bpy.types.Object:
    """Create a small curved oval leaf instead of a sharp diamond card."""
    top_outline = [
        (-0.34, 0.00, 0.00),
        (-0.15, 0.14, 0.035),
        (0.10, 0.18, 0.050),
        (0.40, 0.00, 0.010),
        (0.10, -0.17, 0.045),
        (-0.16, -0.13, 0.030),
    ]
    bottom_outline = [(x, y, z - 0.025) for x, y, z in top_outline]
    vertices = top_outline + [(-0.02, 0.0, 0.095)] + bottom_outline + [(-0.02, 0.0, -0.035)]
    top_center = 6
    bottom_start = 7
    bottom_center = 13
    faces: list[tuple[int, ...]] = []
    for index in range(6):
        next_index = (index + 1) % 6
        faces.append((index, next_index, top_center))
        faces.append((bottom_center, bottom_start + next_index, bottom_start + index))
        faces.append(
            (
                index,
                bottom_start + index,
                bottom_start + next_index,
                next_index,
            )
        )
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
    leaf_count = 36
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
        shell = random.uniform(0.34, 1.0)
        position = center + Vector(
            (
                direction.x * cluster.scale.x,
                direction.y * cluster.scale.y,
                direction.z * cluster.scale.z,
            )
        ) * shell + jitter
        rotation = direction.to_track_quat("Z", "Y").to_euler()
        rotation.rotate_axis("Z", random.uniform(-0.55, 0.55))
        leaf_blade(
            f"{layer_name}葉片_{index:02d}_{leaf_index:02d}",
            position,
            tuple(rotation),
            (
                random.uniform(0.44, 0.70),
                random.uniform(0.44, 0.72),
                random.uniform(0.42, 0.66),
            ),
            leaf_materials[(index + leaf_index) % len(leaf_materials)],
            target,
            cluster,
        )


def build_tree() -> bpy.types.Object:
    random.seed(SEED)
    trunk_material = material("樹皮深棕", (0.19, 0.065, 0.025, 1), roughness=0.86)
    trunk_mid = material("樹皮暖棕", (0.34, 0.13, 0.045, 1), roughness=0.78)
    trunk_light = material("樹皮日照面", (0.50, 0.24, 0.075, 1), roughness=0.70)
    leaf_dark = material("深林葉", (0.018, 0.17, 0.10, 1), roughness=0.82)
    leaf_mid = material("同行葉", (0.045, 0.34, 0.18, 1), roughness=0.76)
    leaf_light = material("新芽葉", (0.28, 0.65, 0.26, 1), roughness=0.72)
    leaf_warm = material("日照葉", (0.52, 0.72, 0.22, 1), roughness=0.70)

    root_collection = collection("生命樹_主體")
    branch_collection = collection("生命樹_主枝")
    leaf_back_collection = collection("生命樹_後景葉冠")
    leaf_front_collection = collection("生命樹_前景葉冠")
    socket_collection = collection("生命樹_紀念掛點")
    root_detail_collection = collection("生命樹_盤根與樹皮")

    root = bpy.data.objects.new("生命樹_根節點", None)
    root_collection.objects.link(root)
    root["資產版本"] = 2
    root["生長階段數"] = 6
    root["紀念掛點數"] = 12

    trunk = curve_branch(
        "主幹",
        [
            (0.0, 0.0, 0.05),
            (-0.16, 0.03, 0.82),
            (0.17, -0.08, 1.70),
            (-0.11, 0.10, 2.55),
            (0.18, 0.03, 3.35),
            (-0.04, -0.03, 4.10),
            (0.08, 0.02, 4.76),
        ],
        [1.22, 1.08, 0.90, 0.72, 0.52, 0.30, 0.10],
        trunk_material,
        root_collection,
        bevel=0.48,
    )
    trunk.parent = root

    bark_ridges = (
        (
            "主幹_暖光脊",
            [(-0.29, -0.37, 0.10), (-0.36, -0.38, 1.05), (-0.08, -0.40, 2.12), (-0.22, -0.32, 3.35)],
            trunk_light,
        ),
        (
            "主幹_中間脊",
            [(0.32, -0.30, 0.16), (0.25, -0.37, 1.25), (0.40, -0.25, 2.48), (0.18, -0.22, 3.82)],
            trunk_mid,
        ),
        (
            "主幹_背光脊",
            [(-0.45, 0.18, 0.18), (-0.34, 0.22, 1.35), (-0.48, 0.18, 2.52), (-0.26, 0.15, 3.58)],
            trunk_mid,
        ),
    )
    for ridge_name, ridge_points, ridge_material in bark_ridges:
        ridge = curve_branch(
            ridge_name,
            ridge_points,
            [0.50, 0.36, 0.20, 0.04],
            ridge_material,
            root_detail_collection,
            bevel=0.095,
        )
        ridge.parent = root

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
        add_branch_hierarchy(
            branch,
            index,
            points,
            trunk_material,
            branch_collection,
        )
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
            root_detail_collection,
            bevel=0.22,
        )
        root_branch.parent = root

    for index, angle in enumerate((0.7, 2.05, 3.3, 4.55, 5.75), start=6):
        end = (math.cos(angle) * 1.15, math.sin(angle) * 0.52, -0.03)
        root_branch = curve_branch(
            f"樹根_{index:02d}",
            [(0.0, 0.0, 0.10), (end[0] * 0.58, end[1] * 0.58, 0.03), end],
            [0.54, 0.26, 0.03],
            trunk_mid,
            root_detail_collection,
            bevel=0.14,
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
        add_canopy_lobes(
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
        add_canopy_lobes(
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

    return root


def build_floating_world() -> bpy.types.Object:
    grass_material = material("浮島新芽草", (0.08, 0.34, 0.12, 1), roughness=0.84)
    rock_material = material("浮島暖灰岩", (0.18, 0.16, 0.135, 1), roughness=0.93)
    path_material = material("同行步道暖石", (0.48, 0.36, 0.21, 1), roughness=0.92)
    waterfall_material = material(
        "瀑布微光",
        (0.36, 0.78, 0.92, 1),
        roughness=0.22,
        emission=(0.16, 0.54, 0.82, 1),
        emission_strength=0.75,
    )

    world_collection = collection("浮島世界_主體")
    island_collection = collection("浮島世界_旅程島")
    water_collection = collection("浮島世界_瀑布")
    world_root = bpy.data.objects.new("浮島世界_根節點", None)
    world_collection.objects.link(world_root)
    world_root["世界版本"] = 1
    world_root["三維中央島數"] = 1
    world_root["遠景形式"] = "原創二維背景"

    floating_island(
        "浮島_中央生命島",
        (0.0, 0.0, -0.18),
        (3.25, 2.15),
        1.55,
        grass_material,
        rock_material,
        island_collection,
        world_root,
        seed=3101,
        segments=36,
    )
    add_central_island_details(
        rock_material,
        path_material,
        island_collection,
        world_root,
    )
    waterfall_ribbon(
        "瀑布_中央左",
        (-1.72, -2.02, -0.14),
        0.48,
        1.65,
        waterfall_material,
        water_collection,
        world_root,
    )
    waterfall_ribbon(
        "瀑布_中央右",
        (1.45, -2.08, -0.16),
        0.34,
        1.40,
        waterfall_material,
        water_collection,
        world_root,
    )
    return world_root


def add_preview_scene(root: bpy.types.Object) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 768
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.10, 0.36, 0.64, 1)
    background.inputs["Strength"].default_value = 0.70

    bpy.ops.object.light_add(type="AREA", location=(-4.2, -4.5, 7.2))
    key = bpy.context.object
    key.name = "預覽_暖陽主光"
    key.data.energy = 720
    key.data.shape = "DISK"
    key.data.size = 5.0
    key.data.color = (1.0, 0.78, 0.52)
    key.rotation_euler = (math.radians(28), 0, math.radians(-36))

    bpy.ops.object.light_add(type="AREA", location=(4.0, 1.5, 5.4))
    fill = bpy.context.object
    fill.name = "預覽_葉冠補光"
    fill.data.energy = 480
    fill.data.size = 4.0
    fill.data.color = (0.38, 0.66, 0.88)
    fill.rotation_euler = (math.radians(58), 0, math.radians(140))

    bpy.ops.object.light_add(type="POINT", location=(0, -0.8, 1.0))
    rim = bpy.context.object
    rim.name = "預覽_根部微光"
    rim.data.energy = 180
    rim.data.color = (0.42, 0.82, 1.0)

    ocean_material = material(
        "預覽海面材質",
        (0.025, 0.28, 0.48, 1),
        roughness=0.20,
        metallic=0.08,
    )
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 3.5, -2.05))
    ocean = bpy.context.object
    ocean.name = "預覽_海面"
    ocean.data.materials.append(ocean_material)

    bpy.ops.object.camera_add(location=(10.4, -15.8, 8.4))
    camera = bpy.context.object
    camera.name = "預覽_相機"
    camera.data.lens = 54
    direction = Vector((0, 0.6, 2.30)) - camera.location
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


def combine_leaf_meshes_for_export() -> None:
    """Collapse each animated crown to one renderer while retaining material slots."""
    clusters = [
        obj
        for obj in bpy.context.scene.objects
        if obj.name.startswith("前景葉簇_") or obj.name.startswith("後景葉簇_")
    ]
    for cluster in clusters:
        descendants: list[bpy.types.Object] = []
        pending = list(cluster.children)
        while pending:
            item = pending.pop()
            pending.extend(item.children)
            if item.type == "MESH" and "葉片_" in item.name:
                descendants.append(item)
        if not descendants:
            raise RuntimeError(f"{cluster.name} 沒有可合併的葉片")

        bpy.ops.object.select_all(action="DESELECT")
        for leaf in descendants:
            bpy.context.view_layer.update()
            world_matrix = leaf.matrix_world.copy()
            leaf.parent = None
            leaf.matrix_world = world_matrix
            leaf.select_set(True)
        bpy.context.view_layer.objects.active = descendants[0]
        bpy.ops.object.join()
        joined = bpy.context.object
        joined.name = f"葉群網格_{cluster.name}"
        joined["原始葉片數"] = len(descendants)
        bpy.context.view_layer.update()
        world_matrix = joined.matrix_world.copy()
        joined.parent = cluster
        joined.matrix_world = world_matrix
        joined.select_set(False)


def write_asset_stats(output: Path) -> None:
    mesh_objects = [
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH" and not obj.name.startswith("預覽_")
    ]
    triangle_count = sum(
        max(0, len(polygon.vertices) - 2)
        for obj in mesh_objects
        for polygon in obj.data.polygons
    )
    stats = {
        "資產版本": 2,
        "網格物件數": len(mesh_objects),
        "頂點數": sum(len(obj.data.vertices) for obj in mesh_objects),
        "三角面數": triangle_count,
        "主枝數": sum(obj.name.startswith("主枝_") for obj in bpy.context.scene.objects),
        "葉冠群組數": sum(
            obj.name.startswith("前景葉簇_") or obj.name.startswith("後景葉簇_")
            for obj in bpy.context.scene.objects
        ),
        "葉片元素數": sum(
            int(obj.get("原始葉片數", 0)) for obj in bpy.context.scene.objects
        ),
        "葉群合併網格數": sum(
            obj.name.startswith("葉群網格_") for obj in bpy.context.scene.objects
        ),
        "紀念掛點數": sum(obj.name.startswith("紀念掛點_") for obj in bpy.context.scene.objects),
        "三維浮島數": sum(obj.name.startswith("浮島_") for obj in bpy.context.scene.objects),
        "瀑布數": sum(obj.name.startswith("瀑布_") for obj in bpy.context.scene.objects),
        "雲海塊數": sum(obj.name.startswith("雲海_") for obj in bpy.context.scene.objects),
    }
    expected = {
        "主枝數": 8,
        "葉冠群組數": 16,
        "葉群合併網格數": 16,
        "紀念掛點數": 12,
        "三維浮島數": 1,
        "瀑布數": 2,
        "雲海塊數": 0,
    }
    for label, expected_count in expected.items():
        if stats[label] != expected_count:
            raise RuntimeError(f"{label}應為 {expected_count}，實際為 {stats[label]}")
    if not 14000 <= triangle_count <= 60000:
        raise RuntimeError(f"第一輪三角面預算應介於 14000～60000，實際為 {triangle_count}")
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
    combine_leaf_meshes_for_export()
    write_asset_stats(output)

    excluded = {
        "預覽_暖陽主光",
        "預覽_葉冠補光",
        "預覽_根部微光",
        "預覽_相機",
        "預覽_海面",
    }
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
    build_floating_world()
    add_preview_scene(tree)
    export_assets(Path(args.output).resolve(), Path(args.source).resolve())


if __name__ == "__main__":
    main()
