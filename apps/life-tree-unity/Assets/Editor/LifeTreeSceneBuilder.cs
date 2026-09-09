using System;
using System.IO;
using System.Linq;
using TreeCompanion.LifeTree;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace TreeCompanion.Editor
{
    public static class LifeTreeSceneBuilder
    {
        private const string ModelPath = "Assets/Art/Generated/生命樹庭園.fbx";
        private const string CloudModelPath = "Assets/Art/Generated/雲境立體雲海.fbx";
        private const string BarkTexturePath = "Assets/Art/Textures/生命樹_樹皮色彩_v1.png";
        private const string BarkMaterialPath = "Assets/Art/Generated/Materials/生命樹_樹皮.mat";
        private const string FoliageTexturePath = "Assets/Art/Textures/生命樹_葉簇色彩_v2.png";
        private const string FoliageMaterialPath = "Assets/Art/Generated/Materials/生命樹_葉簇.mat";
        private const string GrassTexturePath = "Assets/Art/Textures/生命樹_浮島草地色彩_v1.png";
        private const string RockTexturePath = "Assets/Art/Textures/生命樹_浮島岩層色彩_v1.png";
        private const string IslandMaterialPath = "Assets/Art/Generated/Materials/生命樹_浮島地表.mat";
        private const string RockMaterialPath = "Assets/Art/Generated/Materials/生命樹_島岩.mat";
        private const string WaterfallMaterialPath = "Assets/Art/Generated/Materials/生命樹_瀑布流光.mat";
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
            var worldModel = (GameObject)PrefabUtility.InstantiatePrefab(model, scene);
            worldModel.name = "生命樹_浮島世界模型";
            worldModel.transform.SetParent(environment.transform, false);
            // The generated FBX is authored in metres and Unity's importer has
            // already converted its file units. A second 100x scale here would
            // push the camera kilometres away and flatten every material into
            // the fog colour.
            worldModel.transform.localScale = Vector3.one;

            ValidateImportedHierarchy(worldModel.transform);
            var lifeTreeRoot = FindRequiredDescendant(worldModel.transform, "生命樹_根節點");
            ApplyTreeMaterials(lifeTreeRoot);
            ApplyFloatingIslandMaterials(worldModel.transform);
            ApplyWaterfallMaterial(worldModel.transform);

            var controllerObject = new GameObject("生命樹_資料與動畫");
            controllerObject.transform.SetParent(environment.transform, false);
            var controller = controllerObject.AddComponent<LifeTreeSceneController>();
            controller.BindHierarchy(lifeTreeRoot);
            controller.BindGrowthStages(CreateGrowthStages(worldModel.transform, lifeTreeRoot));
            var bridge = controllerObject.AddComponent<LifeTreeBridge>();
            bridge.Configure(controller);

            var camera = CreateCamera(environment.transform, worldModel.transform);
            var atmosphere = controllerObject.AddComponent<LifeTreeAtmosphereController>();
            atmosphere.Bind(
                camera,
                camera.transform.position + camera.transform.forward * 20f
            );
            controller.ConfigureAtmosphere(atmosphere);
            atmosphere.BindWaterfallMist(CreateWaterfallMist(worldModel.transform));
            CreateLighting(environment.transform);
            atmosphere.BindClouds(CreateCloudWorld(worldModel.transform, camera));
            var interaction = controllerObject.AddComponent<LifeTreeWorldInteraction>();
            interaction.Configure(worldModel.transform, camera, null);
            CloudGardenSceneBuilder.Configure(controllerObject, worldModel.transform, camera, interaction, atmosphere);

            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.40f, 0.54f, 0.62f);
            RenderSettings.ambientEquatorColor = new Color(0.24f, 0.36f, 0.38f);
            RenderSettings.ambientGroundColor = new Color(0.07f, 0.12f, 0.11f);
            RenderSettings.ambientIntensity = 0.88f;
            RenderSettings.reflectionIntensity = 0.48f;
            RenderSettings.fog = true;
            RenderSettings.fogColor = new Color(0.61f, 0.73f, 0.78f);
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogDensity = 0.0045f;

            PlayerSettings.companyName = "樹伴";
            PlayerSettings.productName = "樹伴生命樹庭園";
            Application.targetFrameRate = 30;
            QualitySettings.vSyncCount = 0;
            QualitySettings.antiAliasing = 4;
            QualitySettings.shadowDistance = 30f;
            QualitySettings.shadowCascades = 2;

            EditorSceneManager.MarkSceneDirty(scene);
            if (!EditorSceneManager.SaveScene(scene, ScenePath))
            {
                throw new InvalidOperationException($"無法儲存場景：{ScenePath}");
            }

            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();
            Debug.Log("雲境已建立：三維主樹、1 座中央島、2 道近景瀑布與 9 組立體雲團；未使用背景圖。目標更新率為每秒 30 幀，待實機驗證。");
        }

        public static void BuildAndCapture()
        {
            Build();
            var camera = Camera.main;
            if (camera == null)
            {
                throw new InvalidOperationException("生命樹庭園缺少主相機。");
            }
            var controller = UnityEngine.Object.FindFirstObjectByType<LifeTreeSceneController>();
            if (controller == null)
            {
                throw new InvalidOperationException("生命樹庭園缺少資料與動畫控制器。");
            }
            controller.ApplyState(new LifeTreeState
            {
                stageIndex = LifeTreeState.MaximumStageIndex,
                reduceMotion = true,
            });

            var outputPath = Path.GetFullPath(Path.Combine(
                Application.dataPath,
                "../../../docs/leadership-evidence/screenshots/life-tree-unity-garden.png"));
            LifeTreePreviewCapture.CaptureStill(camera, outputPath, 768, 1024);
            Debug.Log($"生命樹庭園實景已輸出：{outputPath}");
        }

        [MenuItem("樹伴/輸出六階段生命樹實景")]
        public static void BuildAndCaptureGrowthStages()
        {
            Build();
            var camera = Camera.main;
            var controller = UnityEngine.Object.FindFirstObjectByType<LifeTreeSceneController>();
            var labels = new[] { "種子", "發芽", "幼苗", "小樹", "成樹", "大樹" };
            var output = Path.GetFullPath(Path.Combine(Application.dataPath,
                "../../../docs/leadership-evidence/screenshots/growth-stages-2026-09-08"));
            var originalPosition = camera.transform.position;
            var originalRotation = camera.transform.rotation;
            for (var stage = 0; stage < labels.Length; stage++)
            {
                controller.ApplyState(new LifeTreeState { stageIndex = stage, reduceMotion = true });
                camera.transform.SetPositionAndRotation(originalPosition, originalRotation);
                LifeTreePreviewCapture.CaptureStill(camera,
                    Path.Combine(output, $"{stage:00}-{labels[stage]}-浮島.png"), 768, 1024);
                // A separate labelled close-up is evidence, not a change to the
                // model's physical scale or the user's earned progress.
                var target = new Vector3(0, new[] { .22f, .50f, .85f, 1.45f, 2.05f, 2.6f }[stage], 0);
                var distance = new[] { 2.1f, 3.3f, 5.0f, 8.5f, 12f, 16f }[stage];
                camera.transform.position = target + new Vector3(.49f, .34f, .80f).normalized * distance;
                camera.transform.LookAt(target);
                LifeTreePreviewCapture.CaptureStill(camera,
                    Path.Combine(output, $"{stage:00}-{labels[stage]}-近景.png"), 768, 1024);
            }
            controller.ApplyState(new LifeTreeState { stageIndex = 5, reduceMotion = true });
            camera.transform.SetPositionAndRotation(originalPosition, originalRotation);
            Debug.Log($"六個獨立生長階段已輸出：{output}");
        }

        private static Transform[] CreateGrowthStages(Transform world, Transform mature)
        {
            const string path = "Assets/Art/Generated/生命樹生長階段.fbx";
            var model = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            if (model == null) throw new InvalidOperationException($"缺少生長階段模型：{path}");
            var young = (GameObject)PrefabUtility.InstantiatePrefab(model, world.gameObject.scene);
            young.transform.SetParent(world, false);
            var labels = new[] { "種子", "發芽", "幼苗", "小樹", "成樹" };
            var stages = new Transform[6];
            for (var i = 0; i < labels.Length; i++)
                stages[i] = FindRequiredDescendant(young.transform, $"生長階段_{i:00}_{labels[i]}");
            stages[5] = mature;
            var foliage = AssetDatabase.LoadAssetAtPath<Material>(FoliageMaterialPath);
            foreach (var renderer in young.GetComponentsInChildren<Renderer>(true))
            {
                if (renderer.name.StartsWith("嫩葉_", StringComparison.Ordinal))
                    renderer.sharedMaterial = foliage;
            }
            return stages;
        }

        [MenuItem("樹伴/輸出浮島環繞展示")]
        public static void BuildAndCaptureWorldTour()
        {
            Build();
            var camera = Camera.main;
            var controller = UnityEngine.Object.FindFirstObjectByType<LifeTreeSceneController>();
            var atmosphere = UnityEngine.Object.FindFirstObjectByType<LifeTreeAtmosphereController>();
            var interaction = UnityEngine.Object.FindFirstObjectByType<LifeTreeWorldInteraction>();
            var output = Path.Combine(Path.GetTempPath(), "tree-companion-world-tour-20260908");
            controller.ApplyState(new LifeTreeState { stageIndex = 5, reduceMotion = false });
            try
            {
                LifeTreePreviewCapture.CaptureSequence(camera, output, "生命樹動態", 384, 512, 90, frame =>
                {
                    var time = frame / 30f;
                    controller.EvaluateWindAt(time);
                    atmosphere.EvaluateAt(time);
                    interaction.SetView(Mathf.Sin(frame / 90f * Mathf.PI * 2f) * 30f, 1f);
                });
            }
            finally { interaction.ResetView(); }
            Debug.Log($"浮島環繞展示已輸出：{output}");
        }

        [MenuItem("樹伴/輸出生命樹動態預覽影格")]
        public static void BuildAndCaptureMotionPreview()
        {
            Build();
            var camera = Camera.main;
            var controller = UnityEngine.Object.FindFirstObjectByType<LifeTreeSceneController>();
            var atmosphere = UnityEngine.Object.FindFirstObjectByType<LifeTreeAtmosphereController>();
            if (camera == null || controller == null || atmosphere == null)
            {
                throw new InvalidOperationException("生命樹動態預覽缺少相機或場景控制器。");
            }

            controller.ApplyState(new LifeTreeState
            {
                stageIndex = LifeTreeState.MaximumStageIndex,
                reduceMotion = false,
            });

            const int width = 768;
            const int height = 1024;
            const int framesPerSecond = 30;
            const int frameCount = framesPerSecond * 3;
            var outputDirectory = Path.Combine(
                Path.GetTempPath(),
                "tree-companion-life-tree-motion-frames"
            );
            if (Directory.Exists(outputDirectory))
            {
                Directory.Delete(outputDirectory, true);
            }
            Directory.CreateDirectory(outputDirectory);

            try
            {
                LifeTreePreviewCapture.CaptureSequence(
                    camera,
                    outputDirectory,
                    "生命樹動態",
                    width,
                    height,
                    frameCount,
                    frame =>
                    {
                        var sampleTime = frame / (float)framesPerSecond;
                        controller.EvaluateWindAt(sampleTime);
                        atmosphere.EvaluateAt(sampleTime);
                    }
                );
                Debug.Log($"生命樹動態預覽已輸出 {frameCount} 幀：{outputDirectory}");
            }
            finally
            {
                controller.ApplyState(new LifeTreeState
                {
                    stageIndex = LifeTreeState.MaximumStageIndex,
                    reduceMotion = true,
                });
            }
        }

        [MenuItem("樹伴/匯出 iOS 生命樹程式庫")]
        public static void ExportIosLibrary()
        {
            ValidateLibraryExport(BuildTargetGroup.iOS, BuildTarget.iOS, "iOS");

            var outputPath = Path.GetFullPath(Path.Combine(Application.dataPath, "../Builds/iOS"));
            Directory.CreateDirectory(outputPath);
            EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.iOS, BuildTarget.iOS);
            PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.iOS, "tw.treecompanion.lifetreegarden");
            PlayerSettings.iOS.targetOSVersionString = "15.0";
            BuildLibrary(BuildTarget.iOS, outputPath, BuildOptions.None, "iOS");
            Debug.Log($"iOS 生命樹程式庫已匯出：{outputPath}");
        }

        [MenuItem("樹伴/匯出 Android 生命樹程式庫")]
        public static void ExportAndroidLibrary()
        {
            ValidateLibraryExport(BuildTargetGroup.Android, BuildTarget.Android, "Android");

            var outputPath = Path.GetFullPath(Path.Combine(Application.dataPath, "../Builds/Android"));
            if (Directory.Exists(outputPath))
            {
                Directory.Delete(outputPath, true);
            }
            Directory.CreateDirectory(outputPath);

            EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            EditorUserBuildSettings.exportAsGoogleAndroidProject = true;
            PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android, "tw.treecompanion.lifetreegarden");
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel26;
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            BuildLibrary(
                BuildTarget.Android,
                outputPath,
                BuildOptions.AcceptExternalModificationsToPlayer,
                "Android"
            );
            Debug.Log($"Android 生命樹程式庫已匯出：{outputPath}/unityLibrary");
        }

        private static void ValidateLibraryExport(
            BuildTargetGroup buildTargetGroup,
            BuildTarget buildTarget,
            string platformName
        )
        {
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            if (AssetDatabase.LoadAssetAtPath<SceneAsset>(ScenePath) == null)
            {
                throw new InvalidOperationException(
                    $"找不到已版控的生命樹場景：{ScenePath}。請先執行「樹伴/重建生命樹庭園」並審查差異。"
                );
            }
            if (!BuildPipeline.IsBuildTargetSupported(buildTargetGroup, buildTarget))
            {
                throw new InvalidOperationException($"尚未安裝 Unity {platformName} Build Support。");
            }
        }

        private static void BuildLibrary(
            BuildTarget buildTarget,
            string outputPath,
            BuildOptions options,
            string platformName
        )
        {
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = outputPath,
                target = buildTarget,
                options = options,
            });
            if (report.summary.result != BuildResult.Succeeded)
            {
                throw new InvalidOperationException(
                    $"{platformName} 生命樹程式庫匯出失敗：{report.summary.result}，錯誤 {report.summary.totalErrors}。"
                );
            }
        }

        private static void ValidateImportedHierarchy(Transform root)
        {
            var names = root.GetComponentsInChildren<Transform>(true).Select(item => item.name).ToArray();
            RequireCount(names, "主枝_", 8);
            RequireCount(names, "後景葉簇_", 8);
            RequireCount(names, "前景葉簇_", 8);
            RequireCount(names, "紀念掛點_", LifeTreeState.KeepsakeSlotCount);
            RequireCount(names, "浮島_", 1);
            RequireCount(names, "群島地形_", 0);
            RequireCount(names, "瀑布_", 2);
            RequireCount(names, "雲海_", 0);
        }

        private static Transform FindRequiredDescendant(Transform root, string name)
        {
            var match = root.GetComponentsInChildren<Transform>(true)
                .SingleOrDefault(item => item.name == name);
            return match ?? throw new InvalidOperationException($"模型缺少必要節點：{name}。");
        }

        private static void RequireCount(string[] names, string prefix, int expected)
        {
            var actual = names.Count(name => name.StartsWith(prefix, StringComparison.Ordinal));
            if (actual != expected)
            {
                throw new InvalidOperationException($"模型階層 {prefix} 數量應為 {expected}，實際為 {actual}。");
            }
        }

        private static Camera CreateCamera(Transform parent, Transform content)
        {
            // Clouds are edge dressing rather than a framing target. Including
            // their outer lobes makes the portrait camera retreat so far that
            // the life tree loses its role as the hero object.
            var renderers = content.GetComponentsInChildren<Renderer>(true)
                .Where(renderer => renderer.enabled && IsCameraFramingRenderer(renderer.transform, content))
                .ToArray();
            if (renderers.Length == 0)
            {
                throw new InvalidOperationException("生命樹浮島模型沒有可供相機取景的網格。");
            }
            var contentBounds = renderers[0].bounds;
            foreach (var renderer in renderers.Skip(1))
            {
                contentBounds.Encapsulate(renderer.bounds);
            }

            var cameraObject = new GameObject("生命樹庭園_主相機");
            cameraObject.transform.SetParent(parent, false);

            var camera = cameraObject.AddComponent<Camera>();
            camera.fieldOfView = 37f;
            camera.aspect = 0.75f;
            camera.nearClipPlane = 0.1f;
            var verticalHalfAngle = camera.fieldOfView * 0.5f * Mathf.Deg2Rad;
            var horizontalHalfAngle = Mathf.Atan(Mathf.Tan(verticalHalfAngle) * camera.aspect);
            var verticalDistance = contentBounds.extents.y / Mathf.Tan(verticalHalfAngle);
            var horizontalDistance = contentBounds.extents.x / Mathf.Tan(horizontalHalfAngle);
            // A portrait hero view intentionally lets the far-island edges
            // leave frame. Fitting the entire horizontal world would reduce
            // the tree to roughly one quarter of the screen instead of the
            // product target of a dominant life-tree silhouette.
            var distance = Mathf.Max(
                20f,
                Mathf.Max(verticalDistance * 1.38f, horizontalDistance * 0.88f)
            );
            // Blender's authored front (-Y) becomes Unity's +Z after FBX
            // conversion. View from that side so the two cliff waterfalls and
            // the warm bark ridges remain visible in the hero composition.
            var viewDirection = new Vector3(0.49f, 0.34f, 0.80f).normalized;
            // Reserve the lower portrait area for the construction controls.
            var target = contentBounds.center - Vector3.up * contentBounds.extents.y * 0.22f;
            cameraObject.transform.position = target + viewDirection * distance;
            cameraObject.transform.rotation = Quaternion.LookRotation(target - cameraObject.transform.position, Vector3.up);
            camera.farClipPlane = Mathf.Max(80f, distance * 4f);
            camera.clearFlags = CameraClearFlags.Skybox;
            camera.backgroundColor = new Color(0.18f, 0.48f, 0.72f);
            camera.allowHDR = true;
            camera.allowMSAA = true;
            cameraObject.tag = "MainCamera";
            Debug.Log($"生命樹浮島取景邊界：中心 {contentBounds.center}、尺寸 {contentBounds.size}、相機距離 {distance:F2}。");
            return camera;
        }

        private static bool HasNamedAncestor(
            Transform item,
            Transform contentRoot,
            string[] prefixes
        )
        {
            for (var current = item; current != null && current != contentRoot; current = current.parent)
            {
                if (prefixes.Any(prefix => current.name.StartsWith(prefix, StringComparison.Ordinal)))
                {
                    return true;
                }
            }
            return false;
        }

        private static void ApplyTreeMaterials(Transform lifeTreeRoot)
        {
            var barkTexture = AssetDatabase.LoadAssetAtPath<Texture2D>(BarkTexturePath);
            if (barkTexture == null)
            {
                throw new InvalidOperationException($"找不到生命樹樹皮貼圖：{BarkTexturePath}");
            }
            var shader = Shader.Find("Standard") ?? Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null)
            {
                throw new InvalidOperationException("找不到生命樹樹皮需要的光照著色器。");
            }
            var foliageShader = Shader.Find("樹伴/生命樹立體葉片");
            if (foliageShader == null)
            {
                throw new InvalidOperationException("找不到生命樹立體葉片著色器。");
            }

            var materialDirectory = Path.GetDirectoryName(BarkMaterialPath);
            if (!AssetDatabase.IsValidFolder(materialDirectory))
            {
                Directory.CreateDirectory(Path.Combine(Application.dataPath, "Art/Generated/Materials"));
                AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            }
            var barkMaterial = AssetDatabase.LoadAssetAtPath<Material>(BarkMaterialPath);
            if (barkMaterial == null)
            {
                barkMaterial = new Material(shader) { name = "生命樹_樹皮" };
                AssetDatabase.CreateAsset(barkMaterial, BarkMaterialPath);
            }
            else
            {
                barkMaterial.shader = shader;
            }
            barkMaterial.mainTexture = barkTexture;
            barkMaterial.mainTextureScale = new Vector2(1.35f, 2.8f);
            barkMaterial.color = Color.white;
            if (barkMaterial.HasProperty("_Glossiness"))
            {
                barkMaterial.SetFloat("_Glossiness", 0.18f);
            }
            if (barkMaterial.HasProperty("_Smoothness"))
            {
                barkMaterial.SetFloat("_Smoothness", 0.18f);
            }

            var foliageMaterial = AssetDatabase.LoadAssetAtPath<Material>(FoliageMaterialPath);
            if (foliageMaterial == null)
            {
                foliageMaterial = new Material(foliageShader) { name = "生命樹_葉簇" };
                AssetDatabase.CreateAsset(foliageMaterial, FoliageMaterialPath);
            }
            else
            {
                foliageMaterial.shader = foliageShader;
            }
            foliageMaterial.color = Color.white;
            if (foliageMaterial.HasProperty("_Cutoff"))
            {
                foliageMaterial.SetFloat("_Cutoff", 0.28f);
            }
            if (foliageMaterial.HasProperty("_WindStrength"))
            {
                // FBX leaf-card children retain centimetre-scale transforms;
                // keep the object-space offset correspondingly small.
                foliageMaterial.SetFloat("_WindStrength", 0.00032f);
            }
            foliageMaterial.SetOverrideTag("RenderType", "Opaque");
            foliageMaterial.renderQueue = 2000;

            var barkPrefixes = new[]
            {
                "主幹",
                "主枝_",
                "次枝_",
                "末梢枝_",
                "樹根_",
                "垂根_",
            };
            var foliageRendererCount = 0;
            foreach (var renderer in lifeTreeRoot.GetComponentsInChildren<Renderer>(true))
            {
                if (HasNamedAncestor(
                    renderer.transform,
                    lifeTreeRoot,
                    new[] { "前景葉簇_", "後景葉簇_" }
                ))
                {
                    renderer.sharedMaterial = foliageMaterial;
                    foliageRendererCount++;
                }
                else if (HasNamedAncestor(renderer.transform, lifeTreeRoot, barkPrefixes)
                    || barkPrefixes.Any(prefix => renderer.name.StartsWith(prefix, StringComparison.Ordinal)))
                {
                    renderer.sharedMaterial = barkMaterial;
                }
            }
            if (foliageRendererCount != 16)
            {
                throw new InvalidOperationException(
                    $"生命樹葉冠應有 16 個合併渲染器，實際為 {foliageRendererCount}。"
                );
            }
            EditorUtility.SetDirty(barkMaterial);
            EditorUtility.SetDirty(foliageMaterial);
        }

        private static bool IsCameraFramingRenderer(Transform item, Transform contentRoot)
        {
            for (var current = item; current != null && current != contentRoot; current = current.parent)
            {
                if (current.name.StartsWith("雲海_", StringComparison.Ordinal)
                    || current.name.StartsWith("雲朵_", StringComparison.Ordinal)
                    || current.name.StartsWith("群島_", StringComparison.Ordinal))
                {
                    return false;
                }
            }
            return true;
        }

        private static void ApplyFloatingIslandMaterials(Transform worldRoot)
        {
            var grassTexture = AssetDatabase.LoadAssetAtPath<Texture2D>(GrassTexturePath);
            var rockTexture = AssetDatabase.LoadAssetAtPath<Texture2D>(RockTexturePath);
            if (grassTexture == null || rockTexture == null)
            {
                throw new InvalidOperationException(
                    $"找不到浮島材質貼圖：草地 {GrassTexturePath}；岩層 {RockTexturePath}。"
                );
            }
            var shader = Shader.Find("樹伴/生命樹浮島三向材質");
            if (shader == null)
            {
                throw new InvalidOperationException("找不到生命樹浮島三向材質著色器。");
            }

            var islandMaterial = AssetDatabase.LoadAssetAtPath<Material>(IslandMaterialPath);
            if (islandMaterial == null)
            {
                islandMaterial = new Material(shader) { name = "生命樹_浮島地表" };
                AssetDatabase.CreateAsset(islandMaterial, IslandMaterialPath);
            }
            var rockMaterial = AssetDatabase.LoadAssetAtPath<Material>(RockMaterialPath);
            if (rockMaterial == null)
            {
                rockMaterial = new Material(shader) { name = "生命樹_島岩" };
                AssetDatabase.CreateAsset(rockMaterial, RockMaterialPath);
            }
            ConfigureIslandMaterial(islandMaterial, shader, grassTexture, rockTexture, 1f);
            ConfigureIslandMaterial(rockMaterial, shader, grassTexture, rockTexture, 0f);
            const string bankPath = "Assets/Art/Generated/Materials/生命樹_溪岸濕土.mat";
            var bankMaterial = AssetDatabase.LoadAssetAtPath<Material>(bankPath);
            if (bankMaterial == null)
            {
                bankMaterial = new Material(shader) { name = "生命樹_溪岸濕土" };
                AssetDatabase.CreateAsset(bankMaterial, bankPath);
            }
            ConfigureIslandMaterial(bankMaterial, shader, grassTexture, rockTexture, 1f);
            bankMaterial.SetFloat("_BankInfluence", 1f);

            var islandRendererCount = 0;
            var rockRendererCount = 0;
            var bankRendererCount = 0;
            foreach (var renderer in worldRoot.GetComponentsInChildren<Renderer>(true))
            {
                if (renderer.name == "林地_葉冠")
                {
                    renderer.sharedMaterial = AssetDatabase.LoadAssetAtPath<Material>(FoliageMaterialPath);
                }
                else if (renderer.name.StartsWith("浮島_", StringComparison.Ordinal)
                    || HasNamedAncestor(
                        renderer.transform,
                        worldRoot,
                        new[] { "浮島_" }
                    ))
                {
                    var materialCount = Math.Max(1, renderer.sharedMaterials.Length);
                    renderer.sharedMaterials = Enumerable.Repeat(islandMaterial, materialCount).ToArray();
                    islandRendererCount++;
                }
                else if (renderer.name.StartsWith("溪岸_", StringComparison.Ordinal)
                    || renderer.name.StartsWith("河床_", StringComparison.Ordinal))
                {
                    renderer.sharedMaterial = bankMaterial;
                    bankRendererCount++;
                }
                else if (renderer.name.StartsWith("中央島_岩塊_", StringComparison.Ordinal)
                    || HasNamedAncestor(
                        renderer.transform,
                        worldRoot,
                        new[] { "中央島_岩塊_" }
                    ))
                {
                    renderer.sharedMaterial = rockMaterial;
                    rockRendererCount++;
                }
            }
            if (islandRendererCount != 1 || rockRendererCount != 5 || bankRendererCount != 6)
            {
                throw new InvalidOperationException(
                    $"浮島材質節點數量錯誤：中央島 {islandRendererCount}，島岩 {rockRendererCount}，溪岸河床 {bankRendererCount}。"
                );
            }
            EditorUtility.SetDirty(islandMaterial);
            EditorUtility.SetDirty(rockMaterial);
            EditorUtility.SetDirty(bankMaterial);
        }

        private static void ConfigureIslandMaterial(
            Material material,
            Shader shader,
            Texture2D grassTexture,
            Texture2D rockTexture,
            float grassInfluence
        )
        {
            material.shader = shader;
            material.SetTexture("_GrassTex", grassTexture);
            material.SetTexture("_RockTex", rockTexture);
            material.SetFloat("_Tiling", 0.42f);
            material.SetFloat("_GrassInfluence", grassInfluence);
            material.SetFloat("_BankInfluence", 0f);
            material.color = Color.white;
        }

        private static void ApplyWaterfallMaterial(Transform worldRoot)
        {
            var shader = Shader.Find("樹伴/生命樹瀑布流動");
            if (shader == null)
            {
                throw new InvalidOperationException("找不到生命樹瀑布流動著色器。");
            }

            var material = AssetDatabase.LoadAssetAtPath<Material>(WaterfallMaterialPath);
            if (material == null)
            {
                material = new Material(shader) { name = "生命樹_瀑布流光" };
                AssetDatabase.CreateAsset(material, WaterfallMaterialPath);
            }
            else
            {
                material.shader = shader;
            }
            material.SetColor("_Color", new Color(0.32f, 0.70f, 0.86f, 1f));
            material.SetColor("_FoamColor", new Color(0.80f, 0.94f, 1f, 1f));
            material.SetFloat("_FlowSpeed", 0.65f);
            material.SetFloat("_FlowScale", 2.8f);
            material.SetFloat("_Opacity", 0.85f);
            material.renderQueue = 3000;

            var rendererCount = 0;
            foreach (var renderer in worldRoot.GetComponentsInChildren<Renderer>(true))
            {
                if (renderer.name.StartsWith("瀑布_", StringComparison.Ordinal)
                    || renderer.name.StartsWith("水沫內光_", StringComparison.Ordinal)
                    || renderer.name.StartsWith("溪流_", StringComparison.Ordinal))
                {
                    renderer.sharedMaterial = material;
                    renderer.enabled = !renderer.name.StartsWith("水沫內光_", StringComparison.Ordinal);
                    renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                    renderer.receiveShadows = false;
                    rendererCount++;
                }
            }
            if (rendererCount != 6)
            {
                throw new InvalidOperationException(
                    $"溪流與瀑布材質應套用至 6 個水流渲染器，實際為 {rendererCount}。"
                );
            }
            EditorUtility.SetDirty(material);
        }

        private static void CreateLighting(Transform parent)
        {
            var sunObject = new GameObject("暖陽主光");
            sunObject.transform.SetParent(parent, false);
            sunObject.transform.rotation = Quaternion.Euler(42f, -34f, 0f);
            var sun = sunObject.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.93f, 0.78f);
            sun.intensity = 0.96f;
            sun.shadows = LightShadows.Soft;
            sun.shadowStrength = 0.72f;
            RenderSettings.sun = sun;

            var fillObject = new GameObject("葉冠柔光");
            fillObject.transform.SetParent(parent, false);
            fillObject.transform.position = new Vector3(3.8f, 5.2f, 6.4f);
            var fill = fillObject.AddComponent<Light>();
            fill.type = LightType.Point;
            fill.color = new Color(0.80f, 0.82f, 0.74f);
            fill.intensity = 1.18f;
            fill.range = 24f;
            fill.shadows = LightShadows.None;
        }

        private static ParticleSystem[] CreateWaterfallMist(Transform world)
        {
            const string materialPath = "Assets/Art/Generated/Materials/生命樹_柔霧.mat";
            var shader = Shader.Find("樹伴/生命樹柔霧");
            if (shader == null) throw new InvalidOperationException("缺少瀑布柔霧著色器。");
            var material = AssetDatabase.LoadAssetAtPath<Material>(materialPath);
            if (material == null)
            {
                material = new Material(shader) { name = "生命樹_柔霧" };
                AssetDatabase.CreateAsset(material, materialPath);
            }
            var falls = world.GetComponentsInChildren<Renderer>(true)
                .Where(renderer => renderer.name.StartsWith("瀑布_", StringComparison.Ordinal)).ToArray();
            var result = new ParticleSystem[falls.Length];
            for (var index = 0; index < falls.Length; index++)
            {
                var bounds = falls[index].bounds;
                var item = new GameObject($"水霧_{index:00}");
                item.transform.SetParent(world, false);
                item.transform.position = new Vector3(bounds.center.x, bounds.min.y + .18f, bounds.center.z);
                item.transform.rotation = Quaternion.Euler(-90f, 0, 0);
                var mist = item.AddComponent<ParticleSystem>();
                mist.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
                mist.useAutoRandomSeed = false;
                mist.randomSeed = (uint)(2108 + index);
                var main = mist.main;
                main.loop = true;
                main.playOnAwake = true;
                main.startLifetime = new ParticleSystem.MinMaxCurve(1.5f, 3f);
                main.startSpeed = new ParticleSystem.MinMaxCurve(.12f, .30f);
                main.startSize = new ParticleSystem.MinMaxCurve(.55f, 1.15f);
                main.startColor = new Color(.80f, .90f, .97f, .24f);
                main.simulationSpace = ParticleSystemSimulationSpace.Local;
                main.maxParticles = 32;
                var emission = mist.emission;
                emission.rateOverTime = 9f;
                var shape = mist.shape;
                shape.shapeType = ParticleSystemShapeType.Cone;
                shape.angle = 40f;
                shape.radius = .22f;
                var color = mist.colorOverLifetime;
                color.enabled = true;
                var gradient = new Gradient();
                gradient.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(Color.white, 1) },
                    new[] { new GradientAlphaKey(0, 0), new GradientAlphaKey(1, .2f), new GradientAlphaKey(0, 1) });
                color.color = gradient;
                var renderer = item.GetComponent<ParticleSystemRenderer>();
                renderer.sharedMaterial = material;
                renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                renderer.receiveShadows = false;
                result[index] = mist;
            }
            return result;
        }

        private static Transform[] CreateCloudWorld(Transform parent, Camera camera)
        {
            var skyboxShader = Shader.Find("樹伴/雲境天空");
            if (skyboxShader != null)
            {
                const string skyPath = "Assets/Art/Generated/Materials/雲境_天空.mat";
                var skybox = AssetDatabase.LoadAssetAtPath<Material>(skyPath);
                if (skybox == null)
                {
                    skybox = new Material(skyboxShader) { name = "雲境_天空" };
                    AssetDatabase.CreateAsset(skybox, skyPath);
                }
                skybox.shader = skyboxShader;
                RenderSettings.skybox = skybox;
                EditorUtility.SetDirty(skybox);
            }
            var model = AssetDatabase.LoadAssetAtPath<GameObject>(CloudModelPath);
            var shader = Shader.Find("樹伴/雲境柔光雲");
            if (model == null || shader == null)
                throw new InvalidOperationException("缺少立體雲海模型或柔光材質。");
            const string materialPath = "Assets/Art/Generated/Materials/雲境_柔光雲.mat";
            var material = AssetDatabase.LoadAssetAtPath<Material>(materialPath);
            if (material == null)
            {
                material = new Material(shader) { name = "雲境_柔光雲" };
                AssetDatabase.CreateAsset(material, materialPath);
            }
            var cloudWorld = (GameObject)PrefabUtility.InstantiatePrefab(model);
            cloudWorld.name = "雲境_三維背景";
            cloudWorld.transform.SetParent(parent, false);
            var renderers = cloudWorld.GetComponentsInChildren<MeshRenderer>();
            if (renderers.Length != 9) throw new InvalidOperationException("立體雲團應為九組。");
            var variation = 0;
            foreach (var renderer in renderers)
            {
                // Keep Blender as the editable size/placement source. Render
                // density through its bounding volume, not a solid skin.
                var bounds = renderer.GetComponent<MeshFilter>().sharedMesh.bounds;
                renderer.enabled = false;
                var volume = GameObject.CreatePrimitive(PrimitiveType.Cube);
                volume.name = "雲層體積";
                volume.transform.SetParent(renderer.transform, false);
                volume.transform.localPosition = bounds.center;
                volume.transform.localScale = bounds.size;
                UnityEngine.Object.DestroyImmediate(volume.GetComponent<Collider>());
                var volumeRenderer = volume.GetComponent<MeshRenderer>();
                volumeRenderer.sharedMaterial = material;
                volumeRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                volumeRenderer.receiveShadows = false;
                volume.AddComponent<CloudVolumeAppearance>().Configure((variation++ + .5f) / 9);
                PlaceCloudBank(renderer.transform, volumeRenderer, camera);
            }
            camera.farClipPlane = 180f;
            return renderers.Select(renderer => renderer.transform).ToArray();
        }

        internal static void PlaceCloudBank(Transform bank, Renderer volume, Camera camera)
        {
            // Compose once in the authored hero view, then keep the resulting
            // world positions. They are NOT attached to the camera: orbiting
            // or entering the island still produces real parallax/occlusion.
            var layout = new[]
            {
                ("後景左", .12f, .62f, 45f), ("後景中", .54f, .30f, 47f),
                ("後景右", .90f, .56f, 45f), ("中景左", .03f, .28f, 32f),
                ("中景右", .97f, .27f, 33f), ("近景左", .16f, .10f, 25f),
                ("近景右", .86f, .10f, 26f), ("高空左", .15f, .90f, 60f),
                ("高空右", .90f, .87f, 65f),
            };
            var placement = layout.Single(item => bank.name.StartsWith("立體雲_" + item.Item1, StringComparison.Ordinal));
            var destination = camera.ViewportToWorldPoint(new Vector3(placement.Item2, placement.Item3, placement.Item4));
            bank.position += destination - volume.bounds.center;
        }
    }
}
