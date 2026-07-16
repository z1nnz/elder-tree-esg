import 'dart:async';
import 'dart:math' as math;

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
  final EvidenceUploader? _evidenceUploader;
  final String? _initialDisplayName;
  final bool _allowOfflineDemo;
  final ImagePicker _picker = ImagePicker();
  final List<StreamSubscription<dynamic>> _subscriptions = [];
  StreamSubscription<Position>? _locationSubscription;
  static const bool _developmentLocationFallbackEnabled = bool.fromEnvironment(
    'ELDER_TREE_LOCATION_FALLBACK',
  );

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
  List<LineBindingModel> lineBindings = [];
  LineBindingCodeModel? latestLineBindingCode;
  ImpactSummaryModel impact = _emptyImpact;
  ExplorationStateModel exploration = _emptyExploration;
  RadarStateModel radar = _emptyRadar;
  HomeSummaryModel? home;
  List<String> discoveredTrees = [];
  double? latestLatitude;
  double? latestLongitude;
  double? latestAccuracyMeters;
  DateTime? latestLocationAt;
  String explorationLocationStatus = '準備定位';
  int? lastGrowthAwardPoints;
  String? lastGrowthAwardTitle;
  bool _sendingLocation = false;

  bool get sendingLocation => _sendingLocation;

  List<RadarMissionViewState> get radarMissionViews {
    final now = DateTime.now();
    final views = radar.missions
        .map(
          (mission) => RadarMissionViewState(
            mission: mission,
            distanceMeters: _distanceToMission(mission),
            now: now,
          ),
        )
        .toList();
    views.sort((a, b) {
      final priority = a.priority.compareTo(b.priority);
      if (priority != 0) return priority;
      final distanceA = a.distanceMeters ?? 1 << 30;
      final distanceB = b.distanceMeters ?? 1 << 30;
      final distance = distanceA.compareTo(distanceB);
      if (distance != 0) return distance;
      return a.mission.endsAt.compareTo(b.mission.endsAt);
    });
    return views;
  }

  RadarMissionViewState? get featuredRadarMissionView =>
      radarMissionViews.isEmpty ? null : radarMissionViews.first;

  DailyTask? taskById(String? taskId) {
    if (taskId == null) return null;
    for (final task in tasks) {
      if (task.id == taskId) return task;
    }
    return null;
  }

  String photoTaskActionLabel(DailyTask task) {
    if (task.capabilityEnabled) return '拍照驗證任務';
    return switch (task.capabilityReason) {
      'PHOTO_STORAGE_UNAVAILABLE' => '照片儲存尚未設定',
      'PHOTO_VERIFIER_UNAVAILABLE' => 'AI 驗證服務未連線',
      'BLAZE_REQUIRED' => '照片驗證尚未啟用',
      _ => '照片驗證暫時不可用',
    };
  }

  Future<void> initialize() async {
    final preferences = await SharedPreferences.getInstance();
    elderMode = preferences.getBool('elderMode') ?? true;
    await refresh();
    if (context?.displayName == '綠伴使用者' &&
        (_initialDisplayName?.trim().isNotEmpty ?? false)) {
      try {
        context = await _api.updateDisplayName(_initialDisplayName!.trim());
      } catch (error) {
        notice = _friendlyActionError(error, fallback: '名稱暫時無法同步，稍後會再以帳號資料為準。');
      }
      notifyListeners();
    }
  }

  Future<void> refresh() async {
    loading = true;
    notice = null;
    notifyListeners();
    try {
      final results = await Future.wait<Object?>([
        _safeRefresh('home', _api.getHomeSummary()),
        _safeRefresh('context', _api.getContext()),
        _safeRefresh('tasks', _api.getTasks()),
        _safeRefresh('tree', _api.getTree()),
        _safeRefresh('exploration', _api.getExplorationState()),
        _safeRefresh('radar', _api.getRadarState()),
      ]);
      final homeResult = results[0] as HomeSummaryModel?;
      final contextResult = results[1] as AppContextModel?;
      final tasksResult = results[2] as List<DailyTask>?;
      final treeResult = results[3] as TreeSummary?;
      final explorationResult = results[4] as ExplorationStateModel?;
      final radarResult = results[5] as RadarStateModel?;
      final hasCoreUpdate = results.any((result) => result != null);
      if (!hasCoreUpdate) {
        throw TimeoutException('Core App data unavailable');
      }
      home = homeResult ?? home;
      context = contextResult ?? context;
      tasks = tasksResult ?? tasks;
      tree = treeResult ?? tree;
      exploration = explorationResult ?? exploration;
      radar = radarResult ?? radar;
      offlineDemo = false;
      loading = false;
      notifyListeners();

      final optionalResults = await Future.wait<Object?>([
        _safeRefresh('messages', _api.getMessages()),
        _safeRefresh('devices', _api.getDevices()),
        _safeRefresh('reviews', _api.getFamilyReviews()),
        _safeRefresh('impact', _api.getImpactSummary()),
        _safeRefresh('lineBindings', _api.getLineBindings()),
      ]);
      messages = optionalResults[0] as List<FamilyMessageModel>? ?? messages;
      devices = optionalResults[1] as List<CompanionDevice>? ?? devices;
      reviews = optionalResults[2] as List<FamilyReviewModel>? ?? reviews;
      impact = optionalResults[3] as ImpactSummaryModel? ?? impact;
      lineBindings =
          optionalResults[4] as List<LineBindingModel>? ?? lineBindings;
    } catch (error) {
      if (kDebugMode) {
        debugPrint('[DEBUG-app-refresh] failed: $error');
      }
      offlineDemo = _allowOfflineDemo;
      notice = _allowOfflineDemo
          ? '目前使用離線示範資料，連上 API 後會自動同步。'
          : '目前無法連線到服務，資料未變更，請稍後重新整理。';
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<T?> _safeRefresh<T>(String label, Future<T> request) async {
    try {
      return await request;
    } catch (error) {
      if (kDebugMode) {
        debugPrint('[DEBUG-app-refresh:$label] failed: $error');
      }
      return null;
    }
  }

  Future<void> updateDisplayName(String displayName) async {
    if (displayName.trim().isEmpty) return;
    try {
      context = await _api.updateDisplayName(displayName.trim());
      notice = '顯示名稱已更新。';
    } catch (error) {
      notice = _friendlyActionError(error, fallback: '名稱暫時無法更新，請確認網路後再試一次。');
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
      notice = _friendlyActionError(error, fallback: '家庭暫時無法切換，請稍後再試一次。');
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
      notice = _friendlyActionError(error, fallback: '邀請碼暫時無法建立，請稍後再試一次。');
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
      notice = _friendlyActionError(error, fallback: '暫時無法加入家庭，請確認邀請碼後再試一次。');
      notifyListeners();
    }
  }

  Future<LineBindingCodeModel?> createLineBindingCode() async {
    try {
      latestLineBindingCode = await _api.createLineBindingCode();
      notice = 'LINE 綁定碼已建立，請在 10 分鐘內輸入官方帳號。';
      notifyListeners();
      return latestLineBindingCode;
    } catch (error) {
      notice = _friendlyActionError(error, fallback: 'LINE 綁定碼暫時無法建立，請稍後再試一次。');
      notifyListeners();
      return null;
    }
  }

  Future<void> refreshLineBindings() async {
    try {
      lineBindings = await _api.getLineBindings();
    } catch (error) {
      notice = _friendlyActionError(error, fallback: 'LINE 綁定狀態暫時無法更新。');
    }
    notifyListeners();
  }

  Future<void> revokeLineBinding(LineBindingModel binding) async {
    try {
      lineBindings = await _api.revokeLineBinding(binding.id);
      notice = '已解除 LINE 陪伴入口。';
    } catch (error) {
      notice = _friendlyActionError(error, fallback: 'LINE 綁定暫時無法解除，請稍後再試一次。');
    }
    notifyListeners();
  }

  Future<void> toggleElderMode(bool value) async {
    elderMode = value;
    notifyListeners();
    final preferences = await SharedPreferences.getInstance();
    await preferences.setBool('elderMode', value);
  }

  Future<void> _refreshHomeSummary() async {
    if (offlineDemo) return;
    try {
      home = await _api.getHomeSummary();
    } catch (_) {
      // Keep the primary task result visible even if the optional hub summary
      // refresh is temporarily unavailable.
    }
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
        await _refreshHomeSummary();
      }
      lastGrowthAwardPoints = task.growthPoints;
      lastGrowthAwardTitle = task.title;
      notice = '生命樹長出新葉 +${task.growthPoints}：${task.title}';
    } catch (error) {
      notice = _friendlyActionError(error, fallback: '任務暫時無法完成，請確認網路後再試一次。');
    }
    notifyListeners();
  }

  Future<void> startTask(DailyTask task) async {
    try {
      _replaceTask(await _api.startTask(task.id));
      await _refreshHomeSummary();
      notice = '計時已開始；離開 App 後伺服器仍會保留開始時間。';
    } catch (error) {
      notice = _friendlyActionError(error, fallback: '任務暫時無法開始，請確認網路後再試一次。');
    }
    notifyListeners();
  }

  Future<void> photographTask(DailyTask task) async {
    if (!task.capabilityEnabled ||
        context?.photoEvidenceEnabled == false ||
        context?.geminiPhotoVerificationEnabled == false) {
      notice = _photoCapabilityMessage(task);
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
        notice = '正在安全上傳照片，完成後會立即交給 AI 判斷。';
        notifyListeners();
        final evidence = await _api.initializePhotoEvidence(
          task.id,
          '${task.id}-${DateTime.now().millisecondsSinceEpoch}.jpg',
        );
        final uploaded = await (_evidenceUploader ?? FirebaseEvidenceUploader())
            .upload(photo, evidence);
        final decision = await _api.completePhotoEvidence(
          evidence.id,
          uploaded.sha256,
        );
        tasks = await _api.getTasks();
        tree = await _api.getTree();
        impact = await _api.getImpactSummary();
        reviews = await _api.getFamilyReviews();
        await _refreshHomeSummary();
        switch (decision.decision) {
          case EvidenceDecision.pass:
            lastGrowthAwardPoints = task.growthPoints;
            lastGrowthAwardTitle = task.title;
            notice = '生命樹長出新葉 +${task.growthPoints}：${task.title}';
          case EvidenceDecision.review:
            notice = '照片已送出，AI 需要家人再確認；確認通過後生命樹才會成長。';
          case EvidenceDecision.fail:
            notice = '這張照片沒有通過驗證，可以讓主體更清楚後重新拍一次。';
        }
      } else {
        _replaceTask(task.copyWith(status: TaskStatus.completed));
        _applyLocalGrowth(task.growthPoints);
        notice = '照片驗證已通過並完成「${task.title}」，陪伴樹獲得 ${task.growthPoints} 點成長值。';
      }
    } catch (error) {
      notice = _friendlyPhotoError(error);
    }
    notifyListeners();
  }

  String _photoCapabilityMessage(DailyTask task) {
    final reason =
        task.capabilityReason ??
        context?.geminiPhotoVerificationReason ??
        context?.photoEvidenceReason;
    return switch (reason) {
      'PHOTO_STORAGE_UNAVAILABLE' ||
      'STORAGE_NOT_CONFIGURED' => '照片驗證需要的私人儲存空間還沒設定完成；其他任務仍可正常使用。',
      'PHOTO_VERIFIER_UNAVAILABLE' || 'VERIFIER_DISABLED' =>
        '照片驗證服務尚未連線。請先啟動 AI verifier，或確認 PHOTO_VERIFICATION_ENABLED 已開啟。',
      'BLAZE_REQUIRED' => '照片驗證尚未啟用；其他任務與城市探索仍可正常使用。',
      _ => '照片驗證暫時不可用，請稍後再試；其他任務仍可正常使用。',
    };
  }

  String _friendlyPhotoError(Object error) {
    final message = error.toString();
    if (message.contains('413') ||
        message.contains('too large') ||
        message.contains('10 MB')) {
      return '照片檔案太大，請重新拍一張較清楚、較近的照片。';
    }
    if (message.contains('Storage') ||
        message.contains('Firebase') ||
        message.contains('upload')) {
      return '照片暫時無法安全上傳，請確認網路後再試一次。';
    }
    if (message.contains('verifier') ||
        message.contains('Gemini') ||
        message.contains('503') ||
        message.contains('timeout')) {
      return 'AI 驗證服務暫時沒有回應，照片沒有加分，請稍後再拍一次。';
    }
    return '照片辨識沒有完成。請讓主體更清楚、光線更穩定後再拍一次。';
  }

  String _friendlyActionError(Object error, {required String fallback}) {
    final message = error.toString().toLowerCase();
    if (message.contains('permission') ||
        message.contains('denied') ||
        message.contains('權限')) {
      return '權限尚未開啟，請到系統設定允許後再試一次。';
    }
    if (message.contains('socket') ||
        message.contains('network') ||
        message.contains('connection') ||
        message.contains('timeout') ||
        message.contains('timed out')) {
      return '網路暫時不穩，請確認連線後再試一次。';
    }
    if (message.contains('401') || message.contains('unauthorized')) {
      return '登入狀態已過期，請重新登入後再試一次。';
    }
    if (message.contains('403') || message.contains('forbidden')) {
      return '這個操作目前沒有權限，請確認帳號或家庭設定。';
    }
    if (message.contains('404') || message.contains('not found')) {
      return '找不到這筆資料，請重新整理後再試一次。';
    }
    if (message.contains('409') ||
        message.contains('conflict') ||
        message.contains('already')) {
      return '這個狀態已更新，請重新整理畫面確認最新結果。';
    }
    return fallback;
  }

  Future<void> decideReview(FamilyReviewModel review, String decision) async {
    try {
      await _api.decideFamilyReview(review.id, decision);
      reviews = await _api.getFamilyReviews();
      tasks = await _api.getTasks();
      tree = await _api.getTree();
      impact = await _api.getImpactSummary();
      await _refreshHomeSummary();
      notice = decision == 'PASS' ? '已確認任務完成。' : '已退回，對方可以重新拍攝。';
    } catch (error) {
      notice = _friendlyActionError(error, fallback: '覆核暫時無法送出，請稍後再試一次。');
    }
    notifyListeners();
  }

  Future<void> startExploration() async {
    if (exploring) return;
    try {
      explorationLocationStatus = '正在確認定位權限';
      notifyListeners();
      final route = exploration.routes.isEmpty
          ? null
          : exploration.routes.first;
      await _ensureLocationPermission();
      ExplorationSessionModel? session;
      if (route != null) {
        session =
            exploration.activeSession ??
            await _api.startExplorationSession(route.id);
        exploration = await _api.getExplorationState();
        if (exploration.activeSession?.id != session.id) {
          throw const FormatException('探索 Session 建立失敗');
        }
      }
      exploring = true;
      explorationLocationStatus = '等待第一個定位點';
      await _captureCurrentLocationPreview(notify: false);
      final previewPosition = _latestPositionSnapshot();
      if (previewPosition != null) {
        unawaited(_recordPosition(previewPosition));
      }
      lastGrowthAwardPoints = null;
      lastGrowthAwardTitle = null;
      notice = route == null
          ? radar.missions.isEmpty
                ? '已定位到你的位置；目前附近還沒有開放任務，地圖會持續準備好。'
                : '地圖正在更新附近任務；只會把候選座標送到後端驗證接取範圍。'
          : '地圖正在記錄這趟散步；精確座標只暫存最新一點，結束後立即清除。';
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
              notice = _friendlyActionError(
                error,
                fallback: '暫時收不到定位，請確認定位服務與網路後再試一次。',
              );
              notifyListeners();
            },
          );
    } catch (error) {
      exploring = false;
      notice = _friendlyActionError(
        error,
        fallback: '暫時無法進入探索模式，請確認定位與網路後再試一次。',
      );
      notifyListeners();
    }
  }

  Future<void> prepareExplorationPreview() async {
    if (exploring || latestLatitude != null || latestLongitude != null) return;
    try {
      explorationLocationStatus = '正在尋找你的位置';
      notifyListeners();
      await _ensureLocationPermission();
      await _captureCurrentLocationPreview();
    } catch (error) {
      explorationLocationStatus = '等待定位';
      notice = _friendlyActionError(
        error,
        fallback: '目前還抓不到位置；你仍可以先查看附近任務，App 會再嘗試定位。',
      );
      notifyListeners();
    }
  }

  Future<void> stopExploration() async {
    exploring = false;
    await _locationSubscription?.cancel();
    _locationSubscription = null;
    explorationLocationStatus = '已離開探索頁';
    final sessionId = exploration.activeSession?.id;
    if (!offlineDemo && sessionId != null) {
      try {
        exploration = await _api.endExplorationSession(sessionId);
      } catch (error) {
        notice = _friendlyActionError(
          error,
          fallback: '定位已停止，但探索結束狀態暫時無法同步；請稍後重新整理。',
        );
        notifyListeners();
        return;
      }
    }
    notice = '已離開探索頁，定位上傳已停止；地圖仍會保留目前位置方便你確認方向。';
    notifyListeners();
  }

  Future<void> pauseExplorationTracking() async {
    if (!exploring) return;
    exploring = false;
    await _locationSubscription?.cancel();
    _locationSubscription = null;
    explorationLocationStatus = '背景暫停定位';
    notice = 'App 已進入背景，定位追蹤已暫停；回到探索頁可繼續同一趟路線。';
    notifyListeners();
  }

  Future<void> _recordPosition(Position position) async {
    if (!exploring || _sendingLocation) return;
    _updateLatestPosition(position);
    if (position.accuracy > 50) {
      explorationLocationStatus = '定位精度不足';
      notice =
          '目前定位誤差約 ${position.accuracy.round()} 公尺，需要 50 公尺內；App 會自動等待下一個定位點。';
      notifyListeners();
      return;
    }
    final sessionId = exploration.activeSession?.id;
    _sendingLocation = true;
    explorationLocationStatus = '正在驗證位置';
    notifyListeners();
    try {
      if (sessionId != null) {
        exploration = await _api.recordExplorationEvent(
          sessionId: sessionId,
          eventKey: 'mobile-${DateTime.now().microsecondsSinceEpoch}',
          latitude: position.latitude,
          longitude: position.longitude,
          accuracyMeters: position.accuracy,
          occurredAt: position.timestamp,
        );
      }
      await _unlockNearbyRadarMissions(position);
      tasks = await _api.getTasks();
      explorationLocationStatus = '定位已更新';
      notifyListeners();
    } catch (error) {
      explorationLocationStatus = '定位點未被接受';
      notice = _friendlyActionError(
        error,
        fallback: '這個定位點未被接受，請保持網路連線；App 會在下一點自動重試。',
      );
      notifyListeners();
    } finally {
      _sendingLocation = false;
      notifyListeners();
    }
  }

  Future<void> _unlockNearbyRadarMissions(Position position) async {
    if (offlineDemo) return;
    for (final mission in radar.missions) {
      if (mission.status != 'LOCKED') continue;
      final distance = Geolocator.distanceBetween(
        position.latitude,
        position.longitude,
        mission.latitude,
        mission.longitude,
      );
      if (distance > mission.radiusMeters) continue;
      radar = await _api.unlockRadarMission(
        missionId: mission.id,
        eventKey:
            'mobile-radar-${mission.id}-${DateTime.now().microsecondsSinceEpoch}',
        latitude: position.latitude,
        longitude: position.longitude,
        accuracyMeters: position.accuracy,
        occurredAt: position.timestamp,
      );
      notice = '已接近「${mission.title}」，任務已解鎖。';
    }
  }

  Future<void> completeRadarMission(RadarMissionModel mission) async {
    if (mission.status == 'COMPLETED') return;
    if (mission.status != 'UNLOCKED') {
      notice = '請先走進「${mission.title}」的任務範圍再完成。';
      notifyListeners();
      return;
    }
    final timerRemaining = mission.timerRemainingAt(DateTime.now());
    if (timerRemaining > Duration.zero) {
      notice =
          '「${mission.title}」還需要 ${timerRemaining.inSeconds} 秒，完成後生命樹才會成長。';
      notifyListeners();
      return;
    }
    try {
      if (offlineDemo) {
        radar = RadarStateModel(
          generatedAt: DateTime.now(),
          missions: radar.missions
              .map(
                (item) => item.id == mission.id
                    ? item.copyWith(
                        status: 'COMPLETED',
                        completedAt: DateTime.now(),
                      )
                    : item,
              )
              .toList(),
        );
        _applyLocalGrowth(mission.growthPoints);
      } else {
        radar = await _api.completeRadarMission(mission.id);
        tree = await _api.getTree();
        impact = await _api.getImpactSummary();
        exploration = await _api.getExplorationState();
        await _refreshHomeSummary();
      }
      lastGrowthAwardPoints = mission.growthPoints;
      lastGrowthAwardTitle = mission.title;
      notice = '生命樹長出新葉 +${mission.growthPoints}：${mission.title}';
    } catch (error) {
      notice = _friendlyActionError(error, fallback: '雷達任務暫時無法完成，請稍後再試一次。');
    }
    notifyListeners();
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
      await _refreshHomeSummary();
      notice = message.delivered ? '訊息已同步到客廳陪伴樹。' : '訊息已保存，裝置重新連線後會送達。';
    } catch (error) {
      notice = _friendlyActionError(error, fallback: '訊息暫時無法送出，請確認網路後再試一次。');
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
      notice = _friendlyActionError(
        error,
        fallback: '陪伴樹暫時無法認領，請確認序號與認領碼後再試一次。',
      );
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

  int? _distanceToMission(RadarMissionModel mission) {
    final latitude = latestLatitude;
    final longitude = latestLongitude;
    if (latitude == null || longitude == null) return null;
    return _haversineDistanceMeters(
      latitude,
      longitude,
      mission.latitude,
      mission.longitude,
    ).round();
  }

  Future<void> _ensureLocationPermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw const FormatException('請先開啟定位服務');
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      explorationLocationStatus = '定位權限未開啟';
      throw const FormatException('未取得定位權限');
    }
  }

  Future<void> _captureCurrentLocationPreview({bool notify = true}) async {
    late final Position position;
    try {
      position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
    } catch (error) {
      if (_useDevelopmentLocationFallback(error, notify: notify)) return;
      rethrow;
    }
    _updateLatestPosition(position);
    explorationLocationStatus = position.accuracy > 50
        ? '目前定位約 ${position.accuracy.round()} 公尺'
        : '目前位置已顯示';
    if (notify) notifyListeners();
  }

  bool _useDevelopmentLocationFallback(Object error, {required bool notify}) {
    if (!kDebugMode) return false;
    final allowApplePreviewFallback =
        defaultTargetPlatform == TargetPlatform.macOS ||
        (defaultTargetPlatform == TargetPlatform.iOS &&
            _developmentLocationFallbackEnabled);
    if (!allowApplePreviewFallback) return false;
    debugPrint('[DEBUG-location-fallback] $error');
    _updateLatestPosition(_daanForestParkPosition());
    explorationLocationStatus = '模擬器定位未設定，先以大安森林公園示範';
    notice = '目前使用開發示範位置；若要測真實定位，請在 Simulator Features > Location 設定位置，或改用實機。';
    if (notify) notifyListeners();
    return true;
  }

  Position? _latestPositionSnapshot() {
    final latitude = latestLatitude;
    final longitude = latestLongitude;
    if (latitude == null || longitude == null) return null;
    return Position(
      latitude: latitude,
      longitude: longitude,
      timestamp: latestLocationAt ?? DateTime.now(),
      accuracy: latestAccuracyMeters ?? 12,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
      isMocked: kDebugMode,
    );
  }

  Position _daanForestParkPosition() => Position(
    latitude: 25.0316,
    longitude: 121.5362,
    timestamp: DateTime.now(),
    accuracy: 18,
    altitude: 0,
    altitudeAccuracy: 0,
    heading: 0,
    headingAccuracy: 0,
    speed: 0,
    speedAccuracy: 0,
    isMocked: true,
  );

  void _updateLatestPosition(Position position) {
    latestLatitude = position.latitude;
    latestLongitude = position.longitude;
    latestAccuracyMeters = position.accuracy;
    latestLocationAt = position.timestamp;
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

enum AdventureMissionState {
  waitingForLocation,
  far,
  near,
  insideRadius,
  unlocked,
  timerRunning,
  readyToComplete,
  completed,
  expired,
  upcoming,
}

class RadarMissionViewState {
  const RadarMissionViewState({
    required this.mission,
    required this.distanceMeters,
    required DateTime now,
  }) : _now = now;

  final RadarMissionModel mission;
  final int? distanceMeters;
  final DateTime _now;

  bool get insideRadius =>
      distanceMeters != null && distanceMeters! <= mission.radiusMeters;

  bool get canUnlock => mission.status == 'LOCKED' && insideRadius;

  bool get canComplete => mission.canCompleteAt(_now);

  Duration get timerRemaining => mission.timerRemainingAt(_now);

  AdventureMissionState get adventureState {
    if (mission.status == 'COMPLETED') {
      return AdventureMissionState.completed;
    }
    if (mission.status == 'EXPIRED') {
      return AdventureMissionState.expired;
    }
    if (mission.status == 'UPCOMING') {
      return AdventureMissionState.upcoming;
    }
    if (distanceMeters == null) {
      return AdventureMissionState.waitingForLocation;
    }
    if (canComplete) {
      return AdventureMissionState.readyToComplete;
    }
    if (mission.status == 'UNLOCKED' && timerRemaining > Duration.zero) {
      return AdventureMissionState.timerRunning;
    }
    if (mission.status == 'UNLOCKED') {
      return AdventureMissionState.unlocked;
    }
    if (insideRadius) {
      return AdventureMissionState.insideRadius;
    }
    if (distanceMeters! <= mission.radiusMeters * 2) {
      return AdventureMissionState.near;
    }
    return AdventureMissionState.far;
  }

  double get proximityProgress {
    final distance = distanceMeters;
    if (distance == null || mission.status == 'COMPLETED') return 0;
    if (insideRadius || mission.status == 'UNLOCKED') return 1;
    final radius = mission.radiusMeters.toDouble();
    final outerRadius = math.max(radius * 3, radius + 1);
    final progress = 1 - ((distance - radius) / (outerRadius - radius));
    return progress.clamp(0, 1).toDouble();
  }

  String get stateLabel => switch (adventureState) {
    AdventureMissionState.waitingForLocation => '等待定位',
    AdventureMissionState.far => '靠近中',
    AdventureMissionState.near => '快到了',
    AdventureMissionState.insideRadius => '範圍內',
    AdventureMissionState.unlocked => '可接取',
    AdventureMissionState.timerRunning => '計時中',
    AdventureMissionState.readyToComplete => '可完成',
    AdventureMissionState.completed => '已完成',
    AdventureMissionState.expired => '已結束',
    AdventureMissionState.upcoming => '尚未開始',
  };

  String get primaryActionLabel => switch (adventureState) {
    AdventureMissionState.readyToComplete =>
      mission.isTimer ? '完成計時任務' : '我完成了',
    AdventureMissionState.timerRunning => '還需 ${timerRemaining.inSeconds} 秒',
    AdventureMissionState.unlocked => mission.isTimer ? '計時中' : '我完成了',
    AdventureMissionState.insideRadius => '正在解鎖',
    AdventureMissionState.near => '再靠近一點',
    AdventureMissionState.far => '往任務光點走',
    AdventureMissionState.waitingForLocation => '正在找位置',
    AdventureMissionState.completed => '生命樹已成長',
    AdventureMissionState.expired => '任務已結束',
    AdventureMissionState.upcoming => '稍後開放',
  };

  String get helperText => switch (adventureState) {
    AdventureMissionState.readyToComplete =>
      '完成後生命樹會長出新葉 +${mission.growthPoints}',
    AdventureMissionState.timerRunning => '停一下，等時間走完再完成。',
    AdventureMissionState.unlocked => '任務已接取，可以慢慢完成。',
    AdventureMissionState.insideRadius => '你已經進入半徑，App 會向後端確認。',
    AdventureMissionState.near => '任務就在附近，靠近光點即可接取。',
    AdventureMissionState.far => '城市裡有一個小任務正在等你。',
    AdventureMissionState.waitingForLocation => '地圖正在尋找你的目前位置。',
    AdventureMissionState.completed => '這次完成已經被記錄，重送不會重複加分。',
    AdventureMissionState.expired => '這個任務已結束，可以看看其他光點。',
    AdventureMissionState.upcoming => '這個任務還沒開始。',
  };

  int get priority {
    if (canComplete) return 0;
    if (mission.status == 'UNLOCKED') return 1;
    if (canUnlock) return 2;
    if (adventureState == AdventureMissionState.near) return 3;
    if (mission.status == 'LOCKED' || mission.status == 'UPCOMING') return 4;
    if (mission.status == 'EXPIRED') return 5;
    return 6;
  }

  String get distanceLabel {
    final distance = distanceMeters;
    if (distance == null) return '等待定位';
    if (insideRadius) return '已進入 ${mission.radiusMeters}m 半徑';
    return '距離 ${distance}m';
  }
}

double _haversineDistanceMeters(
  double startLatitude,
  double startLongitude,
  double endLatitude,
  double endLongitude,
) {
  const earthRadiusMeters = 6371000.0;
  final dLat = _degreesToRadians(endLatitude - startLatitude);
  final dLon = _degreesToRadians(endLongitude - startLongitude);
  final lat1 = _degreesToRadians(startLatitude);
  final lat2 = _degreesToRadians(endLatitude);
  final a =
      math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(lat1) * math.cos(lat2) * math.sin(dLon / 2) * math.sin(dLon / 2);
  return earthRadiusMeters * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
}

double _degreesToRadians(double degrees) => degrees * math.pi / 180;

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

final _emptyRadar = RadarStateModel(
  generatedAt: DateTime.fromMillisecondsSinceEpoch(0),
  missions: const [],
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
    id: '55555555-5555-4555-8555-555555555555',
    title: '拍下今天的水杯',
    description: '讓水杯或水瓶清楚入鏡，提醒自己慢慢補水。',
    verificationMode: VerificationMode.photoAi,
    growthPoints: 35,
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
