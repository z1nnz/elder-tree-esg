import 'package:elder_tree_mobile/src/app_controller.dart';
import 'package:elder_tree_mobile/src/models.dart';
import 'package:elder_tree_mobile/src/screens.dart';
import 'package:elder_tree_mobile/src/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

CircleOverviewModel timerCircle() {
  final now = DateTime.now();
  return CircleOverviewModel(
    id: 'timer-circle',
    name: '一起舒展的樹伴圈',
    kind: 'FRIENDS',
    currentMemberId: 'member-2',
    memberCount: 3,
    members: const [],
    activeAction: CooperativeActionModel(
      id: 'spring',
      runId: 'spring-run',
      title: '讓春天回到生命樹',
      description: '三位樹伴輪流找回陽光、水與新芽。',
      kind: CooperativeActionKind.relay,
      status: CooperativeActionStatus.active,
      minimumContributors: 3,
      maxChaptersPerMember: 1,
      contributorCount: 1,
      completedChapterCount: 1,
      totalChapterCount: 3,
      growthPoints: 120,
      keepsakeName: '春日紀念枝',
      chapters: [
        CooperativeActionChapterModel(
          id: 'water',
          sequence: 2,
          title: '喚醒水流',
          description: '跟著畫面完成三分鐘舒緩伸展。',
          elementName: '水',
          verificationMode: VerificationMode.timer,
          minimumSeconds: 180,
          alternative: const CooperativeActionAlternativeModel(
            title: '坐著完成慢呼吸',
            description: '坐穩後跟著畫面完成三分鐘慢呼吸。',
            verificationMode: VerificationMode.timer,
            minimumSeconds: 180,
          ),
          claim: CooperativeActionClaimModel(
            memberId: 'member-2',
            displayName: '美玲',
            claimedAt: now,
            expiresAt: now.add(const Duration(minutes: 30)),
            usingAlternative: false,
          ),
          contributor: null,
        ),
      ],
    ),
  );
}

void main() {
  testWidgets(
    'relay timer blocks completion and explains the process witness',
    (tester) async {
      final controller = AppController()..circle = timerCircle();
      addTearDown(controller.dispose);
      await tester.pumpWidget(
        MaterialApp(
          theme: buildAppTheme(true),
          home: Scaffold(body: CircleScreen(controller: controller)),
        ),
      );
      await tester.drag(find.byType(ListView), const Offset(0, -1200));
      await tester.pumpAndSettle();

      expect(find.text('完整計時見證'), findsOneWidget);
      expect(find.textContaining('還需 3:00'), findsOneWidget);
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, '完成「水」這一棒'))
            .onPressed,
        isNull,
      );
    },
  );

  for (final width in [360.0, 390.0, 768.0]) {
    for (final scale in [1.0, 1.5, 2.0]) {
      testWidgets('timer witness fits $width width at $scale text', (
        tester,
      ) async {
        await tester.binding.setSurfaceSize(Size(width, 844));
        addTearDown(() => tester.binding.setSurfaceSize(null));
        final controller = AppController()..circle = timerCircle();
        addTearDown(controller.dispose);
        await tester.pumpWidget(
          MaterialApp(
            theme: buildAppTheme(true),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(scale)),
              child: child!,
            ),
            home: Scaffold(body: CircleScreen(controller: controller)),
          ),
        );
        await tester.drag(find.byType(ListView), const Offset(0, -1600));
        await tester.pump();

        expect(find.text('完整計時見證'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }
  }
}
