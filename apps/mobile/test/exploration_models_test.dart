import 'package:elder_tree_mobile/src/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'parses route progress, active session, badge, and locked photo task',
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
        'capability': {'enabled': false, 'reason': 'PHOTO_STORAGE_UNAVAILABLE'},
      });

      expect(state.activeSession?.distanceMeters, 120);
      expect(state.routes.single.badgeAwarded, isTrue);
      expect(state.quests.single.completed, isTrue);
      expect(photo.capabilityEnabled, isFalse);
      expect(photo.capabilityReason, 'PHOTO_STORAGE_UNAVAILABLE');
    },
  );
}
