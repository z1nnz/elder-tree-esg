enum VerificationMode {
  photoAi,
  selfCheck,
  timer,
  stepCount,
  locationCheckIn,
  deviceConfirm,
}

enum TaskStatus { available, inProgress, verifying, completed, rejected }

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
  });

  final String displayName;
  final String activeHouseholdId;
  final List<HouseholdSummaryModel> households;

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
    required this.title,
    required this.description,
    required this.triggerType,
    required this.latitude,
    required this.longitude,
    required this.radiusMeters,
    required this.unlockDistanceMeters,
    required this.unlocked,
  });

  final String id;
  final String taskId;
  final String title;
  final String description;
  final String triggerType;
  final double? latitude;
  final double? longitude;
  final int? radiusMeters;
  final int? unlockDistanceMeters;
  final bool unlocked;

  factory ExplorationQuestModel.fromJson(Map<String, dynamic> json) =>
      ExplorationQuestModel(
        id: json['id'] as String,
        taskId: json['taskId'] as String,
        title: json['title'] as String,
        description: json['description'] as String,
        triggerType: json['triggerType'] as String,
        latitude: (json['latitude'] as num?)?.toDouble(),
        longitude: (json['longitude'] as num?)?.toDouble(),
        radiusMeters: json['radiusMeters'] as int?,
        unlockDistanceMeters: json['unlockDistanceMeters'] as int?,
        unlocked: json['unlocked'] as bool,
      );
}

class ExplorationStateModel {
  const ExplorationStateModel({
    required this.totalDistanceMeters,
    required this.coarseCell,
    required this.quests,
  });

  final int totalDistanceMeters;
  final String? coarseCell;
  final List<ExplorationQuestModel> quests;

  factory ExplorationStateModel.fromJson(Map<String, dynamic> json) =>
      ExplorationStateModel(
        totalDistanceMeters: json['totalDistanceMeters'] as int,
        coarseCell: json['coarseCell'] as String?,
        quests: (json['quests'] as List)
            .cast<Map<String, dynamic>>()
            .map(ExplorationQuestModel.fromJson)
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
