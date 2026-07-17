enum VerificationMode {
  photoAi,
  selfCheck,
  timer,
  stepCount,
  locationCheckIn,
  deviceConfirm,
}

enum TaskStatus { available, inProgress, verifying, completed, rejected }

enum EvidenceDecision { pass, review, fail }

class DailyTask {
  const DailyTask({
    required this.id,
    required this.title,
    required this.description,
    required this.verificationMode,
    required this.growthPoints,
    required this.status,
    this.startedAt,
    this.minimumSeconds,
    this.dueAt,
    this.capabilityEnabled = true,
    this.capabilityReason,
  });

  final String id;
  final String title;
  final String description;
  final VerificationMode verificationMode;
  final int growthPoints;
  final TaskStatus status;
  final DateTime? startedAt;
  final int? minimumSeconds;
  final DateTime? dueAt;
  final bool capabilityEnabled;
  final String? capabilityReason;

  DailyTask copyWith({TaskStatus? status, DateTime? startedAt}) => DailyTask(
    id: id,
    title: title,
    description: description,
    verificationMode: verificationMode,
    growthPoints: growthPoints,
    status: status ?? this.status,
    startedAt: startedAt ?? this.startedAt,
    minimumSeconds: minimumSeconds,
    dueAt: dueAt,
    capabilityEnabled: capabilityEnabled,
    capabilityReason: capabilityReason,
  );

  factory DailyTask.fromJson(Map<String, dynamic> json) => DailyTask(
    id: json['id'] as String,
    title: json['title'] as String,
    description: json['description'] as String,
    verificationMode: switch (json['verificationMode']) {
      'PHOTO_AI' => VerificationMode.photoAi,
      'SELF_CHECK' => VerificationMode.selfCheck,
      'TIMER' => VerificationMode.timer,
      'STEP_COUNT' => VerificationMode.stepCount,
      'LOCATION_CHECK_IN' => VerificationMode.locationCheckIn,
      _ => VerificationMode.deviceConfirm,
    },
    growthPoints: json['growthPoints'] as int,
    status: switch (json['status']) {
      'IN_PROGRESS' => TaskStatus.inProgress,
      'VERIFYING' => TaskStatus.verifying,
      'COMPLETED' => TaskStatus.completed,
      'REJECTED' => TaskStatus.rejected,
      _ => TaskStatus.available,
    },
    startedAt: json['startedAt'] == null
        ? null
        : DateTime.parse(json['startedAt'] as String),
    minimumSeconds: json['minimumSeconds'] as int?,
    dueAt: json['dueAt'] == null
        ? null
        : DateTime.parse(json['dueAt'] as String),
    capabilityEnabled:
        (json['capability'] as Map<String, dynamic>?)?['enabled'] as bool? ??
        true,
    capabilityReason:
        (json['capability'] as Map<String, dynamic>?)?['reason'] as String?,
  );
}

class HouseholdSummaryModel {
  const HouseholdSummaryModel({
    required this.id,
    required this.name,
    required this.relationship,
  });

  final String id;
  final String name;
  final String relationship;

  factory HouseholdSummaryModel.fromJson(Map<String, dynamic> json) =>
      HouseholdSummaryModel(
        id: json['id'] as String,
        name: json['name'] as String,
        relationship: json['relationship'] as String,
      );
}

class AppContextModel {
  const AppContextModel({
    required this.displayName,
    required this.activeHouseholdId,
    required this.households,
    this.photoEvidenceEnabled = false,
    this.photoEvidenceReason,
    this.geminiPhotoVerificationEnabled = false,
    this.geminiPhotoVerificationReason,
  });

  final String displayName;
  final String activeHouseholdId;
  final List<HouseholdSummaryModel> households;
  final bool photoEvidenceEnabled;
  final String? photoEvidenceReason;
  final bool geminiPhotoVerificationEnabled;
  final String? geminiPhotoVerificationReason;

  HouseholdSummaryModel get activeHousehold =>
      households.firstWhere((household) => household.id == activeHouseholdId);

  factory AppContextModel.fromJson(Map<String, dynamic> json) =>
      AppContextModel(
        displayName: json['displayName'] as String,
        activeHouseholdId: json['activeHouseholdId'] as String,
        households: (json['households'] as List)
            .cast<Map<String, dynamic>>()
            .map(HouseholdSummaryModel.fromJson)
            .toList(),
        photoEvidenceEnabled:
            ((json['capabilities'] as Map<String, dynamic>?)?['photoEvidence']
                    as Map<String, dynamic>?)?['enabled']
                as bool? ??
            false,
        photoEvidenceReason:
            ((json['capabilities'] as Map<String, dynamic>?)?['photoEvidence']
                    as Map<String, dynamic>?)?['reason']
                as String?,
        geminiPhotoVerificationEnabled:
            ((json['capabilities']
                        as Map<String, dynamic>?)?['geminiPhotoVerification']
                    as Map<String, dynamic>?)?['enabled']
                as bool? ??
            false,
        geminiPhotoVerificationReason:
            ((json['capabilities']
                        as Map<String, dynamic>?)?['geminiPhotoVerification']
                    as Map<String, dynamic>?)?['reason']
                as String?,
      );
}

enum HomeNextActionKind {
  completeTask,
  startTimer,
  takePhoto,
  reviewPhoto,
  startExploration,
  readMessage,
  rest,
}

enum CompanionSpriteMood { ready, walking, growing, waiting, resting }

class HomeNextActionModel {
  const HomeNextActionModel({
    required this.kind,
    required this.title,
    required this.description,
    required this.ctaLabel,
    this.taskId,
    this.radarMissionId,
  });

  final HomeNextActionKind kind;
  final String title;
  final String description;
  final String ctaLabel;
  final String? taskId;
  final String? radarMissionId;

  factory HomeNextActionModel.fromJson(Map<String, dynamic> json) =>
      HomeNextActionModel(
        kind: switch (json['kind']) {
          'START_TIMER' => HomeNextActionKind.startTimer,
          'TAKE_PHOTO' => HomeNextActionKind.takePhoto,
          'REVIEW_PHOTO' => HomeNextActionKind.reviewPhoto,
          'START_EXPLORATION' => HomeNextActionKind.startExploration,
          'READ_MESSAGE' => HomeNextActionKind.readMessage,
          'REST' => HomeNextActionKind.rest,
          _ => HomeNextActionKind.completeTask,
        },
        title: json['title'] as String,
        description: json['description'] as String,
        ctaLabel: json['ctaLabel'] as String,
        taskId: json['taskId'] as String?,
        radarMissionId: json['radarMissionId'] as String?,
      );
}

class HomeTaskCardModel {
  const HomeTaskCardModel({
    required this.task,
    required this.stateLabel,
    required this.actionLabel,
  });

  final DailyTask task;
  final String stateLabel;
  final String actionLabel;

  factory HomeTaskCardModel.fromJson(Map<String, dynamic> json) =>
      HomeTaskCardModel(
        task: DailyTask.fromJson(json),
        stateLabel: json['stateLabel'] as String,
        actionLabel: json['actionLabel'] as String,
      );
}

class HomeAlertModel {
  const HomeAlertModel({
    required this.id,
    required this.kind,
    required this.title,
    required this.description,
    required this.count,
  });

  final String id;
  final String kind;
  final String title;
  final String description;
  final int count;

  factory HomeAlertModel.fromJson(Map<String, dynamic> json) => HomeAlertModel(
    id: json['id'] as String,
    kind: json['kind'] as String,
    title: json['title'] as String,
    description: json['description'] as String,
    count: json['count'] as int,
  );
}

class CompanionSpriteStateModel {
  const CompanionSpriteStateModel({
    required this.mood,
    required this.label,
    required this.energyPoints,
  });

  final CompanionSpriteMood mood;
  final String label;
  final int energyPoints;

  factory CompanionSpriteStateModel.fromJson(Map<String, dynamic> json) =>
      CompanionSpriteStateModel(
        mood: switch (json['mood']) {
          'WALKING' => CompanionSpriteMood.walking,
          'GROWING' => CompanionSpriteMood.growing,
          'WAITING' => CompanionSpriteMood.waiting,
          'RESTING' => CompanionSpriteMood.resting,
          _ => CompanionSpriteMood.ready,
        },
        label: json['label'] as String,
        energyPoints: json['energyPoints'] as int,
      );
}

class HomeCapabilitiesModel {
  const HomeCapabilitiesModel({
    required this.photoEvidenceEnabled,
    this.photoEvidenceReason,
    required this.geminiPhotoVerificationEnabled,
    this.geminiPhotoVerificationReason,
  });

  final bool photoEvidenceEnabled;
  final String? photoEvidenceReason;
  final bool geminiPhotoVerificationEnabled;
  final String? geminiPhotoVerificationReason;

  factory HomeCapabilitiesModel.fromJson(Map<String, dynamic> json) {
    final photoEvidence = json['photoEvidence'] as Map<String, dynamic>?;
    final geminiPhotoVerification =
        json['geminiPhotoVerification'] as Map<String, dynamic>?;
    return HomeCapabilitiesModel(
      photoEvidenceEnabled: photoEvidence?['enabled'] as bool? ?? false,
      photoEvidenceReason: photoEvidence?['reason'] as String?,
      geminiPhotoVerificationEnabled:
          geminiPhotoVerification?['enabled'] as bool? ?? false,
      geminiPhotoVerificationReason:
          geminiPhotoVerification?['reason'] as String?,
    );
  }
}

class HomeSummaryModel {
  const HomeSummaryModel({
    required this.generatedAt,
    required this.displayName,
    required this.activeHouseholdName,
    required this.tree,
    required this.nextAction,
    required this.taskCards,
    required this.pendingReviewCount,
    required this.messageCount,
    required this.capabilities,
    required this.companionSprite,
    required this.alerts,
    this.featuredRadarMission,
    this.latestMessage,
  });

  final DateTime generatedAt;
  final String displayName;
  final String activeHouseholdName;
  final TreeSummary tree;
  final HomeNextActionModel nextAction;
  final List<HomeTaskCardModel> taskCards;
  final RadarMissionModel? featuredRadarMission;
  final int pendingReviewCount;
  final int messageCount;
  final FamilyMessageModel? latestMessage;
  final HomeCapabilitiesModel capabilities;
  final CompanionSpriteStateModel companionSprite;
  final List<HomeAlertModel> alerts;

  factory HomeSummaryModel.fromJson(Map<String, dynamic> json) =>
      HomeSummaryModel(
        generatedAt: DateTime.parse(json['generatedAt'] as String),
        displayName: json['displayName'] as String,
        activeHouseholdName: json['activeHouseholdName'] as String,
        tree: TreeSummary.fromJson(json['tree'] as Map<String, dynamic>),
        nextAction: HomeNextActionModel.fromJson(
          json['nextAction'] as Map<String, dynamic>,
        ),
        taskCards: (json['taskCards'] as List)
            .cast<Map<String, dynamic>>()
            .map(HomeTaskCardModel.fromJson)
            .toList(),
        featuredRadarMission: json['featuredRadarMission'] == null
            ? null
            : RadarMissionModel.fromJson(
                json['featuredRadarMission'] as Map<String, dynamic>,
              ),
        pendingReviewCount: json['pendingReviewCount'] as int,
        messageCount: json['messageCount'] as int,
        latestMessage: json['latestMessage'] == null
            ? null
            : FamilyMessageModel.fromJson(
                json['latestMessage'] as Map<String, dynamic>,
              ),
        capabilities: HomeCapabilitiesModel.fromJson(
          json['capabilities'] as Map<String, dynamic>,
        ),
        companionSprite: CompanionSpriteStateModel.fromJson(
          json['companionSprite'] as Map<String, dynamic>,
        ),
        alerts: (json['alerts'] as List)
            .cast<Map<String, dynamic>>()
            .map(HomeAlertModel.fromJson)
            .toList(),
      );
}

class RadarMissionModel {
  const RadarMissionModel({
    required this.id,
    required this.title,
    required this.description,
    required this.category,
    required this.tag,
    required this.latitude,
    required this.longitude,
    required this.radiusMeters,
    required this.startsAt,
    required this.endsAt,
    required this.remainingSeconds,
    required this.verificationMode,
    required this.minimumSeconds,
    required this.growthPoints,
    required this.badgeName,
    required this.publicationStatus,
    required this.status,
    required this.unlockedAt,
    required this.completedAt,
  });

  final String id;
  final String title;
  final String description;
  final String category;
  final String tag;
  final double latitude;
  final double longitude;
  final int radiusMeters;
  final DateTime startsAt;
  final DateTime endsAt;
  final int remainingSeconds;
  final VerificationMode verificationMode;
  final int? minimumSeconds;
  final int growthPoints;
  final String? badgeName;
  final String publicationStatus;
  final String status;
  final DateTime? unlockedAt;
  final DateTime? completedAt;

  bool get isUnlocked => status == 'UNLOCKED' || status == 'COMPLETED';
  bool get isCompleted => status == 'COMPLETED';
  bool get isLocked => status == 'LOCKED' || status == 'UPCOMING';
  bool get isExpired => status == 'EXPIRED';
  bool get isTimer => verificationMode == VerificationMode.timer;

  Duration get remainingDuration =>
      Duration(seconds: remainingSeconds < 0 ? 0 : remainingSeconds);

  Duration timerRemainingAt(DateTime now) {
    if (!isTimer ||
        minimumSeconds == null ||
        unlockedAt == null ||
        isCompleted) {
      return Duration.zero;
    }
    final elapsed = now.difference(unlockedAt!);
    final remaining = Duration(seconds: minimumSeconds!) - elapsed;
    return remaining.isNegative ? Duration.zero : remaining;
  }

  bool canCompleteAt(DateTime now) =>
      status == 'UNLOCKED' && timerRemainingAt(now) == Duration.zero;

  RadarMissionModel copyWith({
    String? status,
    DateTime? unlockedAt,
    DateTime? completedAt,
    int? remainingSeconds,
  }) => RadarMissionModel(
    id: id,
    title: title,
    description: description,
    category: category,
    tag: tag,
    latitude: latitude,
    longitude: longitude,
    radiusMeters: radiusMeters,
    startsAt: startsAt,
    endsAt: endsAt,
    remainingSeconds: remainingSeconds ?? this.remainingSeconds,
    verificationMode: verificationMode,
    minimumSeconds: minimumSeconds,
    growthPoints: growthPoints,
    badgeName: badgeName,
    publicationStatus: publicationStatus,
    status: status ?? this.status,
    unlockedAt: unlockedAt ?? this.unlockedAt,
    completedAt: completedAt ?? this.completedAt,
  );

  factory RadarMissionModel.fromJson(Map<String, dynamic> json) =>
      RadarMissionModel(
        id: json['id'] as String,
        title: json['title'] as String,
        description: json['description'] as String,
        category: json['category'] as String,
        tag: json['tag'] as String,
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        radiusMeters: json['radiusMeters'] as int,
        startsAt: DateTime.parse(json['startsAt'] as String),
        endsAt: DateTime.parse(json['endsAt'] as String),
        remainingSeconds: json['remainingSeconds'] as int,
        verificationMode: switch (json['verificationMode']) {
          'TIMER' => VerificationMode.timer,
          _ => VerificationMode.selfCheck,
        },
        minimumSeconds: json['minimumSeconds'] as int?,
        growthPoints: json['growthPoints'] as int,
        badgeName: json['badgeName'] as String?,
        publicationStatus: json['publicationStatus'] as String,
        status: json['status'] as String,
        unlockedAt: json['unlockedAt'] == null
            ? null
            : DateTime.parse(json['unlockedAt'] as String),
        completedAt: json['completedAt'] == null
            ? null
            : DateTime.parse(json['completedAt'] as String),
      );
}

class RadarStateModel {
  const RadarStateModel({required this.generatedAt, required this.missions});

  final DateTime generatedAt;
  final List<RadarMissionModel> missions;

  factory RadarStateModel.fromJson(Map<String, dynamic> json) =>
      RadarStateModel(
        generatedAt: DateTime.parse(json['generatedAt'] as String),
        missions: (json['missions'] as List)
            .cast<Map<String, dynamic>>()
            .map(RadarMissionModel.fromJson)
            .toList(),
      );
}

class HouseholdInviteModel {
  const HouseholdInviteModel({required this.code, required this.expiresAt});

  final String code;
  final DateTime expiresAt;

  factory HouseholdInviteModel.fromJson(Map<String, dynamic> json) =>
      HouseholdInviteModel(
        code: json['code'] as String,
        expiresAt: DateTime.parse(json['expiresAt'] as String),
      );
}

class LineBindingCodeModel {
  const LineBindingCodeModel({
    required this.code,
    required this.expiresAt,
    required this.qrPayload,
    required this.instructions,
  });

  final String code;
  final DateTime expiresAt;
  final String qrPayload;
  final String instructions;

  factory LineBindingCodeModel.fromJson(Map<String, dynamic> json) =>
      LineBindingCodeModel(
        code: json['code'] as String,
        expiresAt: DateTime.parse(json['expiresAt'] as String),
        qrPayload: json['qrPayload'] as String? ?? '',
        instructions: json['instructions'] as String,
      );
}

class LineBindingModel {
  const LineBindingModel({
    required this.id,
    required this.householdName,
    required this.status,
    required this.createdAt,
    this.revokedAt,
  });

  final String id;
  final String householdName;
  final String status;
  final DateTime createdAt;
  final DateTime? revokedAt;

  bool get active => status == 'ACTIVE';

  factory LineBindingModel.fromJson(Map<String, dynamic> json) =>
      LineBindingModel(
        id: json['id'] as String,
        householdName: json['householdName'] as String,
        status: json['status'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        revokedAt: json['revokedAt'] == null
            ? null
            : DateTime.parse(json['revokedAt'] as String),
      );
}

class EvidenceUploadModel {
  const EvidenceUploadModel({
    required this.id,
    required this.storagePath,
    required this.contentType,
  });

  final String id;
  final String storagePath;
  final String contentType;

  factory EvidenceUploadModel.fromJson(Map<String, dynamic> json) =>
      EvidenceUploadModel(
        id: json['id'] as String,
        storagePath: json['storagePath'] as String,
        contentType: json['contentType'] as String,
      );
}

class EvidenceDecisionModel {
  const EvidenceDecisionModel({
    required this.evidenceId,
    required this.decision,
    required this.status,
  });

  final String evidenceId;
  final EvidenceDecision decision;
  final TaskStatus status;

  factory EvidenceDecisionModel.fromJson(Map<String, dynamic> json) =>
      EvidenceDecisionModel(
        evidenceId: json['evidenceId'] as String,
        decision: switch (json['decision']) {
          'PASS' => EvidenceDecision.pass,
          'REVIEW' => EvidenceDecision.review,
          'FAIL' => EvidenceDecision.fail,
          final value => throw FormatException(
            'Unknown evidence decision: $value',
          ),
        },
        status: switch (json['status']) {
          'IN_PROGRESS' => TaskStatus.inProgress,
          'VERIFYING' => TaskStatus.verifying,
          'COMPLETED' => TaskStatus.completed,
          'REJECTED' => TaskStatus.rejected,
          _ => TaskStatus.available,
        },
      );
}

class FamilyReviewModel {
  const FamilyReviewModel({
    required this.id,
    required this.taskTitle,
    required this.participantName,
    required this.imageUrl,
    required this.confidence,
    required this.explanation,
  });

  final String id;
  final String taskTitle;
  final String participantName;
  final String imageUrl;
  final double confidence;
  final String explanation;

  factory FamilyReviewModel.fromJson(Map<String, dynamic> json) =>
      FamilyReviewModel(
        id: json['id'] as String,
        taskTitle: json['taskTitle'] as String,
        participantName: json['participantName'] as String,
        imageUrl: json['imageUrl'] as String,
        confidence: (json['confidence'] as num).toDouble(),
        explanation: json['explanation'] as String,
      );
}

class ImpactSummaryModel {
  const ImpactSummaryModel({
    required this.householdName,
    required this.treeStage,
    required this.growthPoints,
    required this.nextStageAt,
    required this.contributedPoints,
  });

  final String householdName;
  final String treeStage;
  final int growthPoints;
  final int? nextStageAt;
  final int contributedPoints;

  factory ImpactSummaryModel.fromJson(Map<String, dynamic> json) =>
      ImpactSummaryModel(
        householdName: json['householdName'] as String,
        treeStage: json['treeStage'] as String,
        growthPoints: json['growthPoints'] as int,
        nextStageAt: json['nextStageAt'] as int?,
        contributedPoints: json['contributedPoints'] as int,
      );
}

class ExplorationQuestModel {
  const ExplorationQuestModel({
    required this.id,
    required this.taskId,
    required this.sequence,
    required this.locationName,
    required this.category,
    required this.safetyNote,
    required this.accessibilityTags,
    required this.title,
    required this.description,
    required this.triggerType,
    required this.latitude,
    required this.longitude,
    required this.radiusMeters,
    required this.unlockDistanceMeters,
    required this.unlocked,
    required this.completed,
  });

  final String id;
  final String taskId;
  final int sequence;
  final String locationName;
  final String category;
  final String? safetyNote;
  final List<String> accessibilityTags;
  final String title;
  final String description;
  final String triggerType;
  final double? latitude;
  final double? longitude;
  final int? radiusMeters;
  final int? unlockDistanceMeters;
  final bool unlocked;
  final bool completed;

  factory ExplorationQuestModel.fromJson(Map<String, dynamic> json) =>
      ExplorationQuestModel(
        id: json['id'] as String,
        taskId: json['taskId'] as String,
        sequence: json['sequence'] as int,
        locationName: json['locationName'] as String,
        category: json['category'] as String,
        safetyNote: json['safetyNote'] as String?,
        accessibilityTags: (json['accessibilityTags'] as List).cast<String>(),
        title: json['title'] as String,
        description: json['description'] as String,
        triggerType: json['triggerType'] as String,
        latitude: (json['latitude'] as num?)?.toDouble(),
        longitude: (json['longitude'] as num?)?.toDouble(),
        radiusMeters: json['radiusMeters'] as int?,
        unlockDistanceMeters: json['unlockDistanceMeters'] as int?,
        unlocked: json['unlocked'] as bool,
        completed: json['completed'] as bool,
      );
}

class ExplorationSessionModel {
  const ExplorationSessionModel({
    required this.id,
    required this.routeId,
    required this.status,
    required this.distanceMeters,
    required this.startedAt,
    required this.lastEventAt,
  });

  final String id;
  final String routeId;
  final String status;
  final int distanceMeters;
  final DateTime startedAt;
  final DateTime? lastEventAt;

  factory ExplorationSessionModel.fromJson(Map<String, dynamic> json) =>
      ExplorationSessionModel(
        id: json['id'] as String,
        routeId: json['routeId'] as String,
        status: json['status'] as String,
        distanceMeters: json['distanceMeters'] as int,
        startedAt: DateTime.parse(json['startedAt'] as String),
        lastEventAt: json['lastEventAt'] == null
            ? null
            : DateTime.parse(json['lastEventAt'] as String),
      );
}

class ExplorationRouteModel {
  const ExplorationRouteModel({
    required this.id,
    required this.slug,
    required this.name,
    required this.description,
    required this.badgeName,
    required this.badgeAssetKey,
    required this.completedQuestCount,
    required this.totalQuestCount,
    required this.badgeAwarded,
    required this.quests,
  });

  final String id;
  final String slug;
  final String name;
  final String description;
  final String badgeName;
  final String badgeAssetKey;
  final int completedQuestCount;
  final int totalQuestCount;
  final bool badgeAwarded;
  final List<ExplorationQuestModel> quests;

  factory ExplorationRouteModel.fromJson(Map<String, dynamic> json) =>
      ExplorationRouteModel(
        id: json['id'] as String,
        slug: json['slug'] as String,
        name: json['name'] as String,
        description: json['description'] as String,
        badgeName: json['badgeName'] as String,
        badgeAssetKey: json['badgeAssetKey'] as String,
        completedQuestCount: json['completedQuestCount'] as int,
        totalQuestCount: json['totalQuestCount'] as int,
        badgeAwarded: json['badgeAwarded'] as bool,
        quests: (json['quests'] as List)
            .cast<Map<String, dynamic>>()
            .map(ExplorationQuestModel.fromJson)
            .toList(),
      );
}

class ExplorationStateModel {
  const ExplorationStateModel({
    required this.totalDistanceMeters,
    required this.coarseCell,
    required this.activeSession,
    required this.routes,
  });

  final int totalDistanceMeters;
  final String? coarseCell;
  final ExplorationSessionModel? activeSession;
  final List<ExplorationRouteModel> routes;

  List<ExplorationQuestModel> get quests =>
      routes.expand((route) => route.quests).toList();

  factory ExplorationStateModel.fromJson(Map<String, dynamic> json) =>
      ExplorationStateModel(
        totalDistanceMeters: json['totalDistanceMeters'] as int,
        coarseCell: json['coarseCell'] as String?,
        activeSession: json['activeSession'] == null
            ? null
            : ExplorationSessionModel.fromJson(
                json['activeSession'] as Map<String, dynamic>,
              ),
        routes: (json['routes'] as List)
            .cast<Map<String, dynamic>>()
            .map(ExplorationRouteModel.fromJson)
            .toList(),
      );
}

class TreeSummary {
  const TreeSummary({
    required this.name,
    required this.householdName,
    required this.stage,
    required this.growthPoints,
    this.nextStageAt,
  });

  final String name;
  final String householdName;
  final String stage;
  final int growthPoints;
  final int? nextStageAt;

  factory TreeSummary.fromJson(Map<String, dynamic> json) => TreeSummary(
    name: json['name'] as String,
    householdName: json['householdName'] as String,
    stage: json['stage'] as String,
    growthPoints: json['growthPoints'] as int,
    nextStageAt: json['nextStageAt'] as int?,
  );
}

class FamilyMessageModel {
  const FamilyMessageModel({
    required this.id,
    required this.authorName,
    required this.body,
    required this.createdAt,
    required this.delivered,
  });

  final String id;
  final String authorName;
  final String body;
  final DateTime createdAt;
  final bool delivered;

  factory FamilyMessageModel.fromJson(Map<String, dynamic> json) =>
      FamilyMessageModel(
        id: json['id'] as String,
        authorName: json['authorName'] as String,
        body: json['body'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        delivered: json['deliveredToDeviceAt'] != null,
      );
}

class CompanionPromptModel {
  const CompanionPromptModel({
    required this.id,
    required this.sourceType,
    required this.householdId,
    required this.participantName,
    required this.sourceTitle,
    required this.category,
    required this.tag,
    required this.growthPoints,
    required this.elderMessage,
    required this.companionReply,
    required this.volunteerNote,
    required this.shareSummary,
    required this.createdAt,
  });

  final String id;
  final String sourceType;
  final String householdId;
  final String participantName;
  final String sourceTitle;
  final String category;
  final String tag;
  final int growthPoints;
  final String elderMessage;
  final String companionReply;
  final String volunteerNote;
  final String shareSummary;
  final DateTime createdAt;

  factory CompanionPromptModel.fromJson(Map<String, dynamic> json) =>
      CompanionPromptModel(
        id: json['id'] as String,
        sourceType: json['sourceType'] as String,
        householdId: json['householdId'] as String,
        participantName: json['participantName'] as String? ?? '家庭成員',
        sourceTitle: json['sourceTitle'] as String,
        category: json['category'] as String,
        tag: json['tag'] as String,
        growthPoints: json['growthPoints'] as int,
        elderMessage: json['elderMessage'] as String,
        companionReply: json['companionReply'] as String,
        volunteerNote: json['volunteerNote'] as String,
        shareSummary: json['shareSummary'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

class CompanionDevice {
  const CompanionDevice({
    required this.id,
    required this.serialNumber,
    required this.name,
    required this.online,
    required this.firmwareVersion,
    required this.temperatureC,
    required this.humidityPercent,
    required this.ambientLux,
    required this.presence,
  });

  final String id;
  final String serialNumber;
  final String name;
  final bool online;
  final String firmwareVersion;
  final double? temperatureC;
  final double? humidityPercent;
  final double? ambientLux;
  final bool? presence;

  factory CompanionDevice.fromJson(Map<String, dynamic> json) {
    final reported = json['reportedState'] as Map<String, dynamic>;
    return CompanionDevice(
      id: json['id'] as String,
      serialNumber: json['serialNumber'] as String,
      name: json['name'] as String,
      online: reported['online'] as bool,
      firmwareVersion: reported['firmwareVersion'] as String,
      temperatureC: (reported['temperatureC'] as num?)?.toDouble(),
      humidityPercent: (reported['humidityPercent'] as num?)?.toDouble(),
      ambientLux: (reported['ambientLux'] as num?)?.toDouble(),
      presence: reported['presence'] as bool?,
    );
  }
}
