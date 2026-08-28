import 'dart:async';

import 'package:elder_tree_mobile/src/api_client.dart';
import 'package:elder_tree_mobile/src/app_controller.dart';
import 'package:elder_tree_mobile/src/app_locale.dart';
import 'package:elder_tree_mobile/src/circle_profile_screen.dart';
import 'package:elder_tree_mobile/src/circle_welcome_screen.dart';
import 'package:elder_tree_mobile/src/models.dart';
import 'package:elder_tree_mobile/src/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'circle_membership_test.dart' show MembershipApi;

const starter = HouseholdSummaryModel(
  id: 'starter',
  name: '我的樹伴圈',
  relationship: '建立者',
  canManageCircle: true,
  needsSetup: true,
);
AppContextModel circleContext(HouseholdSummaryModel profile) => AppContextModel(
  displayName: '小林',
  activeHouseholdId: profile.id,
  households: [profile],
);

class ProfileApi extends MembershipApi {
  final keys = <String>[];
  final revisions = <int>[];
  Object? saveError;
  Completer<void>? response;

  @override
  Future<AppContextModel> createCircle({
    required String name,
    required String kind,
    required String idempotencyKey,
  }) async {
    keys.add(idempotencyKey);
    if (response != null) await response!.future;
    if (saveError != null) throw saveError!;
    return currentContext = AppContextModel(
      displayName: '小林',
      activeHouseholdId: 'created',
      households: [
        starter,
        HouseholdSummaryModel(
          id: 'created',
          name: name,
          kind: kind,
          relationship: '建立者',
          canManageCircle: true,
        ),
      ],
    );
  }

  @override
  Future<AppContextModel> updateCircle({
    required String circleId,
    required String name,
    required String kind,
    required int expectedRevision,
  }) async {
    revisions.add(expectedRevision);
    if (saveError != null) throw saveError!;
    return currentContext = circleContext(
      HouseholdSummaryModel(
        id: circleId,
        name: name,
        kind: kind,
        relationship: '建立者',
        canManageCircle: true,
        settingsRevision: expectedRevision + 1,
      ),
    );
  }
}

AppController controllerFor(ProfileApi api) =>
    AppController(api: api, allowOfflineDemo: false)
      ..context = circleContext(starter)
      ..loading = false;

Future<void> showProfile(
  WidgetTester tester,
  AppController controller, {
  HouseholdSummaryModel? profile,
  bool welcome = false,
  double width = 390,
  double height = 844,
  double scale = 1,
  double keyboard = 0,
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
        data: MediaQuery.of(context).copyWith(
          textScaler: TextScaler.linear(scale),
          viewInsets: EdgeInsets.only(bottom: keyboard),
        ),
        child: child!,
      ),
      home: welcome
          ? ListenableBuilder(
              listenable: controller,
              builder: (context, _) => controller.needsCircleSetup
                  ? CircleWelcomeScreen(controller: controller)
                  : const Scaffold(body: Text('開始旅程')),
            )
          : Builder(
              builder: (context) => Scaffold(
                body: TextButton(
                  onPressed: () =>
                      openCircleProfile(context, controller, profile: profile),
                  child: const Text('開啟設定'),
                ),
              ),
            ),
    ),
  );
  if (!welcome) await tester.tap(find.text('開啟設定'));
  await tester.pumpAndSettle();
}

Future<void> tapVisible(WidgetTester tester, String text) async {
  await tester.ensureVisible(find.text(text));
  await tester.pumpAndSettle();
  await tester.tap(find.text(text));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test(
    'older profile payload is not silently granted management or forced setup',
    () {
      final profile = HouseholdSummaryModel.fromJson({
        'id': 'old',
        'name': '原本的圈',
        'relationship': '朋友',
      });
      expect(profile.canManageCircle, isFalse);
      expect(profile.needsSetup, isFalse);
      expect(profile.settingsRevision, 0);
    },
  );

  test(
    'setup deferral persists for this circle without hiding setup for another',
    () async {
      final api = ProfileApi();
      final controller = controllerFor(api);
      expect(controller.needsCircleSetup, isTrue);
      await controller.deferCircleSetup();
      expect(controller.needsCircleSetup, isFalse);
      final restored = controllerFor(ProfileApi());
      await restored.initialize();
      expect(restored.needsCircleSetup, isFalse);
      restored.context = circleContext(
        const HouseholdSummaryModel(
          id: 'other',
          name: '另一圈',
          relationship: '建立者',
          canManageCircle: true,
          needsSetup: true,
        ),
      );
      expect(restored.needsCircleSetup, isTrue);
      restored.offlineDemo = true;
      expect(restored.needsCircleSetup, isFalse);
      controller.dispose();
      restored.dispose();
    },
  );

  test('offline creation and settings never write to the API', () async {
    final api = ProfileApi();
    final controller = controllerFor(api)..offlineDemo = true;
    expect(
      await controller.createCircle(
        name: '新圈',
        kind: 'FRIENDS',
        idempotencyKey: 'test-creation-key',
      ),
      isFalse,
    );
    expect(
      await controller.updateCircle(
        circleId: 'starter',
        name: '改名',
        kind: 'FRIENDS',
        expectedRevision: 0,
      ),
      isFalse,
    );
    expect(api.keys, isEmpty);
    expect(api.revisions, isEmpty);
    controller.dispose();
  });

  test(
    'profile reload invalidates an older refresh and clears its loading state',
    () async {
      final pending = Completer<AppContextModel>();
      final api = ProfileApi()..contextRequest = () => pending.future;
      final controller = controllerFor(api);
      final refresh = controller.refresh();
      api.contextRequest = () async => circleContext(
        const HouseholdSummaryModel(
          id: 'starter',
          name: '新設定',
          relationship: '建立者',
          canManageCircle: true,
          settingsRevision: 2,
        ),
      );
      expect((await controller.reloadCircleProfile('starter'))?.name, '新設定');
      pending.complete(circleContext(starter));
      await refresh;
      expect(controller.context!.activeHousehold.name, '新設定');
      expect(controller.loading, isFalse);
      controller.dispose();
    },
  );

  testWidgets(
    'invalid form stays local; failed creation keeps input and reuses one key',
    (tester) async {
      final api = ProfileApi()..saveError = const ApiException('offline');
      final controller = controllerFor(api);
      await showProfile(tester, controller);
      await tapVisible(tester, '建立並開啟');
      expect(api.keys, isEmpty);
      expect(find.text('請選擇樹伴圈類型'), findsOneWidget);
      await tester.ensureVisible(find.byType(TextFormField));
      await tester.enterText(find.byType(TextFormField), ' 河岸一起走 ');
      await tapVisible(tester, '朋友');
      await tapVisible(tester, '建立並開啟');
      expect(find.byType(CircleProfileScreen), findsOneWidget);
      expect(find.text(' 河岸一起走 '), findsOneWidget);
      expect(api.keys.length, 1);
      api.saveError = null;
      await tapVisible(tester, '建立並開啟');
      expect(api.keys.length, 2);
      expect(api.keys.toSet().length, 1);
      expect(controller.context!.activeHousehold.name, '河岸一起走');
      expect(controller.context!.households.length, 2);
      expect(find.byType(CircleProfileScreen), findsNothing);
    },
  );

  testWidgets(
    'stale settings can be reloaded and saved with the latest revision',
    (tester) async {
      final api = ProfileApi()
        ..saveError = const ApiException(
          'Circle settings changed; reload before saving',
        );
      final controller = controllerFor(api);
      await showProfile(tester, controller, profile: starter);
      await tester.enterText(find.byType(TextFormField), '舊畫面的修改');
      await tapVisible(tester, '朋友');
      await tapVisible(tester, '儲存設定');
      expect(find.textContaining('請重新載入最新設定'), findsOneWidget);
      api.contextRequest = () async => circleContext(
        const HouseholdSummaryModel(
          id: 'starter',
          name: '目前的名稱',
          kind: 'COMMUNITY',
          relationship: '建立者',
          canManageCircle: true,
          settingsRevision: 3,
        ),
      );
      await tapVisible(tester, '重新載入最新設定');
      expect(find.text('目前的名稱'), findsOneWidget);
      api.contextRequest = null;
      api.saveError = null;
      await tapVisible(tester, '儲存設定');
      expect(api.revisions, [0, 3]);
      expect(find.byType(CircleProfileScreen), findsNothing);
    },
  );

  testWidgets(
    'removed membership does not inherit manager rights from an old route',
    (tester) async {
      final api = ProfileApi();
      final controller = controllerFor(api)
        ..context = const AppContextModel(
          displayName: '小林',
          activeHouseholdId: 'other',
          households: [],
        );
      await showProfile(tester, controller, profile: starter);
      await tester.ensureVisible(find.text('儲存設定'));
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, '儲存設定'))
            .onPressed,
        isNull,
      );
      expect(
        tester.widget<TextFormField>(find.byType(TextFormField)).enabled,
        isFalse,
      );
      expect(api.revisions, isEmpty);
    },
  );

  testWidgets('pending create blocks another submit and back until settled', (
    tester,
  ) async {
    final api = ProfileApi()..response = Completer<void>();
    final controller = controllerFor(api);
    await showProfile(tester, controller);
    await tester.enterText(find.byType(TextFormField), '河岸同行');
    await tapVisible(tester, '朋友');
    await tapVisible(tester, '建立並開啟');
    expect(controller.membershipBusy, isTrue);
    expect(
      tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, '正在儲存…'))
          .onPressed,
      isNull,
    );
    expect(
      await controller.createCircle(
        name: '不能重送',
        kind: 'FRIENDS',
        idempotencyKey: 'other-request-key',
      ),
      isFalse,
    );
    api.response!.complete();
    await tester.pumpAndSettle();
    expect(api.keys.length, 1);
    expect(find.byType(CircleProfileScreen), findsNothing);
  });

  testWidgets(
    'welcome setup saves the existing starter rather than creating another circle',
    (tester) async {
      final api = ProfileApi();
      final controller = controllerFor(api);
      await showProfile(tester, controller, welcome: true);
      await tapVisible(tester, '為樹伴圈取名');
      await tester.enterText(find.byType(TextFormField), '週末慢步');
      await tapVisible(tester, '朋友');
      await tapVisible(tester, '儲存設定');
      expect(controller.needsCircleSetup, isFalse);
      expect(api.keys, isEmpty);
      expect(api.revisions, [0]);
      expect(find.text('開始旅程'), findsOneWidget);
    },
  );

  for (final welcome in [false, true]) {
    for (final width in [360.0, 390.0, 768.0]) {
      for (final scale in [1.0, 1.5, 2.0]) {
        testWidgets(
          '${welcome ? 'welcome' : 'profile'} fits $width at $scale text',
          (tester) async {
            final controller = controllerFor(ProfileApi());
            await showProfile(
              tester,
              controller,
              welcome: welcome,
              width: width,
              scale: scale,
            );
            final action = welcome ? '稍後設定，先看看' : '建立並開啟';
            await tester.scrollUntilVisible(
              find.text(action),
              200,
              scrollable: find
                  .byWidgetPredicate(
                    (widget) =>
                        widget is Scrollable &&
                        widget.axisDirection == AxisDirection.down,
                  )
                  .last,
            );
            await tester.pumpAndSettle();
            expect(tester.takeException(), isNull);
            expect(find.text(action).hitTestable(), findsOneWidget);
            if (welcome) {
              await tester.tap(find.text(action));
              await tester.pumpAndSettle();
              expect(find.text('開始旅程'), findsOneWidget);
            }
          },
        );
      }
    }
  }

  testWidgets(
    'settings action remains reachable with landscape keyboard and large text',
    (tester) async {
      await showProfile(
        tester,
        controllerFor(ProfileApi()),
        width: 768,
        height: 390,
        scale: 1.5,
        keyboard: 150,
      );
      await tester.scrollUntilVisible(
        find.text('建立並開啟'),
        200,
        scrollable: find
            .byWidgetPredicate(
              (widget) =>
                  widget is Scrollable &&
                  widget.axisDirection == AxisDirection.down,
            )
            .last,
      );
      expect(tester.takeException(), isNull);
      expect(find.text('建立並開啟').hitTestable(), findsOneWidget);
    },
  );
}
