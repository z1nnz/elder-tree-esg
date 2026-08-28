import 'dart:async';
import 'dart:convert';

import 'package:elder_tree_mobile/src/api_client.dart';
import 'package:elder_tree_mobile/src/app_controller.dart';
import 'package:elder_tree_mobile/src/app_locale.dart';
import 'package:elder_tree_mobile/src/circle_membership_screen.dart';
import 'package:elder_tree_mobile/src/models.dart';
import 'package:elder_tree_mobile/src/screens.dart';
import 'package:elder_tree_mobile/src/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const oldContext = AppContextModel(
  displayName: '小林',
  activeHouseholdId: 'old',
  households: [
    HouseholdSummaryModel(id: 'old', name: '散步好友樹伴圈', relationship: '朋友'),
  ],
);
const joinedContext = AppContextModel(
  displayName: '小林',
  activeHouseholdId: 'joined',
  households: [
    HouseholdSummaryModel(id: 'old', name: '散步好友樹伴圈', relationship: '朋友'),
    HouseholdSummaryModel(id: 'joined', name: '社區一起出發樹伴圈', relationship: '志工'),
  ],
);

class MembershipApi extends ApiClient {
  int joins = 0;
  int invites = 0;
  AppContextModel currentContext = oldContext;
  Future<AppContextModel> Function()? contextRequest;
  Completer<AppContextModel>? joinResponse;
  Completer<CircleOverviewModel>? claimResponse;
  Completer<List<FamilyMessageModel>>? messageResponse;
  Object? joinError;
  bool refreshFails = true;
  Duration inviteLifetime = const Duration(hours: 2);
  String? receivedCode;
  String? receivedRelationship;

  @override
  Future<AppContextModel> getContext() =>
      contextRequest?.call() ??
      (refreshFails
          ? Future.error(const ApiException('offline'))
          : Future.value(currentContext));
  @override
  Future<AppContextModel> joinHousehold(
    String code,
    String relationship,
  ) async {
    joins++;
    receivedCode = code;
    receivedRelationship = relationship;
    if (joinError != null) throw joinError!;
    currentContext = joinResponse != null
        ? await joinResponse!.future
        : joinedContext;
    return currentContext;
  }

  @override
  Future<AppContextModel> setActiveHousehold(String id) async => joinedContext;
  @override
  Future<HouseholdInviteModel> createHouseholdInvite() async {
    invites++;
    return HouseholdInviteModel(
      code: 'AB12CD34',
      expiresAt: DateTime.now().add(inviteLifetime),
    );
  }

  @override
  Future<HomeSummaryModel> getHomeSummary() => Future.error('unavailable');
  @override
  Future<List<DailyTask>> getTasks() => Future.error('unavailable');
  @override
  Future<TreeSummary> getTree() => Future.error('unavailable');
  @override
  Future<ExplorationStateModel> getExplorationState() =>
      Future.error('unavailable');
  @override
  Future<RadarStateModel> getRadarState() => Future.error('unavailable');
  @override
  Future<CircleOverviewModel> getCircleOverview() =>
      Future.error('unavailable');
  @override
  Future<CircleOverviewModel> claimCooperativeActionChapter({
    required String runId,
    required String chapterId,
    required bool useAlternative,
  }) => claimResponse!.future;
  @override
  Future<List<FamilyMessageModel>> getMessages() =>
      messageResponse?.future ?? Future.error('unavailable');
  @override
  Future<List<CompanionPromptModel>> getCompanionPrompts() =>
      Future.error('unavailable');
  @override
  Future<List<CompanionDevice>> getDevices() => Future.error('unavailable');
  @override
  Future<List<FamilyReviewModel>> getFamilyReviews() =>
      Future.error('unavailable');
  @override
  Future<ImpactSummaryModel> getImpactSummary() => Future.error('unavailable');
  @override
  Future<List<LineBindingModel>> getLineBindings() =>
      Future.error('unavailable');
}

AppController makeController(MembershipApi api) =>
    AppController(api: api, allowOfflineDemo: false)
      ..context = oldContext
      ..loading = false;

Future<void> showMembership(
  WidgetTester tester,
  AppController controller, {
  bool joining = true,
  double width = 390,
  double scale = 1,
  double height = 844,
  double keyboardInset = 0,
}) async {
  await tester.binding.setSurfaceSize(Size(width, height));
  await tester.pumpWidget(
    MaterialApp(
      theme: buildAppTheme(true),
      locale: appLocale,
      supportedLocales: appSupportedLocales,
      localizationsDelegates: appLocalizationDelegates,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(
          textScaler: TextScaler.linear(scale),
          viewInsets: EdgeInsets.only(bottom: keyboardInset),
        ),
        child: child!,
      ),
      home: Builder(
        builder: (context) => Scaffold(
          body: TextButton(
            onPressed: () =>
                openCircleMembership(context, controller, joining: joining),
            child: const Text('開啟樹伴圈'),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('開啟樹伴圈'));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'joins once, normalizes code, preserves old membership and clears stale private data',
    () async {
      final api = MembershipApi()..joinResponse = Completer<AppContextModel>();
      final controller = makeController(api);
      controller.messages = [
        FamilyMessageModel(
          id: 'private',
          authorName: '舊樹伴',
          body: '私人訊息',
          createdAt: DateTime(2026, 8, 28),
          delivered: false,
        ),
      ];
      final first = controller.joinHousehold(' ab12cd34 ', ' 志工 ');
      expect(controller.membershipBusy, isTrue);
      expect(await controller.joinHousehold('AB12CD34', '朋友'), isFalse);
      api.joinResponse!.complete(joinedContext);
      expect(await first, isTrue);
      expect(api.joins, 1);
      expect(api.receivedCode, 'AB12CD34');
      expect(api.receivedRelationship, '志工');
      expect(controller.context?.households.length, 2);
      expect(controller.context?.activeHouseholdId, 'joined');
      expect(controller.messages, isEmpty);
      expect(controller.circle.members, isEmpty);
      expect(controller.membershipBusy, isFalse);
      expect(controller.notice, contains('已加入'));
      expect(controller.notice, contains('無法連線'));
      controller.dispose();
    },
  );

  for (final error in {
    'Household invite not found': '找不到這組邀請碼',
    'Household invite is expired or already used': '邀請碼已過期或已使用',
    'Already a household member': '你已經在這個樹伴圈裡了',
  }.entries) {
    test('actionable error: ${error.key}', () async {
      final api = MembershipApi()..joinError = ApiException(error.key);
      final controller = makeController(api);
      expect(await controller.joinHousehold('AB12CD34', '朋友'), isFalse);
      expect(controller.membershipError, contains(error.value));
      expect(controller.context?.activeHouseholdId, 'old');
      expect(controller.membershipBusy, isFalse);
      controller.dispose();
    });
  }

  test('late old-circle refresh cannot overwrite a successful join', () async {
    final stale = Completer<AppContextModel>();
    final api = MembershipApi()..contextRequest = () => stale.future;
    final controller = makeController(api);
    final oldRefresh = controller.refresh();
    api.contextRequest = null;
    expect(await controller.joinHousehold('AB12CD34', '朋友'), isTrue);
    stale.complete(oldContext);
    await oldRefresh;
    expect(controller.context?.activeHouseholdId, 'joined');
    expect(controller.notice, contains('已加入'));
    controller.dispose();
  });

  test('late optional data cannot leak across a circle switch', () async {
    final api = MembershipApi()
      ..refreshFails = false
      ..messageResponse = Completer<List<FamilyMessageModel>>();
    final controller = makeController(api);
    final oldRefresh = controller.refresh();
    await Future<void>.delayed(Duration.zero);
    final response = api.messageResponse!;
    api.messageResponse = null;
    api.refreshFails = true;
    expect(await controller.switchHousehold('joined'), isTrue);
    response.complete([
      FamilyMessageModel(
        id: 'private',
        authorName: '舊樹伴',
        body: '私人訊息',
        createdAt: DateTime(2026, 8, 28),
        delivered: false,
      ),
    ]);
    await oldRefresh;
    expect(controller.messages, isEmpty);
    expect(controller.context?.activeHouseholdId, 'joined');
    controller.dispose();
  });

  test(
    'a late relay response is ignored after joining a different circle',
    () async {
      final api = MembershipApi()
        ..claimResponse = Completer<CircleOverviewModel>();
      final controller = makeController(api);
      final sample = AppController();
      final oldCircle = sample.circle;
      sample.dispose();
      controller.circle = oldCircle;
      final claim = controller.claimCooperativeActionChapter(
        oldCircle.activeAction!.nextChapter!,
        useAlternative: false,
      );
      expect(await controller.joinHousehold('AB12CD34', '朋友'), isTrue);
      api.claimResponse!.complete(oldCircle);
      await claim;
      expect(controller.context?.activeHouseholdId, 'joined');
      expect(controller.circle.members, isEmpty);
      expect(controller.notice, contains('已加入'));
      controller.dispose();
    },
  );

  test('offline demonstration makes no membership writes', () async {
    final api = MembershipApi();
    final controller = makeController(api)..offlineDemo = true;
    expect(await controller.joinHousehold('AB12CD34', '朋友'), isFalse);
    expect(await controller.createHouseholdInvite(), isNull);
    expect(api.joins, 0);
    expect(api.invites, 0);
    expect(controller.membershipError, contains('離線示範'));
    controller.dispose();
  });

  test('pending join safely finishes after the App is disposed', () async {
    final api = MembershipApi()..joinResponse = Completer<AppContextModel>();
    final controller = makeController(api);
    final pending = controller.joinHousehold('AB12CD34', '朋友');
    controller.dispose();
    api.joinResponse!.complete(joinedContext);
    expect(await pending, isFalse);
  });

  test('join API uses the existing authenticated server contract', () async {
    final api = ApiClient(
      baseUrl: 'https://example.invalid/api/v1',
      tokenProvider: () async => 'test-only-token',
      client: MockClient((request) async {
        expect(request.method, 'POST');
        expect(request.url.path, '/api/v1/households/join');
        expect(request.headers['authorization'], 'Bearer test-only-token');
        expect(jsonDecode(request.body), {
          'code': 'AB12CD34',
          'relationship': '志工',
        });
        return http.Response(
          jsonEncode({
            'data': {
              'displayName': '小林',
              'activeHouseholdId': 'joined',
              'households': [
                {'id': 'joined', 'name': '社區樹伴圈', 'relationship': '志工'},
              ],
            },
          }),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );
    expect(
      (await api.joinHousehold('AB12CD34', '志工')).activeHouseholdId,
      'joined',
    );
    api.dispose();
  });

  testWidgets(
    'invalid input stays local; a server rejection preserves input and permits retry',
    (tester) async {
      final api = MembershipApi()
        ..joinError = const ApiException('Household invite not found');
      final controller = makeController(api);
      await showMembership(tester, controller);
      await tester.ensureVisible(find.text('加入樹伴圈'));
      await tester.tap(find.text('加入樹伴圈'));
      await tester.pumpAndSettle();
      expect(api.joins, 0);
      expect(find.text('請填入完整的 8 碼英文字母與數字'), findsOneWidget);
      await tester.enterText(find.byType(TextFormField).first, 'ab12cd34');
      await tester.ensureVisible(find.text('加入樹伴圈'));
      await tester.tap(find.text('加入樹伴圈'));
      await tester.pumpAndSettle();
      expect(find.byType(CircleMembershipScreen), findsOneWidget);
      expect(find.text('ab12cd34'), findsOneWidget);
      expect(find.textContaining('找不到這組邀請碼'), findsOneWidget);
      api.joinError = null;
      await tester.tap(find.text('加入樹伴圈'));
      await tester.pumpAndSettle();
      expect(find.byType(CircleMembershipScreen), findsNothing);
      expect(controller.context?.activeHouseholdId, 'joined');
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
      await tester.binding.setSurfaceSize(null);
    },
  );

  testWidgets('invitation shows server expiry and copies the unbroken code', (
    tester,
  ) async {
    final controller = makeController(MembershipApi());
    String? clipboard;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'Clipboard.setData') {
          clipboard = (call.arguments as Map)['text'] as String;
        }
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );
    await showMembership(tester, controller, joining: false);
    await tester.tap(find.text('產生邀請碼'));
    await tester.pumpAndSettle();
    expect(find.text('AB12'), findsOneWidget);
    expect(find.text('CD34'), findsOneWidget);
    expect(find.textContaining('有效至'), findsOneWidget);
    await tester.ensureVisible(find.text('複製邀請碼'));
    await tester.tap(find.text('複製邀請碼'));
    await tester.pumpAndSettle();
    expect(clipboard, 'AB12CD34');
    expect(find.text('邀請碼已複製'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
    await tester.binding.setSurfaceSize(null);
  });

  for (final width in [360.0, 390.0, 768.0]) {
    for (final scale in [1.0, 1.5, 2.0]) {
      testWidgets('membership form fits width $width at text scale $scale', (
        tester,
      ) async {
        final controller = makeController(MembershipApi());
        await showMembership(tester, controller, width: width, scale: scale);
        await tester.scrollUntilVisible(
          find.text('加入樹伴圈'),
          250,
          scrollable: find.byType(Scrollable).last,
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.text('加入樹伴圈').hitTestable(), findsOneWidget);
        await tester.pumpWidget(const SizedBox.shrink());
        controller.dispose();
        await tester.binding.setSurfaceSize(null);
      });
    }
  }

  testWidgets(
    'invite code wraps at double text and expires without being copyable',
    (tester) async {
      final api = MembershipApi()..inviteLifetime = const Duration(seconds: -1);
      final controller = makeController(api);
      await showMembership(
        tester,
        controller,
        joining: false,
        width: 360,
        scale: 2,
      );
      await tester.scrollUntilVisible(
        find.text('產生邀請碼'),
        250,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.text('產生邀請碼'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('複製邀請碼'),
        200,
        scrollable: find.byType(Scrollable).last,
      );
      expect(tester.takeException(), isNull);
      final button = tester.widget<OutlinedButton>(
        find.widgetWithText(OutlinedButton, '複製邀請碼'),
      );
      expect(button.onPressed, isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
      await tester.binding.setSurfaceSize(null);
    },
  );

  testWidgets(
    'join remains reachable in landscape with a keyboard inset and a long circle name',
    (tester) async {
      final controller = makeController(MembershipApi())
        ..context = const AppContextModel(
          displayName: '小林',
          activeHouseholdId: 'old',
          households: [
            HouseholdSummaryModel(
              id: 'old',
              name: '中壢社區星期六一起散步與分享生活故事的樹伴圈',
              relationship: '志工',
            ),
          ],
        );
      await showMembership(
        tester,
        controller,
        width: 768,
        height: 390,
        keyboardInset: 150,
        scale: 1.5,
      );
      await tester.scrollUntilVisible(
        find.text('加入樹伴圈'),
        200,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.pumpAndSettle();
      expect(find.text('加入樹伴圈').hitTestable(), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
      await tester.binding.setSurfaceSize(null);
    },
  );

  testWidgets(
    'empty journey still offers membership, without a family page detour',
    (tester) async {
      final controller = makeController(MembershipApi());
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: CircleScreen(controller: controller)),
        ),
      );
      expect(find.text('新的共行旅程正在準備'), findsOneWidget);
      await tester.tap(find.text('邀請與加入樹伴圈'));
      await tester.pumpAndSettle();
      expect(find.byType(CircleMembershipScreen), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    },
  );
}
