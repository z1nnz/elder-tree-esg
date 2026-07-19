import 'package:elder_tree_mobile/main.dart';
import 'package:elder_tree_mobile/src/auth_service.dart';
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
  testWidgets('shows settings as a dedicated full-screen function page', (
    tester,
  ) async {
    await tester.pumpWidget(
      ElderTreeApp(authService: FakeAuthService(), initialTab: 6),
    );
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('綠伴'), findsOneWidget);
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
}
