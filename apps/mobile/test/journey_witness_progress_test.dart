import 'package:elder_tree_mobile/src/journey_witness_progress.dart';
import 'package:elder_tree_mobile/src/models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const witness = ExplorationJourneyWitnessModel(
  tier: 'COMPOSITE',
  status: 'IN_PROGRESS',
  dwellSeconds: 120,
  minimumDwellSeconds: 180,
  stepCount: 160,
  minimumStepCount: 240,
  distanceMeters: 210,
  minimumDistanceMeters: 300,
  stepSource: 'APPLE_HEALTH',
  firstInsideAt: null,
  lastInsideAt: null,
  completedAt: null,
);

void main() {
  for (final width in [360.0, 390.0, 768.0]) {
    testWidgets('shows all three witness requirements at ${width.toInt()}px', (
      tester,
    ) async {
      tester.view.physicalSize = Size(width, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        const MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(textScaler: TextScaler.linear(2)),
            child: Scaffold(
              body: SingleChildScrollView(
                child: JourneyWitnessProgress(
                  witness: witness,
                  healthAccessLabel: '健康步數已準備；只上傳這趟的步數總量',
                ),
              ),
            ),
          ),
        ),
      );

      expect(find.text('三項同行見證'), findsOneWidget);
      expect(find.text('場域內停留'), findsOneWidget);
      expect(find.text('健康步數'), findsOneWidget);
      expect(find.text('場域內距離'), findsOneWidget);
      expect(find.textContaining('還差'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
