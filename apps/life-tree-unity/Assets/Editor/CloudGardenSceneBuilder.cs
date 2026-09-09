using System;
using System.IO;
using System.Linq;
using TreeCompanion.LifeTree;
using UnityEditor;
using UnityEngine;

namespace TreeCompanion.Editor
{
    public static class CloudGardenSceneBuilder
    {
        public static void Configure(GameObject owner, Transform world, Camera camera,
            LifeTreeWorldInteraction interaction, LifeTreeAtmosphereController atmosphere)
        {
            var ground = world.GetComponentsInChildren<MeshFilter>().Single(item => item.name == "浮島_中央生命島");
            var collider = ground.gameObject.AddComponent<MeshCollider>(); collider.sharedMesh = ground.sharedMesh;
            Physics.SyncTransforms();
            var positions = new[] { new Vector3(-1.75f, 5, .25f), new Vector3(1.5f, 5, -1f), new Vector3(0, 5, 1.6f) };
            var plots = new Transform[3]; var gardens = new GameObject[3];
            var soil = Material("晨光花圃_陶土", new Color(.38f,.25f,.15f));
            var green = Material("晨光花圃_葉", new Color(.16f,.38f,.17f));
            var gold = Material("晨光花圃_花", new Color(1f,.75f,.21f));
            for (var i = 0; i < positions.Length; i++)
            {
                if (!collider.Raycast(new Ray(positions[i], Vector3.down), out var hit, 10))
                    throw new InvalidOperationException($"建設位置 {i} 不在主島地面。");
                var plot = new GameObject($"建設位置_{i}"); plot.transform.SetParent(world, false);
                plot.transform.position = hit.point + Vector3.up * .08f; plots[i] = plot.transform;
                var garden = new GameObject("晨光花圃"); garden.transform.SetParent(plot.transform, false);
                Part(garden.transform, PrimitiveType.Cylinder, Vector3.zero, new Vector3(.72f,.07f,.72f), soil);
                for (var flower = 0; flower < 5; flower++)
                {
                    var angle = flower * Mathf.PI * 2 / 5;
                    var point = new Vector3(Mathf.Cos(angle)*.22f,.20f + flower*.022f,Mathf.Sin(angle)*.22f);
                    Part(garden.transform, PrimitiveType.Cylinder, new Vector3(point.x,point.y*.5f,point.z), new Vector3(.025f,point.y*.5f,.025f), green);
                    for (var petal = 0; petal < 5; petal++)
                    {
                        var turn = petal * Mathf.PI * 2 / 5;
                        Part(garden.transform, PrimitiveType.Sphere, point + new Vector3(Mathf.Cos(turn)*.055f,0,Mathf.Sin(turn)*.055f), new Vector3(.095f,.045f,.095f), gold);
                    }
                }
                gardens[i] = garden; garden.SetActive(false);
            }
            owner.AddComponent<CloudGardenPlayController>().Configure(camera, interaction, atmosphere, plots, gardens);
        }
        private static Material Material(string name, Color color)
        {
            var path = $"Assets/Art/Generated/Materials/{name}.mat";
            var material = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (material == null) { material = new Material(Shader.Find("Standard")); AssetDatabase.CreateAsset(material, path); }
            material.color = color; material.SetFloat("_Glossiness", .12f); EditorUtility.SetDirty(material);
            return material;
        }
        private static void Part(Transform parent, PrimitiveType type, Vector3 position, Vector3 scale, Material material)
        {
            var part = GameObject.CreatePrimitive(type); part.name = material.name;
            part.transform.SetParent(parent, false); part.transform.localPosition = position; part.transform.localScale = scale;
            part.GetComponent<Renderer>().sharedMaterial = material;
            UnityEngine.Object.DestroyImmediate(part.GetComponent<Collider>());
        }
        [MenuItem("樹伴/輸出雲境建設試玩")]
        public static void BuildAndCapture()
        {
            LifeTreeSceneBuilder.Build();
            var play = UnityEngine.Object.FindFirstObjectByType<CloudGardenPlayController>();
            var state = UnityEngine.Object.FindFirstObjectByType<LifeTreeSceneController>();
            state.ApplyState(new LifeTreeState { stageIndex = 5, reduceMotion = true });
            play.Initialize(false);
            var output = Path.GetFullPath(Path.Combine(Application.dataPath, "../../../docs/leadership-evidence/screenshots/cloud-garden-2026-09-09"));
            LifeTreePreviewCapture.CaptureStill(Camera.main, Path.Combine(output, "雲境全景.png"), 768, 1024);
            play.Enter(); play.EvaluateTransition(1); play.Plant(); Canvas.ForceUpdateCanvases();
            LifeTreePreviewCapture.CaptureStill(Camera.main, Path.Combine(output, "晨光花圃試玩.png"), 768, 1024);
            play.Exit(); play.EvaluateTransition(1);
        }

        [MenuItem("樹伴/交付本機試玩與實景")]
        public static void BuildPreviewWithEvidence()
        {
            BuildAndCapture();
            BuildMacPreview();
        }

        [MenuItem("樹伴/建置本機雲境試玩")]
        public static void BuildMacPreview()
        {
            LifeTreeSceneBuilder.Build();
            UnityEngine.Object.FindFirstObjectByType<CloudGardenPlayController>().EnableLocalArtPreview();
            const string previewScene = "Assets/Scenes/雲境本機試玩.unity";
            UnityEditor.SceneManagement.EditorSceneManager.SaveScene(
                UnityEngine.SceneManagement.SceneManager.GetActiveScene(), previewScene);
            var path = Path.GetFullPath(Path.Combine(Application.dataPath, "../Builds/雲境試玩.app"));
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { previewScene }, locationPathName = path,
                target = BuildTarget.StandaloneOSX, options = BuildOptions.Development,
            });
            if (report.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
                throw new InvalidOperationException("本機雲境試玩建置失敗。");
            Debug.Log($"本機雲境試玩已建置：{path}");
        }
    }
}
