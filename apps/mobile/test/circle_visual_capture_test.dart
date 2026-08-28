// Optional, reproducible Flutter-rendered evidence; no font is redistributed.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:elder_tree_mobile/src/app_controller.dart';
import 'package:elder_tree_mobile/src/app_locale.dart';
import 'package:elder_tree_mobile/src/circle_welcome_screen.dart';
import 'package:elder_tree_mobile/src/models.dart';
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
      if (label == 'setup') {
        controller.offlineDemo = false;
        controller.context = const AppContextModel(
          displayName: '畫面驗收帳號',
          activeHouseholdId: 'capture',
          households: [
            HouseholdSummaryModel(
              id: 'capture',
              name: '我的樹伴圈',
              relationship: '建立者',
              canManageCircle: true,
              needsSetup: true,
            ),
          ],
        );
      }
      final key = GlobalKey();
      final theme = buildAppTheme(true);
      await tester.pumpWidget(
        RepaintBoundary(
          key: key,
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            locale: appLocale,
            supportedLocales: appSupportedLocales,
            localizationsDelegates: appLocalizationDelegates,
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
            home: label == 'setup'
                ? CircleWelcomeScreen(controller: controller)
                : Scaffold(
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

      await capture(label == 'setup' ? 'circle-welcome' : 'circle-$label');
      if (label == 'setup') {
        await tester.ensureVisible(find.text('為樹伴圈取名'));
        await tester.tap(find.text('為樹伴圈取名'));
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextFormField), '週末慢步的我們');
        await tester.tap(find.text('朋友'));
        await tester.pumpAndSettle();
        await tester.scrollUntilVisible(
          find.text('儲存設定'),
          200,
          scrollable: find
              .byWidgetPredicate(
                (widget) =>
                    widget is Scrollable &&
                    widget.axisDirection == AxisDirection.down,
              )
              .last,
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await capture('circle-profile');
      }
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
