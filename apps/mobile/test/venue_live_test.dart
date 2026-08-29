import 'dart:convert';
import 'dart:io';

import 'package:elder_tree_mobile/src/api_client.dart';
import 'package:elder_tree_mobile/src/app_controller.dart';
import 'package:elder_tree_mobile/src/venue_witness_models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

// Only replaces the development identity header. HTTP and all responses are real.
class _LocalIdentityClient extends http.BaseClient {
  _LocalIdentityClient(this.base, this.uid);
  final Uri base;
  final String uid;
  final http.Client inner = http.Client();

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) {
    if (request.url.origin != base.origin ||
        !request.url.path.startsWith('${base.path}/')) {
      throw StateError(
        'Live acceptance may only call its local fixture server.',
      );
    }
    request.headers['x-demo-user'] = uid;
    return inner.send(request);
  }

  @override
  void close() => inner.close();
}

void main() {
  final env = Platform.environment;
  final url = env['VENUE_ACCEPTANCE_API_URL'];
  test(
    'Flutter client completes and reloads the real HTTP venue workflow',
    () async {
      final base = Uri.parse(url!);
      expect(base.scheme, 'http');
      expect(base.host, '127.0.0.1');
      expect(base.path, '/api/v1');
      final missionId = env['VENUE_ACCEPTANCE_MISSION']!;
      final transport = _LocalIdentityClient(
        base,
        env['VENUE_ACCEPTANCE_MEMBER']!,
      );
      final api = ApiClient(baseUrl: url, client: transport);
      final controller = AppController(api: api, allowOfflineDemo: false);
      addTearDown(() {
        controller.dispose();
        transport.close();
      });
      controller.context = await api.getContext();

      if (env['VENUE_ACCEPTANCE_MODE'] == 'read-redeemed') {
        final receipt = await api.getVenueReceipt(missionId);
        expect(receipt, isNotNull);
        expect(receipt!.redeemedAt, isNotNull);
        await expectLater(
          api.createVenueRedemptionCode(missionId),
          throwsA(
            isA<ApiException>().having(
              (error) => error.message,
              'message',
              'Offer already redeemed',
            ),
          ),
        );
        stdout.writeln(
          'VENUE_ACCEPTANCE_RESULT:${jsonEncode({'witnessed': true, 'redeemed': true})}',
        );
        return;
      }

      expect(await api.getVenueReceipt(missionId), isNull);
      final before = await api.getTree();
      final radar = await api.unlockRadarMission(
        missionId: missionId,
        eventKey: 'live-acceptance-$missionId',
        latitude: 25.033,
        longitude: 121.5654,
        accuracyMeters: 8,
        occurredAt: DateTime.now(),
      );
      final mission = radar.missions.singleWhere(
        (item) => item.id == missionId,
      );
      expect(mission.requiresVenueWitness, isTrue);
      expect(mission.status, 'UNLOCKED');
      await expectLater(
        api.completeRadarMission(missionId),
        throwsA(
          isA<ApiException>().having(
            (error) => error.message,
            'message',
            'Scan the current venue code to complete this journey',
          ),
        ),
      );
      expect(await api.getVenueReceipt(missionId), isNull);
      // Synthetic coordinate input tests the protocol, not physical GPS or presence.
      final witness = VenueWitnessSubmission(
        code: env['VENUE_ACCEPTANCE_CODE']!,
        latitude: 25.033,
        longitude: 121.5654,
        accuracyMeters: 8,
        occurredAt: DateTime.now(),
      );
      final completed = await controller.completeRadarMission(
        mission,
        venueWitness: witness,
      );
      expect(completed, isTrue, reason: controller.notice);
      final receipt = await api.getVenueReceipt(missionId);
      expect(receipt, isNotNull);
      expect(receipt!.redeemedAt, isNull);
      expect(receipt.offer, '一杯飲水，不需要消費。');
      await api.completeRadarMission(missionId, venueWitness: witness);
      expect((await api.getVenueReceipt(missionId))!.id, receipt.id);
      final after = await api.getTree();
      expect(after.growthPoints - before.growthPoints, 12);
      final code = await api.createVenueRedemptionCode(missionId);
      expect(code.lifetime, const Duration(minutes: 5));
      stdout.writeln(
        'VENUE_ACCEPTANCE_RESULT:${jsonEncode({'code': code.code, 'witnessed': true, 'redeemed': false, 'growthDelta': after.growthPoints - before.growthPoints})}',
      );
    },
    skip: url == null
        ? 'Run through the isolated cross-platform acceptance suite.'
        : false,
  );
}
