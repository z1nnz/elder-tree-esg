import 'dart:convert';

import 'package:flutter/services.dart';

import 'models.dart';

const _keepsakeColours = <String>[
  '#E6B566',
  '#D9896A',
  '#8FBF78',
  '#79AFC2',
  '#C497C8',
  '#E3A8A1',
  '#A6C86F',
  '#84B9A5',
  '#D6A15B',
  '#8EA7D2',
  '#C7A86E',
  '#A0C4B4',
];

class LifeTreeGardenState {
  LifeTreeGardenState({
    required this.stageIndex,
    required this.reduceMotion,
    required List<LifeTreeGardenKeepsake> keepsakes,
  }) : keepsakes = List.unmodifiable(keepsakes) {
    if (stageIndex < 0 || stageIndex > 5) {
      throw ArgumentError.value(stageIndex, 'stageIndex', '必須介於 0 到 5');
    }
    final slots = keepsakes.map((item) => item.slotIndex).toSet();
    if (slots.length != keepsakes.length) {
      throw ArgumentError('生命樹紀念物不可使用重複掛點');
    }
  }

  factory LifeTreeGardenState.fromVerifiedResults({
    required int stageIndex,
    required bool reduceMotion,
    required Iterable<JourneyResultModel> results,
  }) {
    final recent = results.take(12);
    return LifeTreeGardenState(
      stageIndex: stageIndex,
      reduceMotion: reduceMotion,
      keepsakes: [
        for (final result in recent)
          LifeTreeGardenKeepsake(
            id: result.runId,
            slotIndex: result.keepsakeSlot,
            kind: _kindFor(result.keepsakeName),
            label: result.keepsakeName,
            color: _keepsakeColours[result.keepsakeSlot],
          ),
      ],
    );
  }

  final int stageIndex;
  final bool reduceMotion;
  final List<LifeTreeGardenKeepsake> keepsakes;

  Map<String, Object> toJson() => {
    'schemaVersion': 1,
    'stageIndex': stageIndex,
    'reduceMotion': reduceMotion,
    'keepsakes': keepsakes.map((item) => item.toJson()).toList(),
  };

  String encode() => jsonEncode(toJson());

  static String _kindFor(String name) {
    if (name.contains('果')) return '相聚果實';
    if (name.contains('花')) return '探索花';
    if (name.contains('公益')) return '公益葉';
    return '季節枝';
  }
}

class LifeTreeGardenKeepsake {
  LifeTreeGardenKeepsake({
    required this.id,
    required this.slotIndex,
    required this.kind,
    required this.label,
    required this.color,
  }) {
    if (id.trim().isEmpty) throw ArgumentError('紀念物識別碼不可為空');
    if (slotIndex < 0 || slotIndex >= 12) {
      throw ArgumentError.value(slotIndex, 'slotIndex', '必須介於 0 到 11');
    }
  }

  final String id;
  final int slotIndex;
  final String kind;
  final String label;
  final String color;

  Map<String, Object> toJson() => {
    'id': id,
    'slotIndex': slotIndex,
    'kind': kind,
    'label': label,
    'color': color,
  };
}

class LifeTreeGardenBridge {
  const LifeTreeGardenBridge({
    MethodChannel channel = const MethodChannel(
      'tree-companion/life-tree-garden',
    ),
  }) : _channel = channel;

  final MethodChannel _channel;

  Future<bool> isAvailable() async {
    try {
      return await _channel.invokeMethod<bool>('isAvailable') ?? false;
    } on MissingPluginException {
      return false;
    } on PlatformException {
      return false;
    }
  }

  Future<bool> open(LifeTreeGardenState state) async {
    if (!await isAvailable()) return false;
    try {
      return await _channel.invokeMethod<bool>('open', {
            'state': state.encode(),
          }) ??
          false;
    } on MissingPluginException {
      return false;
    } on PlatformException {
      return false;
    }
  }
}
