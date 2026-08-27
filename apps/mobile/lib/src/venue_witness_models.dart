/// Short-lived credentials stay in memory; never add them to persisted app state.
bool isVenueArrivalCode(String code) =>
    RegExp(r'^TCA1_[A-Za-z0-9_-]{43}$').hasMatch(code);

class VenueWitnessSubmission {
  const VenueWitnessSubmission({
    required this.code,
    required this.latitude,
    required this.longitude,
    required this.accuracyMeters,
    required this.occurredAt,
  });

  final String code;
  final double latitude;
  final double longitude;
  final double accuracyMeters;
  final DateTime occurredAt;

  bool isValidAt(DateTime now) =>
      isVenueArrivalCode(code) &&
      latitude.isFinite &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude.isFinite &&
      longitude >= -180 &&
      longitude <= 180 &&
      accuracyMeters.isFinite &&
      accuracyMeters >= 0 &&
      accuracyMeters <= 50 &&
      now.difference(occurredAt) <= const Duration(seconds: 30) &&
      occurredAt.difference(now) <= const Duration(seconds: 5);

  Map<String, Object> toJson() => {
    'code': code,
    'latitude': latitude,
    'longitude': longitude,
    'accuracyMeters': accuracyMeters,
    'occurredAt': occurredAt.toUtc().toIso8601String(),
  };
}

class VenueReceipt {
  const VenueReceipt({
    required this.id,
    required this.campaignId,
    required this.witnessedAt,
    required this.redeemedAt,
    required this.offer,
  });
  final String id;
  final String campaignId;
  final DateTime witnessedAt;
  final DateTime? redeemedAt;
  final String? offer;

  factory VenueReceipt.fromJson(Map<String, dynamic> json) => VenueReceipt(
    id: json['id'] as String,
    campaignId: json['campaignId'] as String,
    witnessedAt: DateTime.parse(json['witnessedAt'] as String),
    redeemedAt: json['redeemedAt'] == null
        ? null
        : DateTime.parse(json['redeemedAt'] as String),
    offer: json['offer'] as String?,
  );
}

class VenueRedemptionCode {
  const VenueRedemptionCode({
    required this.code,
    required this.serverTime,
    required this.expiresAt,
  });
  final String code;
  final DateTime serverTime;
  final DateTime expiresAt;

  Duration get lifetime {
    if (!RegExp(r'^TCR1_[A-Za-z0-9_-]{43}$').hasMatch(code)) {
      return Duration.zero;
    }
    final milliseconds = expiresAt.difference(serverTime).inMilliseconds;
    return Duration(milliseconds: milliseconds.clamp(0, 300000));
  }

  factory VenueRedemptionCode.fromJson(Map<String, dynamic> json) =>
      VenueRedemptionCode(
        code: json['code'] as String,
        serverTime: DateTime.parse(json['serverTime'] as String),
        expiresAt: DateTime.parse(json['expiresAt'] as String),
      );
}
