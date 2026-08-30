import 'package:elder_tree_mobile/src/api_client.dart';
import 'package:elder_tree_mobile/src/app_controller.dart';
import 'package:elder_tree_mobile/src/journey_step_source.dart';
import 'package:elder_tree_mobile/src/models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';

class _StepSource implements JourneyStepSource {
  _StepSource({
    this.access = JourneyStepAccessState.ready,
    this.reading = const JourneyStepReading(total: 42, source: 'APPLE_HEALTH'),
  });

  final JourneyStepAccessState access;
  final JourneyStepReading? reading;
  int requestCount = 0;
  int readCount = 0;

  @override
  Future<JourneyStepAccessState> requestReadAccess() async {
    requestCount += 1;
    return access;
  }

  @override
  Future<JourneyStepReading?> readTotal({
    required DateTime startedAt,
    required DateTime endedAt,
  }) async {
    readCount += 1;
    return reading;
  }
}

class _ExplorationApi extends ApiClient {
  _ExplorationApi(this.state);

  final ExplorationStateModel state;
  int? sentStepCount;
  String? sentStepSource;
  bool? sentManualPolicy;

  @override
  Future<ExplorationStateModel> recordExplorationEvent({
    required String sessionId,
    required String eventKey,
    required double latitude,
    required double longitude,
    required double accuracyMeters,
    required DateTime occurredAt,
    int? stepCountSinceStart,
    String? stepSource,
    bool? stepsExcludeManualEntries,
  }) async {
    sentStepCount = stepCountSinceStart;
    sentStepSource = stepSource;
    sentManualPolicy = stepsExcludeManualEntries;
    return state;
  }

  @override
  Future<List<DailyTask>> getTasks() async => const [];
}

void main() {
  test(
    'asks for health steps only when the selected route needs them',
    () async {
      final source = _StepSource();
      final api = _ExplorationApi(_state(composite: false));
      final controller = AppController(
        api: api,
        journeyStepSource: source,
        allowOfflineDemo: false,
      );

      await controller.prepareJourneyStepAccessForRoute(
        _state(composite: false).routes.single,
      );
      expect(source.requestCount, 0);
      expect(
        controller.journeyStepAccessState,
        JourneyStepAccessState.notNeeded,
      );

      await controller.prepareJourneyStepAccessForRoute(
        _state(composite: true).routes.single,
      );
      expect(source.requestCount, 1);
      expect(controller.journeyStepAccessState, JourneyStepAccessState.ready);
      controller.dispose();
    },
  );

  test(
    'sends only the session step aggregate with the location sample',
    () async {
      final state = _state(composite: true);
      final source = _StepSource();
      final api = _ExplorationApi(state);
      final controller = AppController(
        api: api,
        journeyStepSource: source,
        allowOfflineDemo: false,
      );
      controller.exploration = state;
      controller.exploring = true;
      await controller.prepareJourneyStepAccessForRoute(state.routes.single);

      await controller.recordExplorationPosition(
        Position(
          latitude: 25.0338,
          longitude: 121.5357,
          timestamp: DateTime.parse('2026-08-30T01:01:00.000Z'),
          accuracy: 8,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          headingAccuracy: 0,
          speed: 0,
          speedAccuracy: 0,
        ),
      );

      expect(source.readCount, 1);
      expect(api.sentStepCount, 42);
      expect(api.sentStepSource, 'APPLE_HEALTH');
      expect(api.sentManualPolicy, isTrue);
      controller.dispose();
    },
  );

  test(
    'health permission denial does not block location exploration',
    () async {
      final state = _state(composite: true);
      final source = _StepSource(
        access: JourneyStepAccessState.denied,
        reading: null,
      );
      final api = _ExplorationApi(state);
      final controller = AppController(
        api: api,
        journeyStepSource: source,
        allowOfflineDemo: false,
      );
      controller.exploration = state;
      controller.exploring = true;
      await controller.prepareJourneyStepAccessForRoute(state.routes.single);

      await controller.recordExplorationPosition(
        Position(
          latitude: 25.0338,
          longitude: 121.5357,
          timestamp: DateTime.parse('2026-08-30T01:01:00.000Z'),
          accuracy: 8,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          headingAccuracy: 0,
          speed: 0,
          speedAccuracy: 0,
        ),
      );

      expect(controller.explorationLocationStatus, '定位已更新');
      expect(controller.journeyStepAccessState, JourneyStepAccessState.denied);
      expect(source.readCount, 0);
      expect(api.sentStepCount, isNull);
      expect(api.sentStepSource, isNull);
      expect(api.sentManualPolicy, isNull);
      controller.dispose();
    },
  );
}

ExplorationStateModel _state({required bool composite}) =>
    ExplorationStateModel.fromJson({
      'totalDistanceMeters': 0,
      'coarseCell': null,
      'activeSession': {
        'id': 'session-1',
        'routeId': 'route-1',
        'status': 'ACTIVE',
        'distanceMeters': 0,
        'lastStepTotal': null,
        'stepSource': null,
        'startedAt': '2026-08-30T01:00:00.000Z',
        'lastEventAt': null,
      },
      'routes': [
        {
          'id': 'route-1',
          'slug': 'journey-witness-test',
          'name': '場域同行測試',
          'description': '測試健康步數是否只在需要時讀取。',
          'badgeName': '同行葉',
          'badgeAssetKey': 'journey-leaf',
          'completedQuestCount': 0,
          'totalQuestCount': 1,
          'badgeAwarded': false,
          'quests': [
            {
              'id': 'quest-1',
              'taskId': 'task-1',
              'sequence': 1,
              'locationName': '測試公園',
              'category': 'WALK',
              'safetyNote': '請走平坦步道。',
              'accessibilityTags': ['平坦步道'],
              'title': '一起走一段路',
              'description': '在公園裡慢慢走。',
              'verificationMode': composite
                  ? 'LOCATION_CHECK_IN'
                  : 'SELF_CHECK',
              'minimumSeconds': composite ? 60 : null,
              'minimumStepCount': composite ? 100 : null,
              'minimumDistanceMeters': composite ? 200 : null,
              'triggerType': 'GEOFENCE',
              'latitude': 25.0338,
              'longitude': 121.5357,
              'radiusMeters': 100,
              'unlockDistanceMeters': null,
              'unlocked': true,
              'completed': false,
              'journeyWitness': composite
                  ? {
                      'tier': 'COMPOSITE',
                      'status': 'NOT_STARTED',
                      'dwellSeconds': 0,
                      'minimumDwellSeconds': 60,
                      'stepCount': 0,
                      'minimumStepCount': 100,
                      'distanceMeters': 0,
                      'minimumDistanceMeters': 200,
                      'stepSource': null,
                      'firstInsideAt': null,
                      'lastInsideAt': null,
                      'completedAt': null,
                    }
                  : null,
            },
          ],
        },
      ],
    });
