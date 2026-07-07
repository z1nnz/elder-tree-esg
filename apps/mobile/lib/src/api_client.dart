import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';

typedef TokenProvider = Future<String?> Function();

class ApiClient {
  ApiClient({
    http.Client? client,
    String? baseUrl,
    TokenProvider? tokenProvider,
  }) : _client = client ?? http.Client(),
       _tokenProvider = tokenProvider,
       baseUrl =
           baseUrl ??
           const String.fromEnvironment(
             'API_URL',
             defaultValue: 'http://localhost:4100/api/v1',
           );

  final http.Client _client;
  final TokenProvider? _tokenProvider;
  final String baseUrl;

  Future<Map<String, String>> get _headers async {
    final token = await _tokenProvider?.call();
    return {
      'content-type': 'application/json',
      if (token != null && token.isNotEmpty) 'authorization': 'Bearer $token',
      if (token == null || token.isEmpty) ...const {
        'x-demo-user': 'demo-elder',
        'x-demo-role': 'PARTICIPANT',
      },
    };
  }

  Future<List<DailyTask>> getTasks() async {
    final data = await _getList('/tasks');
    return data.map(DailyTask.fromJson).toList();
  }

  Future<AppContextModel> getContext() async {
    return AppContextModel.fromJson(await _getMap('/me/context'));
  }

  Future<AppContextModel> updateDisplayName(String displayName) async {
    return AppContextModel.fromJson(
      await _patch('/me/profile', {'displayName': displayName}),
    );
  }

  Future<AppContextModel> setActiveHousehold(String householdId) async {
    return AppContextModel.fromJson(
      await _post('/me/active-household', {'householdId': householdId}),
    );
  }

  Future<HouseholdInviteModel> createHouseholdInvite() async {
    return HouseholdInviteModel.fromJson(
      await _post('/households/invites', const {}),
    );
  }

  Future<AppContextModel> joinHousehold(
    String code,
    String relationship,
  ) async {
    return AppContextModel.fromJson(
      await _post('/households/join', {
        'code': code,
        'relationship': relationship,
      }),
    );
  }

  Future<TreeSummary> getTree() async {
    final data = await _getMap('/tree');
    return TreeSummary.fromJson(data);
  }

  Future<List<FamilyMessageModel>> getMessages() async {
    final data = await _getList('/family/messages');
    return data.map(FamilyMessageModel.fromJson).toList();
  }

  Future<List<FamilyReviewModel>> getFamilyReviews() async {
    final data = await _getList('/family/reviews');
    return data.map(FamilyReviewModel.fromJson).toList();
  }

  Future<ImpactSummaryModel> getImpactSummary() async {
    return ImpactSummaryModel.fromJson(
      await _getMap('/impact-batches/summary/current'),
    );
  }

  Future<ExplorationStateModel> getExplorationState() async {
    return ExplorationStateModel.fromJson(await _getMap('/exploration/state'));
  }

  Future<List<CompanionDevice>> getDevices() async {
    final data = await _getList('/devices');
    return data.map(CompanionDevice.fromJson).toList();
  }

  Future<DailyTask> completeTask(String taskId) async {
    final data = await _post('/tasks/$taskId/complete', {
      'idempotencyKey': 'mobile-assignment-$taskId',
    });
    return DailyTask.fromJson(data);
  }

  Future<DailyTask> completeGeminiPhotoTask({
    required String taskId,
    required String imageBase64,
    required String contentType,
    required String idempotencyKey,
  }) async {
    final data = await _post('/tasks/$taskId/photo-verification', {
      'imageBase64': imageBase64,
      'contentType': contentType,
      'idempotencyKey': idempotencyKey,
    });
    return DailyTask.fromJson(data);
  }

  Future<DailyTask> startTask(String taskId) async {
    return DailyTask.fromJson(await _post('/tasks/$taskId/start', const {}));
  }

  Future<EvidenceUploadModel> initializePhotoEvidence(
    String taskId,
    String fileName,
  ) async {
    return EvidenceUploadModel.fromJson(
      await _post('/evidence', {
        'assignmentId': taskId,
        'fileName': fileName,
        'contentType': 'image/jpeg',
      }),
    );
  }

  Future<void> completePhotoEvidence(String evidenceId, String sha256) async {
    await _post('/evidence/$evidenceId/complete', {'sha256': sha256});
  }

  Future<void> decideFamilyReview(String reviewId, String decision) async {
    await _post('/family/reviews/$reviewId/decision', {
      'decision': decision,
      'note': 'Reviewed in the family app',
    });
  }

  Future<ExplorationSessionModel> startExplorationSession(
    String routeId,
  ) async {
    return ExplorationSessionModel.fromJson(
      await _post('/exploration/sessions', {'routeId': routeId}),
    );
  }

  Future<ExplorationStateModel> recordExplorationEvent({
    required String sessionId,
    required String eventKey,
    required double latitude,
    required double longitude,
    required double accuracyMeters,
    required DateTime occurredAt,
  }) async {
    return ExplorationStateModel.fromJson(
      await _post('/exploration/sessions/$sessionId/events', {
        'eventKey': eventKey,
        'latitude': latitude,
        'longitude': longitude,
        'accuracyMeters': accuracyMeters,
        'occurredAt': occurredAt.toUtc().toIso8601String(),
      }),
    );
  }

  Future<ExplorationStateModel> endExplorationSession(String sessionId) async {
    return ExplorationStateModel.fromJson(
      await _post('/exploration/sessions/$sessionId/end', const {}),
    );
  }

  Future<FamilyMessageModel> sendMessage(String body) async {
    final data = await _post('/family/messages', {'body': body});
    return FamilyMessageModel.fromJson(data);
  }

  Future<CompanionDevice> claimDevice(
    String serialNumber,
    String claimCode,
  ) async {
    final data = await _post('/devices/claim', {
      'serialNumber': serialNumber,
      'claimCode': claimCode,
    });
    return CompanionDevice.fromJson(data);
  }

  Future<Map<String, dynamic>> _getMap(String path) async {
    final response = await _client
        .get(Uri.parse('$baseUrl$path'), headers: await _headers)
        .timeout(const Duration(seconds: 5));
    return _decode(response) as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> _getList(String path) async {
    final response = await _client
        .get(Uri.parse('$baseUrl$path'), headers: await _headers)
        .timeout(const Duration(seconds: 5));
    return (_decode(response) as List).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body,
  ) async {
    final response = await _client
        .post(
          Uri.parse('$baseUrl$path'),
          headers: await _headers,
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 8));
    return _decode(response) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> _patch(
    String path,
    Map<String, dynamic> body,
  ) async {
    final response = await _client
        .patch(
          Uri.parse('$baseUrl$path'),
          headers: await _headers,
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 8));
    return _decode(response) as Map<String, dynamic>;
  }

  dynamic _decode(http.Response response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      try {
        final decoded = jsonDecode(response.body) as Map<String, dynamic>;
        final message = decoded['message'];
        throw ApiException(
          message is List ? message.join('、') : message?.toString() ?? '伺服器錯誤',
        );
      } on FormatException {
        throw ApiException('伺服器回應 ${response.statusCode}');
      }
    }
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return decoded['data'];
  }

  void dispose() => _client.close();
}

class ApiException implements Exception {
  const ApiException(this.message);
  final String message;

  @override
  String toString() => message;
}
