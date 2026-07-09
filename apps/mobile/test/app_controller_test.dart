import 'package:elder_tree_mobile/src/api_client.dart';
import 'package:elder_tree_mobile/src/app_controller.dart';
import 'package:elder_tree_mobile/src/models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class UnavailableApiClient extends ApiClient {
  @override
  Future<List<DailyTask>> getTasks() => Future.error('offline');

  @override
  Future<TreeSummary> getTree() => Future.error('offline');

  @override
  Future<List<FamilyMessageModel>> getMessages() => Future.error('offline');

  @override
  Future<List<CompanionDevice>> getDevices() => Future.error('offline');

  @override
  Future<DailyTask> completeTask(String taskId) => Future.error('offline');
}

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
    expect(views[1].canUnlock, isTrue);
    expect(views[1].distanceLabel, startsWith('已進入'));
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
