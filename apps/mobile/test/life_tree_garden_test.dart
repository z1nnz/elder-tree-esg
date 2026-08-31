import 'dart:convert';

import 'package:elder_tree_mobile/src/life_tree_garden.dart';
import 'package:elder_tree_mobile/src/models.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('tree-companion/life-tree-garden-test');
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  tearDown(() async {
    messenger.setMockMethodCallHandler(channel, null);
  });

  test('encodes backend-owned stable keepsake slots for Unity', () {
    final state = LifeTreeGardenState.fromVerifiedResults(
      stageIndex: 4,
      reduceMotion: true,
      results: [
        JourneyResultModel(
          runId: 'run-1',
          title: '很久沒聊了',
          keepsakeName: '相聚果實',
          keepsakeSlot: 7,
          completedAt: DateTime(2026, 8, 31),
          growthPoints: 80,
          contributions: const [],
        ),
      ],
    );

    expect(jsonDecode(state.encode()), {
      'schemaVersion': 1,
      'stageIndex': 4,
      'reduceMotion': true,
      'keepsakes': [
        {
          'id': 'run-1',
          'slotIndex': 7,
          'kind': '相聚果實',
          'label': '相聚果實',
          'color': '#84B9A5',
        },
      ],
    });
  });

  test('rejects duplicate keepsake sockets before native launch', () {
    expect(
      () => LifeTreeGardenState(
        stageIndex: 2,
        reduceMotion: false,
        keepsakes: [
          LifeTreeGardenKeepsake(
            id: 'a',
            slotIndex: 2,
            kind: '季節枝',
            label: '春季枝',
            color: '#FFFFFF',
          ),
          LifeTreeGardenKeepsake(
            id: 'b',
            slotIndex: 2,
            kind: '季節枝',
            label: '夏季枝',
            color: '#FFFFFF',
          ),
        ],
      ),
      throwsArgumentError,
    );
  });

  test('opens only after the native library reports available', () async {
    final calls = <MethodCall>[];
    messenger.setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      return switch (call.method) {
        'isAvailable' => true,
        'open' => true,
        _ => null,
      };
    });
    final bridge = LifeTreeGardenBridge(channel: channel);
    final opened = await bridge.open(
      LifeTreeGardenState(
        stageIndex: 1,
        reduceMotion: false,
        keepsakes: const [],
      ),
    );

    expect(opened, isTrue);
    expect(calls.map((item) => item.method), ['isAvailable', 'open']);
    expect((calls.last.arguments as Map)['state'], contains('"stageIndex":1'));
  });

  test('uses the Flutter tree when the Unity library is absent', () async {
    messenger.setMockMethodCallHandler(channel, (call) async => false);
    final opened = await LifeTreeGardenBridge(channel: channel).open(
      LifeTreeGardenState(
        stageIndex: 1,
        reduceMotion: false,
        keepsakes: const [],
      ),
    );
    expect(opened, isFalse);
  });
}
