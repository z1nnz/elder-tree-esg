using System;
using System.IO;
using System.Linq;
using TreeCompanion.LifeTree;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace TreeCompanion.Editor
{
    public static class LifeTreeSceneBuilder
    {
        private const string ModelPath = "Assets/Art/Generated/生命樹庭園.fbx";
        private const string ScenePath = "Assets/Scenes/生命樹庭園.unity";

        [MenuItem("樹伴/重建生命樹庭園")]
        public static void Build()
        {
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            var model = AssetDatabase.LoadAssetAtPath<GameObject>(ModelPath);
            if (model == null)
            {
                throw new InvalidOperationException($"找不到生命樹模型：{ModelPath}");
            }

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            scene.name = "生命樹庭園";

            var environment = new GameObject("生命樹庭園_場景");
            var tree = (GameObject)PrefabUtility.InstantiatePrefab(model, scene);
            tree.name = "生命樹_展示模型";
            tree.transform.SetParent(environment.transform, false);
            // Blender's FBX uses centimetre file units. Keeping the scale on
            // the authored root preserves a clear scene contract and lets the
            // runtime stage controller apply relative growth without guessing.
            tree.transform.localScale = Vector3.one * 100f;

            ValidateImportedHierarchy(tree.transform);

            var controllerObject = new GameObject("生命樹_資料與動畫");
            controllerObject.transform.SetParent(environment.transform, false);
            var controller = controllerObject.AddComponent<LifeTreeSceneController>();
            controller.BindHierarchy(tree.transform);
            var bridge = controllerObject.AddComponent<LifeTreeBridge>();
            bridge.Configure(controller);

            CreateCamera(environment.transform);
            CreateLighting(environment.transform);
            CreateBackdrop(environment.transform);

            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.42f, 0.56f, 0.46f);
            RenderSettings.ambientEquatorColor = new Color(0.20f, 0.30f, 0.23f);
            RenderSettings.ambientGroundColor = new Color(0.075f, 0.09f, 0.072f);
            RenderSettings.fog = true;
            RenderSettings.fogColor = new Color(0.035f, 0.075f, 0.058f);
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogDensity = 0.012f;

            PlayerSettings.companyName = "樹伴";
            PlayerSettings.productName = "樹伴生命樹庭園";
            Application.targetFrameRate = 30;
            QualitySettings.vSyncCount = 0;

            EditorSceneManager.MarkSceneDirty(scene);
            if (!EditorSceneManager.SaveScene(scene, ScenePath))
            {
                throw new InvalidOperationException($"無法儲存場景：{ScenePath}");
            }

            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();
            Debug.Log("生命樹庭園已建立：8 根主枝、16 組葉簇、12 個穩定紀念掛點。目標更新率為每秒 30 幀。");
        }

        public static void BuildAndCapture()
        {
            Build();
            var camera = Camera.main;
            if (camera == null)
            {
                throw new InvalidOperationException("生命樹庭園缺少主相機。");
            }

            const int width = 768;
            const int height = 1024;
            var renderTexture = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32);
            var image = new Texture2D(width, height, TextureFormat.RGBA32, false);
            var previousActive = RenderTexture.active;

            try
            {
                camera.targetTexture = renderTexture;
                camera.Render();
                RenderTexture.active = renderTexture;
                image.ReadPixels(new Rect(0f, 0f, width, height), 0, 0);
                image.Apply(false);

                var outputPath = Path.GetFullPath(Path.Combine(
                    Application.dataPath,
                    "../../../docs/leadership-evidence/screenshots/life-tree-unity-garden.png"));
                Directory.CreateDirectory(Path.GetDirectoryName(outputPath));
                File.WriteAllBytes(outputPath, image.EncodeToPNG());
                Debug.Log($"生命樹庭園實景已輸出：{outputPath}");
            }
            finally
            {
                camera.targetTexture = null;
                RenderTexture.active = previousActive;
                UnityEngine.Object.DestroyImmediate(image);
                UnityEngine.Object.DestroyImmediate(renderTexture);
            }
        }

        private static void ValidateImportedHierarchy(Transform root)
        {
            var names = root.GetComponentsInChildren<Transform>(true).Select(item => item.name).ToArray();
            RequireCount(names, "主枝_", 8);
            RequireCount(names, "後景葉簇_", 8);
            RequireCount(names, "前景葉簇_", 8);
            RequireCount(names, "紀念掛點_", LifeTreeState.KeepsakeSlotCount);
        }

        private static void RequireCount(string[] names, string prefix, int expected)
        {
            var actual = names.Count(name => name.StartsWith(prefix, StringComparison.Ordinal));
            if (actual != expected)
            {
                throw new InvalidOperationException($"模型階層 {prefix} 數量應為 {expected}，實際為 {actual}。");
            }
        }

        private static void CreateCamera(Transform parent)
        {
            var cameraObject = new GameObject("生命樹庭園_主相機");
            cameraObject.transform.SetParent(parent, false);
            cameraObject.transform.position = new Vector3(7.8f, 5.7f, -10.8f);
            cameraObject.transform.rotation = Quaternion.LookRotation(new Vector3(0f, 2.55f, 0f) - cameraObject.transform.position, Vector3.up);

            var camera = cameraObject.AddComponent<Camera>();
            camera.fieldOfView = 36f;
            camera.nearClipPlane = 0.1f;
            camera.farClipPlane = 80f;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.025f, 0.055f, 0.043f);
            camera.allowHDR = true;
            camera.allowMSAA = true;
            cameraObject.tag = "MainCamera";
        }

        private static void CreateLighting(Transform parent)
        {
            var sunObject = new GameObject("暖陽主光");
            sunObject.transform.SetParent(parent, false);
            sunObject.transform.rotation = Quaternion.Euler(42f, -34f, 0f);
            var sun = sunObject.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.76f, 0.54f);
            sun.intensity = 0.90f;
            sun.shadows = LightShadows.Soft;
            sun.shadowStrength = 0.72f;

            var fillObject = new GameObject("葉冠柔光");
            fillObject.transform.SetParent(parent, false);
            fillObject.transform.position = new Vector3(-3.6f, 5.4f, -2.2f);
            fillObject.transform.rotation = Quaternion.LookRotation(new Vector3(0f, 3.2f, 0f) - fillObject.transform.position);
            var fill = fillObject.AddComponent<Light>();
            fill.type = LightType.Spot;
            fill.color = new Color(0.48f, 0.70f, 0.56f);
            fill.intensity = 2.65f;
            fill.range = 18f;
            fill.spotAngle = 78f;
            fill.shadows = LightShadows.None;
        }

        private static void CreateBackdrop(Transform parent)
        {
            var backdrop = GameObject.CreatePrimitive(PrimitiveType.Plane);
            backdrop.name = "庭園遠景地面";
            backdrop.transform.SetParent(parent, false);
            backdrop.transform.position = new Vector3(0f, -0.24f, 0f);
            backdrop.transform.localScale = new Vector3(4.5f, 4.5f, 4.5f);

            var renderer = backdrop.GetComponent<Renderer>();
            var shader = Shader.Find("Standard") ?? Shader.Find("Universal Render Pipeline/Lit");
            if (shader != null)
            {
                var material = new Material(shader)
                {
                    name = "庭園地面_執行時材質",
                    color = new Color(0.065f, 0.095f, 0.07f),
                };
                renderer.sharedMaterial = material;
            }

            var collider = backdrop.GetComponent<Collider>();
            if (collider != null)
            {
                UnityEngine.Object.DestroyImmediate(collider);
            }
        }
    }
}
