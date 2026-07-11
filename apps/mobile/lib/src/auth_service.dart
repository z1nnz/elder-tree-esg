import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';

class AuthAccount {
  const AuthAccount({required this.uid, required this.email, this.displayName});

  final String uid;
  final String email;
  final String? displayName;
}

abstract class AuthService {
  Stream<AuthAccount?> get accountChanges;
  AuthAccount? get currentAccount;

  Future<void> signIn({required String email, required String password});
  Future<void> register({
    required String email,
    required String password,
    required String displayName,
  });
  Future<void> signOut();
  Future<String?> getIdToken();
}

class FirebaseAuthService implements AuthService {
  FirebaseAuthService({FirebaseAuth? auth})
    : _auth = auth ?? FirebaseAuth.instance;

  final FirebaseAuth _auth;

  AuthAccount? _toAccount(User? user) {
    if (user == null) return null;
    return AuthAccount(
      uid: user.uid,
      email: user.email ?? '未設定信箱',
      displayName: user.displayName,
    );
  }

  @override
  Stream<AuthAccount?> get accountChanges =>
      _auth.authStateChanges().map(_toAccount);

  @override
  AuthAccount? get currentAccount => _toAccount(_auth.currentUser);

  @override
  Future<String?> getIdToken() async => _auth.currentUser?.getIdToken();

  @override
  Future<void> register({
    required String email,
    required String password,
    required String displayName,
  }) async {
    final credential = await _auth.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
    await credential.user?.updateDisplayName(displayName.trim());
  }

  @override
  Future<void> signIn({required String email, required String password}) async {
    await _auth.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
  }

  @override
  Future<void> signOut() => _auth.signOut();
}

class LocalDebugAuthService implements AuthService {
  LocalDebugAuthService({
    this.initialAccount = const AuthAccount(
      uid: 'debug-macos-demo',
      email: 'demo@elder-tree.local',
      displayName: '綠伴 Demo',
    ),
  }) : _currentAccount = initialAccount;

  final AuthAccount initialAccount;
  final StreamController<AuthAccount?> _controller =
      StreamController<AuthAccount?>.broadcast();
  AuthAccount? _currentAccount;

  @override
  Stream<AuthAccount?> get accountChanges async* {
    yield _currentAccount;
    yield* _controller.stream;
  }

  @override
  AuthAccount? get currentAccount => _currentAccount;

  @override
  Future<String?> getIdToken() async => null;

  @override
  Future<void> register({
    required String email,
    required String password,
    required String displayName,
  }) async {
    _currentAccount = AuthAccount(
      uid: 'debug-macos-demo',
      email: email.trim().isEmpty ? initialAccount.email : email.trim(),
      displayName: displayName.trim().isEmpty
          ? initialAccount.displayName
          : displayName.trim(),
    );
    _controller.add(_currentAccount);
  }

  @override
  Future<void> signIn({required String email, required String password}) async {
    _currentAccount = AuthAccount(
      uid: 'debug-macos-demo',
      email: email.trim().isEmpty ? initialAccount.email : email.trim(),
      displayName: initialAccount.displayName,
    );
    _controller.add(_currentAccount);
  }

  @override
  Future<void> signOut() async {
    _currentAccount = null;
    _controller.add(null);
  }

  Future<void> dispose() => _controller.close();
}
