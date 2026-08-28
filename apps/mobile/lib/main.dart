import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'firebase_options.dart';
import 'src/app_controller.dart';
import 'src/app_locale.dart';
import 'src/api_client.dart';
import 'src/auth_screen.dart';
import 'src/auth_service.dart';
import 'src/root_shell.dart';
import 'src/circle_welcome_screen.dart';
import 'src/theme.dart';

const _localDemoAuth = bool.fromEnvironment('ELDER_TREE_LOCAL_DEMO_AUTH');
const _legacyMacosDemoAuth = bool.fromEnvironment('ELDER_TREE_MACOS_DEMO_AUTH');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (!kDebugMode || !_localDemoAuth) {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  }
  runApp(ElderTreeApp(initialTab: _localDemoAuth ? 0 : 2));
}

class ElderTreeApp extends StatefulWidget {
  const ElderTreeApp({this.authService, this.initialTab = 2, super.key});

  final AuthService? authService;
  final int initialTab;

  @override
  State<ElderTreeApp> createState() => _ElderTreeAppState();
}

class _ElderTreeAppState extends State<ElderTreeApp> {
  late final AuthService auth;

  @override
  void initState() {
    super.initState();
    auth =
        widget.authService ??
        (kDebugMode &&
                (_localDemoAuth ||
                    (defaultTargetPlatform == TargetPlatform.macOS &&
                        _legacyMacosDemoAuth))
            ? LocalDebugAuthService()
            : FirebaseAuthService());
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '同行成林',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(true),
      locale: appLocale,
      supportedLocales: appSupportedLocales,
      localizationsDelegates: appLocalizationDelegates,
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
            initialTab: widget.initialTab,
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
    required this.initialTab,
    super.key,
  });

  final AuthService auth;
  final AuthAccount account;
  final int initialTab;

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
      initialDisplayName: widget.account.displayName,
      allowOfflineDemo: widget.account.uid == 'debug-macos-demo',
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
              textScaler: controller.elderMode
                  ? media.textScaler.clamp(minScaleFactor: 1.12)
                  : media.textScaler,
            ),
            child: controller.needsCircleSetup
                ? CircleWelcomeScreen(controller: controller)
                : RootShell(
                    controller: controller,
                    accountEmail: widget.account.email,
                    onSignOut: widget.auth.signOut,
                    initialIndex: widget.initialTab,
                  ),
          ),
        );
      },
    );
  }
}
