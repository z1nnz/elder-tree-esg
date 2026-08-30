import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';
import 'evidence_uploader.dart';
import 'journey_step_source.dart';
import 'models.dart';
import 'venue_witness_models.dart';

class AppController extends ChangeNotifier {
  AppController({
    ApiClient? api,
    EvidenceUploader? evidenceUploader,
    JourneyStepSource? journeyStepSource,
    String? initialDisplayName,
    bool allowOfflineDemo = true,
  }) : _api = api ?? ApiClient(),
       _evidenceUploader = evidenceUploader,
       _journeyStepSource = journeyStepSource ?? HealthJourneyStepSource(),
       _initialDisplayName = initialDisplayName,
       _allowOfflineDemo = allowOfflineDemo {
    if (!allowOfflineDemo) {
      tasks = [];
      tree = _emptyTree;
      circle = _emptyCircle;
      messages = [];
      devices = [];
    }
  }

  final ApiClient _api;
  final EvidenceUploader? _evidenceUploader;
  final JourneyStepSource _journeyStepSource;
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
  CircleOverviewModel circle = _fallbackCircle;
  List<FamilyMessageModel> messages = _fallbackMessages;
  List<CompanionPromptModel> companionPrompts = [];
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
  JourneyStepAccessState journeyStepAccessState =
      JourneyStepAccessState.notNeeded;
  int? lastGrowthAwardPoints;
  String? lastGrowthAwardTitle;
  bool _sendingLocation = false;
  bool _radarCompletionInFlight = false;
  bool _disposed = false;
  int _refreshGeneration = 0;
  int _circleEpoch = 0;
  bool membershipBusy = false;
  bool messageSending = false;
  String? messageError;
  final Map<String, String> _messageDrafts = {};
  String get messageDraft => _messageDrafts[context?.activeHouseholdId] ?? '';
  void saveMessageDraft(String value) {
    final id = context?.activeHouseholdId;
    if (id != null) _messageDrafts[id] = value;
  }

  String? membershipError;
  bool _changingHousehold = false;
  Set<String> _deferredCircleSetups = {};
  JourneyShelfModel? journeyShelf;
  bool journeyLoading = false;
  bool journeyStarting = false;
  String? journeyError;
  int _journeyRequestGeneration = 0;

  Future<void> loadJourneyShelf({bool more = false}) async {
    if (_disposed || journeyLoading || journeyStarting || membershipBusy) {
      return;
    }
    if (offlineDemo) {
      journeyError = '離線示範不會產生共同紀錄。連上服務後，就能查看旅程與選擇下一段。';
      notifyListeners();
      return;
    }
    final circleId = context?.activeHouseholdId;
    if (circleId == null) return;
    final epoch = _circleEpoch;
    final generation = ++_journeyRequestGeneration;
    bool current() =>
        !_disposed &&
        epoch == _circleEpoch &&
        generation == _journeyRequestGeneration;
    final previous = journeyShelf;
    final cursor = more ? previous?.nextCursor : null;
    if (more && cursor == null) return;
    journeyLoading = true;
    journeyError = null;
    notifyListeners();
    try {
      final shelf = await _api.getJourneyShelf(before: cursor);
      if (!current()) return;
      if (shelf.circleId != circleId) {
        throw const ApiException('Circle changed; reload journeys');
      }
      journeyShelf = more && previous != null
          ? JourneyShelfModel(
              circleId: shelf.circleId,
              currentRunId: shelf.currentRunId,
              completedCount: shelf.completedCount,
              choices: shelf.choices,
              nextCursor: shelf.nextCursor,
              results: {
                for (final result in [...previous.results, ...shelf.results])
                  result.runId: result,
              }.values.toList(),
            )
          : shelf;
    } catch (error) {
      if (current()) {
        journeyError = _friendlyActionError(
          error,
          fallback: '共同紀錄暫時讀不到，請重新整理；已完成的旅程不會因此消失。',
        );
      }
    } finally {
      if (current()) {
        journeyLoading = false;
        notifyListeners();
      }
    }
  }

  Future<bool> startJourney(JourneyChoiceModel choice) async {
    final shelf = journeyShelf;
    if (_disposed ||
        membershipBusy ||
        journeyStarting ||
        journeyLoading ||
        offlineDemo ||
        shelf?.currentRunId == null ||
        shelf?.circleId != context?.activeHouseholdId ||
        choice.unavailableReason != null) {
      return false;
    }
    final epoch = ++_circleEpoch;
    ++_refreshGeneration;
    ++_journeyRequestGeneration;
    loading = false;
    journeyStarting = true;
    journeyError = null;
    notifyListeners();
    bool current() => !_disposed && epoch == _circleEpoch;
    try {
      final updated = await _api.startJourney(
        circleId: shelf!.circleId,
        actionId: choice.actionId,
        previousRunId: shelf.currentRunId!,
      );
      if (!current()) return false;
      if (updated.id != shelf.circleId) {
        throw const ApiException('Circle changed; reload journeys');
      }
      circle = updated;
      journeyShelf = null;
      notice = '新的共行旅程已準備好，一起接下第一棒吧。';
      return true;
    } catch (error) {
      if (current()) {
        final message = error.toString().toLowerCase();
        journeyError = message.contains('finish the current')
            ? '已經有人接棒了。先完成目前旅程，再選下一段。'
            : message.contains('revisit')
            ? '這段旅程還在休息，請重新整理查看再次開放時間。'
            : message.contains('invite more')
            ? '目前樹伴人數不足，先邀請夥伴，或選擇人數較少的旅程。'
            : message.contains('changed')
            ? '樹伴圈已選擇另一段旅程，請重新整理後再確認。'
            : _friendlyActionError(error, fallback: '旅程暫時無法開啟，請重新整理後再試。');
      }
      return false;
    } finally {
      if (current()) {
        journeyStarting = false;
        notifyListeners();
      }
    }
  }

  bool get needsCircleSetup {
    final profile = context?.activeHousehold;
    return !offlineDemo &&
        profile != null &&
        profile.canManageCircle &&
        profile.needsSetup &&
        !_deferredCircleSetups.contains(profile.id);
  }

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
    if (_disposed) return;
    elderMode = preferences.getBool('elderMode') ?? true;
    _deferredCircleSetups =
        (preferences.getStringList('deferredCircleSetups') ?? []).toSet();
    await refresh();
    if ((context?.displayName == '同行成林使用者' ||
            context?.displayName == '樹伴使用者') &&
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
    if (_disposed || _changingHousehold) return;
    final generation = ++_refreshGeneration;
    bool current() => !_disposed && generation == _refreshGeneration;
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
        _safeRefresh('circle', _api.getCircleOverview()),
      ]);
      if (!current()) return;
      final homeResult = results[0] as HomeSummaryModel?;
      final contextResult = results[1] as AppContextModel?;
      final tasksResult = results[2] as List<DailyTask>?;
      final treeResult = results[3] as TreeSummary?;
      final explorationResult = results[4] as ExplorationStateModel?;
      final radarResult = results[5] as RadarStateModel?;
      final circleResult = results[6] as CircleOverviewModel?;
      final hasCoreUpdate = results.any((result) => result != null);
      if (!hasCoreUpdate) {
        throw TimeoutException('Core App data unavailable');
      }
      if (contextResult != null) _adoptContext(contextResult);
      home = homeResult ?? home;
      tasks = tasksResult ?? tasks;
      tree = treeResult ?? tree;
      exploration = explorationResult ?? exploration;
      radar = radarResult ?? radar;
      circle = circleResult ?? circle;
      offlineDemo = false;
      loading = false;
      notifyListeners();

      final optionalResults = await Future.wait<Object?>([
        _safeRefresh('messages', _api.getMessages()),
        _safeRefresh('companionPrompts', _api.getCompanionPrompts()),
        _safeRefresh('devices', _api.getDevices()),
        _safeRefresh('reviews', _api.getFamilyReviews()),
        _safeRefresh('impact', _api.getImpactSummary()),
        _safeRefresh('lineBindings', _api.getLineBindings()),
      ]);
      if (!current()) return;
      messages = optionalResults[0] as List<FamilyMessageModel>? ?? messages;
      companionPrompts =
          optionalResults[1] as List<CompanionPromptModel>? ?? companionPrompts;
      devices = optionalResults[2] as List<CompanionDevice>? ?? devices;
      reviews = optionalResults[3] as List<FamilyReviewModel>? ?? reviews;
      impact = optionalResults[4] as ImpactSummaryModel? ?? impact;
      lineBindings =
          optionalResults[5] as List<LineBindingModel>? ?? lineBindings;
    } catch (error) {
      if (!current()) return;
      if (kDebugMode) {
        debugPrint('[DEBUG-app-refresh] failed: $error');
      }
      offlineDemo = _allowOfflineDemo && context == null;
      notice = offlineDemo
          ? '目前使用離線示範資料，連上 API 後會自動同步。'
          : '目前無法連線到服務，資料未變更，請稍後重新整理。';
    } finally {
      if (current()) {
        loading = false;
        notifyListeners();
      }
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

  Future<bool> switchHousehold(String householdId) async {
    if (context?.activeHouseholdId == householdId) return true;
    return _changeHousehold(
      () => _api.setActiveHousehold(householdId),
      success: '已切換樹伴圈。',
    );
  }

  Future<HouseholdInviteModel?> createHouseholdInvite() async {
    if (!_beginMembershipAction()) return null;
    try {
      final invite = await _api.createHouseholdInvite();
      if (_disposed) return null;
      notice = '邀請碼已準備好，請私下傳給一位想邀請的人。';
      return invite;
    } catch (error) {
      if (!_disposed) membershipError = _membershipFailure(error);
      return null;
    } finally {
      _finishMembershipAction();
    }
  }

  Future<bool> joinHousehold(String code, String relationship) async {
    return _changeHousehold(
      () => _api.joinHousehold(code.trim().toUpperCase(), relationship.trim()),
      success: '已加入樹伴圈，可以一起展開旅程了。',
    );
  }

  Future<bool> createCircle({
    required String name,
    required String kind,
    required String idempotencyKey,
  }) => _changeHousehold(
    () => _api.createCircle(
      name: name.trim(),
      kind: kind,
      idempotencyKey: idempotencyKey,
    ),
    success: '新樹伴圈已建立，可以邀請同行的人了。',
  );

  Future<bool> updateCircle({
    required String circleId,
    required String name,
    required String kind,
    required int expectedRevision,
  }) => _changeHousehold(
    () => _api.updateCircle(
      circleId: circleId,
      name: name.trim(),
      kind: kind,
      expectedRevision: expectedRevision,
    ),
    success: '樹伴圈設定已儲存。',
  );

  Future<void> deferCircleSetup() async {
    final id = context?.activeHouseholdId;
    if (_disposed || id == null || membershipBusy) return;
    _deferredCircleSetups.add(id);
    notifyListeners();
    try {
      final preferences = await SharedPreferences.getInstance();
      await preferences.setStringList(
        'deferredCircleSetups',
        _deferredCircleSetups.toList(),
      );
    } catch (_) {
      if (!_disposed) {
        notice = '已暫時略過設定，下次開啟時可能再次提醒。';
        notifyListeners();
      }
    }
  }

  Future<HouseholdSummaryModel?> reloadCircleProfile(String circleId) async {
    if (_disposed || membershipBusy) return null;
    final epoch = _circleEpoch;
    final generation = ++_refreshGeneration;
    loading = false;
    try {
      final updated = await _api.getContext();
      if (_disposed ||
          epoch != _circleEpoch ||
          generation != _refreshGeneration) {
        return null;
      }
      _adoptContext(updated);
      final profile = updated.households
          .where((item) => item.id == circleId)
          .firstOrNull;
      membershipError = profile == null ? '找不到這個樹伴圈，請返回重新整理。' : null;
      notifyListeners();
      return profile;
    } catch (error) {
      if (!_disposed &&
          epoch == _circleEpoch &&
          generation == _refreshGeneration) {
        membershipError = _membershipFailure(error);
        notifyListeners();
      }
      return null;
    }
  }

  bool _beginMembershipAction() {
    if (_disposed || membershipBusy || journeyStarting || messageSending) {
      return false;
    }
    membershipError = null;
    if (offlineDemo) {
      membershipError = '離線示範只能瀏覽。連上服務後，才能建立、設定、邀請或加入樹伴圈。';
      notifyListeners();
      return false;
    }
    membershipBusy = true;
    notifyListeners();
    return true;
  }

  Future<bool> _changeHousehold(
    Future<AppContextModel> Function() request, {
    required String success,
  }) async {
    if (!_beginMembershipAction()) return false;
    _changingHousehold = true;
    ++_circleEpoch;
    ++_journeyRequestGeneration;
    journeyLoading = false;
    journeyShelf = null;
    ++_refreshGeneration; // A previous circle's late refresh must not win.
    loading = false;
    try {
      final updated = await request();
      if (_disposed) return false;
      _adoptContext(updated);
      _changingHousehold = false;
      await refresh();
      if (_disposed) return false;
      // Joining succeeded even if a subsequent content refresh is unavailable.
      offlineDemo = false;
      notice = notice == null ? success : '$success $notice';
      return true;
    } catch (error) {
      if (!_disposed) membershipError = _membershipFailure(error);
      return false;
    } finally {
      _changingHousehold = false;
      _finishMembershipAction();
    }
  }

  void _finishMembershipAction() {
    membershipBusy = false;
    if (!_disposed) {
      if (membershipError != null) notice = membershipError;
      notifyListeners();
    }
  }

  String _membershipFailure(Object error) {
    final message = error.toString().toLowerCase();
    if (message.contains('settings changed')) {
      return '樹伴圈設定已更新。請重新載入最新設定，再決定要如何修改。';
    }
    if (message.contains('manager permission')) return '只有這個樹伴圈的管理者可以修改名稱與類型。';
    if (message.contains('creation key')) {
      return '這次建立要求已送出。請先重新整理樹伴圈，確認結果後再建立其他圈。';
    }
    if (message.contains('already a household member')) {
      return '你已經在這個樹伴圈裡了，請從「我的樹伴圈」切換。';
    }
    if (message.contains('expired') || message.contains('already used')) {
      return '邀請碼已過期或已使用，請邀請人產生一組新的邀請碼。';
    }
    if (message.contains('invite not found')) {
      return '找不到這組邀請碼，請核對 8 碼英文字母與數字後重試。';
    }
    return _friendlyActionError(error, fallback: '暫時無法更新樹伴圈，請稍後再試一次。');
  }

  void _adoptContext(AppContextModel updated) {
    if (context?.activeHouseholdId != updated.activeHouseholdId) {
      ++_circleEpoch;
      ++_journeyRequestGeneration;
      journeyShelf = null;
      journeyLoading = false;
      journeyStarting = false;
      journeyError = null;
      messageSending = false;
      messageError = null;
      // Never retain another circle's private data after a partial refresh.
      home = null;
      tasks = [];
      tree = _emptyTree;
      circle = _emptyCircle;
      messages = [];
      companionPrompts = [];
      devices = [];
      reviews = [];
      lineBindings = [];
      latestLineBindingCode = null;
      impact = _emptyImpact;
      exploration = _emptyExploration;
      radar = _emptyRadar;
      discoveredTrees = [];
      lastGrowthAwardPoints = null;
      lastGrowthAwardTitle = null;
      exploring = false;
      _locationSubscription?.cancel();
      _locationSubscription = null;
    }
    context = updated;
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
        notice = '離線示範只能瀏覽，不會建立真實足跡或增加年輪進度。';
      } else {
        _replaceTask(await _api.completeTask(task.id));
        tree = await _api.getTree();
        await _refreshHomeSummary();
      }
      if (!offlineDemo) {
        lastGrowthAwardPoints = task.growthPoints;
        lastGrowthAwardTitle = task.title;
        notice = '生命樹長出新葉 +${task.growthPoints}：${task.title}';
      }
    } catch (error) {
      notice = _friendlyActionError(error, fallback: '任務暫時無法完成，請確認網路後再試一次。');
    }
    notifyListeners();
  }

  Future<void> claimCooperativeActionChapter(
    CooperativeActionChapterModel chapter, {
    required bool useAlternative,
  }) async {
    if (membershipBusy || journeyStarting) return;
    final epoch = _circleEpoch;
    bool current() => !_disposed && epoch == _circleEpoch;
    final action = circle.activeAction;
    if (action == null || action.runId == null || chapter.completed) return;
    try {
      if (offlineDemo) {
        notice = '離線示範不會建立多人接力紀錄；請連上服務後再認領。';
      } else {
        final updated = await _api.claimCooperativeActionChapter(
          runId: action.runId!,
          chapterId: chapter.id,
          useAlternative: useAlternative,
        );
        if (!current()) return;
        circle = updated;
        final selectedMode = useAlternative
            ? chapter.alternative?.verificationMode
            : chapter.verificationMode;
        notice = selectedMode == VerificationMode.timer
            ? '接力棒交到你手上，完整計時已由伺服器開始；離開 App 後仍會繼續。'
            : useAlternative
            ? '你已認領無障礙替代方案，請在到期前完成或轉交。'
            : '接力棒交到你手上了，請在到期前完成或轉交。';
      }
    } catch (error) {
      if (!current()) return;
      notice = _friendlyActionError(error, fallback: '目前無法認領這一棒，請重新整理後再試一次。');
    }
    if (current()) notifyListeners();
  }

  Future<void> handoffCooperativeActionChapter(
    CooperativeActionChapterModel chapter,
    CircleMemberModel target,
  ) async {
    if (membershipBusy || journeyStarting) return;
    final epoch = _circleEpoch;
    bool current() => !_disposed && epoch == _circleEpoch;
    final action = circle.activeAction;
    if (action == null || action.runId == null || chapter.completed) return;
    try {
      if (offlineDemo) {
        notice = '離線示範不會建立轉棒紀錄；請連上服務後再轉交。';
      } else {
        final updated = await _api.handoffCooperativeActionChapter(
          runId: action.runId!,
          chapterId: chapter.id,
          memberId: target.id,
        );
        if (!current()) return;
        circle = updated;
        notice = '接力棒已轉交給 ${target.displayName}，請對方在到期前完成。';
      }
    } catch (error) {
      if (!current()) return;
      notice = _friendlyActionError(error, fallback: '目前無法轉交這一棒，請重新整理後再試一次。');
    }
    if (current()) notifyListeners();
  }

  Future<void> releaseExpiredCooperativeActionClaim(
    CooperativeActionChapterModel chapter,
  ) async {
    if (membershipBusy || journeyStarting) return;
    final epoch = _circleEpoch;
    bool current() => !_disposed && epoch == _circleEpoch;
    final action = circle.activeAction;
    if (action == null || action.runId == null || chapter.completed) return;
    try {
      if (offlineDemo) {
        notice = '離線示範不會變更接力狀態；請連上服務後再釋出。';
      } else {
        final updated = await _api.releaseExpiredCooperativeActionClaim(
          runId: action.runId!,
          chapterId: chapter.id,
        );
        if (!current()) return;
        circle = updated;
        notice = '逾時的接力棒已釋出，樹伴成員可以重新認領。';
      }
    } catch (error) {
      if (!current()) return;
      notice = _friendlyActionError(error, fallback: '目前無法釋出這一棒，請重新整理後再試一次。');
    }
    if (current()) notifyListeners();
  }

  Future<void> completeCooperativeActionChapter(
    CooperativeActionChapterModel chapter,
  ) async {
    if (membershipBusy || journeyStarting) return;
    final epoch = _circleEpoch;
    bool current() => !_disposed && epoch == _circleEpoch;
    final action = circle.activeAction;
    if (action == null || action.runId == null || chapter.completed) return;
    try {
      if (offlineDemo) {
        notice = '離線示範不會假裝完成多人見證；請連上 API 後再接棒。';
      } else {
        final updated = await _api.completeCooperativeActionChapter(
          runId: action.runId!,
          chapterId: chapter.id,
        );
        if (!current()) return;
        circle = updated;
        final completedAction = circle.activeAction;
        if (completedAction?.completed ?? false) {
          ++_journeyRequestGeneration;
          journeyLoading = false;
          journeyShelf = null;
          try {
            final updatedTree = await _api.getTree();
            if (!current()) return;
            tree = updatedTree;
          } catch (_) {
            if (!current()) return;
            notice = '旅程已完成，共同紀錄已保存；生命樹資料暫時讀不到，請稍後重新整理。';
            notifyListeners();
            return;
          }
          lastGrowthAwardPoints = completedAction!.growthPoints;
          lastGrowthAwardTitle = completedAction.keepsakeName;
          notice =
              '大家完成接力了！生命樹長出「${completedAction.keepsakeName}」，年輪進度 +${completedAction.growthPoints}。';
        } else {
          notice = '你的真實足跡已留下，接力棒已交給下一位樹伴。';
        }
      }
    } catch (error) {
      if (!current()) return;
      notice = _friendlyActionError(error, fallback: '這一棒暫時無法送出，請重新整理後再試一次。');
    }
    if (current()) notifyListeners();
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
        notice = '離線示範不會假裝完成照片驗證，也不會增加年輪進度。';
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
      'BLAZE_REQUIRED' => '照片驗證環境尚未完成連線；請確認 Firebase Storage 與 AI 驗證服務已啟動。',
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
    final timerRemaining = RegExp(
      r'relay timer witness requires (\d+) more seconds',
    ).firstMatch(message);
    if (timerRemaining != null) {
      return '完整計時還差 ${timerRemaining.group(1)} 秒，時間到後再留下這一棒。';
    }
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
      final activeRouteId = exploration.activeSession?.routeId;
      final route = exploration.routes.isEmpty
          ? null
          : exploration.routes.firstWhere(
              (item) => item.id == activeRouteId,
              orElse: () => exploration.routes.first,
            );
      await _ensureLocationPermission();
      if (route != null) {
        await prepareJourneyStepAccessForRoute(route);
      } else {
        journeyStepAccessState = JourneyStepAccessState.notNeeded;
      }
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
        unawaited(recordExplorationPosition(previewPosition));
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
            recordExplorationPosition,
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

  Future<void> prepareJourneyStepAccessForRoute(
    ExplorationRouteModel route,
  ) async {
    final needsSteps = route.quests.any(
      (quest) =>
          quest.verificationMode == VerificationMode.locationCheckIn &&
          !quest.completed,
    );
    if (!needsSteps) {
      journeyStepAccessState = JourneyStepAccessState.notNeeded;
      notifyListeners();
      return;
    }
    journeyStepAccessState = JourneyStepAccessState.requesting;
    notifyListeners();
    try {
      journeyStepAccessState = await _journeyStepSource.requestReadAccess();
    } catch (_) {
      journeyStepAccessState = JourneyStepAccessState.unavailable;
    }
    notifyListeners();
  }

  bool get activeRouteNeedsJourneySteps {
    final routeId = exploration.activeSession?.routeId;
    if (routeId == null) return false;
    for (final route in exploration.routes) {
      if (route.id != routeId) continue;
      return route.quests.any(
        (quest) =>
            quest.verificationMode == VerificationMode.locationCheckIn &&
            !quest.completed,
      );
    }
    return false;
  }

  String get journeyStepAccessLabel => switch (journeyStepAccessState) {
    JourneyStepAccessState.notNeeded => '這趟路線不需要讀取健康步數',
    JourneyStepAccessState.notRequested => '尚未詢問健康步數權限',
    JourneyStepAccessState.requesting => '正在詢問健康步數權限',
    JourneyStepAccessState.ready => '健康步數已準備；只上傳這趟的步數總量',
    JourneyStepAccessState.denied => '未取得健康步數；位置探索可繼續，但本篇章無法形成三項同行見證',
    JourneyStepAccessState.unavailable => '這台裝置目前無法提供健康步數',
    JourneyStepAccessState.readError => '暫時讀不到健康步數，下一個定位點會再試一次',
  };

  Future<void> recordExplorationPosition(Position position) async {
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
        JourneyStepReading? stepReading;
        if (activeRouteNeedsJourneySteps &&
            (journeyStepAccessState == JourneyStepAccessState.ready ||
                journeyStepAccessState == JourneyStepAccessState.readError)) {
          try {
            stepReading = await _journeyStepSource.readTotal(
              startedAt: exploration.activeSession!.startedAt,
              endedAt: position.timestamp,
            );
            journeyStepAccessState = stepReading == null
                ? JourneyStepAccessState.readError
                : JourneyStepAccessState.ready;
          } catch (_) {
            journeyStepAccessState = JourneyStepAccessState.readError;
          }
        }
        exploration = await _api.recordExplorationEvent(
          sessionId: sessionId,
          eventKey: 'mobile-${DateTime.now().microsecondsSinceEpoch}',
          latitude: position.latitude,
          longitude: position.longitude,
          accuracyMeters: position.accuracy,
          occurredAt: position.timestamp,
          stepCountSinceStart: stepReading?.total,
          stepSource: stepReading?.source,
          stepsExcludeManualEntries: stepReading == null ? null : true,
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

  Future<bool> completeRadarMission(
    RadarMissionModel mission, {
    VenueWitnessSubmission? venueWitness,
  }) async {
    if (_disposed || _radarCompletionInFlight) return false;
    if (mission.status == 'COMPLETED') return true;
    if (mission.status != 'UNLOCKED') {
      notice = '請先走進「${mission.title}」的任務範圍再完成。';
      notifyListeners();
      return false;
    }
    final timerRemaining = mission.timerRemainingAt(DateTime.now());
    if (timerRemaining > Duration.zero) {
      notice =
          '「${mission.title}」還需要 ${timerRemaining.inSeconds} 秒，完成後生命樹才會成長。';
      notifyListeners();
      return false;
    }
    if (mission.requiresVenueWitness &&
        (venueWitness == null || !venueWitness.isValidAt(DateTime.now()))) {
      notice = '請掃描現場到場碼，並取得最近三十秒、誤差五十公尺內的真實位置。';
      notifyListeners();
      return false;
    }
    final activeCircle = context?.activeHouseholdId;
    bool current() => !_disposed && context?.activeHouseholdId == activeCircle;
    var completed = false;
    _radarCompletionInFlight = true;
    try {
      if (offlineDemo) {
        notice = '離線示範只能瀏覽，不會完成雷達旅程或增加年輪進度。';
      } else {
        final nextRadar = await _api.completeRadarMission(
          mission.id,
          venueWitness: venueWitness,
        );
        if (!current()) return false;
        radar = nextRadar;
        completed = radar.missions.any(
          (item) => item.id == mission.id && item.isCompleted,
        );
        if (!completed) throw const FormatException('旅程尚未完成');
        final nextTree = await _safeRefresh('treeAfterRadar', _api.getTree());
        final nextImpact = await _safeRefresh(
          'impactAfterRadar',
          _api.getImpactSummary(),
        );
        final nextExploration = await _safeRefresh(
          'explorationAfterRadar',
          _api.getExplorationState(),
        );
        if (!current()) return false;
        tree = nextTree ?? tree;
        impact = nextImpact ?? impact;
        exploration = nextExploration ?? exploration;
        final nextPrompts = await _safeRefresh(
          'companionPromptsAfterRadarComplete',
          _api.getCompanionPrompts(),
        );
        final nextHome = await _safeRefresh(
          'homeAfterRadar',
          _api.getHomeSummary(),
        );
        if (!current()) return false;
        companionPrompts = nextPrompts ?? companionPrompts;
        home = nextHome ?? home;
        lastGrowthAwardPoints = mission.growthPoints;
        lastGrowthAwardTitle = mission.title;
        notice =
            '生命樹長出新葉 +${mission.growthPoints}：${mission.title}。生活片段已整理，可分享給家人/陪伴者。';
      }
    } catch (error) {
      if (current()) {
        notice = _friendlyActionError(
          error,
          fallback: '旅程暫時無法完成。請確認連線、現場碼與位置後重試。',
        );
      }
    } finally {
      _radarCompletionInFlight = false;
    }
    if (current()) notifyListeners();
    return current() && completed;
  }

  Future<VenueReceipt?> getVenueReceipt(String missionId) {
    if (offlineDemo) throw const FormatException('離線示範不提供到場見證或回饋。');
    return _api.getVenueReceipt(missionId);
  }

  Future<VenueRedemptionCode> createVenueRedemptionCode(String missionId) {
    if (offlineDemo) throw const FormatException('離線示範不提供領取碼。');
    return _api.createVenueRedemptionCode(missionId);
  }

  Future<bool> sendFamilyMessage(String body) async {
    if (_disposed || messageSending || membershipBusy || body.trim().isEmpty) {
      return false;
    }
    if (offlineDemo || context == null) {
      messageError = '連上服務並進入樹伴圈後，才能傳送訊息。離線示範不會代為送出。';
      notifyListeners();
      return false;
    }
    final epoch = _circleEpoch;
    final circleId = context!.activeHouseholdId;
    bool current() => !_disposed && epoch == _circleEpoch;
    messageSending = true;
    messageError = null;
    notifyListeners();
    try {
      final message = await _api.sendMessage(body.trim());
      if (!current()) return false;
      messages = [message, ...messages.where((item) => item.id != message.id)];
      if (_messageDrafts[circleId]?.trim() == body.trim()) {
        _messageDrafts.remove(circleId);
      }
      notice = '訊息已存入樹伴圈，夥伴可在 App 裡查看。';
      return true;
    } catch (_) {
      if (current()) {
        messageError = '尚未收到送出確認，文字已保留。先重新整理最近訊息，再決定是否重送。';
      }
      return false;
    } finally {
      if (current()) {
        messageSending = false;
        notifyListeners();
      }
    }
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
    _disposed = true;
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

  int? get remainingToRadiusMeters {
    final distance = distanceMeters;
    if (distance == null) return null;
    return math.max(0, distance - mission.radiusMeters);
  }

  String get navigationDistanceLabel {
    final remaining = remainingToRadiusMeters;
    if (remaining == null) return '等待定位';
    if (remaining == 0) return '已在半徑內';
    if (remaining >= 1000) {
      return '還差 ${(remaining / 1000).toStringAsFixed(1)}km';
    }
    return '還差 ${remaining}m';
  }

  String get navigationHeadline => switch (adventureState) {
    AdventureMissionState.waitingForLocation => '正在定位你的位置',
    AdventureMissionState.far => '朝任務光點前進',
    AdventureMissionState.near => '任務就在附近',
    AdventureMissionState.insideRadius => '已進入任務範圍',
    AdventureMissionState.unlocked => '任務已接取',
    AdventureMissionState.timerRunning => '計時任務進行中',
    AdventureMissionState.readyToComplete => '可以完成任務',
    AdventureMissionState.completed => '任務已完成',
    AdventureMissionState.expired => '任務已結束',
    AdventureMissionState.upcoming => '任務尚未開始',
  };

  String get navigationInstruction {
    final remaining = navigationDistanceLabel;
    return switch (adventureState) {
      AdventureMissionState.waitingForLocation => '先讓地圖找到你，再顯示附近任務。',
      AdventureMissionState.far => '$remaining，靠近後會自動解鎖。',
      AdventureMissionState.near => '$remaining，走進光圈就能接取。',
      AdventureMissionState.insideRadius => '你已在安全半徑內，App 正在確認任務。',
      AdventureMissionState.unlocked =>
        mission.isTimer ? '停留一下，倒數完成後就能提交。' : '可以完成這件小事，完成後生命樹會長出新葉。',
      AdventureMissionState.timerRunning =>
        '剩下 ${timerRemaining.inSeconds} 秒，時間到才能完成。',
      AdventureMissionState.readyToComplete =>
        '完成後生命樹會長出新葉 +${mission.growthPoints}。',
      AdventureMissionState.completed => '這次成長已被記錄，重送也不會重複加分。',
      AdventureMissionState.expired => '這個任務已經結束，看看附近其他光點。',
      AdventureMissionState.upcoming => '這個任務稍後才會亮起。',
    };
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
    if (distance >= 1000) {
      final kilometers = distance / 1000;
      final compact = kilometers >= 100
          ? kilometers.toStringAsFixed(0)
          : kilometers.toStringAsFixed(1);
      return '距離 ${compact}km';
    }
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

const _emptyCircle = CircleOverviewModel(
  id: 'empty-circle',
  name: '我的樹伴圈',
  kind: 'FAMILY',
  currentMemberId: 'current-member',
  memberCount: 1,
  members: [],
  activeAction: null,
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

final _fallbackCircle = CircleOverviewModel(
  id: 'demo-circle',
  name: '林家與好朋友',
  kind: 'FAMILY',
  currentMemberId: 'demo-elder',
  memberCount: 3,
  members: const [
    CircleMemberModel(
      id: 'demo-daughter',
      displayName: '小晴',
      relationship: '女兒',
    ),
    CircleMemberModel(
      id: 'demo-neighbor',
      displayName: '美玲阿姨',
      relationship: '鄰居朋友',
    ),
    CircleMemberModel(id: 'demo-elder', displayName: '林阿公', relationship: '本人'),
  ],
  activeAction: CooperativeActionModel(
    id: 'demo-action',
    runId: 'demo-run',
    title: '讓春天回到生命樹',
    description: '三位樹伴輪流找回陽光、水與新芽，完成後一起留下春日紀念枝。',
    kind: CooperativeActionKind.relay,
    status: CooperativeActionStatus.active,
    minimumContributors: 3,
    maxChaptersPerMember: 1,
    contributorCount: 0,
    completedChapterCount: 0,
    totalChapterCount: 3,
    growthPoints: 120,
    keepsakeName: '春日紀念枝',
    chapters: [
      CooperativeActionChapterModel(
        id: 'demo-sunlight',
        sequence: 1,
        title: '找回陽光',
        description: '到附近安全的戶外空間走一小段，感受今天的光。',
        elementName: '陽光',
        verificationMode: VerificationMode.selfCheck,
        alternative: CooperativeActionAlternativeModel(
          title: '在窗邊找一束光',
          description: '不方便外出時，在安全的窗邊坐一會兒，感受今天的光。',
          verificationMode: VerificationMode.selfCheck,
        ),
        claim: null,
        contributor: null,
      ),
      CooperativeActionChapterModel(
        id: 'demo-water',
        sequence: 2,
        title: '喚醒水流',
        description: '跟著畫面完成三分鐘舒緩伸展或慢呼吸。',
        elementName: '水',
        verificationMode: VerificationMode.selfCheck,
        alternative: CooperativeActionAlternativeModel(
          title: '坐著完成慢呼吸',
          description: '不方便伸展時，坐穩後跟著畫面完成三分鐘慢呼吸。',
          verificationMode: VerificationMode.selfCheck,
        ),
        claim: null,
        contributor: null,
      ),
      CooperativeActionChapterModel(
        id: 'demo-sprout',
        sequence: 3,
        title: '迎接新芽',
        description: '到戶外找到一株讓你喜歡的植物，停下來看看它。',
        elementName: '新芽',
        verificationMode: VerificationMode.selfCheck,
        alternative: CooperativeActionAlternativeModel(
          title: '在室內找一片綠',
          description: '不方便外出時，在室內找一株植物或從窗邊觀察一片綠。',
          verificationMode: VerificationMode.selfCheck,
        ),
        claim: null,
        contributor: null,
      ),
    ],
  ),
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
