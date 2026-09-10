using System;
using System.IO;
using System.Linq;
using NUnit.Framework;
using TreeCompanion.Editor;
using TreeCompanion.LifeTree;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using Object = UnityEngine.Object;

namespace TreeCompanion.Tests
{
    public sealed class ExteriorShowcaseTests
    {
        [Test]
        public void ShowcaseHasNoConstructionCardAndDoesNotReplaceEarnedScene()
        {
            var previous = EditorSceneManager.GetSceneManagerSetup();
            try
            {
                EditorSceneManager.OpenScene("Assets/Scenes/雲境外觀展示.unity");
                Assert.That(Object.FindFirstObjectByType<CloudGardenPlayController>().enabled, Is.False);
                Assert.That(Object.FindObjectsByType<Canvas>(FindObjectsSortMode.None), Is.Empty);
                Assert.That(Object.FindFirstObjectByType<CloudExteriorPreview>(), Is.Not.Null);
                var streams = Object.FindObjectsByType<MeshRenderer>(FindObjectsSortMode.None)
                    .Where(item => item.name.StartsWith("溪流_", StringComparison.Ordinal)).ToArray();
                Assert.That(streams.Length, Is.EqualTo(2));
                foreach (var stream in streams)
                    Assert.That(stream.sharedMaterial.GetFloat("_IsStream"), Is.EqualTo(1), "島面溪流必須使用不消散的材質");
                EditorSceneManager.OpenScene("Assets/Scenes/生命樹庭園.unity");
                Assert.That(Object.FindFirstObjectByType<CloudExteriorPreview>(), Is.Null);
            }
            finally
            {
                if (previous.Length == 0 || previous.Any(item => string.IsNullOrEmpty(item.path)))
                    EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                else EditorSceneManager.RestoreSceneManagerSetup(previous);
            }
        }

        [Test]
        public void ExteriorKeepsOneIslandAndBoundedFineFoliage()
        {
            var model = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/Generated/生命樹庭園.fbx");
            var meshes = model.GetComponentsInChildren<MeshFilter>(true);
            Assert.That(meshes.Count(item => item.name.StartsWith("浮島_")), Is.EqualTo(1));
            Assert.That(meshes.Single(item => item.name == "林地_葉冠").sharedMesh.vertexCount, Is.GreaterThan(10000));
            var leaves = meshes.Where(item => item.name.StartsWith("葉群網格_")).ToArray();
            Assert.That(leaves.Length, Is.EqualTo(16));
            Assert.That(leaves.Sum(item => item.sharedMesh.triangles.Length / 3), Is.EqualTo(120000));
            Assert.That(meshes.Sum(item => item.sharedMesh.triangles.Length / 3), Is.LessThan(220000));
        }

        [Test]
        public void LandscapeCapturePreservesGeometryAspectAndRestoresCamera()
        {
            var owner = new GameObject("截圖相機測試");
            var sphere = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            var material = new Material(Shader.Find("Unlit/Color")) { color = Color.white };
            var previous = new RenderTexture(16,16,0);
            var image = new Texture2D(2,2);
            var path = Path.Combine(Path.GetTempPath(), $"exterior-capture-{Guid.NewGuid():N}.png");
            try
            {
                sphere.layer = 30;
                sphere.GetComponent<Renderer>().sharedMaterial = material;
                var camera = owner.AddComponent<Camera>();
                camera.cullingMask = 1 << 30;
                camera.clearFlags = CameraClearFlags.SolidColor;
                camera.backgroundColor = Color.black;
                camera.transform.position = new Vector3(0,0,-5);
                camera.orthographic = true; camera.orthographicSize = 2;
                camera.aspect = .75f; camera.targetTexture = previous;
                LifeTreePreviewCapture.CaptureStill(camera, path, 160, 80);
                Assert.That(camera.targetTexture, Is.SameAs(previous));
                Assert.That(camera.aspect, Is.EqualTo(.75f).Within(.001));
                image.LoadImage(File.ReadAllBytes(path));
                var minX=160; var maxX=0; var minY=80; var maxY=0;
                for(var y=0;y<80;y++) for(var x=0;x<160;x++)
                    if(image.GetPixel(x,y).r > .5f)
                    { minX=Math.Min(minX,x); maxX=Math.Max(maxX,x); minY=Math.Min(minY,y); maxY=Math.Max(maxY,y); }
                Assert.That(maxX-minX, Is.GreaterThan(10));
                Assert.That(maxX-minX, Is.EqualTo(maxY-minY).Within(2), "圓球不應被橫向拉寬");
            }
            finally
            {
                Object.DestroyImmediate(owner); Object.DestroyImmediate(sphere);
                Object.DestroyImmediate(material); Object.DestroyImmediate(previous); Object.DestroyImmediate(image);
                if(File.Exists(path)) File.Delete(path);
            }
        }
    }
}
