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
    public static class CloudExteriorSceneBuilder
    {
        private const string ScenePath = "Assets/Scenes/雲境外觀展示.unity";

        [MenuItem("樹伴/輸出世界樹外觀審查")]
        public static void Capture()
        {
            BuildScene();
            var state = UnityEngine.Object.FindFirstObjectByType<LifeTreeSceneController>();
            var controls = UnityEngine.Object.FindFirstObjectByType<LifeTreeWorldInteraction>();
            var atmosphere = UnityEngine.Object.FindFirstObjectByType<LifeTreeAtmosphereController>();
            state.ApplyState(new LifeTreeState { stageIndex = 5, reduceMotion = false });
            state.EvaluateWindAt(1.8f);
            atmosphere.EvaluateAt(1.8f);
            var output = Path.GetFullPath(Path.Combine(Application.dataPath,
                "../../../docs/leadership-evidence/screenshots/exterior-landform-2026-09-12"));
            foreach (var yaw in new[] { 0f, -35f, 35f })
            {
                controls.SetView(yaw, 1);
                LifeTreePreviewCapture.CaptureStill(Camera.main,
                    Path.Combine(output, $"世界樹外觀_{yaw:0}.png"), 1200, 1600);
            }
            controls.ResetView();
            LifeTreePreviewCapture.CaptureStill(Camera.main,
                Path.Combine(output, "世界樹橫幅.png"), 1600, 1000);
            LifeTreePreviewCapture.CaptureSequence(Camera.main, output, "水流連續實景", 600, 800, 4,
                frame => { state.EvaluateWindAt(1.8f + frame * .25f); atmosphere.EvaluateAt(1.8f + frame * .25f); });
            Debug.Log($"外觀審查實景：{output}");
        }

        public static void BuildScene()
        {
            LifeTreeSceneBuilder.Build();
            var play = UnityEngine.Object.FindFirstObjectByType<CloudGardenPlayController>();
            play.EnableLocalArtPreview();
            // Refresh imported mesh references in the historical local trial
            // without rebuilding its app or touching the user's saved layout.
            EditorSceneManager.SaveScene(SceneManager.GetActiveScene(), "Assets/Scenes/雲境本機試玩.unity");
            // Preserve the earlier experiment in its own scene and preserve
            // its local save. No construction UI or loading it in the showcase.
            play.enabled = false;
            play.gameObject.AddComponent<CloudExteriorPreview>();
            var camera = Camera.main;
            var target = new Vector3(0, .80f, 0);
            camera.transform.position = target + new Vector3(.23f, .43f, .87f).normalized * 24.5f;
            camera.transform.LookAt(target);
            if (RenderSettings.sun != null)
                RenderSettings.sun.transform.rotation = Quaternion.Euler(42f, 34f, 0f);
            foreach (var volume in UnityEngine.Object.FindObjectsByType<MeshRenderer>(FindObjectsSortMode.None))
                if (volume.name == "雲層體積")
                {
                    var bank = volume.transform.parent;
                    if (bank.name.Contains("後景中")) bank.localScale *= 2.6f;
                    else if (bank.name.Contains("後景左") || bank.name.Contains("後景右")) bank.localScale *= 1.6f;
                    LifeTreeSceneBuilder.PlaceCloudBank(volume.transform.parent, volume, camera);
                }
            CreateDistantClouds(camera);
            var air = UnityEngine.Object.FindFirstObjectByType<LifeTreeAtmosphereController>();
            air.Bind(camera, target);
            air.BindClouds(UnityEngine.Object.FindObjectsByType<MeshRenderer>(FindObjectsSortMode.None)
                .Where(item => item.name == "雲層體積").Select(item => item.transform.parent).ToArray());
            CreateDistantSea();
            EditorSceneManager.SaveScene(SceneManager.GetActiveScene(), ScenePath);
        }

        private static void CreateDistantClouds(Camera camera)
        {
            var template = UnityEngine.Object.FindObjectsByType<MeshRenderer>(FindObjectsSortMode.None)
                .First(item => item.name == "雲層體積" && item.transform.parent.name.Contains("高空左"));
            // Uneven banks with clear sky between them, not a row of identical
            // cloud icons. Positions are authored once in world space.
            var banks = new[]
            {
                new Vector4(-.06f,.76f,68f,2.2f), new Vector4(.10f,.81f,76f,1.5f),
                new Vector4(.25f,.78f,84f,2.5f), new Vector4(.69f,.79f,80f,2.0f),
                new Vector4(.89f,.75f,72f,2.9f), new Vector4(1.06f,.82f,82f,1.7f),
            };
            for (var i=0;i<banks.Length;i++)
            {
                var bank = UnityEngine.Object.Instantiate(template.transform.parent.gameObject,
                    template.transform.parent.parent);
                bank.name=$"遠景雲牆_{i:00}";
                bank.transform.localScale *= banks[i].w;
                var volume=bank.GetComponentsInChildren<MeshRenderer>().Single(item=>item.name=="雲層體積");
                volume.GetComponent<CloudVolumeAppearance>().Configure(Mathf.Repeat(i*.37f+.08f,1));
                bank.transform.position += camera.ViewportToWorldPoint(
                    new Vector3(banks[i].x,banks[i].y,banks[i].z)) - volume.bounds.center;
            }
        }

        private static void CreateDistantSea()
        {
            const int steps = 80;
            var vertices = new Vector3[(steps+1)*(steps+1)];
            var triangles = new int[steps*steps*6];
            for(var z=0;z<=steps;z++) for(var x=0;x<=steps;x++)
                vertices[z*(steps+1)+x] = new Vector3((x-steps/2f)*8, -26, (z-steps/2f)*8);
            var cursor=0;
            for(var z=0;z<steps;z++) for(var x=0;x<steps;x++)
            {
                var a=z*(steps+1)+x; var b=a+steps+1;
                triangles[cursor++]=a; triangles[cursor++]=b; triangles[cursor++]=a+1;
                triangles[cursor++]=a+1; triangles[cursor++]=b; triangles[cursor++]=b+1;
            }
            const string meshPath="Assets/Art/Generated/雲境遠海.asset";
            var mesh=AssetDatabase.LoadAssetAtPath<Mesh>(meshPath);
            if(mesh==null) { mesh=new Mesh { name="雲境遠海" }; AssetDatabase.CreateAsset(mesh,meshPath); }
            mesh.Clear(); mesh.vertices=vertices; mesh.triangles=triangles; mesh.RecalculateNormals(); mesh.RecalculateBounds();
            EditorUtility.SetDirty(mesh);
            const string materialPath="Assets/Art/Generated/Materials/雲境遠海.mat";
            var shader=Shader.Find("樹伴/雲境遠海");
            if(shader==null) throw new InvalidOperationException("缺少遠海材質");
            var material=AssetDatabase.LoadAssetAtPath<Material>(materialPath);
            if(material==null) { material=new Material(shader); AssetDatabase.CreateAsset(material,materialPath); }
            material.shader=shader; EditorUtility.SetDirty(material);
            var sea=new GameObject("雲境_遠海");
            sea.AddComponent<MeshFilter>().sharedMesh=mesh;
            var renderer=sea.AddComponent<MeshRenderer>(); renderer.sharedMaterial=material;
            renderer.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.Off;
            renderer.receiveShadows=false;
            AssetDatabase.SaveAssets();
        }

        [MenuItem("樹伴/建置世界樹外觀展示")]
        public static void BuildMac()
        {
            BuildScene();
            var path = Path.GetFullPath(Path.Combine(Application.dataPath, "../Builds/雲境外觀展示.app"));
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { ScenePath }, locationPathName = path,
                target = BuildTarget.StandaloneOSX, options = BuildOptions.Development,
            });
            if (report.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
                throw new InvalidOperationException("雲境外觀展示建置失敗。");
            Debug.Log($"雲境外觀展示已建置：{path}");
        }

        public static void Deliver()
        {
            Capture();
            BuildMac();
        }
    }
}
