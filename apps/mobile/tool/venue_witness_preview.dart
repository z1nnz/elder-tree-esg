// A debug-only visual fixture. This entry point is never imported by main.dart.
// Run with: flutter run -d web-server -t tool/venue_witness_preview.dart
import 'dart:convert';

import 'package:elder_tree_mobile/src/api_client.dart';
import 'package:elder_tree_mobile/src/app_controller.dart';
import 'package:elder_tree_mobile/src/app_locale.dart';
import 'package:elder_tree_mobile/src/models.dart';
import 'package:elder_tree_mobile/src/theme.dart';
import 'package:elder_tree_mobile/src/venue_witness_screen.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  if (!kDebugMode) throw StateError('介面驗收只能使用偵錯建置。');
  runApp(const VenueWitnessPreview());
}

class VenueWitnessPreview extends StatefulWidget {
  const VenueWitnessPreview({super.key});

  @override
  State<VenueWitnessPreview> createState() => _VenueWitnessPreviewState();
}

class _VenueWitnessPreviewState extends State<VenueWitnessPreview> {
  final semantics = WidgetsBinding.instance.ensureSemantics();
  late final AppController controller;
  late final MockClient client;
  late final RadarMissionModel mission;
  final parameters = Uri.base.queryParameters;
  late final String scenario = parameters['state'] ?? 'offer';
  late final double width = (double.tryParse(parameters['width'] ?? '') ?? 390)
      .clamp(320, 1024);
  late final double scale = (double.tryParse(parameters['scale'] ?? '') ?? 1)
      .clamp(1, 2);

  @override
  void initState() {
    super.initState();
    final now = DateTime.now().toUtc();
    mission = RadarMissionModel.fromJson({
      'id': 'visual-fixture-only',
      'title': '沿著河畔，留下今天的足跡',
      'description': '一起散步，讓相聚成為日常。',
      'category': 'NATURE',
      'tag': '共行',
      'latitude': 25.03,
      'longitude': 121.53,
      'radiusMeters': 60,
      'startsAt': now.subtract(const Duration(hours: 1)).toIso8601String(),
      'endsAt': now.add(const Duration(hours: 1)).toIso8601String(),
      'remainingSeconds': 3600,
      'verificationMode': 'SELF_CHECK',
      'growthPoints': 12,
      'venueName': '河畔共行站（測試據點）',
      'optionalOffer': scenario == 'none' ? null : '一杯飲水，不需要消費。',
      'publicationStatus': 'PUBLISHED',
      'status': scenario == 'arrival' ? 'UNLOCKED' : 'COMPLETED',
      'requiresVenueWitness': true,
    });
    client = MockClient((request) async {
      Object? data;
      if (request.method == 'GET' &&
          request.url.path.endsWith('/venue-receipt')) {
        if (scenario == 'error') return http.Response('fixture offline', 503);
        data = scenario == 'arrival'
            ? null
            : {
                'id': 'visual-fixture-receipt',
                'campaignId': 'visual-fixture-campaign',
                'witnessedAt': now.toIso8601String(),
                'redeemedAt': scenario == 'redeemed'
                    ? now.toIso8601String()
                    : null,
                'offer': scenario == 'none' ? null : '一杯飲水，不需要消費。',
              };
      } else if (request.method == 'POST' &&
          request.url.path.endsWith('/redemption-code')) {
        final issued = DateTime.now().toUtc();
        data = {
          'code': 'TCR1_${List.filled(43, 'v').join()}',
          'serverTime': issued.toIso8601String(),
          'expiresAt': issued
              .add(Duration(seconds: scenario == 'expiry' ? 8 : 300))
              .toIso8601String(),
        };
      } else {
        // No completion or real server request is implemented here.
        // Visual acceptance stops before the button requesting real location.
        return http.Response(
          'visual fixture does not implement this action',
          501,
        );
      }
      return http.Response(
        jsonEncode({'data': data}),
        200,
        headers: {'content-type': 'application/json; charset=utf-8'},
      );
    });
    controller = AppController(
      api: ApiClient(client: client, baseUrl: 'https://visual.invalid/api/v1'),
      allowOfflineDemo: false,
    );
  }

  @override
  void dispose() {
    semantics.dispose();
    controller.dispose();
    client.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: '同行成林｜介面驗收',
    debugShowCheckedModeBanner: false,
    theme: buildAppTheme(true),
    locale: appLocale,
    supportedLocales: appSupportedLocales,
    localizationsDelegates: appLocalizationDelegates,
    builder: (context, child) => ColoredBox(
      color: const Color(0xFF25332D),
      child: Center(
        child: SizedBox(
          width: width,
          child: Column(
            children: [
              const Padding(
                padding: EdgeInsets.all(8),
                child: Text(
                  '介面驗收・測試資料・不產生真實紀錄',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white,
                    decoration: TextDecoration.none,
                    fontWeight: FontWeight.w400,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) => MediaQuery(
                    data: MediaQuery.of(context).copyWith(
                      size: constraints.biggest,
                      textScaler: TextScaler.linear(scale),
                    ),
                    child: child!,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
    home: Builder(
      builder: (context) => Scaffold(
        appBar: AppBar(title: const Text('到場足跡・畫面驗收')),
        body: Center(
          child: FilledButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => VenueWitnessScreen(
                  controller: controller,
                  mission: mission,
                ),
              ),
            ),
            child: const Text('開啟驗收畫面'),
          ),
        ),
      ),
    ),
  );
}
