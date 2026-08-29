import 'package:elder_tree_mobile/main.dart';
import 'package:elder_tree_mobile/src/auth_service.dart';
import 'package:elder_tree_mobile/src/app_controller.dart';
import 'package:elder_tree_mobile/src/models.dart';
import 'package:elder_tree_mobile/src/root_shell.dart';
import 'package:elder_tree_mobile/src/screens.dart';
import 'package:elder_tree_mobile/src/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeAuthService implements AuthService {
  static const account = AuthAccount(
    uid: 'test-user',
    email: 'test@example.com',
  );

  @override
  Stream<AuthAccount?> get accountChanges => Stream.value(account);

  @override
  AuthAccount? get currentAccount => account;

  @override
  Future<String?> getIdToken() async => 'test-token';

  @override
  Future<void> register({
    required String email,
    required String password,
    required String displayName,
  }) async {}

  @override
  Future<void> signIn({
    required String email,
    required String password,
  }) async {}

  @override
  Future<void> signOut() async {}
}

void main() {
  testWidgets('home prioritizes the active circle relay and opens it', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final controller = AppController();
    var openedCircle = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HomeScreen(
            controller: controller,
            onOpenTasks: () {},
            onOpenExploration: () {},
            onOpenFamily: () {},
            onOpenCircle: () => openedCircle = true,
            onOpenTree: () {},
          ),
        ),
      ),
    );

    expect(find.text('接力旅程'), findsOneWidget);
    expect(find.text('讓春天回到生命樹'), findsOneWidget);
    expect(find.textContaining('下一棒等人認領'), findsOneWidget);
    await tester.tap(find.textContaining('去認領下一棒'));
    expect(openedCircle, isTrue);

    controller.dispose();
  });

  testWidgets('home sends an expired relay claim to release flow', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final controller = AppController();
    controller.circle = CircleOverviewModel(
      id: 'circle',
      name: '散步好友圈',
      kind: 'FRIENDS',
      currentMemberId: 'member-1',
      memberCount: 1,
      members: const [
        CircleMemberModel(
          id: 'member-1',
          displayName: '阿樹',
          relationship: '本人',
        ),
      ],
      activeAction: CooperativeActionModel(
        id: 'action',
        runId: 'run',
        title: '讓春天回到生命樹',
        description: '完成一棒。',
        kind: CooperativeActionKind.relay,
        status: CooperativeActionStatus.active,
        minimumContributors: 1,
        maxChaptersPerMember: 1,
        contributorCount: 0,
        completedChapterCount: 0,
        totalChapterCount: 1,
        growthPoints: 30,
        keepsakeName: '春日枝條',
        chapters: [
          CooperativeActionChapterModel(
            id: 'chapter',
            sequence: 1,
            title: '找回陽光',
            description: '到戶外感受陽光。',
            elementName: '陽光',
            verificationMode: VerificationMode.selfCheck,
            alternative: null,
            claim: CooperativeActionClaimModel(
              memberId: 'member-1',
              displayName: '阿樹',
              claimedAt: DateTime.now().subtract(const Duration(hours: 1)),
              expiresAt: DateTime.now().subtract(const Duration(minutes: 1)),
              usingAlternative: false,
            ),
            contributor: null,
          ),
        ],
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(true),
        home: Scaffold(
          body: HomeScreen(
            controller: controller,
            onOpenTasks: () {},
            onOpenExploration: () {},
            onOpenFamily: () {},
            onOpenCircle: () {},
            onOpenTree: () {},
          ),
        ),
      ),
    );

    expect(find.textContaining('接力棒已逾時'), findsOneWidget);
    expect(find.textContaining('前往釋出接力棒'), findsOneWidget);
    expect(find.text('現在輪到你'), findsNothing);
    controller.dispose();
  });

  testWidgets('offline status remains visible outside the home page', (
    tester,
  ) async {
    final controller = AppController()..offlineDemo = true;
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(true),
        home: RootShell(
          controller: controller,
          accountEmail: 'test@example.com',
          onSignOut: () async {},
          initialIndex: 5,
        ),
      ),
    );

    expect(find.text('生命樹成長路徑'), findsOneWidget);
    expect(find.text('離線示範・不會建立真實足跡或增加年輪進度'), findsOneWidget);
    controller.dispose();
  });

  testWidgets('shows settings as a dedicated full-screen function page', (
    tester,
  ) async {
    await tester.pumpWidget(
      ElderTreeApp(authService: FakeAuthService(), initialTab: 6),
    );
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('樹伴'), findsOneWidget);
    expect(find.text('帳號'), findsOneWidget);
    expect(find.text(FakeAuthService.account.email), findsOneWidget);
    expect(find.text('長者友善顯示'), findsOneWidget);
    expect(find.text('設定'), findsWidgets);
    expect(find.text('登出'), findsOneWidget);
    final settingsContext = tester.element(find.text('帳號'));
    expect(Localizations.localeOf(settingsContext).languageCode, 'zh');
    expect(Localizations.localeOf(settingsContext).scriptCode, 'Hant');
    expect(MaterialLocalizations.of(settingsContext).backButtonTooltip, '返回');
    expect(MaterialLocalizations.of(settingsContext).copyButtonLabel, '複製');
  });

  testWidgets('elder mode preserves a larger operating-system text scale', (
    tester,
  ) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.5;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await tester.pumpWidget(
      ElderTreeApp(authService: FakeAuthService(), initialTab: 6),
    );
    await tester.pump(const Duration(milliseconds: 100));

    final settingsContext = tester.element(find.text('帳號'));
    expect(MediaQuery.textScalerOf(settingsContext).scale(10), 15);
  });

  testWidgets('shows the life tree growth page', (tester) async {
    await tester.pumpWidget(
      ElderTreeApp(authService: FakeAuthService(), initialTab: 5),
    );
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('生命樹'), findsWidgets);
    expect(find.text('生命樹成長路徑'), findsOneWidget);
  });

  testWidgets('shows the cooperative circle relay journey', (tester) async {
    final controller = AppController();
    await tester.pumpWidget(
      MaterialApp(home: CircleScreen(controller: controller)),
    );

    expect(find.text('樹伴圈'), findsOneWidget);
    expect(find.text('讓春天回到生命樹'), findsOneWidget);
    await tester.dragUntilVisible(
      find.text('找回陽光'),
      find.byType(ListView),
      const Offset(0, -260),
    );
    expect(find.text('找回陽光'), findsOneWidget);
    await tester.dragUntilVisible(
      find.text('喚醒水流'),
      find.byType(ListView),
      const Offset(0, -220),
    );
    expect(find.text('喚醒水流'), findsOneWidget);
    await tester.dragUntilVisible(
      find.text('迎接新芽'),
      find.byType(ListView),
      const Offset(0, -220),
    );
    expect(find.text('迎接新芽'), findsOneWidget);
    await tester.dragUntilVisible(
      find.text('認領「陽光」這一棒'),
      find.byType(ListView),
      const Offset(0, -260),
    );
    await tester.tap(find.text('認領「陽光」這一棒'));
    await tester.pumpAndSettle();
    expect(find.text('選一個現在做得到的方式。認領後保留 30 分鐘，也可以再轉交。'), findsOneWidget);
    expect(find.text('無障礙替代：在窗邊找一束光'), findsOneWidget);
    controller.dispose();
  });
}
