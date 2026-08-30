// Optional, reproducible Flutter-rendered evidence; no font is redistributed.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:elder_tree_mobile/src/app_controller.dart';
import 'package:elder_tree_mobile/src/app_locale.dart';
import 'package:elder_tree_mobile/src/circle_welcome_screen.dart';
import 'package:elder_tree_mobile/src/models.dart';
import 'package:elder_tree_mobile/src/journey_library_screen.dart';
import 'package:elder_tree_mobile/src/journey_witness_progress.dart';
import 'package:elder_tree_mobile/src/screens.dart';
import 'package:elder_tree_mobile/src/root_shell.dart';
import 'package:elder_tree_mobile/src/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'journey_library_test.dart' show JourneyApi, journeyController;
import 'relay_timer_witness_test.dart' show timerCircle;

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
      final controller = label == 'journey'
          ? journeyController(JourneyApi())
          : (AppController()..offlineDemo = true);
      controller.loading = false;
      if (label == 'timer') {
        controller
          ..offlineDemo = false
          ..circle = timerCircle();
      }
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
            home: label.startsWith('core-')
                ? RootShell(
                    controller: controller,
                    accountEmail: 'preview@example.invalid',
                    onSignOut: () async {},
                    initialIndex: label.contains('home')
                        ? 0
                        : label.contains('companion')
                        ? 3
                        : 5,
                  )
                : label == 'journey'
                ? JourneyLibraryScreen(controller: controller)
                : label == 'setup'
                ? CircleWelcomeScreen(controller: controller)
                : label == 'journey-witness'
                ? Scaffold(
                    appBar: AppBar(title: const Text('樹伴 · 場域同行')),
                    body: const SingleChildScrollView(
                      padding: EdgeInsets.fromLTRB(18, 20, 18, 32),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '大安森林公園同行篇章',
                            style: TextStyle(
                              color: forestDark,
                              fontSize: 24,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          SizedBox(height: 7),
                          Text(
                            '在場域內連續散步，三項條件都完成後，才會為樹伴圈留下這次真實足跡。',
                            style: TextStyle(
                              color: Color(0xFF5D6C63),
                              height: 1.5,
                            ),
                          ),
                          SizedBox(height: 16),
                          JourneyWitnessProgress(
                            witness: ExplorationJourneyWitnessModel(
                              tier: 'COMPOSITE',
                              status: 'IN_PROGRESS',
                              dwellSeconds: 120,
                              minimumDwellSeconds: 180,
                              stepCount: 160,
                              minimumStepCount: 240,
                              distanceMeters: 210,
                              minimumDistanceMeters: 300,
                              stepSource: 'APPLE_HEALTH',
                              firstInsideAt: null,
                              lastInsideAt: null,
                              completedAt: null,
                            ),
                            healthAccessLabel:
                                '健康步數已準備；只讀取並上傳這趟探索的步數總量。',
                          ),
                          SizedBox(height: 14),
                          _CaptureEvidenceBoundary(),
                        ],
                      ),
                    ),
                  )
                : Scaffold(
                    appBar: AppBar(title: const Text('樹伴 · 示範畫面')),
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

      await capture(
        label.startsWith('core-')
            ? label
            : label == 'journey'
            ? 'journey-records'
            : label == 'setup'
            ? 'circle-welcome'
            : label == 'journey-witness'
            ? 'journey-witness-progress'
            : 'circle-$label',
      );
      if (label == 'journey') {
        await tester.tap(find.text('回看大家留下的片刻'));
        await tester.pumpAndSettle();
        await capture('journey-story');
        await tester.ensureVisible(find.text('選下一段'));
        await tester.tap(find.text('選下一段'));
        await tester.pumpAndSettle();
        await capture('journey-choices');
      }
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
      if (label == 'timer') {
        await tester.scrollUntilVisible(
          find.text('完整計時見證'),
          240,
          scrollable: find.byType(Scrollable).last,
        );
        await tester.pump();
        expect(tester.takeException(), isNull);
        await capture('relay-timer-witness');
      }
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    },
    skip: output.isEmpty || fontPath.isEmpty,
  );
}

class _CaptureEvidenceBoundary extends StatelessWidget {
  const _CaptureEvidenceBoundary();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7E2),
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Text(
        '這項見證只代表裝置回報的步數與伺服器接受的位置、時間條件共同成立，不代表醫療效果或完全排除裝置造假。',
        style: TextStyle(color: Color(0xFF635B49), height: 1.5),
      ),
    );
  }
}
