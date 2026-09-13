using System.Linq;
using NUnit.Framework;
using TreeCompanion.LifeTree;
using UnityEditor;
using UnityEngine;

namespace TreeCompanion.Tests
{
    public sealed class LifeTreeStateTests
    {
        [Test]
        public void StreamBanksRetainTheirBlendWeightsAfterFbxImport()
        {
            var model = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/Generated/生命樹庭園.fbx");
            var meshes = model.GetComponentsInChildren<MeshFilter>(true);
            var banks = meshes.Where(item => item.name.StartsWith("溪岸_")).ToArray();
            var beds = meshes.Where(item => item.name.StartsWith("河床_")).ToArray();
            Assert.That(banks.Length, Is.EqualTo(4));
            Assert.That(beds.Length, Is.EqualTo(2));
            foreach (var bank in banks)
            {
                var colors = bank.sharedMesh.colors;
                Assert.That(colors.Length, Is.EqualTo(bank.sharedMesh.vertexCount));
                Assert.That(colors.Min(color => color.r), Is.LessThan(.01f));
                Assert.That(colors.Max(color => color.r), Is.GreaterThan(.99f));
            }
            foreach (var bed in beds)
            {
                Assert.That(bed.sharedMesh.colors.Length, Is.EqualTo(bed.sharedMesh.vertexCount));
                Assert.That(bed.sharedMesh.colors.All(color => color.r > .99f), Is.True);
            }
        }

        [Test]
        public void ReducedMotionClearsWaterfallMist()
        {
            var item = new GameObject("測試水霧");
            var cameraObject = new GameObject("測試水霧相機");
            try
            {
                var mist = item.AddComponent<ParticleSystem>();
                var atmosphere = item.AddComponent<LifeTreeAtmosphereController>();
                atmosphere.Bind(cameraObject.AddComponent<Camera>(), Vector3.forward);
                atmosphere.BindWaterfallMist(new[] { mist });
                mist.Emit(8);
                Assert.That(mist.particleCount, Is.GreaterThan(0));
                atmosphere.ApplyMotionPreference(true);
                atmosphere.EvaluateAt(2f);
                Assert.That(mist.particleCount, Is.Zero);
                Assert.That(mist.isPlaying, Is.False);
            }
            finally
            {
                Object.DestroyImmediate(item);
                Object.DestroyImmediate(cameraObject);
            }
        }

        [Test]
        public void WorldContainsOneTerracedIslandAndNoSatelliteIslands()
        {
            var model = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/Generated/生命樹庭園.fbx");
            var names = model.GetComponentsInChildren<Transform>(true).Select(item => item.name).ToArray();
            Assert.That(names.Count(name => name.StartsWith("浮島_")), Is.EqualTo(1));
            Assert.That(names.Any(name => name.StartsWith("群島")), Is.False);
            Assert.That(names.Count(name => name.StartsWith("溪流_")), Is.EqualTo(2));
            Assert.That(names.Count(name => name.StartsWith("垂根_")), Is.EqualTo(6));
        }

        [Test]
        public void IslandViewClampsZoomAndCanRestoreItsAuthoredPose()
        {
            var world = new GameObject("測試浮島");
            var cameraObject = new GameObject("測試取景");
            var camera = cameraObject.AddComponent<Camera>();
            camera.fieldOfView = 37f;
            var controls = cameraObject.AddComponent<LifeTreeWorldInteraction>();
            try
            {
                controls.Configure(world.transform, camera, null);
                controls.SetView(999f, 99f);
                Assert.That(Quaternion.Angle(Quaternion.identity, world.transform.localRotation), Is.EqualTo(70f).Within(.01f));
                Assert.That(camera.fieldOfView, Is.EqualTo(37f / 1.35f).Within(.01f));
                controls.SetView(-999f, .01f);
                Assert.That(camera.fieldOfView, Is.EqualTo(37f / .8f).Within(.01f));
                controls.ResetView();
                Assert.That(world.transform.localRotation, Is.EqualTo(Quaternion.identity));
                Assert.That(camera.fieldOfView, Is.EqualTo(37f));
            }
            finally
            {
                Object.DestroyImmediate(cameraObject);
                Object.DestroyImmediate(world);
            }
        }

        [Test]
        public void AuthoredStagesSwitchWithoutRescalingTheMatureTree()
        {
            var root = new GameObject("測試生長場景");
            try
            {
                var stages = Enumerable.Range(0, 6).Select(index =>
                {
                    var item = new GameObject($"造型_{index}");
                    item.transform.SetParent(root.transform);
                    return item.transform;
                }).ToArray();
                var controller = root.AddComponent<LifeTreeSceneController>();
                controller.BindHierarchy(stages[5]);
                controller.BindGrowthStages(stages);
                foreach (var stage in new[] { 0, 1, 2, 3, 4, 5, 0, 4 })
                {
                    controller.ApplyState(new LifeTreeState { stageIndex = stage });
                    Assert.That(stages.Count(item => item.gameObject.activeSelf), Is.EqualTo(1));
                    Assert.That(stages[stage].gameObject.activeSelf, Is.True);
                    Assert.That(stages[5].localScale, Is.EqualTo(Vector3.one));
                }
                Assert.Throws<System.ArgumentException>(() => controller.BindGrowthStages(new[] { stages[0] }));
                Assert.Throws<System.ArgumentException>(() => controller.BindGrowthStages(Enumerable.Repeat(stages[0], 6).ToArray()));
            }
            finally { Object.DestroyImmediate(root); }
        }

        [Test]
        public void BlenderYoungStagesContainDistinctMeshes()
        {
            var asset = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/Generated/生命樹生長階段.fbx");
            Assert.That(asset, Is.Not.Null);
            var stages = asset.GetComponentsInChildren<Transform>(true)
                .Where(item => item.name.StartsWith("生長階段_")).OrderBy(item => item.name).ToArray();
            Assert.That(stages.Length, Is.EqualTo(5));
            var meshes = stages.Select(stage => stage.GetComponentsInChildren<MeshFilter>(true)
                .Select(item => item.sharedMesh).ToArray()).ToArray();
            Assert.That(meshes.All(stage => stage.Length > 0), Is.True);
            Assert.That(meshes[0].Intersect(meshes[4]), Is.Empty);
            Assert.That(stages[0].GetComponentsInChildren<Transform>().Any(item => item.name.StartsWith("嫩葉_")), Is.False);
            Assert.That(stages[1].GetComponentsInChildren<Transform>().Any(item => item.name.StartsWith("嫩葉_")), Is.True);
        }

        [Test]
        public void ParsesVerifiedStateWithStableKeepsakeSlot()
        {
            const string json = "{\"schemaVersion\":1,\"stageIndex\":5,\"reduceMotion\":false,\"keepsakes\":[{\"id\":\"成果-001\",\"slotIndex\":2,\"kind\":\"相聚果實\",\"label\":\"一起散步\",\"color\":\"#D89B55\"}]}";

            var parsed = LifeTreeState.TryParse(json, out var state, out var error);

            Assert.That(parsed, Is.True, error);
            Assert.That(state.keepsakes, Has.Length.EqualTo(1));
            Assert.That(state.keepsakes[0].slotIndex, Is.EqualTo(2));
        }

        [Test]
        public void RejectsDuplicateKeepsakeSlot()
        {
            const string json = "{\"schemaVersion\":1,\"stageIndex\":4,\"keepsakes\":[{\"id\":\"成果-001\",\"slotIndex\":1,\"kind\":\"公益葉\",\"color\":\"#4C8A63\"},{\"id\":\"成果-002\",\"slotIndex\":1,\"kind\":\"探索花\",\"color\":\"#E7B756\"}]}";

            var parsed = LifeTreeState.TryParse(json, out _, out var error);

            Assert.That(parsed, Is.False);
            Assert.That(error, Does.Contain("掛點重複"));
        }

        [Test]
        public void RejectsClientInventedGrowthStage()
        {
            const string json = "{\"schemaVersion\":1,\"stageIndex\":6,\"keepsakes\":[]}";

            var parsed = LifeTreeState.TryParse(json, out _, out var error);

            Assert.That(parsed, Is.False);
            Assert.That(error, Does.Contain("超出範圍"));
        }

        [Test]
        public void UnconfiguredStateStartsAtSeedlingStage()
        {
            Assert.That(new LifeTreeState().stageIndex, Is.EqualTo(LifeTreeState.MinimumStageIndex));
        }

        [Test]
        public void ReduceMotionRestoresAuthoredBranchRotation()
        {
            var rootObject = new GameObject("生命樹_測試根節點");
            var branchObject = new GameObject("主枝_01");
            branchObject.transform.SetParent(rootObject.transform, false);
            var controllerObject = new GameObject("生命樹_測試控制器");
            var controller = controllerObject.AddComponent<LifeTreeSceneController>();

            try
            {
                controller.BindHierarchy(rootObject.transform);
                controller.EvaluateWindAt(0.75f);
                Assert.That(
                    Quaternion.Angle(Quaternion.identity, branchObject.transform.localRotation),
                    Is.GreaterThan(0.01f));

                controller.ApplyState(new LifeTreeState { reduceMotion = true });
                controller.EvaluateWindAt(1.5f);
                Assert.That(
                    Quaternion.Angle(Quaternion.identity, branchObject.transform.localRotation),
                    Is.LessThan(0.001f));
            }
            finally
            {
                Object.DestroyImmediate(controllerObject);
                Object.DestroyImmediate(rootObject);
            }
        }

        [Test]
        public void ReduceMotionFreezesAtmosphereAndRestoresCameraPose()
        {
            var rootObject = new GameObject("生命樹_測試根節點");
            var cameraObject = new GameObject("生命樹_測試相機");
            var camera = cameraObject.AddComponent<Camera>();
            cameraObject.transform.position = new Vector3(0f, 2.5f, -10f);
            cameraObject.transform.rotation = Quaternion.LookRotation(
                new Vector3(0f, 2.5f, 0f) - cameraObject.transform.position,
                Vector3.up
            );
            var authoredPosition = cameraObject.transform.position;
            var authoredRotation = cameraObject.transform.rotation;
            var controllerObject = new GameObject("生命樹_測試控制器");
            var controller = controllerObject.AddComponent<LifeTreeSceneController>();
            var atmosphere = controllerObject.AddComponent<LifeTreeAtmosphereController>();

            try
            {
                atmosphere.Bind(camera, new Vector3(0f, 2.5f, 0f));
                controller.ConfigureAtmosphere(atmosphere);
                controller.BindHierarchy(rootObject.transform);
                controller.ApplyState(new LifeTreeState { reduceMotion = false });
                atmosphere.EvaluateAt(1.25f);

                Assert.That(
                    Vector3.Distance(authoredPosition, cameraObject.transform.position),
                    Is.GreaterThan(0.01f),
                    "正常動態時相機應有極小幅度的生命感環繞。"
                );
                Assert.That(Shader.GetGlobalFloat("_LifeTreeMotionAmount"), Is.EqualTo(1f));

                controller.ApplyState(new LifeTreeState { reduceMotion = true });
                atmosphere.EvaluateAt(2.5f);

                Assert.That(
                    Vector3.Distance(authoredPosition, cameraObject.transform.position),
                    Is.LessThan(0.0001f)
                );
                Assert.That(
                    Quaternion.Angle(authoredRotation, cameraObject.transform.rotation),
                    Is.LessThan(0.001f)
                );
                Assert.That(Shader.GetGlobalFloat("_LifeTreeMotionAmount"), Is.EqualTo(0f));
            }
            finally
            {
                Object.DestroyImmediate(controllerObject);
                Object.DestroyImmediate(cameraObject);
                Object.DestroyImmediate(rootObject);
            }
        }

        [Test]
        public void CloudBackgroundContainsNineThickMeshesInsteadOfAPlate()
        {
            var model = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/Generated/雲境立體雲海.fbx");
            Assert.That(model, Is.Not.Null);
            var clouds = model.GetComponentsInChildren<MeshFilter>();
            Assert.That(clouds.Length, Is.EqualTo(9));
            foreach (var cloud in clouds)
            {
                Assert.That(cloud.sharedMesh.vertexCount, Is.GreaterThan(100));
                // FBX stores centimetre-sized local meshes beneath a scaled import root.
                // Measure transformed bounds so this asserts actual scene thickness.
                var bounds = new Bounds(cloud.transform.TransformPoint(cloud.sharedMesh.vertices[0]), Vector3.zero);
                foreach (var vertex in cloud.sharedMesh.vertices)
                    bounds.Encapsulate(cloud.transform.TransformPoint(vertex));
                var size = bounds.size;
                Assert.That(Mathf.Min(size.x, size.y, size.z), Is.GreaterThan(1f));
            }
            Assert.That(clouds.Sum(cloud => cloud.sharedMesh.triangles.Length / 3), Is.LessThan(40000));
        }

        [Test]
        public void ReducedMotionRestoresThreeDimensionalCloudPositions()
        {
            var owner = new GameObject("雲層動態測試");
            var cloud = new GameObject("測試雲");
            var camera = owner.AddComponent<Camera>();
            var atmosphere = owner.AddComponent<LifeTreeAtmosphereController>();
            try
            {
                cloud.transform.localPosition = new Vector3(4, 6, 10);
                atmosphere.Bind(camera, Vector3.forward * 20);
                atmosphere.BindClouds(new[] { cloud.transform });
                atmosphere.EvaluateAt(10);
                Assert.That(cloud.transform.localPosition, Is.Not.EqualTo(new Vector3(4, 6, 10)));
                atmosphere.ApplyMotionPreference(true);
                atmosphere.EvaluateAt(15);
                Assert.That(cloud.transform.localPosition, Is.EqualTo(new Vector3(4, 6, 10)));
            }
            finally
            {
                Object.DestroyImmediate(owner);
                Object.DestroyImmediate(cloud);
            }
        }

        [Test]
        public void SharedBarkMaterialUsesTheReviewedTexture()
        {
            const string texturePath = "Assets/Art/Textures/生命樹_樹皮色彩_v1.png";
            const string materialPath = "Assets/Art/Generated/Materials/生命樹_樹皮.mat";
            var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(texturePath);
            var material = AssetDatabase.LoadAssetAtPath<Material>(materialPath);

            Assert.That(texture, Is.Not.Null, $"找不到樹皮貼圖：{texturePath}");
            Assert.That(texture.width, Is.GreaterThanOrEqualTo(1024));
            Assert.That(texture.height, Is.EqualTo(texture.width));
            Assert.That(material, Is.Not.Null, $"找不到共用樹皮材質：{materialPath}");
            Assert.That(material.mainTexture, Is.SameAs(texture));
            Assert.That(material.mainTextureScale.y, Is.GreaterThan(2f));
        }

        [Test]
        public void SharedFoliageMaterialUsesSolidVertexColourAndMotion()
        {
            const string materialPath = "Assets/Art/Generated/Materials/生命樹_葉簇.mat";
            var material = AssetDatabase.LoadAssetAtPath<Material>(materialPath);
            Assert.That(material, Is.Not.Null, $"找不到共用葉簇材質：{materialPath}");
            Assert.That(material.shader.name, Is.EqualTo("樹伴/生命樹立體葉片"));
            Assert.That(material.renderQueue, Is.EqualTo(2000));
            Assert.That(material.HasProperty("_WindStrength"), Is.True);
            Assert.That(material.GetFloat("_WindStrength"), Is.GreaterThan(0f));
            var model = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/Generated/生命樹庭園.fbx");
            var crowns = model.GetComponentsInChildren<MeshFilter>(true)
                .Where(item => item.name.StartsWith("葉群網格_")).ToArray();
            Assert.That(crowns.Length, Is.EqualTo(16));
            foreach (var crown in crowns)
            {
                Assert.That(crown.sharedMesh.vertexCount, Is.GreaterThan(1000));
                Assert.That(crown.sharedMesh.colors.Length, Is.EqualTo(crown.sharedMesh.vertexCount));
            }
        }

        [Test]
        public void FloatingIslandMaterialsUseReviewedStylizedTextures()
        {
            const string grassPath = "Assets/Art/Textures/生命樹_浮島草地色彩_v1.png";
            const string rockPath = "Assets/Art/Textures/生命樹_浮島岩層色彩_v1.png";
            const string islandMaterialPath = "Assets/Art/Generated/Materials/生命樹_浮島地表.mat";
            const string rockMaterialPath = "Assets/Art/Generated/Materials/生命樹_島岩.mat";

            var grass = AssetDatabase.LoadAssetAtPath<Texture2D>(grassPath);
            var rock = AssetDatabase.LoadAssetAtPath<Texture2D>(rockPath);
            var islandMaterial = AssetDatabase.LoadAssetAtPath<Material>(islandMaterialPath);
            var rockMaterial = AssetDatabase.LoadAssetAtPath<Material>(rockMaterialPath);

            Assert.That(grass, Is.Not.Null, $"找不到草地貼圖：{grassPath}");
            Assert.That(rock, Is.Not.Null, $"找不到岩層貼圖：{rockPath}");
            Assert.That(islandMaterial, Is.Not.Null, $"找不到浮島材質：{islandMaterialPath}");
            Assert.That(rockMaterial, Is.Not.Null, $"找不到島岩材質：{rockMaterialPath}");
            Assert.That(islandMaterial.shader.name, Is.EqualTo("樹伴/生命樹浮島三向材質"));
            Assert.That(islandMaterial.GetTexture("_GrassTex"), Is.SameAs(grass));
            Assert.That(islandMaterial.GetTexture("_RockTex"), Is.SameAs(rock));
            Assert.That(islandMaterial.GetFloat("_GrassInfluence"), Is.EqualTo(1f));
            Assert.That(rockMaterial.GetFloat("_GrassInfluence"), Is.EqualTo(0f));
        }

        [Test]
        public void WaterfallMaterialUsesMotionControlledShader()
        {
            const string materialPath = "Assets/Art/Generated/Materials/生命樹_瀑布流光.mat";
            var material = AssetDatabase.LoadAssetAtPath<Material>(materialPath);

            Assert.That(material, Is.Not.Null, $"找不到瀑布流動材質：{materialPath}");
            Assert.That(material.shader.name, Is.EqualTo("樹伴/生命樹瀑布流動"));
            Assert.That(material.GetFloat("_FlowSpeed"), Is.GreaterThan(0f));
            Assert.That(
                material.GetFloat("_VerticalDirection"),
                Is.LessThan(0f),
                "瀑布流紋必須朝世界座標下方移動。"
            );
            Assert.That(material.renderQueue, Is.EqualTo(3000));
        }
    }
}
