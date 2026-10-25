using UnityEngine;

namespace TreeCompanion.LifeTree
{
    /// <summary>Only attached to the separate art showcase, never the earned-growth scene.</summary>
    public sealed class CloudExteriorPreview : MonoBehaviour
    {
        private void Start()
        {
            GetComponent<LifeTreeSceneController>().ApplyState(
                new LifeTreeState { stageIndex = 5, reduceMotion = false });
        }
    }
}
