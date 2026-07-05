import 'package:flutter/material.dart';

import 'src/app_controller.dart';
import 'src/root_shell.dart';
import 'src/theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ElderTreeApp());
}

class ElderTreeApp extends StatefulWidget {
  const ElderTreeApp({super.key});

  @override
  State<ElderTreeApp> createState() => _ElderTreeAppState();
}

class _ElderTreeAppState extends State<ElderTreeApp> {
  late final AppController controller;

  @override
  void initState() {
    super.initState();
    controller = AppController()..initialize();
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
        return MaterialApp(
          title: '綠伴',
          debugShowCheckedModeBanner: false,
          theme: buildAppTheme(controller.elderMode),
          builder: (context, child) {
            final media = MediaQuery.of(context);
            return MediaQuery(
              data: media.copyWith(
                textScaler: TextScaler.linear(controller.elderMode ? 1.12 : 1),
              ),
              child: child!,
            );
          },
          home: RootShell(controller: controller),
        );
      },
    );
  }
}
