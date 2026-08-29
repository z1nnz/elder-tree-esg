import 'dart:async';

import 'package:elder_tree_mobile/src/api_client.dart';
import 'package:elder_tree_mobile/src/app_controller.dart';
import 'package:elder_tree_mobile/src/app_locale.dart';
import 'package:elder_tree_mobile/src/models.dart';
import 'package:elder_tree_mobile/src/root_shell.dart';
import 'package:elder_tree_mobile/src/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const longCircleName = '週末一起沿著河岸慢慢散步也願意聽彼此分享日常的朋友們樹伴圈';

AppController coreController() {
  final controller = AppController()..loading = false;
  controller.context = const AppContextModel(
    displayName: '畫面驗收帳號',
    activeHouseholdId: 'core',
    households: [
      HouseholdSummaryModel(
        id: 'core',
        name: longCircleName,
        relationship: '朋友',
      ),
      HouseholdSummaryModel(id: 'other', name: '另一個樹伴圈', relationship: '朋友'),
    ],
  );
  final circle = controller.circle;
  controller.circle = CircleOverviewModel(
    id: 'core',
    name: longCircleName,
    kind: 'FRIENDS',
    currentMemberId: circle.currentMemberId,
    memberCount: circle.memberCount,
    members: circle.members,
    activeAction: circle.activeAction,
  );
  controller.tree = const TreeSummary(
    name: '共同的生命樹',
    householdName: longCircleName,
    stage: 'YOUNG_TREE',
    growthPoints: 180,
    nextStageAt: 280,
  );
  controller.messages = [
    FamilyMessageModel(
      id: 'message',
      authorName: '一起出門散步的樹伴',
      body: '今天河岸的風很舒服，下次一起去走走吧。',
      createdAt: DateTime(2026, 8, 29, 10),
      delivered: false,
    ),
  ];
  return controller;
}

class MessageApi extends ApiClient {
  int sends = 0;
  Object? error;
  Completer<FamilyMessageModel>? response;

  @override
  Future<FamilyMessageModel> sendMessage(String body) async {
    sends++;
    if (error != null) throw error!;
    return response != null
        ? response!.future
        : FamilyMessageModel(
            id: 'saved',
            authorName: '畫面驗收帳號',
            body: body,
            createdAt: DateTime(2026, 8, 29, 12),
            delivered: false,
          );
  }
}

AppController messageController(MessageApi api) =>
    AppController(api: api, allowOfflineDemo: false)
      ..context = const AppContextModel(
        displayName: '畫面驗收帳號',
        activeHouseholdId: 'core',
        households: [
          HouseholdSummaryModel(id: 'core', name: '同行的我們', relationship: '朋友'),
        ],
      );

Future<void> showCorePage(
  WidgetTester tester,
  AppController controller, {
  required int index,
  double width = 390,
  double scale = 1,
  double height = 844,
}) async {
  await tester.binding.setSurfaceSize(Size(width, height));
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
      home: ListenableBuilder(
        listenable: controller,
        builder: (_, _) => RootShell(
          controller: controller,
          accountEmail: 'preview@example.invalid',
          onSignOut: () async {},
          initialIndex: index,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  test(
    'message draft survives failure and clears only after confirmed success',
    () async {
      final api = MessageApi()..error = const ApiException('unavailable');
      final controller = messageController(api);
      controller.saveMessageDraft('今天有一件事想和你說');
      expect(
        await controller.sendFamilyMessage(controller.messageDraft),
        isFalse,
      );
      expect(controller.messageDraft, '今天有一件事想和你說');
      expect(controller.messages, isEmpty);
      expect(controller.messageError, contains('文字已保留'));

      api.error = null;
      expect(
        await controller.sendFamilyMessage(controller.messageDraft),
        isTrue,
      );
      expect(controller.messageDraft, isEmpty);
      expect(controller.messages.single.body, '今天有一件事想和你說');
      expect(api.sends, 2);
      controller.dispose();
    },
  );

  test(
    'one pending message blocks duplicate send and circle changes',
    () async {
      final api = MessageApi()..response = Completer<FamilyMessageModel>();
      final controller = messageController(api);
      final pending = controller.sendFamilyMessage('先別急著重複送');
      expect(await controller.sendFamilyMessage('先別急著重複送'), isFalse);
      expect(await controller.switchHousehold('other'), isFalse);
      api.response!.complete(
        FamilyMessageModel(
          id: 'saved',
          authorName: '畫面驗收帳號',
          body: '先別急著重複送',
          createdAt: DateTime(2026, 8, 29, 12),
          delivered: false,
        ),
      );
      expect(await pending, isTrue);
      expect(api.sends, 1);
      controller.dispose();
    },
  );

  test(
    'offline demo keeps message read-only and creates no fake record',
    () async {
      final api = MessageApi();
      final controller = messageController(api)..offlineDemo = true;
      controller.saveMessageDraft('不會送出的示範文字');
      expect(
        await controller.sendFamilyMessage(controller.messageDraft),
        isFalse,
      );
      expect(api.sends, 0);
      expect(controller.messages, isEmpty);
      expect(controller.messageDraft, '不會送出的示範文字');
      controller.dispose();
    },
  );

  for (final entry in {0: 'home', 3: 'companion', 5: 'tree'}.entries) {
    for (final width in [360.0, 390.0, 768.0]) {
      for (final scale in [1.0, 1.5, 2.0]) {
        testWidgets(
          '${entry.value} fits $width with $scale text and a long circle name',
          (tester) async {
            await showCorePage(
              tester,
              coreController(),
              index: entry.key,
              width: width,
              scale: scale,
            );
            expect(tester.takeException(), isNull);
            final scroll = find
                .byWidgetPredicate(
                  (widget) =>
                      widget is Scrollable &&
                      widget.axisDirection == AxisDirection.down,
                )
                .first;
            for (var step = 0; step < 8; step++) {
              await tester.drag(scroll, const Offset(0, -450));
              await tester.pumpAndSettle();
              expect(tester.takeException(), isNull);
            }
          },
        );
      }
    }
  }
}
