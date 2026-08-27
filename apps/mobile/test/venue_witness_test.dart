import 'dart:async';
import 'dart:convert';

import 'package:elder_tree_mobile/src/api_client.dart';
import 'package:elder_tree_mobile/src/app_controller.dart';
import 'package:elder_tree_mobile/src/models.dart';
import 'package:elder_tree_mobile/src/theme.dart';
import 'package:elder_tree_mobile/src/venue_witness_models.dart';
import 'package:elder_tree_mobile/src/venue_witness_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:geolocator/geolocator.dart';
import 'package:qr_flutter/qr_flutter.dart';

class VenueLocationStub extends GeolocatorPlatform {
  bool mocked = false;
  LocationPermission permission = LocationPermission.whileInUse;
  @override
  Future<bool> isLocationServiceEnabled() async => true;
  @override
  Future<LocationPermission> checkPermission() async => permission;
  @override
  Future<LocationPermission> requestPermission() async => permission;
  @override
  Future<Position> getCurrentPosition({
    LocationSettings? locationSettings,
  }) async => Position(
    latitude: 25.03,
    longitude: 121.53,
    timestamp: DateTime.now(),
    accuracy: 10,
    altitude: 0,
    altitudeAccuracy: 0,
    heading: 0,
    headingAccuracy: 0,
    speed: 0,
    speedAccuracy: 0,
    isMocked: mocked,
  );
}

final arrivalCode = 'TCA1_${List.filled(43, 'a').join()}';
final redemptionCode = 'TCR1_${List.filled(43, 'b').join()}';
Map<String, dynamic> missionJson({
  bool witness = true,
  String status = 'UNLOCKED',
}) => {
  'id': 'venue-mission',
  'title': '沿著河畔留下今天共同的足跡',
  'description': '不消費也可參加',
  'category': 'NATURE',
  'tag': '共行',
  'latitude': 25.03,
  'longitude': 121.53,
  'radiusMeters': 60,
  'startsAt': '2026-08-01T00:00:00Z',
  'endsAt': '2026-10-01T00:00:00Z',
  'remainingSeconds': 3600,
  'verificationMode': 'SELF_CHECK',
  'minimumSeconds': null,
  'growthPoints': 12,
  'badgeName': null,
  'venueName': '本機測試據點',
  'optionalOffer': '一杯飲水，不需要消費。',
  'publicationStatus': 'PUBLISHED',
  'status': status,
  'unlockedAt': '2026-08-28T00:00:00Z',
  'completedAt': null,
  'requiresVenueWitness': witness,
};
Map<String, dynamic> receiptJson({
  String? offer = '一杯飲水，不需要消費。',
  String? redeemedAt,
}) => {
  'id': 'receipt',
  'campaignId': 'campaign',
  'witnessedAt': '2026-08-28T00:00:00Z',
  'offer': offer,
  'redeemedAt': redeemedAt,
};
Map<String, dynamic> codeJson() => {
  'code': redemptionCode,
  'serverTime': '2026-08-28T00:00:00Z',
  'expiresAt': '2026-08-28T00:05:00Z',
};
http.Response envelope(Object? data) => http.Response(
  jsonEncode({'data': data}),
  200,
  headers: {'content-type': 'application/json; charset=utf-8'},
);
VenueWitnessSubmission proof({
  double accuracy = 10,
  DateTime? at,
  String? code,
}) => VenueWitnessSubmission(
  code: code ?? arrivalCode,
  latitude: 25.03,
  longitude: 121.53,
  accuracyMeters: accuracy,
  occurredAt: at ?? DateTime.now(),
);

void main() {
  test(
    'location capture rejects native mock positions and denied permission',
    () async {
      final original = GeolocatorPlatform.instance;
      final location = VenueLocationStub();
      GeolocatorPlatform.instance = location;
      addTearDown(() => GeolocatorPlatform.instance = original);
      expect(
        (await captureVenuePosition(arrivalCode)).isValidAt(DateTime.now()),
        isTrue,
      );
      location.mocked = true;
      await expectLater(
        captureVenuePosition(arrivalCode),
        throwsFormatException,
      );
      location.mocked = false;
      location.permission = LocationPermission.deniedForever;
      await expectLater(
        captureVenuePosition(arrivalCode),
        throwsFormatException,
      );
    },
  );
  test('preserves the witness flag and supports old radar responses', () {
    final json = missionJson();
    final mission = RadarMissionModel.fromJson(json);
    expect(mission.copyWith(status: 'COMPLETED').requiresVenueWitness, isTrue);
    json.remove('requiresVenueWitness');
    expect(RadarMissionModel.fromJson(json).requiresVenueWitness, isFalse);
  });

  test(
    'accepts only fresh accurate arrival evidence, not a redemption code',
    () {
      final now = DateTime.now();
      expect(proof(at: now).isValidAt(now), isTrue);
      expect(
        proof(at: now.subtract(const Duration(seconds: 31))).isValidAt(now),
        isFalse,
      );
      expect(
        proof(at: now.add(const Duration(seconds: 6))).isValidAt(now),
        isFalse,
      );
      expect(proof(accuracy: 51).isValidAt(now), isFalse);
      expect(proof(accuracy: double.nan).isValidAt(now), isFalse);
      expect(proof(code: redemptionCode).isValidAt(now), isFalse);
      expect(isVenueArrivalCode('https://example.com'), isFalse);
    },
  );

  test(
    'uses server-relative redemption expiry and rejects wrong token kinds',
    () {
      expect(
        VenueRedemptionCode.fromJson(codeJson()).lifetime,
        const Duration(minutes: 5),
      );
      expect(
        VenueRedemptionCode.fromJson({
          ...codeJson(),
          'code': arrivalCode,
        }).lifetime,
        Duration.zero,
      );
      expect(
        VenueRedemptionCode.fromJson({
          ...codeJson(),
          'expiresAt': '2026-08-27T00:00:00Z',
        }).lifetime,
        Duration.zero,
      );
    },
  );

  test(
    'sends nested evidence with auth, and no witness field for ordinary missions',
    () async {
      final requests = <http.Request>[];
      final api = ApiClient(
        tokenProvider: () async => 'test-auth',
        client: MockClient((request) async {
          requests.add(request);
          return envelope({
            'generatedAt': '2026-08-28T00:00:00Z',
            'missions': [],
          });
        }),
      );
      addTearDown(api.dispose);
      final evidence = proof();
      await api.completeRadarMission('venue-mission', venueWitness: evidence);
      expect(
        requests.first.url.path,
        '/api/v1/exploration/radar/venue-mission/complete',
      );
      expect(requests.first.headers['authorization'], 'Bearer test-auth');
      expect(
        (jsonDecode(requests.first.body) as Map)['venueWitness'],
        evidence.toJson(),
      );
      await api.completeRadarMission('ordinary');
      expect(
        (jsonDecode(requests.last.body) as Map).containsKey('venueWitness'),
        isFalse,
      );
    },
  );

  test(
    'reads nullable receipts without caching and requests a code separately',
    () async {
      final requests = <http.Request>[];
      final api = ApiClient(
        client: MockClient((request) async {
          requests.add(request);
          return envelope(request.method == 'GET' ? null : codeJson());
        }),
      );
      addTearDown(api.dispose);
      expect(await api.getVenueReceipt('venue-mission'), isNull);
      expect(requests.single.headers['cache-control'], 'no-store');
      expect(
        (await api.createVenueRedemptionCode('venue-mission')).code,
        redemptionCode,
      );
      expect(
        requests.last.url.path,
        '/api/v1/exploration/radar/venue-mission/redemption-code',
      );
      expect(requests.last.method, 'POST');
    },
  );

  test(
    'controller rejects missing or stale evidence without making a request',
    () async {
      var calls = 0;
      final controller = AppController(
        api: ApiClient(
          client: MockClient((request) async {
            calls++;
            return envelope(null);
          }),
        ),
      );
      addTearDown(controller.dispose);
      final mission = RadarMissionModel.fromJson(missionJson());
      expect(await controller.completeRadarMission(mission), isFalse);
      expect(
        await controller.completeRadarMission(
          mission,
          venueWitness: proof(
            at: DateTime.now().subtract(const Duration(minutes: 1)),
          ),
        ),
        isFalse,
      );
      expect(calls, 0);
      expect(controller.lastGrowthAwardPoints, isNull);
    },
  );

  test(
    'completion stays successful when optional summary refresh fails, and double taps send once',
    () async {
      var posts = 0;
      final done = Completer<http.Response>();
      final controller = AppController(
        api: ApiClient(
          client: MockClient((request) async {
            if (request.method == 'POST') {
              posts++;
              return done.future;
            }
            return http.Response('{"message":"offline"}', 503);
          }),
        ),
      );
      addTearDown(controller.dispose);
      final mission = RadarMissionModel.fromJson(missionJson());
      final first = controller.completeRadarMission(
        mission,
        venueWitness: proof(),
      );
      expect(
        await controller.completeRadarMission(mission, venueWitness: proof()),
        isFalse,
      );
      done.complete(
        envelope({
          'generatedAt': '2026-08-28T00:00:00Z',
          'missions': [missionJson(status: 'COMPLETED')],
        }),
      );
      expect(await first, isTrue);
      expect(posts, 1);
      expect(controller.radar.missions.single.isCompleted, isTrue);
    },
  );

  test('offline mode cannot issue receipts or redemption codes', () async {
    final controller = AppController()..offlineDemo = true;
    addTearDown(controller.dispose);
    expect(
      () => controller.getVenueReceipt('venue-mission'),
      throwsFormatException,
    );
    expect(
      () => controller.createVenueRedemptionCode('venue-mission'),
      throwsFormatException,
    );
    expect(
      await controller.completeRadarMission(
        RadarMissionModel.fromJson(missionJson()),
        venueWitness: proof(),
      ),
      isFalse,
    );
  });

  testWidgets(
    'no-offer completion remains readable at narrow width and double text',
    (tester) async {
      tester.view.reset();
      await tester.binding.setSurfaceSize(const Size(360, 800));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final controller = AppController(
        api: ApiClient(
          client: MockClient(
            (request) async => envelope(receiptJson(offer: null)),
          ),
        ),
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: buildAppTheme(true),
          home: MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(2)),
            child: VenueWitnessScreen(
              controller: controller,
              mission: RadarMissionModel.fromJson(
                missionJson(status: 'COMPLETED'),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.scrollUntilVisible(find.text('這段旅程沒有額外回饋，年輪進度仍已保留。'), 250);
      expect(tester.takeException(), isNull);
      expect(find.text('這段旅程沒有額外回饋，年輪進度仍已保留。'), findsOneWidget);
      expect(find.text('我想領取，顯示領取碼'), findsNothing);
      await tester.pumpWidget(const SizedBox());
      controller.dispose();
    },
  );

  testWidgets(
    'does not issue a reward until asked and clears it when leaving the app',
    (tester) async {
      var posts = 0;
      final controller = AppController(
        api: ApiClient(
          client: MockClient((request) async {
            if (request.method == 'POST') {
              posts++;
              return envelope(codeJson());
            }
            return envelope(receiptJson());
          }),
        ),
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: buildAppTheme(true),
          home: VenueWitnessScreen(
            controller: controller,
            mission: RadarMissionModel.fromJson(
              missionJson(status: 'COMPLETED'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(posts, 0);
      await tester.tap(find.text('我想領取，顯示領取碼'));
      await tester.pumpAndSettle();
      expect(posts, 1);
      expect(find.byType(QrImageView), findsOneWidget);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      expect(find.byType(QrImageView), findsNothing);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(posts, 1);
      await tester.pumpWidget(const SizedBox());
      controller.dispose();
    },
  );

  testWidgets('ignores an issued code arriving after the app became inactive', (
    tester,
  ) async {
    final issued = Completer<http.Response>();
    var requested = false;
    final controller = AppController(
      api: ApiClient(
        client: MockClient((request) async {
          if (request.method == 'POST') {
            requested = true;
            return issued.future;
          }
          return envelope(receiptJson());
        }),
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(true),
        home: VenueWitnessScreen(
          controller: controller,
          mission: RadarMissionModel.fromJson(missionJson(status: 'COMPLETED')),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('我想領取，顯示領取碼'));
    await tester.pump();
    expect(requested, isTrue);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await tester.pump();
    issued.complete(envelope(codeJson()));
    await tester.pumpAndSettle();
    expect(find.byType(QrImageView), findsNothing);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(find.byType(QrImageView), findsNothing);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
  });

  testWidgets('refreshes a redeemed receipt before considering another code', (
    tester,
  ) async {
    var reads = 0;
    var writes = 0;
    final controller = AppController(
      api: ApiClient(
        client: MockClient((request) async {
          if (request.method == 'POST') {
            writes++;
            return envelope(codeJson());
          }
          reads++;
          return envelope(
            receiptJson(redeemedAt: reads > 1 ? '2026-08-28T00:01:00Z' : null),
          );
        }),
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(true),
        home: VenueWitnessScreen(
          controller: controller,
          mission: RadarMissionModel.fromJson(missionJson(status: 'COMPLETED')),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('我想領取，顯示領取碼'));
    await tester.pumpAndSettle();
    expect(writes, 0);
    expect(find.text('回饋已登記領取，請勿重複領取。'), findsOneWidget);
    expect(find.byType(QrImageView), findsNothing);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
  });
}
