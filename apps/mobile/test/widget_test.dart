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
  testWidgets('shows the companion tree home experience', (tester) async {
    await tester.pumpWidget(
      ElderTreeApp(authService: FakeAuthService(), initialTab: 0),
    );
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('綠伴'), findsOneWidget);
    expect(find.text('今天'), findsOneWidget);
    expect(find.text('任務'), findsOneWidget);
    expect(find.text('家人'), findsOneWidget);
    expect(find.text('公益'), findsOneWidget);
    expect(find.text('互動樹'), findsOneWidget);
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
