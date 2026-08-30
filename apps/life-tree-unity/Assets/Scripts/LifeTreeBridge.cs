using UnityEngine;

namespace TreeCompanion.LifeTree
{
    public sealed class LifeTreeBridge : MonoBehaviour
    {
        [SerializeField] private LifeTreeSceneController sceneController;

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
    }
}
