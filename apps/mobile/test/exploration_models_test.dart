import 'package:elder_tree_mobile/src/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'parses route progress, active session, badge, and disabled photo verifier',
    () {
      final state = ExplorationStateModel.fromJson({
        'totalDistanceMeters': 120,
        'coarseCell': '88644a9',
        'activeSession': {
          'id': 'session-1',
          'routeId': 'route-1',
          'status': 'ACTIVE',
          'distanceMeters': 120,
          'startedAt': '2026-07-06T05:00:00.000Z',
          'lastEventAt': '2026-07-06T05:02:00.000Z',
        },
        'routes': [
          {
            'id': 'route-1',
            'slug': 'daan-forest-first-walk',
            'name': '都市綠肺初探',
            'description': '大安森林公園首發路線',
            'badgeName': '都市綠肺初探',
            'badgeAssetKey': 'urban-green-lung',
            'completedQuestCount': 1,
            'totalQuestCount': 1,
            'badgeAwarded': true,
            'quests': [
              {
                'id': 'quest-1',
                'taskId': 'task-1',
                'sequence': 1,
                'locationName': '大生態池',
                'category': 'NATURE',
                'safetyNote': '池邊慢行',
                'accessibilityTags': ['待確認'],
                'title': '聆聽自然',
                'description': '停留三分鐘',
                'triggerType': 'GEOFENCE',
                'latitude': 25.0306,
                'longitude': 121.5366,
                'radiusMeters': 75,
                'unlockDistanceMeters': null,
                'unlocked': true,
                'completed': true,
              },
            ],
          },
        ],
      });
      final photo = DailyTask.fromJson({
        'id': 'photo',
        'title': '拍照任務',
        'description': '尚未開放',
        'verificationMode': 'PHOTO_AI',
        'growthPoints': 80,
        'status': 'AVAILABLE',
        'startedAt': null,
        'minimumSeconds': null,
        'dueAt': null,
        'capability': {'enabled': false, 'reason': 'BLAZE_REQUIRED'},
      });
      final radar = RadarStateModel.fromJson({
        'generatedAt': '2026-07-07T12:00:00.000Z',
        'missions': [
          {
            'id': 'radar-1',
            'title': '華山綠意觀察',
            'description': '觀察一處城市綠意。',
            'category': 'NATURE',
            'tag': '觀察',
            'latitude': 25.04411,
            'longitude': 121.52944,
            'radiusMeters': 90,
            'startsAt': '2026-07-07T00:00:00.000Z',
            'endsAt': '2026-07-07T13:00:00.000Z',
            'remainingSeconds': 3600,
            'verificationMode': 'SELF_CHECK',
            'minimumSeconds': null,
            'growthPoints': 8,
            'badgeName': '城市觀察者',
            'publicationStatus': 'PUBLISHED',
            'status': 'UNLOCKED',
            'unlockedAt': '2026-07-07T12:00:00.000Z',
            'completedAt': null,
          },
        ],
      });

      expect(state.activeSession?.distanceMeters, 120);
      expect(state.routes.single.badgeAwarded, isTrue);
      expect(state.quests.single.completed, isTrue);
      expect(photo.capabilityEnabled, isFalse);
      expect(photo.capabilityReason, 'BLAZE_REQUIRED');
      expect(radar.missions.single.isUnlocked, isTrue);
      expect(radar.missions.single.publicationStatus, 'PUBLISHED');
      expect(radar.missions.single.growthPoints, 8);
    },
  );

  test('derives radar timer completion from unlock time', () {
    final mission = RadarMissionModel.fromJson({
      'id': 'timer-radar',
      'title': '三分鐘慢呼吸',
      'description': '停下來慢慢呼吸。',
      'category': 'WELLNESS',
      'tag': '慢呼吸',
      'latitude': 25.04236,
      'longitude': 121.51542,
      'radiusMeters': 90,
      'startsAt': '2026-07-07T08:00:00.000Z',
      'endsAt': '2026-07-07T10:00:00.000Z',
      'remainingSeconds': 3600,
      'verificationMode': 'TIMER',
      'minimumSeconds': 180,
      'growthPoints': 10,
      'badgeName': null,
      'publicationStatus': 'PUBLISHED',
      'status': 'UNLOCKED',
      'unlockedAt': '2026-07-07T09:00:00.000Z',
      'completedAt': null,
    });

    expect(
      mission.timerRemainingAt(DateTime.parse('2026-07-07T09:02:59.000Z')),
      const Duration(seconds: 1),
    );
    expect(
      mission.canCompleteAt(DateTime.parse('2026-07-07T09:02:59.000Z')),
      isFalse,
    );
    expect(
      mission.canCompleteAt(DateTime.parse('2026-07-07T09:03:00.000Z')),
      isTrue,
    );
  });
}
