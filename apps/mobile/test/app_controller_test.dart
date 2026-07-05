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
    final task = controller.tasks.firstWhere(
      (item) => item.verificationMode == VerificationMode.selfCheck,
    );
    final before = controller.tree.growthPoints;

    await controller.completeTask(task);

    expect(controller.offlineDemo, isFalse);
    expect(controller.tree.growthPoints, before);
    expect(
      controller.tasks.firstWhere((item) => item.id == task.id).status,
      isNot(TaskStatus.completed),
    );
    controller.dispose();
  });
}
