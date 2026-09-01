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
        private const string BackgroundPath = "Assets/Art/Backgrounds/生命樹浮島世界_遠景背景_v1.png";
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
            var bridge = controllerObject.AddComponent<LifeTreeBridge>();
            bridge.Configure(controller);

            var camera = CreateCamera(environment.transform, worldModel.transform);
            var atmosphere = controllerObject.AddComponent<LifeTreeAtmosphereController>();
            atmosphere.Bind(
                camera,
                camera.transform.position + camera.transform.forward * 20f
            );
            controller.ConfigureAtmosphere(atmosphere);
            CreateLighting(environment.transform);
            CreateBackdrop(environment.transform, camera);

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
            Debug.Log("生命樹混合浮島世界已建立：三維主樹、1 座中央島、2 道近景瀑布與原創遠景背景。目標更新率為每秒 30 幀。");
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
                Mathf.Max(verticalDistance * 1.18f, horizontalDistance * 0.78f)
            );
            // Blender's authored front (-Y) becomes Unity's +Z after FBX
            // conversion. View from that side so the two cliff waterfalls and
            // the warm bark ridges remain visible in the hero composition.
            var viewDirection = new Vector3(0.49f, 0.34f, 0.80f).normalized;
            var target = contentBounds.center + Vector3.up * contentBounds.extents.y * 0.15f;
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
            var foliageTexture = AssetDatabase.LoadAssetAtPath<Texture2D>(FoliageTexturePath);
            if (foliageTexture == null)
            {
                throw new InvalidOperationException($"找不到生命樹葉簇貼圖：{FoliageTexturePath}");
            }
            var shader = Shader.Find("Standard") ?? Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null)
            {
                throw new InvalidOperationException("找不到生命樹樹皮需要的光照著色器。");
            }
            var foliageShader = Shader.Find("樹伴/生命樹葉簇裁切");
            if (foliageShader == null)
            {
                throw new InvalidOperationException("找不到生命樹葉簇裁切著色器。");
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
            foliageMaterial.mainTexture = foliageTexture;
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
            foliageMaterial.SetOverrideTag("RenderType", "TransparentCutout");
            foliageMaterial.renderQueue = 2450;

            var barkPrefixes = new[]
            {
                "主幹",
                "主枝_",
                "次枝_",
                "末梢枝_",
                "樹根_",
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
                    || current.name.StartsWith("雲朵_", StringComparison.Ordinal))
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

            var islandRendererCount = 0;
            var rockRendererCount = 0;
            foreach (var renderer in worldRoot.GetComponentsInChildren<Renderer>(true))
            {
                if (renderer.name.StartsWith("浮島_", StringComparison.Ordinal)
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
            if (islandRendererCount != 1 || rockRendererCount != 5)
            {
                throw new InvalidOperationException(
                    $"浮島材質節點數量錯誤：中央島 {islandRendererCount}，島岩 {rockRendererCount}。"
                );
            }
            EditorUtility.SetDirty(islandMaterial);
            EditorUtility.SetDirty(rockMaterial);
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
            material.SetFloat("_FlowSpeed", 0.42f);
            material.SetFloat("_FlowScale", 2.8f);
            material.SetFloat("_Opacity", 0.58f);
            material.renderQueue = 3000;

            var rendererCount = 0;
            foreach (var renderer in worldRoot.GetComponentsInChildren<Renderer>(true))
            {
                if (renderer.name.StartsWith("瀑布_", StringComparison.Ordinal)
                    || renderer.name.StartsWith("水沫內光_", StringComparison.Ordinal))
                {
                    renderer.sharedMaterial = material;
                    renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                    renderer.receiveShadows = false;
                    rendererCount++;
                }
            }
            if (rendererCount != 4)
            {
                throw new InvalidOperationException(
                    $"瀑布流光材質應套用至 4 個水流渲染器，實際為 {rendererCount}。"
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

        private static void CreateBackdrop(Transform parent, Camera camera)
        {
            var skyboxShader = Shader.Find("Skybox/Procedural");
            if (skyboxShader != null)
            {
                var skybox = new Material(skyboxShader) { name = "浮島天空_執行時材質" };
                skybox.SetColor("_SkyTint", new Color(0.18f, 0.50f, 0.82f));
                skybox.SetColor("_GroundColor", new Color(0.13f, 0.32f, 0.42f));
                skybox.SetFloat("_AtmosphereThickness", 0.78f);
                skybox.SetFloat("_Exposure", 1.12f);
                RenderSettings.skybox = skybox;
            }

            var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(BackgroundPath);
            if (texture == null)
            {
                throw new InvalidOperationException($"找不到生命樹遠景背景：{BackgroundPath}");
            }

            var shader = Shader.Find("Unlit/Texture");
            if (shader == null)
            {
                throw new InvalidOperationException("找不到遠景背景需要的 Unlit/Texture 著色器。");
            }

            var backdrop = GameObject.CreatePrimitive(PrimitiveType.Quad);
            backdrop.name = "浮島世界_原創遠景背景";
            backdrop.transform.SetParent(camera.transform, false);
            const float plateDistance = 60f;
            var plateHeight = 2f * plateDistance
                * Mathf.Tan(camera.fieldOfView * 0.5f * Mathf.Deg2Rad);
            var plateWidth = plateHeight * camera.aspect;
            backdrop.transform.localPosition = new Vector3(0f, 0f, plateDistance);
            backdrop.transform.localRotation = Quaternion.identity;
            backdrop.transform.localScale = new Vector3(plateWidth, plateHeight, 1f);

            var renderer = backdrop.GetComponent<MeshRenderer>();
            var material = new Material(shader)
            {
                name = "浮島世界_遠景背景材質",
                mainTexture = texture,
            };
            renderer.sharedMaterial = material;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            renderer.receiveShadows = false;
            renderer.lightProbeUsage = UnityEngine.Rendering.LightProbeUsage.Off;
            renderer.reflectionProbeUsage = UnityEngine.Rendering.ReflectionProbeUsage.Off;

            var collider = backdrop.GetComponent<Collider>();
            UnityEngine.Object.DestroyImmediate(collider);
        }
    }
}
