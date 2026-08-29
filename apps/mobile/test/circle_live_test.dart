import 'dart:io';

import 'package:elder_tree_mobile/src/api_client.dart';
import 'package:elder_tree_mobile/src/app_controller.dart';
import 'package:elder_tree_mobile/src/models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

class _CircleIdentityClient extends http.BaseClient {
  _CircleIdentityClient(this.base, this.uid);
  final Uri base;
  final String uid;
  final http.Client inner = http.Client();

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) {
    if (request.url.origin != base.origin ||
        !request.url.path.startsWith('${base.path}/')) {
      throw StateError('Acceptance can only call its local fixture server.');
    }
    request.headers['x-demo-user'] = uid;
    return inner.send(request);
  }

  @override
  void close() => inner.close();
}

void main() {
  final url = Platform.environment['CIRCLE_ACCEPTANCE_API_URL'];
  test(
    'three real HTTP clients join, relay and reload one shared reward',
    () async {
      final base = Uri.parse(url!);
      expect(base.scheme, 'http');
      expect(base.host, '127.0.0.1');
      expect(base.path, '/api/v1');
      final uids = Platform.environment['CIRCLE_ACCEPTANCE_MEMBERS']!.split(
        ',',
      );
      expect(uids.length, 3);
      final clients = [
        for (final uid in uids)
          ApiClient(baseUrl: url, client: _CircleIdentityClient(base, uid)),
      ];
      final controllers = [
        for (final api in clients)
          AppController(api: api, allowOfflineDemo: false),
      ];
      addTearDown(() {
        for (final controller in controllers) {
          controller.dispose();
        }
      });
      for (var i = 0; i < clients.length; i++) {
        controllers[i].context = await clients[i].getContext();
      }
      final starterId = controllers.first.context!.activeHouseholdId;
      expect(controllers.first.needsCircleSetup, isTrue);
      expect(
        await controllers.first.updateCircle(
          circleId: starterId,
          name: '我的日常',
          kind: 'FRIENDS',
          expectedRevision: 0,
        ),
        isTrue,
      );
      expect(controllers.first.needsCircleSetup, isFalse);
      final creationKey = 'mobile-circle-${uids.first}';
      expect(
        await controllers.first.createCircle(
          name: '一起慢步',
          kind: 'COMMUNITY',
          idempotencyKey: creationKey,
        ),
        isTrue,
      );
      final ownerCircleId = controllers.first.context!.activeHouseholdId;
      expect(ownerCircleId, isNot(starterId));
      expect(
        await controllers.first.createCircle(
          name: '一起慢步',
          kind: 'COMMUNITY',
          idempotencyKey: creationKey,
        ),
        isTrue,
      );
      expect(controllers.first.context!.activeHouseholdId, ownerCircleId);
      expect(controllers.first.context!.households.length, 2);
      expect(
        await controllers.first.updateCircle(
          circleId: ownerCircleId,
          name: '河岸同行',
          kind: 'COMMUNITY',
          expectedRevision: 0,
        ),
        isTrue,
      );
      final ownCircleId = controllers[1].context!.activeHouseholdId;
      for (var i = 1; i < clients.length; i++) {
        final invite = await controllers.first.createHouseholdInvite();
        expect(invite, isNotNull, reason: controllers.first.membershipError);
        expect(
          await controllers[i].joinHousehold(invite!.code.toLowerCase(), '志工'),
          isTrue,
          reason: controllers[i].membershipError,
        );
        expect(controllers[i].context!.activeHouseholdId, ownerCircleId);
        expect(controllers[i].context!.households.length, 2);
        expect(controllers[i].context!.activeHousehold.name, '河岸同行');
        expect(
          controllers[i].context!.activeHousehold.canManageCircle,
          isFalse,
        );
      }
      expect(
        await controllers[1].updateCircle(
          circleId: ownerCircleId,
          name: '不能竄改',
          kind: 'FAMILY',
          expectedRevision: 1,
        ),
        isFalse,
      );
      expect(controllers[1].membershipError, contains('管理者'));
      expect((await clients.first.getContext()).activeHousehold.name, '河岸同行');
      expect(await controllers[1].switchHousehold(ownCircleId), isTrue);
      expect(controllers[1].context!.activeHouseholdId, ownCircleId);
      expect(await controllers[1].switchHousehold(ownerCircleId), isTrue);

      final before = await clients.first.getTree();
      final initialOverview = await clients.first.getCircleOverview();
      final initialShelf = await clients.first.getJourneyShelf();
      final selfCheckJourney = initialShelf.choices.singleWhere(
        (item) => item.title == '把好意傳下去',
      );
      final firstOverview = await clients.first.startJourney(
        circleId: ownerCircleId,
        actionId: selfCheckJourney.actionId,
        previousRunId: initialOverview.activeAction!.runId!,
      );
      expect(firstOverview.memberCount, 3);
      final action = firstOverview.activeAction!;
      expect(action.totalChapterCount, 3);
      expect(action.completedChapterCount, 0);
      expect(
        action.chapters.every(
          (chapter) => chapter.verificationMode == VerificationMode.selfCheck,
        ),
        isTrue,
      );
      for (var i = 0; i < clients.length; i++) {
        controllers[i].circle = await clients[i].getCircleOverview();
        final chapter = controllers[i].circle.activeAction!.nextChapter!;
        await controllers[i].claimCooperativeActionChapter(
          chapter,
          useAlternative: false,
        );
        expect(
          controllers[i].circle.activeAction!.nextChapter!.claim?.memberId,
          controllers[i].circle.currentMemberId,
          reason: controllers[i].notice,
        );
        await controllers[i].completeCooperativeActionChapter(chapter);
        final reloaded = await clients.first.getCircleOverview();
        expect(
          reloaded.activeAction!.completedChapterCount,
          i + 1,
          reason: controllers[i].notice,
        );
      }
      final completed = (await clients.first.getCircleOverview()).activeAction!;
      expect(completed.completed, isTrue);
      expect(completed.contributorCount, 3);
      expect(
        (await clients.first.getTree()).growthPoints - before.growthPoints,
        action.growthPoints,
      );
      // The same mobile idempotency key must not issue a second group reward.
      await clients.last.completeCooperativeActionChapter(
        runId: action.runId!,
        chapterId: action.chapters.last.id,
      );
      expect(
        (await clients.first.getTree()).growthPoints - before.growthPoints,
        action.growthPoints,
      );
      stdout.writeln('CIRCLE_ACCEPTANCE_PASSED:3-members-3-chapters-1-reward');
      await controllers.first.loadJourneyShelf();
      final firstShelf = controllers.first.journeyShelf!;
      expect(firstShelf.results.single.runId, action.runId);
      expect(firstShelf.results.single.growthPoints, action.growthPoints);
      final next = firstShelf.choices.singleWhere(
        (item) => item.title == '聽見彼此的日常',
      );
      expect(
        await controllers.first.startJourney(next),
        isTrue,
        reason: controllers.first.journeyError,
      );
      final nextRun = controllers.first.circle.activeAction!;
      expect(nextRun.runId, isNot(action.runId));
      expect(nextRun.totalChapterCount, 2);
      // Reusing the same predecessor cannot create another journey.
      expect(
        (await clients.first.startJourney(
          circleId: ownerCircleId,
          actionId: next.actionId,
          previousRunId: action.runId!,
        )).activeAction!.runId,
        nextRun.runId,
      );
      for (var i = 0; i < 2; i++) {
        controllers[i].circle = await clients[i].getCircleOverview();
        final chapter = controllers[i].circle.activeAction!.nextChapter!;
        await controllers[i].claimCooperativeActionChapter(
          chapter,
          useAlternative: false,
        );
        await controllers[i].completeCooperativeActionChapter(chapter);
      }
      final history = await clients.last.getJourneyShelf();
      expect(history.completedCount, 2);
      expect(history.results.map((item) => item.runId).toSet(), {
        action.runId,
        nextRun.runId,
      });
      expect(
        (await clients.first.getTree()).growthPoints - before.growthPoints,
        action.growthPoints + next.growthPoints,
      );
      stdout.writeln('JOURNEY_CONTINUATION_PASSED:2-journeys-2-receipts');
    },
    skip: url == null
        ? 'Run through the isolated circle acceptance suite.'
        : false,
  );
}
