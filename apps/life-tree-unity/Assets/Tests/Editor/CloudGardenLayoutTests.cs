using NUnit.Framework;
using TreeCompanion.LifeTree;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using System.Linq;
using System.Collections;
using UnityEditor.TestTools;
using UnityEngine.TestTools;

namespace TreeCompanion.Tests
{
    public sealed class CloudGardenLayoutTests
    {
        [Test]
        public void CloudDriftStaysSubMetreBeneathFbxUnitConversion()
        {
            var root = new GameObject("匯入比例測試");
            var cloud = new GameObject("雲"); cloud.transform.SetParent(root.transform);
            root.transform.localScale = Vector3.one * 100;
            try
            {
                var air = root.AddComponent<LifeTreeAtmosphereController>();
                air.Bind(root.AddComponent<Camera>(), Vector3.forward);
                air.PauseCameraMotion(true); air.BindClouds(new[] { cloud.transform });
                var start = cloud.transform.position;
                air.EvaluateAt(30);
                var distance = Vector3.Distance(start, cloud.transform.position);
                Assert.That(distance, Is.GreaterThan(.01f));
                Assert.That(distance, Is.LessThan(.4f));
            }
            finally { Object.DestroyImmediate(root); }
        }

        [UnityTest]
        public IEnumerator ConstructionButtonsPreserveOverviewWithMotion()
        {
            UnityEditor.SceneManagement.EditorSceneManager.NewScene(UnityEditor.SceneManagement.NewSceneSetup.EmptyScene);
            yield return new EnterPlayMode();
            yield return VerifyConstructionButtons(false);
            yield return new ExitPlayMode();
        }

        [UnityTest]
        public IEnumerator ConstructionButtonsPreserveOverviewWithReducedMotion()
        {
            UnityEditor.SceneManagement.EditorSceneManager.NewScene(UnityEditor.SceneManagement.NewSceneSetup.EmptyScene);
            yield return new EnterPlayMode();
            yield return VerifyConstructionButtons(true);
            yield return new ExitPlayMode();
        }

        [UnityTearDown]
        public IEnumerator LeavePlayModeAfterFailure()
        {
            if (Application.isPlaying) yield return new ExitPlayMode();
        }

        private IEnumerator VerifyConstructionButtons(bool reducedMotion)
        {
            var owner = new GameObject("建設流程測試");
            var world = new GameObject("測試主島");
            try
            {
                var camera = owner.AddComponent<Camera>();
                camera.transform.SetPositionAndRotation(new Vector3(8, 12, 20), Quaternion.Euler(20, 10, 0));
                var controls = owner.AddComponent<LifeTreeWorldInteraction>();
                controls.Configure(world.transform, camera, null);
                var air = owner.AddComponent<LifeTreeAtmosphereController>();
                air.Bind(camera, Vector3.zero); air.ApplyMotionPreference(reducedMotion);
                controls.SetView(36, 1.2f);
                var sites = new Transform[3]; var pieces = new GameObject[3];
                for (var i = 0; i < 3; i++)
                {
                    sites[i] = new GameObject($"位置{i}").transform; sites[i].SetParent(world.transform);
                    sites[i].localPosition = new Vector3(i, 0, 0);
                    pieces[i] = new GameObject($"花圃{i}"); pieces[i].transform.SetParent(sites[i]);
                }
                var play = owner.AddComponent<CloudGardenPlayController>();
                play.Configure(camera, controls, air, sites, pieces); play.Initialize(false);
                // Let runtime register graphic depths and input modules before
                // testing the same raycast/click path as a displayed button.
                yield return null;
                var farPosition = camera.transform.position;
                var farRotation = camera.transform.rotation;
                var farFov = camera.fieldOfView;
                play.Plant(); Assert.That(pieces[0].activeSelf, Is.False, "全景不可誤放置");
                ClickInterface(owner, camera, "走進雲境"); play.EvaluateTransition(1);
                yield return null;
                Assert.That(controls.enabled, Is.False);
                Assert.That(camera.transform.position, Is.Not.EqualTo(farPosition));
                var nearPosition = camera.transform.position;
                air.EvaluateAt(2);
                Assert.That(camera.transform.position, Is.EqualTo(nearPosition), "建設期間環境動畫不可奪回鏡頭");
                Assert.That(air.enabled, Is.True, "建設期間應保留雲與水流動態");
                ClickInterface(owner, camera, "安放花圃"); Assert.That(pieces[0].activeSelf, Is.True);
                play.SelectPlot(2); play.EvaluateTransition(1); play.Plant();
                play.Remove(); Assert.That(pieces[2].activeSelf, Is.False);
                Assert.That(pieces[0].activeSelf, Is.True);
                yield return null;
                ClickInterface(owner, camera, "返回全景"); play.EvaluateTransition(1);
                Assert.That(camera.transform.position, Is.EqualTo(farPosition));
                Assert.That(Quaternion.Angle(camera.transform.rotation, farRotation), Is.LessThan(.01f));
                Assert.That(camera.fieldOfView, Is.EqualTo(farFov));
                Assert.That(controls.CurrentYaw, Is.EqualTo(36));
                Assert.That(controls.enabled && air.enabled, Is.True);
            }
            finally { Object.DestroyImmediate(owner); Object.DestroyImmediate(world); }
        }

        private static void ClickInterface(GameObject owner, Camera camera, string name)
        {
            var button = owner.GetComponentsInChildren<Button>().Single(item => item.name == name);
            var rect = (RectTransform)button.transform;
            Canvas.ForceUpdateCanvases();
            var data = new PointerEventData(EventSystem.current)
            {
                position = RectTransformUtility.WorldToScreenPoint(camera, rect.TransformPoint(rect.rect.center)),
                button = PointerEventData.InputButton.Left,
            };
            var hits = new System.Collections.Generic.List<RaycastResult>();
            EventSystem.current.RaycastAll(data, hits);
            Assert.That(hits.Count, Is.GreaterThan(0), $"{name} 中心應可命中");
            Assert.That(hits[0].gameObject.GetComponentInParent<Button>(), Is.EqualTo(button));
            ExecuteEvents.Execute(button.gameObject, data, ExecuteEvents.pointerDownHandler);
            ExecuteEvents.Execute(button.gameObject, data, ExecuteEvents.pointerUpHandler);
            ExecuteEvents.Execute(button.gameObject, data, ExecuteEvents.pointerClickHandler);
        }

        [Test]
        public void ConstructionCanBeSavedRestoredAndReclaimed()
        {
            var layout = new CloudGardenLayout();
            Assert.That(layout.Plant(0), Is.True);
            Assert.That(layout.Plant(0), Is.False);
            Assert.That(layout.Plant(2), Is.True);
            var restored = JsonUtility.FromJson<CloudGardenLayout>(JsonUtility.ToJson(layout));
            Assert.That(restored.IsValid, Is.True);
            Assert.That(restored.IsPlanted(0), Is.True);
            Assert.That(restored.IsPlanted(1), Is.False);
            Assert.That(restored.IsPlanted(2), Is.True);
            Assert.That(restored.Remove(0), Is.True);
            Assert.That(restored.Remove(0), Is.False);
            Assert.That(restored.Plant(0), Is.True);
        }
        [TestCase(-1)]
        [TestCase(3)]
        [TestCase(999)]
        public void InvalidPlotsCannotChangeTheLayout(int plot)
        {
            var layout = new CloudGardenLayout();
            Assert.That(layout.Plant(plot), Is.False);
            Assert.That(layout.Remove(plot), Is.False);
            Assert.That(layout.plantedMask, Is.Zero);
        }
        [Test]
        public void SavedSceneUsesCloudMeshesAndNoCameraBackgroundPlate()
        {
            var dependencies = UnityEditor.AssetDatabase.GetDependencies("Assets/Scenes/生命樹庭園.unity");
            Assert.That(dependencies, Does.Contain("Assets/Art/Generated/雲境立體雲海.fbx"));
            Assert.That(dependencies, Does.Not.Contain("Assets/Art/Backgrounds/生命樹_純天空雲海_v2.png"));
        }
    }
}
