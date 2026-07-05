import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';

class ApiClient {
  ApiClient({
    http.Client? client,
    String? baseUrl,
  })  : _client = client ?? http.Client(),
        baseUrl = baseUrl ??
            const String.fromEnvironment(
              'API_URL',
              defaultValue: 'http://localhost:4100/api/v1',
            );

  final http.Client _client;
  final String baseUrl;

  Map<String, String> get _headers => const {
        'content-type': 'application/json',
        'x-demo-user': 'demo-elder',
        'x-demo-role': 'PARTICIPANT',
      };

  Future<List<DailyTask>> getTasks() async {
    final data = await _getList('/tasks');
    return data.map(DailyTask.fromJson).toList();
  }

  Future<TreeSummary> getTree() async {
    final data = await _getMap('/tree');
    return TreeSummary.fromJson(data);
  }

  Future<List<FamilyMessageModel>> getMessages() async {
    final data = await _getList('/family/messages');
    return data.map(FamilyMessageModel.fromJson).toList();
  }

  Future<List<CompanionDevice>> getDevices() async {
    final data = await _getList('/devices');
    return data.map(CompanionDevice.fromJson).toList();
  }

  Future<void> completeTask(String taskId) async {
    await _post('/tasks/$taskId/complete', {
      'idempotencyKey': 'mobile-$taskId-${DateTime.now().day}',
    });
  }

  Future<void> submitPhotoEvidence(String taskId, String fileName) async {
    final initialized = await _post('/evidence', {
      'assignmentId': taskId,
      'fileName': fileName,
      'contentType': 'image/jpeg',
    });
    await _post('/evidence/${initialized['id']}/complete', {
      'sha256': 'demo-${DateTime.now().microsecondsSinceEpoch}',
    });
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
        .get(Uri.parse('$baseUrl$path'), headers: _headers)
        .timeout(const Duration(seconds: 5));
    return _decode(response) as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> _getList(String path) async {
    final response = await _client
        .get(Uri.parse('$baseUrl$path'), headers: _headers)
        .timeout(const Duration(seconds: 5));
    return (_decode(response) as List)
        .cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body,
  ) async {
    final response = await _client
        .post(
          Uri.parse('$baseUrl$path'),
          headers: _headers,
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 8));
    return _decode(response) as Map<String, dynamic>;
  }

  dynamic _decode(http.Response response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException('伺服器回應 ${response.statusCode}');
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
