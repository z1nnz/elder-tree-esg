using UnityEngine;

namespace TreeCompanion.LifeTree
{
    public sealed class LifeTreeAtmosphereController : MonoBehaviour
    {
        private static readonly int MotionTimeId = Shader.PropertyToID("_LifeTreeMotionTime");
        private static readonly int MotionAmountId = Shader.PropertyToID("_LifeTreeMotionAmount");

        [SerializeField] private Camera sceneCamera;
        [SerializeField] private float orbitDegrees = 0.72f;
        [SerializeField] private float orbitFrequency = 0.035f;
        [SerializeField] private float verticalBreath = 0.045f;

        private Vector3 orbitTarget;
        private Vector3 authoredCameraPosition;
        private Quaternion authoredCameraRotation;
        private bool hasBoundCamera;
        private bool reduceMotion;

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
            if (reduceMotion)
            {
                RestoreAuthoredCameraPose();
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
                RestoreAuthoredCameraPose();
                ApplyShaderMotion(0f, 0f);
                return;
            }

            var cycle = sampleTime * orbitFrequency * Mathf.PI * 2f;
            var yaw = Mathf.Sin(cycle) * orbitDegrees;
            var lift = Mathf.Sin(cycle * 0.63f + 0.8f) * verticalBreath;
            var offset = authoredCameraPosition - orbitTarget;
            var orbitRotation = Quaternion.AngleAxis(yaw, Vector3.up);
            sceneCamera.transform.position = orbitTarget + orbitRotation * offset + Vector3.up * lift;
            sceneCamera.transform.rotation = Quaternion.LookRotation(
                orbitTarget - sceneCamera.transform.position,
                Vector3.up
            );
            ApplyShaderMotion(sampleTime, 1f);
        }

        private void Update()
        {
            EvaluateAt(Time.unscaledTime);
        }

        private void OnDisable()
        {
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
