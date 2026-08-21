import 'package:elder_tree_mobile/main.dart';
import 'package:elder_tree_mobile/src/auth_service.dart';
import 'package:elder_tree_mobile/src/app_controller.dart';
import 'package:elder_tree_mobile/src/screens.dart';
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
    await tester.binding.setSurfaceSize(const Size(800, 1000));
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

    expect(find.text('樹伴圈・共行接力'), findsOneWidget);
    expect(find.text('讓春天回到生命樹'), findsOneWidget);
    expect(find.text('下一棒等人認領'), findsOneWidget);
    await tester.tap(find.text('去認領下一棒'));
    expect(openedCircle, isTrue);

    controller.dispose();
  });

  testWidgets('shows settings as a dedicated full-screen function page', (
    tester,
  ) async {
    await tester.pumpWidget(
      ElderTreeApp(authService: FakeAuthService(), initialTab: 6),
    );
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('同行成林'), findsOneWidget);
    expect(find.text('帳號'), findsOneWidget);
    expect(find.text(FakeAuthService.account.email), findsOneWidget);
    expect(find.text('長者友善顯示'), findsOneWidget);
    expect(find.text('設定'), findsWidgets);
    expect(find.text('登出'), findsOneWidget);
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
