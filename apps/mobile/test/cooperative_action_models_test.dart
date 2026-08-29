import 'package:elder_tree_mobile/src/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses relay claim and accessibility alternative from circle response', () {
    final circle = CircleOverviewModel.fromJson({
      'id': 'circle-1',
      'name': '散步好友圈',
      'kind': 'FRIENDS',
      'currentMemberId': 'member-1',
      'memberCount': 2,
      'members': [
        {
          'id': 'member-1',
          'displayName': '阿樹',
          'relationship': '本人',
        },
        {
          'id': 'member-2',
          'displayName': '美玲',
          'relationship': '朋友',
        },
      ],
      'activeAction': {
        'id': 'action-1',
        'runId': 'run-1',
        'title': '找回春天',
        'description': '一起完成三棒。',
        'kind': 'RELAY',
        'status': 'ACTIVE',
        'minimumContributors': 2,
        'maxChaptersPerMember': 1,
        'contributorCount': 0,
        'completedChapterCount': 0,
        'totalChapterCount': 1,
        'growthPoints': 30,
        'keepsakeName': '春日枝條',
        'chapters': [
          {
            'id': 'chapter-1',
            'sequence': 1,
            'title': '到戶外找陽光',
            'description': '走到安全的戶外空間。',
            'elementName': '陽光',
            'verificationMode': 'SELF_CHECK',
            'alternative': {
              'title': '在窗邊找陽光',
              'description': '不方便外出時，在窗邊感受陽光。',
              'verificationMode': 'SELF_CHECK',
            },
            'claim': {
              'memberId': 'member-1',
              'displayName': '阿樹',
              'claimedAt': '2026-08-22T01:00:00.000Z',
              'expiresAt': '2026-08-22T01:30:00.000Z',
              'usingAlternative': true,
            },
            'contributor': null,
          },
        ],
      },
    });

    final chapter = circle.activeAction!.chapters.single;
    expect(chapter.alternative?.title, '在窗邊找陽光');
    expect(chapter.claim?.displayName, '阿樹');
    expect(chapter.claim?.usingAlternative, isTrue);
    expect(
      chapter.claim?.expiredAt(DateTime.parse('2026-08-22T01:29:59.000Z')),
      isFalse,
    );
    expect(
      chapter.claim?.expiredAt(DateTime.parse('2026-08-22T01:30:00.000Z')),
      isTrue,
    );
  });

  test(
    'uses the selected relay timer and rounds the visible final second up',
    () {
      final chapter = CooperativeActionChapterModel(
        id: 'timer',
        sequence: 2,
        title: '喚醒水流',
        description: '完成三分鐘舒展。',
        elementName: '水',
        verificationMode: VerificationMode.timer,
        minimumSeconds: 180,
        alternative: const CooperativeActionAlternativeModel(
          title: '坐著慢呼吸',
          description: '完成三分鐘慢呼吸。',
          verificationMode: VerificationMode.timer,
          minimumSeconds: 180,
        ),
        claim: CooperativeActionClaimModel(
          memberId: 'member-2',
          displayName: '美玲',
          claimedAt: DateTime.parse('2026-08-29T08:01:00.000Z'),
          expiresAt: DateTime.parse('2026-08-29T08:31:00.000Z'),
          usingAlternative: true,
        ),
        contributor: null,
      );

      expect(chapter.selectedVerificationMode, VerificationMode.timer);
      expect(chapter.selectedMinimumSeconds, 180);
      expect(
        chapter.timerRemainingAt(DateTime.parse('2026-08-29T08:03:59.999Z')),
        const Duration(seconds: 1),
      );
      expect(
        chapter.timerRemainingAt(DateTime.parse('2026-08-29T08:04:00.000Z')),
        Duration.zero,
      );
    },
  );
}
