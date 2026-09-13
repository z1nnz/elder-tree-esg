using System.Linq;
using NUnit.Framework;
using UnityEngine;

namespace TreeCompanion.Tests
{
    public sealed class WaterFlowRenderingTests
    {
        [Test]
        public void RiverReachesTheLipWhileFallingWaterDissolves()
        {
            var river = RenderWater(true, 0, 1);
            var fall = RenderWater(false, 0, 1);
            var riverEnd = 0f; var fallEnd = 0f;
            for (var y = 58; y < 62; y++) for (var x = 20; x < 44; x++)
            { riverEnd += river[y * 64 + x].a; fallEnd += fall[y * 64 + x].a; }
            Assert.That(riverEnd / 96, Is.GreaterThan(.25f), "溪流末端不能套用瀑布消散遮罩");
            Assert.That(fallEnd / 96, Is.LessThan(.08f), "瀑布末端應消散而非硬切");
        }

        [Test]
        public void WaterFlowsAndReducedMotionFreezesItsSurface()
        {
            var start = RenderWater(false, 0, 1);
            var moving = RenderWater(false, .35f, 1);
            Assert.That(start.Zip(moving, (a,b) => Mathf.Abs(a.r-b.r)).Average(), Is.GreaterThan(.005f));
            var still = RenderWater(false, 0, 0);
            var later = RenderWater(false, 2, 0);
            Assert.That(still.Zip(later, (a,b) => Mathf.Abs(a.r-b.r)).Max(), Is.LessThan(.001f));
        }

        private static Color[] RenderWater(bool stream, float time, float amount)
        {
            var quad = GameObject.CreatePrimitive(PrimitiveType.Quad);
            var owner = new GameObject("水流材質驗證相機");
            var material = new Material(Shader.Find("樹伴/生命樹瀑布流動"));
            var texture = new RenderTexture(64,64,24);
            var image = new Texture2D(64,64,TextureFormat.RGBA32,false);
            var previous = RenderTexture.active;
            var fog = RenderSettings.fog;
            var previousTime = Shader.GetGlobalFloat("_LifeTreeMotionTime");
            var previousAmount = Shader.GetGlobalFloat("_LifeTreeMotionAmount");
            try
            {
                quad.layer = 29; quad.transform.localScale = Vector3.one * 2;
                quad.GetComponent<Renderer>().sharedMaterial = material;
                material.SetFloat("_IsStream", stream ? 1 : 0);
                material.SetFloat("_Opacity", .85f);
                Shader.SetGlobalFloat("_LifeTreeMotionTime", time);
                Shader.SetGlobalFloat("_LifeTreeMotionAmount", amount);
                var camera = owner.AddComponent<Camera>();
                camera.cullingMask = 1 << 29;
                camera.transform.position = new Vector3(0,0,-3);
                camera.orthographic = true; camera.orthographicSize = 1; camera.aspect = 1;
                camera.clearFlags = CameraClearFlags.SolidColor; camera.backgroundColor = Color.clear;
                camera.targetTexture = texture; RenderSettings.fog = false;
                camera.Render(); RenderTexture.active = texture;
                image.ReadPixels(new Rect(0,0,64,64),0,0); image.Apply();
                return image.GetPixels();
            }
            finally
            {
                Shader.SetGlobalFloat("_LifeTreeMotionTime", previousTime);
                Shader.SetGlobalFloat("_LifeTreeMotionAmount", previousAmount);
                RenderSettings.fog = fog; RenderTexture.active = previous;
                Object.DestroyImmediate(owner); Object.DestroyImmediate(quad);
                Object.DestroyImmediate(material); Object.DestroyImmediate(image);
                texture.Release(); Object.DestroyImmediate(texture);
            }
        }
    }
}
