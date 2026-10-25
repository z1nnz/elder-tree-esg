using UnityEngine;

namespace TreeCompanion.LifeTree
{
    [RequireComponent(typeof(MeshRenderer))]
    public sealed class CloudVolumeAppearance : MonoBehaviour
    {
        [SerializeField, Range(0,1)] private float variation;
        private void Awake() => Apply();
        public void Configure(float value) { variation = Mathf.Clamp01(value); Apply(); }
        private void Apply()
        {
            var renderer = GetComponent<MeshRenderer>();
            var properties = new MaterialPropertyBlock();
            renderer.GetPropertyBlock(properties);
            properties.SetFloat("_Seed", variation);
            renderer.SetPropertyBlock(properties);
        }
    }
}
