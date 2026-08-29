import 'package:elder_tree_mobile/src/life_tree_art.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget treeHost({
  required int stageIndex,
  required int keepsakeCount,
  bool reduceMotion = false,
}) {
  return MaterialApp(
    home: MediaQuery(
      data: MediaQueryData(
        size: const Size(390, 844),
        disableAnimations: reduceMotion,
      ),
      child: Scaffold(
        body: Center(
          child: LifeTreeArtwork(
            stageIndex: stageIndex,
            stageCount: 6,
            stageLabel: const ['種子', '發芽', '幼苗', '小樹', '成樹', '大樹'][stageIndex],
            keepsakeCount: keepsakeCount,
          ),
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('all six growth stages finish their entry animation', (
    tester,
  ) async {
    for (var stage = 0; stage < 6; stage++) {
      await tester.pumpWidget(
        treeHost(stageIndex: stage, keepsakeCount: stage),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('verified keepsake count is exposed as one image description', (
    tester,
  ) async {
    await tester.pumpWidget(treeHost(stageIndex: 4, keepsakeCount: 12));
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('生命樹目前是成樹，已有 12 個共同紀念'), findsOneWidget);
  });

  testWidgets(
    'reduced motion renders the same state without an active ticker',
    (tester) async {
      await tester.pumpWidget(
        treeHost(stageIndex: 3, keepsakeCount: 2, reduceMotion: true),
      );
      await tester.pumpAndSettle();
      expect(find.bySemanticsLabel('生命樹目前是小樹，已有 2 個共同紀念'), findsOneWidget);
      expect(tester.binding.hasScheduledFrame, isFalse);
      expect(tester.takeException(), isNull);
    },
  );

  test('painter repaints only when visible state changes', () {
    const base = LifeTreePainter(
      stageIndex: 3,
      stageCount: 6,
      keepsakeCount: 2,
      motion: 1,
    );
    expect(base.shouldRepaint(base), isFalse);
    expect(
      base.shouldRepaint(
        const LifeTreePainter(
          stageIndex: 3,
          stageCount: 6,
          keepsakeCount: 1,
          motion: 1,
        ),
      ),
      isTrue,
    );
  });
}
