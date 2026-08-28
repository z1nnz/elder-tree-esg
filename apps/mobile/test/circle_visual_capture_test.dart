// Optional, reproducible Flutter-rendered evidence; no font is redistributed.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:elder_tree_mobile/src/app_controller.dart';
import 'package:elder_tree_mobile/src/screens.dart';
import 'package:elder_tree_mobile/src/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const output = String.fromEnvironment('CIRCLE_CAPTURE_DIR');
  const fontPath = String.fromEnvironment('CIRCLE_CAPTURE_FONT');
  const label = String.fromEnvironment(
    'CIRCLE_CAPTURE_LABEL',
    defaultValue: 'after',
  );
  testWidgets(
    'capture circle page with a locally supplied Chinese font',
    (tester) async {
      for (final family in ['CircleEvidence', 'Roboto', 'PingFang TC']) {
        final loader = FontLoader(family);
        loader.addFont(
          Future.value(ByteData.sublistView(File(fontPath).readAsBytesSync())),
        );
        await tester.runAsync(loader.load);
      }
      final icons = FontLoader('MaterialIcons')
        ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
      await tester.runAsync(icons.load);
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final controller = AppController()..offlineDemo = true;
      final key = GlobalKey();
      final theme = buildAppTheme(true);
      await tester.pumpWidget(
        RepaintBoundary(
          key: key,
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: theme.copyWith(
              textTheme: theme.textTheme.apply(fontFamily: 'CircleEvidence'),
              chipTheme: theme.chipTheme.copyWith(
                labelStyle: theme.chipTheme.labelStyle?.copyWith(
                  fontFamily: 'CircleEvidence',
                ),
              ),
              filledButtonTheme: FilledButtonThemeData(
                style: theme.filledButtonTheme.style?.copyWith(
                  textStyle: WidgetStateProperty.resolveWith(
                    (states) =>
                        (theme.filledButtonTheme.style?.textStyle?.resolve(
                                  states,
                                ) ??
                                const TextStyle())
                            .copyWith(fontFamily: 'CircleEvidence'),
                  ),
                ),
              ),
              outlinedButtonTheme: OutlinedButtonThemeData(
                style: theme.outlinedButtonTheme.style?.copyWith(
                  textStyle: WidgetStateProperty.resolveWith(
                    (states) =>
                        (theme.outlinedButtonTheme.style?.textStyle?.resolve(
                                  states,
                                ) ??
                                const TextStyle())
                            .copyWith(fontFamily: 'CircleEvidence'),
                  ),
                ),
              ),
              textButtonTheme: TextButtonThemeData(
                style: theme.textButtonTheme.style?.copyWith(
                  textStyle: WidgetStateProperty.resolveWith(
                    (states) =>
                        (theme.textButtonTheme.style?.textStyle?.resolve(
                                  states,
                                ) ??
                                const TextStyle())
                            .copyWith(fontFamily: 'CircleEvidence'),
                  ),
                ),
              ),
            ),
            home: Scaffold(
              appBar: AppBar(title: const Text('同行成林 · 示範畫面')),
              body: CircleScreen(controller: controller),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      Future<void> capture(String name) async {
        final boundary =
            key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
        await tester.runAsync(() async {
          final image = await boundary.toImage(pixelRatio: 2);
          final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
          await Directory(output).create(recursive: true);
          await File(
            '$output/$name-390x844.png',
          ).writeAsBytes(bytes!.buffer.asUint8List());
          image.dispose();
        });
      }

      await capture('circle-$label');
      if (label == 'after') {
        await tester.tap(find.text('邀請與加入樹伴圈'));
        await tester.pumpAndSettle();
        await capture('circle-membership');
        await tester.tap(find.text('我有邀請碼'));
        await tester.pumpAndSettle();
        await capture('circle-join');
      }
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    },
    skip: output.isEmpty || fontPath.isEmpty,
  );
}
