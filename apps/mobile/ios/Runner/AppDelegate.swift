import Flutter
import UIKit
#if canImport(UnityFramework)
import Darwin
import UnityFramework
#endif

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private let lifeTreeGarden = LifeTreeGardenCoordinator()
  private var lifeTreeChannel: FlutterMethodChannel?
  private var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    self.launchOptions = launchOptions ?? [:]
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    let channel = FlutterMethodChannel(
      name: "tree-companion/life-tree-garden",
      binaryMessenger: engineBridge.applicationRegistrar.messenger()
    )
    channel.setMethodCallHandler { [weak self] call, result in
      guard let self else {
        result(false)
        return
      }
      switch call.method {
      case "isAvailable":
        result(self.lifeTreeGarden.isAvailable)
      case "open":
        guard
          let arguments = call.arguments as? [String: Any],
          let state = arguments["state"] as? String,
          !state.isEmpty
        else {
          result(FlutterError(
            code: "INVALID_LIFE_TREE_STATE",
            message: "生命樹資料不可為空。",
            details: nil
          ))
          return
        }
        result(self.lifeTreeGarden.open(state: state, launchOptions: self.launchOptions))
      default:
        result(FlutterMethodNotImplemented)
      }
    }
    lifeTreeChannel = channel
  }
}

private final class LifeTreeGardenCoordinator: NSObject {
#if canImport(UnityFramework)
  private var framework: UnityFramework?
  private weak var flutterWindow: UIWindow?
  private weak var closeButton: UIButton?

  var isAvailable: Bool {
    Bundle.main.url(
      forResource: "UnityFramework",
      withExtension: "framework",
      subdirectory: "Frameworks"
    ) != nil
  }

  func open(
    state: String,
    launchOptions: [UIApplication.LaunchOptionsKey: Any]
  ) -> Bool {
    guard let framework = loadFramework() else { return false }
    flutterWindow = Self.keyWindow
    if framework.appController() == nil {
      framework.runEmbedded(
        withArgc: CommandLine.argc,
        argv: CommandLine.unsafeArgv,
        appLaunchOpts: launchOptions
      )
    } else {
      framework.pause(false)
      framework.showUnityWindow()
    }
    framework.sendMessageToGO(
      withName: "生命樹_資料與動畫",
      functionName: "ApplyStateJson",
      message: state
    )
    installCloseButton(on: framework.appController().window)
    self.framework = framework
    return true
  }

  private func loadFramework() -> UnityFramework? {
    if let framework { return framework }
    guard
      let url = Bundle.main.url(
        forResource: "UnityFramework",
        withExtension: "framework",
        subdirectory: "Frameworks"
      ),
      let bundle = Bundle(url: url)
    else { return nil }
    if !bundle.isLoaded && !bundle.load() { return nil }
    guard let frameworkClass = bundle.principalClass as? UnityFramework.Type else {
      return nil
    }
    guard let instance = frameworkClass.getInstance() else { return nil }
    if instance.appController() == nil {
      guard
        let executableHandle = dlopen(nil, RTLD_LAZY),
        let executeHeader = dlsym(executableHandle, "_mh_execute_header")
      else { return nil }
      instance.setExecuteHeader(
        executeHeader.assumingMemoryBound(to: MachHeader.self)
      )
      instance.setDataBundleId("com.unity3d.framework")
    }
    return instance
  }

  private func installCloseButton(on window: UIWindow) {
    closeButton?.removeFromSuperview()
    let button = UIButton(type: .system)
    button.translatesAutoresizingMaskIntoConstraints = false
    button.setImage(UIImage(systemName: "xmark"), for: .normal)
    button.tintColor = .white
    button.backgroundColor = UIColor.black.withAlphaComponent(0.42)
    button.layer.cornerRadius = 22
    button.accessibilityLabel = "離開生命樹庭園"
    button.addTarget(self, action: #selector(closeGarden), for: .touchUpInside)
    window.addSubview(button)
    NSLayoutConstraint.activate([
      button.widthAnchor.constraint(equalToConstant: 44),
      button.heightAnchor.constraint(equalToConstant: 44),
      button.topAnchor.constraint(equalTo: window.safeAreaLayoutGuide.topAnchor, constant: 12),
      button.trailingAnchor.constraint(equalTo: window.safeAreaLayoutGuide.trailingAnchor, constant: -16),
    ])
    closeButton = button
  }

  @objc private func closeGarden() {
    closeButton?.removeFromSuperview()
    framework?.pause(true)
    flutterWindow?.makeKeyAndVisible()
  }

  private static var keyWindow: UIWindow? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .first(where: \.isKeyWindow)
  }
#else
  var isAvailable: Bool { false }

  func open(
    state: String,
    launchOptions: [UIApplication.LaunchOptionsKey: Any]
  ) -> Bool {
    false
  }
#endif
}
