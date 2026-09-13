using NUnit.Framework;
using UnityEngine;

namespace TreeCompanion.Tests
{
    public sealed class CloudVolumeRenderingTests
    {
        [TestCase(false)]
        [TestCase(true)]
        public void VolumeHasDenseLowerBodyAndTransparentCorners(bool multipleVolumes)
        {
            var cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
            var cameraObject = new GameObject("雲密度驗證相機");
            GameObject second = null;
            var texture = new RenderTexture(64, 64, 24);
            var pixels = new Texture2D(64, 64, TextureFormat.RGBA32, false);
            var previous = RenderTexture.active;
            var material = new Material(Shader.Find("樹伴/雲境柔光雲"));
            var fog = RenderSettings.fog;
            try
            {
                cube.layer = 31;
                cube.transform.localScale = Vector3.one * 2;
                cube.GetComponent<Renderer>().sharedMaterial = material;
                if (multipleVolumes)
                {
                    cube.transform.position = new Vector3(-1.4f,0,0);
                    second = Object.Instantiate(cube);
                    second.transform.position = new Vector3(1.4f,0,0);
                    second.transform.rotation = Quaternion.Euler(0,35,0);
                }
                var camera = cameraObject.AddComponent<Camera>();
                camera.cullingMask = 1 << 31;
                camera.transform.position = new Vector3(0, 0, multipleVolumes ? -6 : -4);
                camera.fieldOfView = 45; camera.aspect = 1;
                camera.clearFlags = CameraClearFlags.SolidColor;
                camera.backgroundColor = Color.clear;
                camera.targetTexture = texture;
                RenderSettings.fog = false;
                camera.Render();
                RenderTexture.active = texture;
                pixels.ReadPixels(new Rect(0,0,64,64),0,0); pixels.Apply();
                if (multipleVolumes)
                {
                    Assert.That(pixels.GetPixel(14,27).r, Is.GreaterThan(.35f), "左方雲不應因合批消失");
                    Assert.That(pixels.GetPixel(50,27).r, Is.GreaterThan(.35f), "旋轉後的右方雲也應可見");
                }
                else
                {
                    Assert.That(pixels.GetPixel(32,25).r, Is.GreaterThan(.35f), "雲腹應有足夠密度");
                    Assert.That(pixels.GetPixel(32,32).r, Is.GreaterThan(.35f));
                }
                Assert.That(pixels.GetPixel(1,1).a, Is.LessThan(.05f), "包圍盒角落必須透明");
                if (!multipleVolumes)
                {
                    material.SetFloat("_Seed", .05f);
                    camera.Render();
                    pixels.ReadPixels(new Rect(0,0,64,64),0,0); pixels.Apply();
                    var lowBank = pixels.GetPixels();
                    material.SetFloat("_Seed", .95f);
                    camera.Render();
                    pixels.ReadPixels(new Rect(0,0,64,64),0,0); pixels.Apply();
                    var tower = pixels.GetPixels();
                    var silhouetteChanges = 0;
                    for (var index = 0; index < lowBank.Length; index++)
                        if ((lowBank[index].a > .4f) != (tower[index].a > .4f)) silhouetteChanges++;
                    Assert.That(silhouetteChanges, Is.GreaterThan(100), "雲形差異必須改變輪廓，而非僅改表面雜訊");
                }
            }
            finally
            {
                RenderSettings.fog = fog; RenderTexture.active = previous;
                Object.DestroyImmediate(cameraObject); Object.DestroyImmediate(cube);
                if (second != null) Object.DestroyImmediate(second);
                Object.DestroyImmediate(material); Object.DestroyImmediate(pixels);
                texture.Release(); Object.DestroyImmediate(texture);
            }
        }
    }
}
