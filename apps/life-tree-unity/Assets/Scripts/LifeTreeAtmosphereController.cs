using UnityEngine;

namespace TreeCompanion.LifeTree
{
    public sealed class LifeTreeAtmosphereController : MonoBehaviour
    {
        private static readonly int MotionTimeId = Shader.PropertyToID("_LifeTreeMotionTime");
        private static readonly int MotionAmountId = Shader.PropertyToID("_LifeTreeMotionAmount");

        [SerializeField] private Camera sceneCamera;
        [SerializeField] private ParticleSystem[] waterfallMist = System.Array.Empty<ParticleSystem>();
        [SerializeField] private Transform[] clouds = System.Array.Empty<Transform>();
        [SerializeField] private Vector3[] cloudPositions = System.Array.Empty<Vector3>();
        [SerializeField] private float orbitDegrees = 0.72f;
        [SerializeField] private float orbitFrequency = 0.035f;
        [SerializeField] private float verticalBreath = 0.045f;

        private Vector3 orbitTarget;
        private Vector3 authoredCameraPosition;
        private Quaternion authoredCameraRotation;
        private bool hasBoundCamera;
        private bool reduceMotion;
        private bool cameraMotionPaused;
        public bool ReducedMotion => reduceMotion;

        private void Awake()
        {
            if (sceneCamera != null)
                Bind(sceneCamera, sceneCamera.transform.position + sceneCamera.transform.forward * 20f);
        }

        public void PauseCameraMotion(bool paused) => cameraMotionPaused = paused;

        public void BindClouds(Transform[] items)
        {
            clouds = items ?? System.Array.Empty<Transform>();
            cloudPositions = new Vector3[clouds.Length];
            for (var i = 0; i < clouds.Length; i++)
                if (clouds[i] != null) cloudPositions[i] = clouds[i].localPosition;
        }

        private void EvaluateClouds(float time, bool reset)
        {
            for (var i = 0; i < clouds.Length && i < cloudPositions.Length; i++)
                if (clouds[i] != null)
                {
                    var offset = reset ? Vector3.zero : new Vector3(
                        Mathf.Sin(time * .035f + i) * .35f, 0,
                        Mathf.Sin(time * .021f + i * 1.3f) * .15f);
                    // FBX parents may carry 100x unit conversion. Motion is authored
                    // in world metres, never in the imported mesh's local units.
                    if (clouds[i].parent != null) offset = clouds[i].parent.InverseTransformVector(offset);
                    clouds[i].localPosition = cloudPositions[i] + offset;
                }
        }

        public void BindWaterfallMist(ParticleSystem[] mist)
        {
            waterfallMist = mist ?? System.Array.Empty<ParticleSystem>();
            ApplyMistPreference();
        }

        private void ApplyMistPreference()
        {
            foreach (var mist in waterfallMist)
            {
                if (mist == null) continue;
                if (reduceMotion) mist.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
                else if (Application.isPlaying && !mist.isPlaying) mist.Play();
            }
        }

        public void Bind(Camera camera, Vector3 target)
        {
            sceneCamera = camera;
            orbitTarget = target;
            authoredCameraPosition = camera.transform.position;
            authoredCameraRotation = camera.transform.rotation;
            hasBoundCamera = true;
            ApplyShaderMotion(0f, reduceMotion ? 0f : 1f);
        }

        public void ApplyMotionPreference(bool shouldReduceMotion)
        {
            reduceMotion = shouldReduceMotion;
            ApplyMistPreference();
            if (reduceMotion)
            {
                EvaluateClouds(0, true);
                if (!cameraMotionPaused) RestoreAuthoredCameraPose();
                ApplyShaderMotion(0f, 0f);
            }
        }

        public void EvaluateAt(float sampleTime)
        {
            if (!hasBoundCamera || sceneCamera == null || !isActiveAndEnabled)
            {
                return;
            }

            if (reduceMotion)
            {
                if (!cameraMotionPaused) RestoreAuthoredCameraPose();
                ApplyShaderMotion(0f, 0f);
                return;
            }

            var cycle = sampleTime * orbitFrequency * Mathf.PI * 2f;
            EvaluateClouds(sampleTime, false);
            var yaw = Mathf.Sin(cycle) * orbitDegrees;
            var lift = Mathf.Sin(cycle * 0.63f + 0.8f) * verticalBreath;
            var offset = authoredCameraPosition - orbitTarget;
            var orbitRotation = Quaternion.AngleAxis(yaw, Vector3.up);
            if (!cameraMotionPaused)
            {
                sceneCamera.transform.position = orbitTarget + orbitRotation * offset + Vector3.up * lift;
                sceneCamera.transform.rotation = Quaternion.LookRotation(
                    orbitTarget - sceneCamera.transform.position, Vector3.up);
            }
            ApplyShaderMotion(sampleTime, 1f);
            if (!Application.isPlaying)
            {
                // Deterministic editor evidence; runtime uses normal playback.
                foreach (var mist in waterfallMist)
                    if (mist != null) mist.Simulate(sampleTime + 2f, true, true, false);
            }
        }

        private void Update()
        {
            EvaluateAt(Time.unscaledTime);
        }

        private void OnDisable()
        {
            EvaluateClouds(0, true);
            foreach (var mist in waterfallMist)
                if (mist != null) mist.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            RestoreAuthoredCameraPose();
            ApplyShaderMotion(0f, 0f);
        }

        private void RestoreAuthoredCameraPose()
        {
            if (!hasBoundCamera || sceneCamera == null)
            {
                return;
            }

            sceneCamera.transform.position = authoredCameraPosition;
            sceneCamera.transform.rotation = authoredCameraRotation;
        }

        private static void ApplyShaderMotion(float sampleTime, float amount)
        {
            Shader.SetGlobalFloat(MotionTimeId, sampleTime);
            Shader.SetGlobalFloat(MotionAmountId, amount);
        }
    }
}
