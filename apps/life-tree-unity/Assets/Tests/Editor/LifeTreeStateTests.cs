using NUnit.Framework;
using TreeCompanion.LifeTree;
using UnityEditor;
using UnityEngine;

namespace TreeCompanion.Tests
{
    public sealed class LifeTreeStateTests
    {
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
        public void HybridBackgroundMatchesPortraitCameraAspect()
        {
            const string backgroundPath =
                "Assets/Art/Backgrounds/生命樹浮島世界_遠景背景_v1.png";
            var background = AssetDatabase.LoadAssetAtPath<Texture2D>(backgroundPath);

            Assert.That(background, Is.Not.Null, $"找不到遠景背景：{backgroundPath}");
            Assert.That(
                (float)background.width / background.height,
                Is.EqualTo(0.75f).Within(0.005f),
                "遠景背景必須與 3:4 生命樹主相機一致，避免手機裁切露出空白。"
            );
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
        public void SharedFoliageMaterialUsesTransparentClusterTexture()
        {
            const string texturePath = "Assets/Art/Textures/生命樹_葉簇色彩_v2.png";
            const string materialPath = "Assets/Art/Generated/Materials/生命樹_葉簇.mat";
            var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(texturePath);
            var material = AssetDatabase.LoadAssetAtPath<Material>(materialPath);

            Assert.That(texture, Is.Not.Null, $"找不到葉簇貼圖：{texturePath}");
            Assert.That(texture.width, Is.GreaterThanOrEqualTo(1024));
            Assert.That(texture.height, Is.EqualTo(texture.width));
            Assert.That(material, Is.Not.Null, $"找不到共用葉簇材質：{materialPath}");
            Assert.That(material.mainTexture, Is.SameAs(texture));
            Assert.That(material.shader.name, Is.EqualTo("樹伴/生命樹葉簇裁切"));
            Assert.That(material.renderQueue, Is.EqualTo(2450));
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
    }
}
