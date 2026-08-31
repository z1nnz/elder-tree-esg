import 'dart:async';

import 'package:elder_tree_mobile/src/api_client.dart';
import 'package:elder_tree_mobile/src/app_controller.dart';
import 'package:elder_tree_mobile/src/app_locale.dart';
import 'package:elder_tree_mobile/src/journey_library_screen.dart';
import 'package:elder_tree_mobile/src/models.dart';
import 'package:elder_tree_mobile/src/screens.dart';
import 'package:elder_tree_mobile/src/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'circle_membership_test.dart' show MembershipApi, oldContext;

const sampleChoice = JourneyChoiceModel(
  actionId: 'next-action',
  title: '聽見彼此的日常',
  description: '兩位樹伴輪流分享一個生活片刻，再把回應交還給對方。面對面、電話或訊息都可以。',
  keepsakeName: '相知葉',
  minimumContributors: 2,
  chapterCount: 2,
  growthPoints: 80,
);
final sampleResult = JourneyResultModel(
  runId: 'finished',
  title: '讓春天回到生命樹',
  keepsakeName: '春日紀念枝',
  keepsakeSlot: 0,
  completedAt: DateTime(2026, 8, 29, 9),
  growthPoints: 120,
  contributions: [
    for (final name in ['小林', '阿芳', '志明'])
      CooperativeActionContributorModel(
        memberId: name,
        displayName: name,
        actionTitle: '在安全的地方留下一段日常',
        usedAlternative: false,
        witnessedAt: DateTime(2026, 8, 29, 9),
        witnessTier: ActionWitnessTier.selfCheck,
      ),
  ],
);
final sampleJourneyShelf = JourneyShelfModel(
  circleId: 'old',
  currentRunId: 'finished',
  completedCount: 1,
  results: [sampleResult],
  choices: [sampleChoice],
);

CircleOverviewModel journeyCircle({
  bool completed = false,
  bool expired = false,
}) => CircleOverviewModel(
  id: 'old',
  name: '河岸同行',
  kind: 'FRIENDS',
  currentMemberId: 'member',
  memberCount: 3,
  members: const [],
  activeAction: CooperativeActionModel(
    id: 'action',
    runId: completed ? 'finished' : 'active',
    title: '讓春天回到生命樹',
    description: '一起留下日常',
    kind: CooperativeActionKind.relay,
    status: expired
        ? CooperativeActionStatus.expired
        : completed
        ? CooperativeActionStatus.completed
        : CooperativeActionStatus.active,
    minimumContributors: 3,
    maxChaptersPerMember: 1,
    contributorCount: completed ? 3 : 2,
    completedChapterCount: completed ? 3 : 2,
    totalChapterCount: 3,
    growthPoints: 120,
    keepsakeName: '春日紀念枝',
    chapters: const [],
  ),
);

class JourneyApi extends MembershipApi {
  int reads = 0, starts = 0;
  String? receivedPrevious;
  final cursors = <String?>[];
  Future<JourneyShelfModel> Function()? shelfRequest;
  JourneyShelfModel shelf = sampleJourneyShelf;
  Object? startError;
  Completer<CircleOverviewModel>? startResponse;
  @override
  Future<JourneyShelfModel> getJourneyShelf({String? before}) {
    reads++;
    cursors.add(before);
    return shelfRequest?.call() ?? Future.value(shelf);
  }

  @override
  Future<CircleOverviewModel> startJourney({
    required String circleId,
    required String actionId,
    required String previousRunId,
  }) async {
    starts++;
    receivedPrevious = previousRunId;
    if (startError != null) throw startError!;
    return startResponse != null
        ? await startResponse!.future
        : journeyCircle();
  }

  @override
  Future<CircleOverviewModel> completeCooperativeActionChapter({
    required String runId,
    required String chapterId,
  }) async => journeyCircle(completed: true);
}

AppController journeyController(JourneyApi api) =>
    AppController(api: api, allowOfflineDemo: false)
      ..context = oldContext
      ..loading = false
      ..circle = journeyCircle();

Future<void> showLibrary(
  WidgetTester tester,
  AppController controller, {
  double width = 390,
  double scale = 1,
}) async {
  await tester.binding.setSurfaceSize(Size(width, 844));
  addTearDown(() async {
    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
    await tester.binding.setSurfaceSize(null);
  });
  await tester.pumpWidget(
    MaterialApp(
      theme: buildAppTheme(true),
      locale: appLocale,
      supportedLocales: appSupportedLocales,
      localizationsDelegates: appLocalizationDelegates,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(
          context,
        ).copyWith(textScaler: TextScaler.linear(scale)),
        child: child!,
      ),
      home: Builder(
        builder: (context) => Scaffold(
          body: TextButton(
            onPressed: () => openJourneyLibrary(context, controller),
            child: const Text('打開年輪'),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('打開年輪'));
  await tester.pumpAndSettle();
}

Future<void> tapJourneyText(WidgetTester tester, String text) async {
  await tester.ensureVisible(find.text(text));
  await tester.pumpAndSettle();
  await tester.tap(find.text(text));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('offline mode makes no history reads or journey starts', () async {
    final api = JourneyApi();
    final controller = journeyController(api)
      ..offlineDemo = true
      ..journeyShelf = sampleJourneyShelf;
    await controller.loadJourneyShelf();
    expect(await controller.startJourney(sampleChoice), isFalse);
    expect(api.reads, 0);
    expect(api.starts, 0);
    expect(controller.journeyError, contains('離線示範'));
    controller.dispose();
  });
  test('late history cannot leak after joining a different circle', () async {
    final response = Completer<JourneyShelfModel>();
    final api = JourneyApi()..shelfRequest = () => response.future;
    final controller = journeyController(api);
    final pending = controller.loadJourneyShelf();
    expect(await controller.joinHousehold('AB12CD34', '朋友'), isTrue);
    response.complete(sampleJourneyShelf);
    await pending;
    expect(controller.journeyShelf, isNull);
    expect(controller.journeyLoading, isFalse);
    controller.dispose();
  });
  test(
    'pagination deduplicates receipts and a failed refresh preserves loaded history',
    () async {
      final api = JourneyApi()
        ..shelf = JourneyShelfModel(
          circleId: 'old',
          currentRunId: 'finished',
          completedCount: 2,
          results: [sampleResult],
          choices: [sampleChoice],
          nextCursor: 'cursor',
        );
      final controller = journeyController(api);
      await controller.loadJourneyShelf();
      await controller.loadJourneyShelf(more: true);
      expect(api.cursors, [null, 'cursor']);
      expect(controller.journeyShelf!.results.length, 1);
      api.shelfRequest = () => Future.error(const ApiException('offline'));
      await controller.loadJourneyShelf();
      expect(controller.journeyShelf!.results.single.runId, 'finished');
      expect(controller.journeyError, isNotNull);
      controller.dispose();
    },
  );
  test(
    'pending start blocks duplicate submission and circle mutations',
    () async {
      final api = JourneyApi()
        ..startResponse = Completer<CircleOverviewModel>();
      final controller = journeyController(api)
        ..journeyShelf = sampleJourneyShelf;
      final pending = controller.startJourney(sampleChoice);
      expect(await controller.startJourney(sampleChoice), isFalse);
      expect(await controller.joinHousehold('AB12CD34', '朋友'), isFalse);
      api.startResponse!.complete(journeyCircle());
      expect(await pending, isTrue);
      expect(api.starts, 1);
      expect(api.receivedPrevious, 'finished');
      expect(controller.journeyStarting, isFalse);
      expect(controller.journeyShelf, isNull);
      controller.dispose();
    },
  );
  test(
    'a completed relay remains successful when tree refresh fails',
    () async {
      final controller = journeyController(JourneyApi());
      const chapter = CooperativeActionChapterModel(
        id: 'last',
        sequence: 3,
        title: '最後一棒',
        description: '日常',
        elementName: '新芽',
        verificationMode: VerificationMode.selfCheck,
        alternative: null,
        claim: null,
        contributor: null,
      );
      await controller.completeCooperativeActionChapter(chapter);
      expect(controller.circle.activeAction!.completed, isTrue);
      expect(controller.notice, contains('旅程已完成'));
      expect(controller.notice, isNot(contains('無法送出')));
      controller.dispose();
    },
  );

  testWidgets('results show witness limits and participant history', (
    tester,
  ) async {
    await showLibrary(tester, journeyController(JourneyApi()));
    expect(find.text('春日紀念枝'), findsOneWidget);
    await tapJourneyText(tester, '回看大家留下的片刻');
    expect(find.text('小林'), findsOneWidget);
    expect(find.textContaining('自我確認'), findsWidgets);
    expect(find.textContaining('留下 120 點基本年輪'), findsOneWidget);
  });
  testWidgets('failed start preserves selection and can be retried', (
    tester,
  ) async {
    final api = JourneyApi()
      ..startError = const ApiException('Journey changed; reload journeys');
    final controller = journeyController(api);
    await showLibrary(tester, controller);
    await tapJourneyText(tester, '選下一段');
    await tapJourneyText(tester, '開始這段旅程');
    await tapJourneyText(tester, '一起出發');
    expect(find.byType(JourneyLibraryScreen), findsOneWidget);
    expect(controller.journeyError, contains('另一段旅程'));
    api.startError = null;
    await tapJourneyText(tester, '開始這段旅程');
    await tapJourneyText(tester, '一起出發');
    expect(find.byType(JourneyLibraryScreen), findsNothing);
    expect(api.starts, 2);
  });
  testWidgets('empty results invite action without inventing a keepsake', (
    tester,
  ) async {
    final api = JourneyApi()
      ..shelf = const JourneyShelfModel(
        circleId: 'old',
        currentRunId: 'active',
        completedCount: 0,
        results: [],
        choices: [sampleChoice],
      );
    await showLibrary(tester, journeyController(api));
    expect(find.text('第一片共同的葉子，\n等你們一起留下。'), findsOneWidget);
    expect(find.text('春日紀念枝'), findsNothing);
    await tapJourneyText(tester, '選擇下一段旅程');
    expect(find.text('聽見彼此的日常'), findsOneWidget);
  });

  for (final reason in ['IN_PROGRESS', 'COOLDOWN', 'NOT_ENOUGH_MEMBERS']) {
    testWidgets('$reason is explained and cannot be started', (tester) async {
      final blocked = JourneyChoiceModel(
        actionId: 'blocked',
        title: '稍後再同行',
        description: '選擇現在做得到的旅程',
        keepsakeName: '紀念葉',
        minimumContributors: 3,
        chapterCount: 3,
        growthPoints: 80,
        unavailableReason: reason,
        availableAt: DateTime(2026, 9, 5),
      );
      final api = JourneyApi()
        ..shelf = JourneyShelfModel(
          circleId: 'old',
          currentRunId: 'finished',
          completedCount: 1,
          results: [sampleResult],
          choices: [blocked],
        );
      await showLibrary(tester, journeyController(api));
      await tapJourneyText(tester, '選下一段');
      await tester.ensureVisible(find.text('開始這段旅程'));
      expect(
        tester
            .widget<OutlinedButton>(
              find.widgetWithText(OutlinedButton, '開始這段旅程'),
            )
            .onPressed,
        isNull,
      );
      expect(api.starts, 0);
    });
  }
  testWidgets('completed circle exposes a direct outcome entry', (
    tester,
  ) async {
    final controller = journeyController(JourneyApi())
      ..circle = journeyCircle(completed: true);
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(true),
        home: Scaffold(body: CircleScreen(controller: controller)),
      ),
    );
    await tapJourneyText(tester, '看看共同留下的年輪');
    expect(find.byType(JourneyLibraryScreen), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });

  testWidgets('an unavailable journey offers a way to choose another', (
    tester,
  ) async {
    final controller = journeyController(JourneyApi())
      ..circle = journeyCircle(expired: true);
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(true),
        home: Scaffold(body: CircleScreen(controller: controller)),
      ),
    );
    expect(find.text('這趟旅程已結束'), findsOneWidget);
    await tapJourneyText(tester, '選擇另一段旅程');
    expect(find.byType(JourneyLibraryScreen), findsOneWidget);
    expect(find.text('看看共同留下的年輪'), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });

  for (final choosing in [false, true]) {
    for (final width in [360.0, 390.0, 768.0]) {
      for (final scale in [1.0, 1.5, 2.0]) {
        testWidgets(
          '${choosing ? 'choices' : 'records'} fit width $width text $scale',
          (tester) async {
            await showLibrary(
              tester,
              journeyController(JourneyApi()),
              width: width,
              scale: scale,
            );
            if (choosing) await tapJourneyText(tester, '選下一段');
            final target = choosing ? '開始這段旅程' : '選擇下一段旅程';
            await tester.scrollUntilVisible(
              find.text(target),
              240,
              scrollable: find
                  .byWidgetPredicate(
                    (widget) =>
                        widget is Scrollable &&
                        widget.axisDirection == AxisDirection.down,
                  )
                  .last,
            );
            await tester.pumpAndSettle();
            expect(find.text(target).hitTestable(), findsOneWidget);
            expect(tester.takeException(), isNull);
          },
        );
      }
    }
  }
}
