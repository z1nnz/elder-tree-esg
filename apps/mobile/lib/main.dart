import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'firebase_options.dart';
import 'src/app_controller.dart';
import 'src/api_client.dart';
import 'src/auth_screen.dart';
import 'src/auth_service.dart';
import 'src/root_shell.dart';
import 'src/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  runApp(const ElderTreeApp());
}

class ElderTreeApp extends StatefulWidget {
  const ElderTreeApp({this.authService, super.key});

  final AuthService? authService;

  @override
  State<ElderTreeApp> createState() => _ElderTreeAppState();
}

class _ElderTreeAppState extends State<ElderTreeApp> {
  late final AuthService auth;

  @override
  void initState() {
    super.initState();
    auth = widget.authService ?? FirebaseAuthService();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '綠伴',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(true),
      home: StreamBuilder<AuthAccount?>(
        stream: auth.accountChanges,
        initialData: auth.currentAccount,
        builder: (context, snapshot) {
          final account = snapshot.data;
          if (account == null) return AuthScreen(auth: auth);
          return _AuthenticatedExperience(
            key: ValueKey(account.uid),
            auth: auth,
            account: account,
          );
        },
      ),
    );
  }
}

class _AuthenticatedExperience extends StatefulWidget {
  const _AuthenticatedExperience({
    required this.auth,
    required this.account,
    super.key,
  });

  final AuthService auth;
  final AuthAccount account;

  @override
  State<_AuthenticatedExperience> createState() =>
      _AuthenticatedExperienceState();
}

class _AuthenticatedExperienceState extends State<_AuthenticatedExperience> {
  late final AppController controller;

  @override
  void initState() {
    super.initState();
    controller = AppController(
      api: ApiClient(tokenProvider: widget.auth.getIdToken),
      allowOfflineDemo: false,
    )..initialize();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final media = MediaQuery.of(context);
        return Theme(
          data: buildAppTheme(controller.elderMode),
          child: MediaQuery(
            data: media.copyWith(
              textScaler: TextScaler.linear(controller.elderMode ? 1.12 : 1),
            ),
            child: RootShell(
              controller: controller,
              accountEmail: widget.account.email,
              onSignOut: widget.auth.signOut,
            ),
          ),
        );
      },
    );
  }
}
