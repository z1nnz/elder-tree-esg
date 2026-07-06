import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';
import 'evidence_uploader.dart';
import 'models.dart';

class AppController extends ChangeNotifier {
  AppController({
    ApiClient? api,
    EvidenceUploader? evidenceUploader,
    String? initialDisplayName,
    bool allowOfflineDemo = true,
  }) : _api = api ?? ApiClient(),
       _evidenceUploader = evidenceUploader,
       _initialDisplayName = initialDisplayName,
       _allowOfflineDemo = allowOfflineDemo {
    if (!allowOfflineDemo) {
      tasks = [];
      tree = _emptyTree;
      messages = [];
      devices = [];
    }
  }

  final ApiClient _api;
  EvidenceUploader? _evidenceUploader;
  final String? _initialDisplayName;
  final bool _allowOfflineDemo;
  final ImagePicker _picker = ImagePicker();
  final List<StreamSubscription<dynamic>> _subscriptions = [];
  StreamSubscription<Position>? _locationSubscription;

  bool loading = true;
  bool elderMode = true;
  bool offlineDemo = false;
  bool exploring = false;
  String? notice;
  AppContextModel? context;
  List<DailyTask> tasks = _fallbackTasks;
  TreeSummary tree = _fallbackTree;
  List<FamilyMessageModel> messages = _fallbackMessages;
  List<CompanionDevice> devices = _fallbackDevices;
  List<FamilyReviewModel> reviews = [];
  ImpactSummaryModel impact = _emptyImpact;
  ExplorationStateModel exploration = _emptyExploration;
  List<String> discoveredTrees = [];
  bool _sendingLocation = false;

  Future<void> initialize() async {
    final preferences = await SharedPreferences.getInstance();
    elderMode = preferences.getBool('elderMode') ?? true;
    await refresh();
    if (context?.displayName == '綠伴使用者' &&
        (_initialDisplayName?.trim().isNotEmpty ?? false)) {
      try {
        context = await _api.updateDisplayName(_initialDisplayName!.trim());
      } catch (error) {
        notice = '名稱同步失敗：$error';
      }
      notifyListeners();
    }
  }

  Future<void> refresh() async {
    loading = true;
    notice = null;
    notifyListeners();
    try {
      final results = await Future.wait([
        _api.getContext(),
        _api.getTasks(),
        _api.getTree(),
        _api.getMessages(),
        _api.getDevices(),
        _api.getFamilyReviews(),
        _api.getImpactSummary(),
        _api.getExplorationState(),
      ]);
      context = results[0] as AppContextModel;
      tasks = results[1] as List<DailyTask>;
      tree = results[2] as TreeSummary;
      messages = results[3] as List<FamilyMessageModel>;
      devices = results[4] as List<CompanionDevice>;
      reviews = results[5] as List<FamilyReviewModel>;
      impact = results[6] as ImpactSummaryModel;
      exploration = results[7] as ExplorationStateModel;
      offlineDemo = false;
    } catch (_) {
      offlineDemo = _allowOfflineDemo;
      notice = _allowOfflineDemo
          ? '目前使用離線示範資料，連上 API 後會自動同步。'
          : '目前無法連線到服務，資料未變更，請稍後重新整理。';
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> updateDisplayName(String displayName) async {
    if (displayName.trim().isEmpty) return;
    try {
      context = await _api.updateDisplayName(displayName.trim());
      notice = '顯示名稱已更新。';
    } catch (error) {
      notice = '名稱更新失敗：$error';
    }
    notifyListeners();
  }

  Future<void> switchHousehold(String householdId) async {
    if (context?.activeHouseholdId == householdId) return;
    try {
      context = await _api.setActiveHousehold(householdId);
      await refresh();
      notice = '已切換到 ${context?.activeHousehold.name ?? '家庭'}。';
      notifyListeners();
    } catch (error) {
      notice = '家庭切換失敗：$error';
      notifyListeners();
    }
  }

  Future<HouseholdInviteModel?> createHouseholdInvite() async {
    try {
      final invite = await _api.createHouseholdInvite();
      notice = '邀請碼 ${invite.code}，24 小時內可使用一次。';
      notifyListeners();
      return invite;
    } catch (error) {
      notice = '邀請碼建立失敗：$error';
      notifyListeners();
      return null;
    }
  }

  Future<void> joinHousehold(String code, String relationship) async {
    try {
      context = await _api.joinHousehold(code.trim(), relationship.trim());
      await refresh();
      notice = '已加入 ${context?.activeHousehold.name ?? '新的家庭'}。';
      notifyListeners();
    } catch (error) {
      notice = '加入家庭失敗：$error';
      notifyListeners();
    }
  }

  Future<void> toggleElderMode(bool value) async {
    elderMode = value;
    notifyListeners();
    final preferences = await SharedPreferences.getInstance();
    await preferences.setBool('elderMode', value);
  }

  Future<void> completeTask(DailyTask task) async {
    if (task.status == TaskStatus.completed) return;
    try {
      if (offlineDemo) {
        _replaceTask(task.copyWith(status: TaskStatus.completed));
        _applyLocalGrowth(task.growthPoints);
      } else {
        _replaceTask(await _api.completeTask(task.id));
        tree = await _api.getTree();
      }
      notice = '完成了「${task.title}」，陪伴樹獲得 ${task.growthPoints} 點成長值。';
    } catch (error) {
      notice = '任務暫時無法完成：$error';
    }
    notifyListeners();
  }

  Future<void> startTask(DailyTask task) async {
    try {
      _replaceTask(await _api.startTask(task.id));
      notice = '計時已開始；離開 App 後伺服器仍會保留開始時間。';
    } catch (error) {
      notice = '任務暫時無法開始：$error';
    }
    notifyListeners();
  }

  Future<void> photographTask(DailyTask task) async {
    if (!task.capabilityEnabled || context?.photoEvidenceEnabled != true) {
      notice = '照片驗證服務尚未開放；其他任務與城市探索仍可正常使用。';
      notifyListeners();
      return;
    }
    try {
      final photo = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 82,
        maxWidth: 1600,
      );
      if (photo == null) return;
      if (!offlineDemo) {
        final destination = await _api.initializePhotoEvidence(
          task.id,
          photo.name,
        );
        final uploader = _evidenceUploader ??= FirebaseEvidenceUploader();
        final uploaded = await uploader.upload(photo, destination);
        await _api.completePhotoEvidence(destination.id, uploaded.sha256);
        tasks = await _api.getTasks();
        tree = await _api.getTree();
        reviews = await _api.getFamilyReviews();
      } else {
        _replaceTask(task.copyWith(status: TaskStatus.verifying));
      }
      notice = '照片已送出。AI 信心不足時會交由人工覆核，不會直接判定失敗。';
    } catch (error) {
      notice = '照片送出失敗：$error';
    }
    notifyListeners();
  }

  Future<void> decideReview(FamilyReviewModel review, String decision) async {
    try {
      await _api.decideFamilyReview(review.id, decision);
      reviews = await _api.getFamilyReviews();
      tasks = await _api.getTasks();
      tree = await _api.getTree();
      impact = await _api.getImpactSummary();
      notice = decision == 'PASS' ? '已確認任務完成。' : '已退回，對方可以重新拍攝。';
    } catch (error) {
      notice = '覆核失敗：$error';
    }
    notifyListeners();
  }

  Future<void> startExploration() async {
    if (exploring) return;
    try {
      final route = exploration.routes.isEmpty
          ? null
          : exploration.routes.first;
      if (route == null) {
        throw const FormatException('目前沒有已發布的探索路線');
      }
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw const FormatException('請先開啟定位服務');
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw const FormatException('未取得定位權限');
      }
      final session =
          exploration.activeSession ??
          await _api.startExplorationSession(route.id);
      exploration = await _api.getExplorationState();
      if (exploration.activeSession?.id != session.id) {
        throw const FormatException('探索 Session 建立失敗');
      }
      exploring = true;
      notice = '探索已開始；精確座標只暫存最新一點，結束後立即清除。';
      notifyListeners();
      _locationSubscription =
          Geolocator.getPositionStream(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high,
              distanceFilter: 20,
            ),
          ).listen(
            _recordPosition,
            onError: (Object error) {
              notice = '暫時收不到定位，請確認定位服務與網路後重試：$error';
              notifyListeners();
            },
          );
    } catch (error) {
      exploring = false;
      notice = '無法開始探索：$error';
      notifyListeners();
    }
  }

  Future<void> stopExploration() async {
    exploring = false;
    await _locationSubscription?.cancel();
    _locationSubscription = null;
    final sessionId = exploration.activeSession?.id;
    if (!offlineDemo && sessionId != null) {
      try {
        exploration = await _api.endExplorationSession(sessionId);
      } catch (error) {
        notice = '定位已停止，但探索結束狀態暫時無法同步：$error';
        notifyListeners();
        return;
      }
    }
    notice = '探索已結束，最新精確座標已清除。';
    notifyListeners();
  }

  Future<void> pauseExplorationTracking() async {
    if (!exploring) return;
    exploring = false;
    await _locationSubscription?.cancel();
    _locationSubscription = null;
    notice = 'App 已進入背景，定位追蹤已暫停；回到探索頁可繼續同一趟路線。';
    notifyListeners();
  }

  Future<void> _recordPosition(Position position) async {
    if (!exploring || _sendingLocation) return;
    if (position.accuracy > 50) {
      notice =
          '目前定位誤差約 ${position.accuracy.round()} 公尺，需要 50 公尺內；App 會自動等待下一個定位點。';
      notifyListeners();
      return;
    }
    final sessionId = exploration.activeSession?.id;
    if (sessionId == null) return;
    _sendingLocation = true;
    try {
      exploration = await _api.recordExplorationEvent(
        sessionId: sessionId,
        eventKey: 'mobile-${DateTime.now().microsecondsSinceEpoch}',
        latitude: position.latitude,
        longitude: position.longitude,
        accuracyMeters: position.accuracy,
        occurredAt: position.timestamp,
      );
      tasks = await _api.getTasks();
      notifyListeners();
    } catch (error) {
      notice = '這個定位點未被接受，請保持網路連線；App 會在下一點自動重試：$error';
      notifyListeners();
    } finally {
      _sendingLocation = false;
    }
  }

  Future<void> sendFamilyMessage(String body) async {
    if (body.trim().isEmpty) return;
    try {
      final message = offlineDemo
          ? FamilyMessageModel(
              id: DateTime.now().microsecondsSinceEpoch.toString(),
              authorName: '小晴',
              body: body.trim(),
              createdAt: DateTime.now(),
              delivered: true,
            )
          : await _api.sendMessage(body.trim());
      messages = [message, ...messages];
      notice = message.delivered ? '訊息已同步到客廳陪伴樹。' : '訊息已保存，裝置重新連線後會送達。';
    } catch (error) {
      notice = '訊息暫時無法送出：$error';
    }
    notifyListeners();
  }

  Future<void> scanForCompanionTrees() async {
    discoveredTrees = [];
    notice = '正在搜尋附近的陪伴樹…';
    notifyListeners();
    try {
      final subscription = FlutterBluePlus.scanResults.listen((results) {
        final names = results
            .map((result) => result.advertisementData.advName)
            .where((name) => name.startsWith('ElderTree-'))
            .toSet()
            .toList();
        if (names.isNotEmpty) {
          discoveredTrees = names;
          notifyListeners();
        }
      });
      _subscriptions.add(subscription);
      await FlutterBluePlus.startScan(timeout: const Duration(seconds: 4));
      await Future<void>.delayed(const Duration(seconds: 4));
      if (discoveredTrees.isEmpty) {
        notice = '附近沒有找到尚未配網的陪伴樹。';
      } else {
        notice = '找到 ${discoveredTrees.length} 台附近裝置。';
      }
    } catch (_) {
      discoveredTrees = [];
      notice = '藍牙權限尚未開啟，無法搜尋附近裝置。';
    }
    notifyListeners();
  }

  Future<void> claimDevice(String serial, String code) async {
    try {
      if (offlineDemo) {
        throw const FormatException('裝置認領需要連線到後端驗證序號與認領碼');
      }
      final device = await _api.claimDevice(serial.trim(), code.trim());
      devices = [device];
      notice = '已認領 ${device.name}，下一步可透過藍牙傳送 Wi-Fi 設定。';
    } catch (error) {
      notice = '認領失敗：$error';
    }
    notifyListeners();
  }

  void clearNotice() {
    notice = null;
    notifyListeners();
  }

  void _replaceTask(DailyTask updated) {
    tasks = tasks
        .map((task) => task.id == updated.id ? updated : task)
        .toList();
  }

  void _applyLocalGrowth(int points) {
    final nextPoints = tree.growthPoints + points;
    final stage = switch (nextPoints) {
      >= 1000 => 'MATURE',
      >= 500 => 'YOUNG_TREE',
      >= 250 => 'SEEDLING',
      >= 100 => 'SPROUT',
      _ => 'SEED',
    };
    final nextStage = switch (nextPoints) {
      < 100 => 100,
      < 250 => 250,
      < 500 => 500,
      < 1000 => 1000,
      _ => null,
    };
    tree = TreeSummary(
      name: tree.name,
      householdName: tree.householdName,
      stage: stage,
      growthPoints: nextPoints,
      nextStageAt: nextStage,
    );
  }

  @override
  void dispose() {
    _locationSubscription?.cancel();
    for (final subscription in _subscriptions) {
      subscription.cancel();
    }
    _api.dispose();
    super.dispose();
  }
}

const _emptyTree = TreeSummary(
  name: '我的陪伴樹',
  householdName: '我的家庭',
  stage: 'SEED',
  growthPoints: 0,
  nextStageAt: 100,
);

const _emptyImpact = ImpactSummaryModel(
  householdName: '我的家庭',
  treeStage: 'SEED',
  growthPoints: 0,
  nextStageAt: 100,
  contributedPoints: 0,
);

const _emptyExploration = ExplorationStateModel(
  totalDistanceMeters: 0,
  coarseCell: null,
  activeSession: null,
  routes: [],
);

const _fallbackTasks = [
  DailyTask(
    id: '11111111-1111-4111-8111-111111111111',
    title: '拍下今天的一抹綠',
    description: '找一株植物，拍下讓你停下來多看一眼的地方。',
    verificationMode: VerificationMode.photoAi,
    growthPoints: 80,
    status: TaskStatus.available,
    capabilityEnabled: false,
    capabilityReason: 'PHOTO_STORAGE_UNAVAILABLE',
  ),
  DailyTask(
    id: '22222222-2222-4222-8222-222222222222',
    title: '慢慢喝一杯水',
    description: '為自己倒杯水，坐下來慢慢喝完。',
    verificationMode: VerificationMode.selfCheck,
    growthPoints: 30,
    status: TaskStatus.available,
  ),
  DailyTask(
    id: '33333333-3333-4333-8333-333333333333',
    title: '十分鐘散步',
    description: '在住家附近走一小段，累了隨時可以休息。',
    verificationMode: VerificationMode.timer,
    growthPoints: 60,
    status: TaskStatus.inProgress,
  ),
];

const _fallbackTree = TreeSummary(
  name: '我們家的陪伴樹',
  householdName: '林家',
  stage: 'SPROUT',
  growthPoints: 180,
  nextStageAt: 250,
);

final _fallbackMessages = [
  FamilyMessageModel(
    id: 'demo-message',
    authorName: '小晴',
    body: '阿公，今天看到漂亮的花可以拍給我看喔。',
    createdAt: DateTime.now().subtract(const Duration(minutes: 45)),
    delivered: true,
  ),
];

const _fallbackDevices = <CompanionDevice>[];
