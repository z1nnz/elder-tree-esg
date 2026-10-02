using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace TreeCompanion.LifeTree
{
    public sealed class CloudGardenPlayController : MonoBehaviour
    {
        private const string SaveKey = "tree-companion.cloud-garden.local.v1";
        [SerializeField] private Camera viewCamera;
        [SerializeField] private LifeTreeWorldInteraction interaction;
        [SerializeField] private LifeTreeAtmosphereController atmosphere;
        [SerializeField] private Transform[] plots;
        [SerializeField] private GameObject[] gardens;
        [SerializeField] private bool localArtPreview;
        private readonly string[] names = { "溪畔", "樹蔭", "望雲台" };
        private CloudGardenLayout layout = new CloudGardenLayout();
        private bool initialized, persist, inside, moving, restoring;
        private int selected;
        private Vector3 farPosition, fromPosition, toPosition;
        private Quaternion farRotation, fromRotation, toRotation;
        private float farYaw, farZoom, elapsed;
        private Text title, status;
        private Button enter, back, place, remove;
        private GameObject choices;

        public void Configure(Camera camera, LifeTreeWorldInteraction controls,
            LifeTreeAtmosphereController air, Transform[] sites, GameObject[] pieces)
        { viewCamera = camera; interaction = controls; atmosphere = air; plots = sites; gardens = pieces; }

        public void EnableLocalArtPreview() => localArtPreview = true;
        private void Start()
        {
            // Only the separate local preview scene opts into an unearned mature tree.
            if (localArtPreview)
                GetComponent<LifeTreeSceneController>().ApplyState(new LifeTreeState { stageIndex = 5 });
            Initialize(true);
        }

        private void OnDestroy()
        {
            if (font == null) return;
            if (Application.isPlaying) Destroy(font);
            else DestroyImmediate(font);
        }
        public void Initialize(bool saveLocally)
        {
            if (initialized) return;
            initialized = true;
            persist = saveLocally;
            if (persist)
            {
                layout.plantedMask = PlayerPrefs.GetInt(SaveKey, 0);
                if (!layout.IsValid) layout = new CloudGardenLayout();
            }
            CreateInterface();
            Refresh();
        }

        public void Enter()
        {
            if (inside || moving) return;
            farPosition = viewCamera.transform.position;
            farRotation = viewCamera.transform.rotation;
            farYaw = interaction.CurrentYaw;
            farZoom = interaction.CurrentZoom;
            atmosphere.PauseCameraMotion(true);
            interaction.enabled = false;
            interaction.SetView(farYaw, farZoom);
            viewCamera.transform.SetPositionAndRotation(farPosition, farRotation);
            inside = true;
            SelectPlot(selected);
            Focus(layout.IsPlanted(selected) ? remove : place);
        }

        public void SelectPlot(int plot)
        {
            if (!inside || plot < 0 || plot >= plots.Length) return;
            selected = plot;
            var target = plots[selected].position + Vector3.up * .25f;
            MoveCamera(target + new Vector3(2.5f, 2.8f, 4.4f),
                Quaternion.LookRotation(new Vector3(-2.5f, -2.8f, -4.4f)), false);
            Refresh();
        }

        public void Plant()
        {
            if (!inside || !layout.Plant(selected)) return;
            Save(); Refresh();
            Focus(remove);
        }
        public void Remove()
        {
            if (!inside || !layout.Remove(selected)) return;
            Save(); Refresh();
            Focus(place);
        }
        public void Exit()
        {
            if (!inside) return;
            inside = false;
            MoveCamera(farPosition, farRotation, true);
            Refresh();
            Focus(enter);
        }

        private void Save()
        {
            if (!persist) return;
            PlayerPrefs.SetInt(SaveKey, layout.plantedMask);
            PlayerPrefs.Save();
        }

        private void MoveCamera(Vector3 position, Quaternion rotation, bool restore)
        {
            fromPosition = viewCamera.transform.position;
            fromRotation = viewCamera.transform.rotation;
            toPosition = position; toRotation = rotation; elapsed = 0;
            restoring = restore; moving = true;
            if (atmosphere.ReducedMotion) EvaluateTransition(1);
        }
        public void EvaluateTransition(float progress)
        {
            if (!moving) return;
            var t = Mathf.SmoothStep(0, 1, Mathf.Clamp01(progress));
            viewCamera.transform.SetPositionAndRotation(Vector3.Lerp(fromPosition, toPosition, t),
                Quaternion.Slerp(fromRotation, toRotation, t));
            if (progress < 1) return;
            moving = false;
            if (restoring)
            {
                interaction.enabled = true;
                interaction.SetView(farYaw, farZoom);
                atmosphere.PauseCameraMotion(false);
            }
        }
        private void Update()
        {
            if (moving) { elapsed += Time.unscaledDeltaTime; EvaluateTransition(elapsed / .65f); }
            if (inside && Input.GetKeyDown(KeyCode.Escape)) Exit();
        }

        private void Refresh()
        {
            for (var i = 0; i < gardens.Length; i++) gardens[i].SetActive(layout.IsPlanted(i));
            title.text = inside ? names[selected] : "雲境";
            status.text = inside ? (layout.IsPlanted(selected) ? "晨光花圃已安放" : "安放一座晨光花圃") : "本機建設試玩";
            ((RectTransform)panel).sizeDelta = new Vector2(390, inside ? 174 : 120);
            title.rectTransform.anchoredPosition = new Vector2(24, inside ? 136 : 76);
            status.rectTransform.anchoredPosition = new Vector2(24, inside ? 110 : 48);
            enter.gameObject.SetActive(!inside); back.gameObject.SetActive(inside);
            choices.SetActive(inside); place.gameObject.SetActive(inside);
            remove.gameObject.SetActive(inside && layout.IsPlanted(selected));
            place.interactable = !layout.IsPlanted(selected);
            Canvas.ForceUpdateCanvases();
        }

        private Font font;
        private Transform panel;
        private void CreateInterface()
        {
            var root = new GameObject("雲境_建設介面", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = root.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceCamera; canvas.worldCamera = viewCamera;
            canvas.planeDistance = .5f;
            var scaler = root.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(390, 780);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.Expand;
            root.transform.SetParent(transform, false);
            if (FindFirstObjectByType<EventSystem>() == null)
                new GameObject("雲境_觸控事件", typeof(EventSystem), typeof(StandaloneInputModule)).transform.SetParent(transform, false);
            font = Font.CreateDynamicFontFromOSFont(new[] { "PingFang TC", "Noto Sans CJK TC", "Microsoft JhengHei" }, 22);
            panel = new GameObject("操作底板", typeof(RectTransform), typeof(Image)).transform;
            panel.SetParent(root.transform, false);
            var rect = (RectTransform)panel;
            rect.anchorMin = rect.anchorMax = new Vector2(.5f, 0);
            rect.pivot = new Vector2(.5f, 0); rect.sizeDelta = new Vector2(0, 220);
            panel.GetComponent<Image>().color = new Color(.98f, .985f, .95f, .96f);
            title = Label("雲境", new Vector2(24, 136), 22);
            status = Label("", new Vector2(24, 110), 14);
            enter = Button("走進雲境", new Vector2(170, 18), new Vector2(196, 52), Enter);
            back = Button("返回全景", new Vector2(257, 122), new Vector2(109, 48), Exit);
            choices = new GameObject("建設位置", typeof(RectTransform)); choices.transform.SetParent(panel, false);
            var choicesRect = (RectTransform)choices.transform;
            choicesRect.anchorMin = Vector2.zero; choicesRect.anchorMax = Vector2.one;
            choicesRect.offsetMin = choicesRect.offsetMax = Vector2.zero;
            for (var i = 0; i < 3; i++)
            {
                var index = i;
                var button = Button(names[i], new Vector2(24 + i * 116, 62), new Vector2(110, 48), () => SelectPlot(index));
                button.transform.SetParent(choices.transform, true);
            }
            place = Button("安放花圃", new Vector2(24, 8), new Vector2(224, 48), Plant);
            remove = Button("收回", new Vector2(258, 8), new Vector2(108, 48), Remove);
            Focus(enter);
        }

        private static void Focus(Button button)
        {
            // Editor still captures have no running input loop. Runtime focus
            // is established once the EventSystem has registered itself.
            if (EventSystem.current != null)
                EventSystem.current.SetSelectedGameObject(button.gameObject);
        }
        private Text Label(string value, Vector2 position, int size)
        {
            var obj = new GameObject(value, typeof(RectTransform), typeof(Text)); obj.transform.SetParent(panel, false);
            var rect = (RectTransform)obj.transform; rect.anchorMin = rect.anchorMax = Vector2.zero;
            rect.pivot = Vector2.zero; rect.anchoredPosition = position; rect.sizeDelta = new Vector2(342, 36);
            var text = obj.GetComponent<Text>(); text.font = font; text.fontSize = size; text.text = value;
            text.color = new Color(.06f,.22f,.15f); text.raycastTarget = false;
            return text;
        }
        private Button Button(string value, Vector2 position, Vector2 size, UnityEngine.Events.UnityAction action)
        {
            var obj = new GameObject(value, typeof(RectTransform), typeof(Image), typeof(Button)); obj.transform.SetParent(panel, false);
            var rect = (RectTransform)obj.transform; rect.anchorMin = rect.anchorMax = Vector2.zero;
            rect.pivot = Vector2.zero; rect.anchoredPosition = position; rect.sizeDelta = size;
            obj.GetComponent<Image>().color = new Color(.09f,.36f,.25f);
            var button = obj.GetComponent<Button>(); button.onClick.AddListener(action);
            var label = Label(value, Vector2.zero, 18); label.transform.SetParent(obj.transform, false);
            var labelRect = (RectTransform)label.transform; labelRect.anchorMin = Vector2.zero; labelRect.anchorMax = Vector2.one;
            labelRect.offsetMin = labelRect.offsetMax = Vector2.zero;
            label.alignment = TextAnchor.MiddleCenter; label.color = Color.white;
            return button;
        }
    }
}
