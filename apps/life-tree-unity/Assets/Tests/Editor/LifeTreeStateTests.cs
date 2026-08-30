using NUnit.Framework;
using TreeCompanion.LifeTree;
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
    }
}
