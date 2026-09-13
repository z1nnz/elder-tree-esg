using UnityEngine;

namespace TreeCompanion.LifeTree
{
    /// <summary>Bounded scene inspection; never changes GPS or earned growth.</summary>
    public sealed class LifeTreeWorldInteraction : MonoBehaviour
    {
        [SerializeField] private Transform world;
        [SerializeField] private Camera viewCamera;
        [SerializeField] private Transform backdrop;
        private Quaternion restingRotation;
        private float restingFieldOfView;
        private float yaw;
        private float zoom = 1f;
        private int previousTouchCount;
        private float previousPinchDistance;
        private Vector2 previousMouse;
        private bool mouseDragging;
        public float CurrentYaw => yaw;
        public float CurrentZoom => zoom;

        public void Configure(Transform sceneWorld, Camera camera, Transform background)
        {
            world = sceneWorld;
            viewCamera = camera;
            backdrop = background;
            restingRotation = world.localRotation;
            restingFieldOfView = camera.fieldOfView;
        }

        private void Awake()
        {
            if (world != null && viewCamera != null)
                Configure(world, viewCamera, backdrop);
        }

        public void SetView(float requestedYaw, float requestedZoom)
        {
            if (world == null || viewCamera == null) return;
            yaw = Mathf.Clamp(requestedYaw, -70f, 70f);
            zoom = Mathf.Clamp(requestedZoom, .80f, 1.35f);
            world.localRotation = Quaternion.AngleAxis(yaw, Vector3.up) * restingRotation;
            viewCamera.fieldOfView = restingFieldOfView / zoom;
            // The atmospheric plate follows the camera, not the island. Keep
            // full coverage when zooming out instead of exposing its corners.
            if (backdrop != null)
            {
                var height = 2f * backdrop.localPosition.z * Mathf.Tan(viewCamera.fieldOfView * .5f * Mathf.Deg2Rad);
                backdrop.localScale = new Vector3(height * viewCamera.aspect, height, 1f);
            }
        }

        public void ResetView() => SetView(0f, 1f);

        private void Update()
        {
            if (world == null || viewCamera == null) return;
            if (UnityEngine.EventSystems.EventSystem.current != null &&
                (UnityEngine.EventSystems.EventSystem.current.IsPointerOverGameObject() ||
                 (Input.touchCount > 0 && UnityEngine.EventSystems.EventSystem.current.IsPointerOverGameObject(Input.GetTouch(0).fingerId)))) return;
            var count = Input.touchCount;
            if (count > 0)
            {
                mouseDragging = false;
                if (count == 1)
                {
                    var touch = Input.GetTouch(0);
                    if (touch.phase == TouchPhase.Began && touch.tapCount == 2) ResetView();
                    else if (previousTouchCount == 1 && touch.phase == TouchPhase.Moved)
                        SetView(yaw - touch.deltaPosition.x / Mathf.Max(1, Screen.width) * 140f, zoom);
                }
                else if (count == 2)
                {
                    var distance = Vector2.Distance(Input.GetTouch(0).position, Input.GetTouch(1).position);
                    if (previousTouchCount == 2 && previousPinchDistance > 1f)
                        SetView(yaw, zoom * distance / previousPinchDistance);
                    previousPinchDistance = distance;
                }
                previousTouchCount = count;
                return;
            }
            previousTouchCount = 0;
            if (Input.GetMouseButtonDown(0))
            {
                mouseDragging = true;
                previousMouse = Input.mousePosition;
            }
            if (Input.GetMouseButtonUp(0)) mouseDragging = false;
            if (mouseDragging && Input.GetMouseButton(0))
            {
                Vector2 current = Input.mousePosition;
                SetView(yaw - (current.x - previousMouse.x) / Mathf.Max(1, Screen.width) * 140f, zoom);
                previousMouse = current;
            }
            if (Mathf.Abs(Input.mouseScrollDelta.y) > .01f)
                SetView(yaw, zoom * Mathf.Exp(Input.mouseScrollDelta.y * .06f));
            if (Input.GetKeyDown(KeyCode.R)) ResetView();
        }

        private void OnDisable()
        {
            mouseDragging = false;
            previousTouchCount = 0;
            ResetView();
        }
    }
}
