using UnityEngine;

namespace TreeCompanion.LifeTree
{
    public sealed class LifeTreeBridge : MonoBehaviour
    {
        private const string AndroidStateExtra = "tree-companion.life-tree-state";

        [SerializeField] private LifeTreeSceneController sceneController;

#if UNITY_ANDROID && !UNITY_EDITOR
        private string lastAppliedAndroidState;
#endif

        public void Configure(LifeTreeSceneController controller)
        {
            sceneController = controller;
        }

        public void ApplyStateJson(string json)
        {
            if (sceneController == null)
            {
                Debug.LogError("生命樹場景控制器尚未就緒。");
                return;
            }

            if (!LifeTreeState.TryParse(json, out var state, out var error))
            {
                Debug.LogWarning($"未套用生命樹資料：{error}");
                return;
            }

            sceneController.ApplyState(state);
        }

#if UNITY_ANDROID && !UNITY_EDITOR
        private void Start()
        {
            ApplyAndroidLaunchState();
        }

        private void OnApplicationFocus(bool hasFocus)
        {
            if (hasFocus)
            {
                ApplyAndroidLaunchState();
            }
        }

        private void ApplyAndroidLaunchState()
        {
            using var unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
            using var activity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity");
            using var intent = activity?.Call<AndroidJavaObject>("getIntent");
            var state = intent?.Call<string>("getStringExtra", AndroidStateExtra);
            if (string.IsNullOrWhiteSpace(state) || state == lastAppliedAndroidState)
            {
                return;
            }

            lastAppliedAndroidState = state;
            ApplyStateJson(state);
        }
#endif
    }
}
