import 'package:flutter/foundation.dart';
import 'package:health/health.dart';
import 'package:permission_handler/permission_handler.dart';

enum JourneyStepAccessState {
  notNeeded,
  notRequested,
  requesting,
  ready,
  denied,
  unavailable,
  readError,
}

class JourneyStepReading {
  const JourneyStepReading({required this.total, required this.source});

  final int total;
  final String source;
}

abstract interface class JourneyStepSource {
  Future<JourneyStepAccessState> requestReadAccess();

  Future<JourneyStepReading?> readTotal({
    required DateTime startedAt,
    required DateTime endedAt,
  });
}

class HealthJourneyStepSource implements JourneyStepSource {
  HealthJourneyStepSource({Health? health}) : _health = health ?? Health();

  final Health _health;

  bool get _isSupportedPlatform =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);

  String? get _source => switch (defaultTargetPlatform) {
    TargetPlatform.iOS => 'APPLE_HEALTH',
    TargetPlatform.android => 'HEALTH_CONNECT',
    _ => null,
  };

  @override
  Future<JourneyStepAccessState> requestReadAccess() async {
    if (!_isSupportedPlatform) return JourneyStepAccessState.unavailable;
    if (defaultTargetPlatform == TargetPlatform.android) {
      final activityAccess = await Permission.activityRecognition.request();
      if (!activityAccess.isGranted) return JourneyStepAccessState.denied;
    }
    await _health.configure();
    final accepted = await _health.requestAuthorization(
      const [HealthDataType.STEPS],
      permissions: const [HealthDataAccess.READ],
    );
    return accepted
        ? JourneyStepAccessState.ready
        : JourneyStepAccessState.denied;
  }

  @override
  Future<JourneyStepReading?> readTotal({
    required DateTime startedAt,
    required DateTime endedAt,
  }) async {
    final source = _source;
    if (!_isSupportedPlatform ||
        source == null ||
        endedAt.isBefore(startedAt)) {
      return null;
    }
    final total = await _health.getTotalStepsInInterval(
      startedAt,
      endedAt,
      includeManualEntry: false,
    );
    return total == null
        ? null
        : JourneyStepReading(total: total, source: source);
  }
}
