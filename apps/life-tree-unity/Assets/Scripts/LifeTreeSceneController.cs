using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace TreeCompanion.LifeTree
{
    public sealed class LifeTreeSceneController : MonoBehaviour
    {
        private sealed class MotionPart
        {
            public Transform Transform;
            public Quaternion BaseRotation;
            public float Phase;
            public float Amplitude;
        }

        [SerializeField] private Transform treeRoot;
        [SerializeField] private Transform[] growthStages = Array.Empty<Transform>();
        [SerializeField] private LifeTreeAtmosphereController atmosphereController;
        [SerializeField] private float windFrequency = 0.34f;
        [SerializeField] private float branchAmplitude = 0.42f;

        private readonly List<Transform> branches = new List<Transform>();
        private readonly List<Transform> backLeaves = new List<Transform>();
        private readonly List<Transform> frontLeaves = new List<Transform>();
        private readonly Transform[] keepsakeSockets = new Transform[LifeTreeState.KeepsakeSlotCount];
        private readonly List<MotionPart> motionParts = new List<MotionPart>();
        private readonly List<GameObject> keepsakeObjects = new List<GameObject>();
        private LifeTreeState currentState = new LifeTreeState();
        private Vector3 authoredScale = Vector3.one;
        private bool hasBoundHierarchy;

        public void BindGrowthStages(Transform[] stages)
        {
            if (stages == null || stages.Length != LifeTreeState.MaximumStageIndex + 1 ||
                stages.Any(stage => stage == null) || stages.Distinct().Count() != stages.Length)
            {
                throw new ArgumentException("生命樹需要六個不同的生長造型節點。", nameof(stages));
            }
            growthStages = stages;
            ApplyState(currentState);
        }

        public void ConfigureAtmosphere(LifeTreeAtmosphereController atmosphere)
        {
            atmosphereController = atmosphere;
            atmosphereController?.ApplyMotionPreference(currentState.reduceMotion);
        }

        public void BindHierarchy(Transform root)
        {
            treeRoot = root;
            authoredScale = root.localScale;
            branches.Clear();
            backLeaves.Clear();
            frontLeaves.Clear();
            motionParts.Clear();
            Array.Clear(keepsakeSockets, 0, keepsakeSockets.Length);

            foreach (var item in treeRoot.GetComponentsInChildren<Transform>(true))
            {
                if (item.name.StartsWith("主枝_", StringComparison.Ordinal))
                {
                    branches.Add(item);
                }
                else if (item.name.StartsWith("後景葉簇_", StringComparison.Ordinal))
                {
                    backLeaves.Add(item);
                }
                else if (item.name.StartsWith("前景葉簇_", StringComparison.Ordinal))
                {
                    frontLeaves.Add(item);
                }
                else if (item.name.StartsWith("紀念掛點_", StringComparison.Ordinal) &&
                         int.TryParse(item.name.Substring("紀念掛點_".Length), out var oneBasedIndex))
                {
                    var slotIndex = oneBasedIndex - 1;
                    if (slotIndex >= 0 && slotIndex < keepsakeSockets.Length)
                    {
                        keepsakeSockets[slotIndex] = item;
                    }
                }
            }

            branches.Sort(CompareByName);
            backLeaves.Sort(CompareByName);
            frontLeaves.Sort(CompareByName);

            AddMotionParts(branches, branchAmplitude, 0.17f);
            hasBoundHierarchy = true;
            ApplyState(currentState);
        }

        public void ApplyState(LifeTreeState state)
        {
            if (state == null)
            {
                Debug.LogWarning("未套用生命樹資料：狀態不可為空。");
                return;
            }

            if (!state.Validate(out var error))
            {
                Debug.LogWarning($"未套用生命樹資料：{error}");
                return;
            }

            currentState = state;
            if (!hasBoundHierarchy || treeRoot == null)
            {
                return;
            }

            ApplyStage(state.stageIndex);
            RebuildKeepsakes(state.keepsakes);

            if (state.reduceMotion)
            {
                RestoreBaseRotations();
            }
            atmosphereController?.ApplyMotionPreference(state.reduceMotion);
        }

        private void Awake()
        {
            QualitySettings.vSyncCount = 0;
            Application.targetFrameRate = 30;
            if (treeRoot != null)
            {
                BindHierarchy(treeRoot);
            }
        }

        private void OnDisable()
        {
            RestoreBaseRotations();
        }

        private void Update()
        {
            EvaluateWindAt(Time.unscaledTime);
        }

        public void EvaluateWindAt(float sampleTime)
        {
            if (!hasBoundHierarchy || !isActiveAndEnabled)
            {
                return;
            }

            if (currentState.reduceMotion)
            {
                RestoreBaseRotations();
                return;
            }

            var time = sampleTime * windFrequency;
            foreach (var part in motionParts)
            {
                if (part.Transform == null || !part.Transform.gameObject.activeInHierarchy)
                {
                    continue;
                }

                var wave = Mathf.Sin((time + part.Phase) * Mathf.PI * 2f);
                var roll = Mathf.Sin((time * 0.63f + part.Phase) * Mathf.PI * 2f) * 0.28f;
                part.Transform.localRotation = part.BaseRotation * Quaternion.Euler(0f, wave * part.Amplitude, roll * part.Amplitude);
            }
        }

        private void ApplyStage(int stageIndex)
        {
            // Stage geometry is authored in Blender. Never shrink a mature
            // crown into a seed. A stage change only follows validated state.
            treeRoot.localScale = authoredScale;
            for (var stage = 0; stage < growthStages.Length; stage++)
            {
                if (growthStages[stage] != null)
                    growthStages[stage].gameObject.SetActive(stage == stageIndex);
            }
            SetVisibleCount(branches, branches.Count);
            SetVisibleCount(backLeaves, backLeaves.Count);
            SetVisibleCount(frontLeaves, frontLeaves.Count);
        }

        private void RebuildKeepsakes(IEnumerable<LifeTreeKeepsake> keepsakes)
        {
            foreach (var item in keepsakeObjects)
            {
                if (item != null)
                {
                    Destroy(item);
                }
            }
            keepsakeObjects.Clear();

            foreach (var keepsake in keepsakes ?? Enumerable.Empty<LifeTreeKeepsake>())
            {
                var socket = keepsakeSockets[keepsake.slotIndex];
                if (socket == null)
                {
                    Debug.LogWarning($"找不到紀念物掛點：{keepsake.slotIndex}。");
                    continue;
                }

                var keepsakeObject = CreateKeepsakePlaceholder(keepsake);
                keepsakeObject.transform.SetParent(socket, false);
                keepsakeObjects.Add(keepsakeObject);
            }
        }

        private static GameObject CreateKeepsakePlaceholder(LifeTreeKeepsake keepsake)
        {
            var item = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            item.name = $"紀念物_{keepsake.id}";
            item.transform.localPosition = Vector3.zero;
            item.transform.localRotation = Quaternion.identity;
            item.transform.localScale = keepsake.kind == "公益葉"
                ? new Vector3(0.10f, 0.18f, 0.055f)
                : new Vector3(0.13f, 0.13f, 0.13f);

            if (item.TryGetComponent<Collider>(out var collider))
            {
                Destroy(collider);
            }

            if (item.TryGetComponent<Renderer>(out var renderer) && ColorUtility.TryParseHtmlString(keepsake.color, out var color))
            {
                var shader = Shader.Find("Standard") ?? Shader.Find("Universal Render Pipeline/Lit");
                if (shader != null)
                {
                    renderer.material = new Material(shader) { color = color };
                }
            }

            return item;
        }

        private void AddMotionParts(IEnumerable<Transform> items, float amplitude, float phaseStep)
        {
            var index = 0;
            foreach (var item in items)
            {
                motionParts.Add(new MotionPart
                {
                    Transform = item,
                    BaseRotation = item.localRotation,
                    Phase = (index * phaseStep) % 1f,
                    Amplitude = amplitude * (0.82f + (index % 4) * 0.06f),
                });
                index++;
            }
        }

        private void RestoreBaseRotations()
        {
            foreach (var part in motionParts)
            {
                if (part.Transform != null)
                {
                    part.Transform.localRotation = part.BaseRotation;
                }
            }
        }

        private static void SetVisibleCount(IReadOnlyList<Transform> items, int count)
        {
            for (var index = 0; index < items.Count; index++)
            {
                items[index].gameObject.SetActive(index < count);
            }
        }

        private static int CompareByName(Transform left, Transform right) =>
            string.Compare(left.name, right.name, StringComparison.Ordinal);
    }
}
