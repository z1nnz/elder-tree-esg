using System;
using System.IO;
using UnityEngine;

namespace TreeCompanion.Editor
{
    /// <summary>
    /// Owns the editor-only render/readback lifecycle used by visual evidence.
    /// Keeping it separate prevents scene construction from accumulating image
    /// encoding and temporary-buffer responsibilities.
    /// </summary>
    public static class LifeTreePreviewCapture
    {
        public static void CaptureStill(
            Camera camera,
            string outputPath,
            int width,
            int height
        )
        {
            Directory.CreateDirectory(Path.GetDirectoryName(outputPath));
            using var capture = new FrameCapture(camera, width, height);
            File.WriteAllBytes(outputPath, capture.RenderPng());
        }

        public static void CaptureSequence(
            Camera camera,
            string outputDirectory,
            string filePrefix,
            int width,
            int height,
            int frameCount,
            Action<int> prepareFrame
        )
        {
            Directory.CreateDirectory(outputDirectory);
            using var capture = new FrameCapture(camera, width, height);
            for (var frame = 0; frame < frameCount; frame++)
            {
                prepareFrame(frame);
                File.WriteAllBytes(
                    Path.Combine(outputDirectory, $"{filePrefix}_{frame:D3}.png"),
                    capture.RenderPng()
                );
            }
        }

        private sealed class FrameCapture : IDisposable
        {
            private readonly Camera camera;
            private readonly RenderTexture renderTexture;
            private readonly Texture2D image;
            private readonly RenderTexture previousActive;

            public FrameCapture(Camera camera, int width, int height)
            {
                this.camera = camera ?? throw new ArgumentNullException(nameof(camera));
                renderTexture = new RenderTexture(
                    width,
                    height,
                    24,
                    RenderTextureFormat.ARGB32
                );
                image = new Texture2D(width, height, TextureFormat.RGBA32, false);
                previousActive = RenderTexture.active;
                camera.targetTexture = renderTexture;
            }

            public byte[] RenderPng()
            {
                camera.Render();
                RenderTexture.active = renderTexture;
                image.ReadPixels(
                    new Rect(0f, 0f, renderTexture.width, renderTexture.height),
                    0,
                    0
                );
                image.Apply(false);
                return image.EncodeToPNG();
            }

            public void Dispose()
            {
                camera.targetTexture = null;
                RenderTexture.active = previousActive;
                UnityEngine.Object.DestroyImmediate(image);
                UnityEngine.Object.DestroyImmediate(renderTexture);
            }
        }
    }
}
