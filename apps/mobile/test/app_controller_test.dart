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
}
