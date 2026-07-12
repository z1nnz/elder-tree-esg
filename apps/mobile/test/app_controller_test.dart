import 'dart:async';

import 'package:elder_tree_mobile/src/api_client.dart';
import 'package:elder_tree_mobile/src/app_controller.dart';
import 'package:elder_tree_mobile/src/models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class UnavailableApiClient extends ApiClient {
  @override
  Future<HomeSummaryModel> getHomeSummary() => Future.error('offline');

  @override
  Future<AppContextModel> getContext() => Future.error('offline');

  @override
  Future<List<DailyTask>> getTasks() => Future.error('offline');

  @override
  Future<TreeSummary> getTree() => Future.error('offline');

  @override
  Future<ExplorationStateModel> getExplorationState() =>
      Future.error('offline');

  @override
  Future<RadarStateModel> getRadarState() => Future.error('offline');

  @override
  Future<List<FamilyMessageModel>> getMessages() => Future.error('offline');

  @override
  Future<List<CompanionDevice>> getDevices() => Future.error('offline');

  @override
  Future<DailyTask> completeTask(String taskId) => Future.error('offline');
}

class PartiallyUnavailableApiClient extends ApiClient {
  @override
  Future<HomeSummaryModel> getHomeSummary() async => HomeSummaryModel(
    generatedAt: DateTime.parse('2026-07-12T00:00:00.000Z'),
    displayName: '千咚咚',
    activeHouseholdName: '林家',
    tree: _syncedTree,
    nextAction: const HomeNextActionModel(
      kind: HomeNextActionKind.completeTask,
      title: '喝一口水',
      description: '先完成一件小事。',
      ctaLabel: '我完成了',
      taskId: 'task-water',
    ),
    taskCards: const [],
    pendingReviewCount: 0,
    messageCount: 0,
    capabilities: const HomeCapabilitiesModel(
      photoEvidenceEnabled: true,
      geminiPhotoVerificationEnabled: true,
    ),
    companionSprite: const CompanionSpriteStateModel(
      mood: CompanionSpriteMood.ready,
      label: '今天也慢慢來',
      energyPoints: 320,
    ),
    alerts: const [],
  );

  @override
  Future<AppContextModel> getContext() async => const AppContextModel(
    displayName: '千咚咚',
    activeHouseholdId: 'household-1',
    households: [
      HouseholdSummaryModel(
        id: 'household-1',
        name: '林家',
        relationship: 'SELF',
      ),
    ],
    photoEvidenceEnabled: true,
    geminiPhotoVerificationEnabled: true,
  );

  @override
  Future<List<DailyTask>> getTasks() async => const [
    DailyTask(
      id: 'task-water',
      title: '喝一口水',
      description: '補充水分。',
      verificationMode: VerificationMode.selfCheck,
      growthPoints: 6,
      status: TaskStatus.available,
    ),
  ];

  @override
  Future<TreeSummary> getTree() async => _syncedTree;

  @override
  Future<ExplorationStateModel> getExplorationState() async =>
      const ExplorationStateModel(
        totalDistanceMeters: 0,
        coarseCell: null,
        activeSession: null,
        routes: [],
      );

  @override
  Future<RadarStateModel> getRadarState() =>
      Future.error(TimeoutException('radar timeout'));

  @override
  Future<List<FamilyMessageModel>> getMessages() async => const [];

  @override
  Future<List<CompanionDevice>> getDevices() async => const [];

  @override
  Future<List<FamilyReviewModel>> getFamilyReviews() async => const [];

  @override
  Future<ImpactSummaryModel> getImpactSummary() async =>
      const ImpactSummaryModel(
        householdName: '林家',
        treeStage: 'SPROUT',
        growthPoints: 320,
        nextStageAt: 500,
        contributedPoints: 0,
      );
}

const _syncedTree = TreeSummary(
  name: '我們家的陪伴樹',
  householdName: '林家',
  stage: 'SPROUT',
  growthPoints: 320,
  nextStageAt: 500,
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('authenticated offline mode never awards local growth', () async {
    SharedPreferences.setMockInitialValues({});
    final controller = AppController(
      api: UnavailableApiClient(),
      allowOfflineDemo: false,
    );

    await controller.initialize();
    const task = DailyTask(
      id: 'offline-task',
      title: '離線任務',
      description: '不應在本地加分',
      verificationMode: VerificationMode.selfCheck,
      growthPoints: 30,
      status: TaskStatus.available,
    );
    final before = controller.tree.growthPoints;

    await controller.completeTask(task);

    expect(controller.offlineDemo, isFalse);
    expect(controller.tasks, isEmpty);
    expect(controller.tree.growthPoints, before);
    controller.dispose();
  });

  test(
    'keeps the App visible when one core refresh endpoint times out',
    () async {
      SharedPreferences.setMockInitialValues({});
      final controller = AppController(
        api: PartiallyUnavailableApiClient(),
        allowOfflineDemo: false,
      );

      await controller.initialize();

      expect(controller.offlineDemo, isFalse);
      expect(controller.notice, isNull);
      expect(controller.context?.displayName, '千咚咚');
      expect(controller.tasks.single.id, 'task-water');
      expect(controller.tree.growthPoints, 320);
      expect(controller.exploration.totalDistanceMeters, 0);
      expect(controller.radar.missions, isEmpty);
      controller.dispose();
    },
  );

  test('sorts radar missions by playable exploration state', () {
    final controller = AppController(allowOfflineDemo: false);
    controller.latestLatitude = 25.04411;
    controller.latestLongitude = 121.52944;
    controller.radar = RadarStateModel(
      generatedAt: DateTime.parse('2026-07-07T09:00:00.000Z'),
      missions: [
        _radarMission(id: 'done', status: 'COMPLETED', latitude: 25.04411),
        _radarMission(id: 'far', status: 'LOCKED', latitude: 25.08),
        _radarMission(id: 'near', status: 'LOCKED', latitude: 25.04411),
        _radarMission(
          id: 'ready',
          status: 'UNLOCKED',
          latitude: 25.04412,
          unlockedAt: DateTime.now().subtract(const Duration(minutes: 5)),
        ),
      ],
    );

    final views = controller.radarMissionViews;

    expect(views.map((view) => view.mission.id), [
      'ready',
      'near',
      'far',
      'done',
    ]);
    expect(views.first.canComplete, isTrue);
    expect(views.first.adventureState, AdventureMissionState.readyToComplete);
    expect(views.first.primaryActionLabel, '我完成了');
    expect(views[1].canUnlock, isTrue);
    expect(views[1].adventureState, AdventureMissionState.insideRadius);
    expect(views[1].distanceLabel, startsWith('已進入'));
    expect(views[1].proximityProgress, 1);
    expect(views.last.adventureState, AdventureMissionState.completed);
    controller.dispose();
  });

  test(
    'describes exploration gameplay states without storing fake progress',
    () {
      final lockedFar = RadarMissionViewState(
        mission: _radarMission(id: 'far', status: 'LOCKED', latitude: 25.08),
        distanceMeters: 1200,
        now: DateTime.parse('2026-07-07T09:00:00.000Z'),
      );
      final lockedNear = RadarMissionViewState(
        mission: _radarMission(
          id: 'near',
          status: 'LOCKED',
          latitude: 25.04411,
        ),
        distanceMeters: 120,
        now: DateTime.parse('2026-07-07T09:00:00.000Z'),
      );
      final waitingLocation = RadarMissionViewState(
        mission: _radarMission(
          id: 'waiting',
          status: 'LOCKED',
          latitude: 25.04411,
        ),
        distanceMeters: null,
        now: DateTime.parse('2026-07-07T09:00:00.000Z'),
      );

      expect(lockedFar.adventureState, AdventureMissionState.far);
      expect(lockedFar.stateLabel, '靠近中');
      expect(lockedFar.proximityProgress, 0);
      expect(lockedNear.adventureState, AdventureMissionState.near);
      expect(lockedNear.stateLabel, '快到了');
      expect(lockedNear.proximityProgress, greaterThan(0));
      expect(
        waitingLocation.adventureState,
        AdventureMissionState.waitingForLocation,
      );
      expect(waitingLocation.primaryActionLabel, '先開始探索');
    },
  );

  test('parses photo evidence decisions from the API', () {
    final pass = EvidenceDecisionModel.fromJson(const {
      'evidenceId': 'evidence-1',
      'decision': 'PASS',
      'status': 'COMPLETED',
    });
    final review = EvidenceDecisionModel.fromJson(const {
      'evidenceId': 'evidence-2',
      'decision': 'REVIEW',
      'status': 'VERIFYING',
    });
    final fail = EvidenceDecisionModel.fromJson(const {
      'evidenceId': 'evidence-3',
      'decision': 'FAIL',
      'status': 'REJECTED',
    });

    expect(pass.decision, EvidenceDecision.pass);
    expect(pass.status, TaskStatus.completed);
    expect(review.decision, EvidenceDecision.review);
    expect(review.status, TaskStatus.verifying);
    expect(fail.decision, EvidenceDecision.fail);
    expect(fail.status, TaskStatus.rejected);
  });

  test('parses App V2 home summary for the companion hub', () {
    final home = HomeSummaryModel.fromJson({
      'generatedAt': '2026-07-11T00:00:00.000Z',
      'displayName': '千咚咚',
      'activeHouseholdName': '林家',
      'tree': {
        'id': 'tree-1',
        'name': '我們家的陪伴樹',
        'householdName': '林家',
        'stage': 'SPROUT',
        'growthPoints': 180,
        'nextStageAt': 250,
      },
      'nextAction': {
        'kind': 'TAKE_PHOTO',
        'title': '拍下今天的一抹綠',
        'description': '找一株植物。',
        'ctaLabel': '拍照驗證',
        'taskId': 'task-photo',
        'radarMissionId': null,
      },
      'taskCards': [
        {
          'id': 'task-photo',
          'title': '拍下今天的一抹綠',
          'description': '找一株植物。',
          'verificationMode': 'PHOTO_AI',
          'growthPoints': 80,
          'status': 'AVAILABLE',
          'startedAt': null,
          'minimumSeconds': null,
          'dueAt': null,
          'capability': {'enabled': true, 'reason': null},
          'stateLabel': '可開始',
          'actionLabel': '拍照驗證',
        },
      ],
      'featuredRadarMission': null,
      'pendingReviewCount': 1,
      'messageCount': 1,
      'latestMessage': {
        'id': 'message-1',
        'authorName': '小晴',
        'body': '今天也慢慢來。',
        'createdAt': '2026-07-11T00:00:00.000Z',
        'deliveredToDeviceAt': null,
      },
      'capabilities': {
        'photoEvidence': {'enabled': true, 'reason': null},
        'geminiPhotoVerification': {'enabled': true, 'reason': null},
      },
      'companionSprite': {
        'mood': 'READY',
        'label': '小葉靈帶著今天的任務來了',
        'energyPoints': 180,
      },
      'alerts': [
        {
          'id': 'reviews',
          'kind': 'REVIEW',
          'title': '等待覆核',
          'description': '有家人的照片需要你確認。',
          'count': 1,
        },
      ],
    });

    expect(home.displayName, '千咚咚');
    expect(home.nextAction.kind, HomeNextActionKind.takePhoto);
    expect(home.taskCards.single.actionLabel, '拍照驗證');
    expect(home.companionSprite.mood, CompanionSpriteMood.ready);
    expect(home.latestMessage?.delivered, isFalse);
    expect(home.capabilities.photoEvidenceEnabled, isTrue);
  });

  test('describes disabled photo AI capabilities without Blaze wording', () {
    final controller = AppController(allowOfflineDemo: false);
    const storageMissing = DailyTask(
      id: 'photo-storage',
      title: '拍植物',
      description: '測試',
      verificationMode: VerificationMode.photoAi,
      growthPoints: 8,
      status: TaskStatus.available,
      capabilityEnabled: false,
      capabilityReason: 'PHOTO_STORAGE_UNAVAILABLE',
    );
    const verifierMissing = DailyTask(
      id: 'photo-verifier',
      title: '拍水杯',
      description: '測試',
      verificationMode: VerificationMode.photoAi,
      growthPoints: 8,
      status: TaskStatus.available,
      capabilityEnabled: false,
      capabilityReason: 'PHOTO_VERIFIER_UNAVAILABLE',
    );

    expect(controller.photoTaskActionLabel(storageMissing), '照片儲存尚未設定');
    expect(controller.photoTaskActionLabel(verifierMissing), 'AI 驗證服務未連線');
    expect(
      controller.photoTaskActionLabel(storageMissing).contains('Blaze'),
      isFalse,
    );
    controller.dispose();
  });
}

RadarMissionModel _radarMission({
  required String id,
  required String status,
  required double latitude,
  DateTime? unlockedAt,
}) => RadarMissionModel(
  id: id,
  title: '任務 $id',
  description: '測試任務',
  category: 'NATURE',
  tag: '觀察',
  latitude: latitude,
  longitude: 121.52944,
  radiusMeters: 90,
  startsAt: DateTime.parse('2026-07-07T08:00:00.000Z'),
  endsAt: DateTime.parse('2026-07-07T10:00:00.000Z'),
  remainingSeconds: 3600,
  verificationMode: VerificationMode.selfCheck,
  minimumSeconds: null,
  growthPoints: 8,
  badgeName: null,
  publicationStatus: 'PUBLISHED',
  status: status,
  unlockedAt: unlockedAt,
  completedAt: status == 'COMPLETED'
      ? DateTime.parse('2026-07-07T09:00:00.000Z')
      : null,
);
