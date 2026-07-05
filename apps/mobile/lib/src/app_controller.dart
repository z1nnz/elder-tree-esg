import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';
import 'models.dart';

class AppController extends ChangeNotifier {
  AppController({ApiClient? api, bool allowOfflineDemo = true})
    : _api = api ?? ApiClient(),
      _allowOfflineDemo = allowOfflineDemo;

  final ApiClient _api;
  final bool _allowOfflineDemo;
  final ImagePicker _picker = ImagePicker();
  final List<StreamSubscription<dynamic>> _subscriptions = [];

  bool loading = true;
  bool elderMode = true;
  bool offlineDemo = false;
  String? notice;
  List<DailyTask> tasks = _fallbackTasks;
  TreeSummary tree = _fallbackTree;
  List<FamilyMessageModel> messages = _fallbackMessages;
  List<CompanionDevice> devices = _fallbackDevices;
  List<String> discoveredTrees = [];

  Future<void> initialize() async {
    final preferences = await SharedPreferences.getInstance();
    elderMode = preferences.getBool('elderMode') ?? true;
    await refresh();
  }

  Future<void> refresh() async {
    loading = true;
    notice = null;
    notifyListeners();
    try {
      final results = await Future.wait([
        _api.getTasks(),
        _api.getTree(),
        _api.getMessages(),
        _api.getDevices(),
      ]);
      tasks = results[0] as List<DailyTask>;
      tree = results[1] as TreeSummary;
      messages = results[2] as List<FamilyMessageModel>;
      devices = results[3] as List<CompanionDevice>;
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

  Future<void> photographTask(DailyTask task) async {
    try {
      final photo = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 82,
        maxWidth: 1600,
      );
      if (photo == null) return;
      if (!offlineDemo) {
        await _api.submitPhotoEvidence(task.id, photo.name);
      }
      _replaceTask(task.copyWith(status: TaskStatus.verifying));
      notice = '照片已送出。AI 信心不足時會交由人工覆核，不會直接判定失敗。';
    } catch (error) {
      notice = '照片送出失敗：$error';
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
        discoveredTrees = ['ElderTree-DEMO-001'];
        notice = '未找到實體裝置，已顯示可操作的示範裝置。';
      } else {
        notice = '找到 ${discoveredTrees.length} 台附近裝置。';
      }
    } catch (_) {
      discoveredTrees = ['ElderTree-DEMO-001'];
      notice = '藍牙權限尚未開啟，已切換為示範配網。';
    }
    notifyListeners();
  }

  Future<void> claimDevice(String serial, String code) async {
    try {
      final device = offlineDemo
          ? _fallbackDevices.first
          : await _api.claimDevice(serial.trim(), code.trim());
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
    for (final subscription in _subscriptions) {
      subscription.cancel();
    }
    _api.dispose();
    super.dispose();
  }
}

const _fallbackTasks = [
  DailyTask(
    id: '11111111-1111-4111-8111-111111111111',
    title: '拍下今天的一抹綠',
    description: '找一株植物，拍下讓你停下來多看一眼的地方。',
    verificationMode: VerificationMode.photoAi,
    growthPoints: 80,
    status: TaskStatus.available,
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

const _fallbackDevices = [
  CompanionDevice(
    id: '44444444-4444-4444-8444-444444444444',
    serialNumber: 'TREE-DEMO-001',
    name: '客廳陪伴樹',
    online: true,
    firmwareVersion: '0.1.0',
    temperatureC: 25.6,
    humidityPercent: 61,
    ambientLux: 168,
    presence: true,
  ),
];
