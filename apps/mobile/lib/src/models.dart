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
    this.dueAt,
  });

  final String id;
  final String title;
  final String description;
  final VerificationMode verificationMode;
  final int growthPoints;
  final TaskStatus status;
  final DateTime? dueAt;

  DailyTask copyWith({TaskStatus? status}) => DailyTask(
    id: id,
    title: title,
    description: description,
    verificationMode: verificationMode,
    growthPoints: growthPoints,
    status: status ?? this.status,
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
    dueAt: json['dueAt'] == null
        ? null
        : DateTime.parse(json['dueAt'] as String),
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
