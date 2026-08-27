import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'app_controller.dart';
import 'models.dart';
import 'theme.dart';
import 'venue_witness_models.dart';

Future<VenueWitnessSubmission> captureVenuePosition(String code) async {
  if (!isVenueArrivalCode(code)) throw const FormatException('請重新掃描現場到場碼。');
  if (!await Geolocator.isLocationServiceEnabled()) {
    throw const FormatException('請開啟定位服務，再重新掃碼。');
  }
  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
  }
  if (permission == LocationPermission.denied ||
      permission == LocationPermission.deniedForever) {
    throw const FormatException('請到系統設定允許定位，再重新掃碼。');
  }
  // Do not call the map-preview helper: its development fallback is not proof.
  final position = await Geolocator.getCurrentPosition(
    locationSettings: const LocationSettings(
      accuracy: LocationAccuracy.high,
      timeLimit: Duration(seconds: 15),
    ),
  );
  if (position.isMocked) throw const FormatException('示範位置不能用來完成到場見證，請使用真實定位。');
  final proof = VenueWitnessSubmission(
    code: code,
    latitude: position.latitude,
    longitude: position.longitude,
    accuracyMeters: position.accuracy,
    occurredAt: position.timestamp,
  );
  if (!proof.isValidAt(DateTime.now())) {
    throw const FormatException('定位尚不準確或已過期。請移到開闊處，再重新掃碼。');
  }
  return proof;
}

class VenueWitnessScreen extends StatefulWidget {
  const VenueWitnessScreen({
    required this.controller,
    required this.mission,
    super.key,
  });
  final AppController controller;
  final RadarMissionModel mission;

  @override
  State<VenueWitnessScreen> createState() => _VenueWitnessScreenState();
}

class _VenueWitnessScreenState extends State<VenueWitnessScreen>
    with WidgetsBindingObserver {
  final _input = TextEditingController();
  final _clock = Stopwatch()..start();
  Timer? _timer;
  VenueReceipt? _receipt;
  VenueRedemptionCode? _redemption;
  Duration _deadline = Duration.zero;
  String? _error;
  String? _circleId;
  bool _busy = false;
  bool _scanning = false;
  bool _completed = false;
  bool _codeExpired = false;
  bool _contextChanged = false;
  int _sequence = 0;

  @override
  void initState() {
    super.initState();
    _circleId = widget.controller.context?.activeHouseholdId;
    _completed = widget.mission.isCompleted;
    WidgetsBinding.instance.addObserver(this);
    widget.controller.addListener(_contextUpdate);
    if (!widget.controller.offlineDemo) unawaited(_loadReceipt());
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_redemption != null) {
        setState(() {
          if (_clock.elapsed >= _deadline) {
            _redemption = null;
            _codeExpired = true;
          }
        });
      }
    });
  }

  void _contextUpdate() {
    if (widget.controller.context?.activeHouseholdId == _circleId ||
        _contextChanged) {
      return;
    }
    _sequence++;
    _input.clear();
    setState(() {
      _contextChanged = true;
      _redemption = null;
      _codeExpired = false;
      _receipt = null;
      _scanning = false;
      _busy = false;
      _error = '樹伴圈已切換。請返回旅程，重新開啟到場紀錄。';
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      if (!widget.controller.offlineDemo) unawaited(_loadReceipt());
      return;
    }
    // Permission sheets may briefly make the app inactive; don't remove a
    // scanner while its first permission prompt is pending.
    if (state == AppLifecycleState.inactive &&
        (_scanning || (_busy && !_completed))) {
      return;
    }
    _sequence++;
    _input.clear();
    setState(() {
      _redemption = null;
      _codeExpired = false;
      _scanning = false;
      _busy = false;
      _error = '畫面已收起。回到現場後，請重新掃碼或更新領取狀態。';
    });
  }

  bool _current(int sequence) =>
      mounted && !_contextChanged && sequence == _sequence;

  Future<void> _loadReceipt() async {
    if (_busy || _contextChanged) return;
    final sequence = ++_sequence;
    setState(() {
      _busy = true;
      _error = null;
      _redemption = null;
      _codeExpired = false;
    });
    try {
      final receipt = await widget.controller.getVenueReceipt(
        widget.mission.id,
      );
      if (!_current(sequence)) return;
      setState(() {
        _receipt = receipt;
        if (receipt != null) _completed = true;
        if (receipt == null && _completed) _error = '暫時找不到到場紀錄，請返回旅程重新整理。';
      });
    } catch (_) {
      if (_current(sequence)) setState(() => _error = '到場紀錄尚未讀取成功，請確認連線後重試。');
    } finally {
      if (_current(sequence)) setState(() => _busy = false);
    }
  }

  Future<void> _complete() async {
    if (_busy || _contextChanged || widget.controller.offlineDemo) return;
    final sequence = ++_sequence;
    final code = _input.text.trim();
    setState(() {
      _busy = true;
      _error = null;
      _scanning = false;
    });
    var completed = false;
    try {
      final proof = await captureVenuePosition(code);
      if (!_current(sequence)) return;
      if (Geolocator.distanceBetween(
            proof.latitude,
            proof.longitude,
            widget.mission.latitude,
            widget.mission.longitude,
          ) >
          widget.mission.radiusMeters) {
        throw const FormatException('目前不在旅程範圍內。請確認所在據點，再重新掃碼。');
      }
      completed = await widget.controller.completeRadarMission(
        widget.mission,
        venueWitness: proof,
      );
      if (!_current(sequence)) return;
      _input.clear();
      setState(() {
        _completed = completed;
        if (!completed) _error = widget.controller.notice ?? '尚未確認完成，請重新掃碼。';
      });
    } on FormatException catch (error) {
      if (_current(sequence)) setState(() => _error = error.message);
    } catch (_) {
      if (_current(sequence)) {
        setState(() => _error = '定位或連線未完成。請確認權限，回到現場後重新掃碼。');
      }
    } finally {
      if (_current(sequence)) setState(() => _busy = false);
    }
    if (_current(sequence) && completed) await _loadReceipt();
  }

  Future<void> _issue() async {
    if (_busy || _contextChanged) return;
    final sequence = ++_sequence;
    final started = _clock.elapsed;
    setState(() {
      _busy = true;
      _error = null;
      _redemption = null;
      _codeExpired = false;
    });
    try {
      // Refresh first so a redeemed reward is not offered again from stale UI.
      final receipt = await widget.controller.getVenueReceipt(
        widget.mission.id,
      );
      if (!_current(sequence)) return;
      setState(() => _receipt = receipt);
      if (receipt == null ||
          receipt.redeemedAt != null ||
          receipt.offer?.trim().isNotEmpty != true) {
        return;
      }
      final result = await widget.controller.createVenueRedemptionCode(
        widget.mission.id,
      );
      if (!_current(sequence)) return;
      final deadline = started + result.lifetime;
      if (deadline <= _clock.elapsed) {
        throw const FormatException('code expired');
      }
      setState(() {
        _redemption = result;
        _deadline = deadline;
      });
    } catch (_) {
      if (_current(sequence)) {
        setState(() => _error = '領取碼尚未取得。若剛剛開啟過，請稍候十秒再試；也可先更新領取狀態。');
      }
    } finally {
      if (_current(sequence)) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _sequence++;
    WidgetsBinding.instance.removeObserver(this);
    widget.controller.removeListener(_contextUpdate);
    _timer?.cancel();
    _clock.stop();
    _input.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final offline = widget.controller.offlineDemo;
    final available = !_busy && !_contextChanged && !offline;
    final remaining = math.max(
      0,
      ((_deadline - _clock.elapsed).inMilliseconds / 1000).ceil(),
    );
    final hasOffer = _receipt?.offer?.trim().isNotEmpty == true;
    return Scaffold(
      backgroundColor: warmWhite,
      appBar: AppBar(
        title: const Text('到場足跡'),
        leading: Navigator.of(context).canPop()
            ? IconButton(
                tooltip: '返回旅程',
                onPressed: () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.arrow_back),
              )
            : null,
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                Text(
                  widget.mission.venueName ?? '旅程據點',
                  style: const TextStyle(
                    color: forest,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  widget.mission.title,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 12),
                const Text(
                  '不需要消費，也不必領取回饋。',
                  style: TextStyle(fontSize: 16, color: mutedInk, height: 1.6),
                ),
                const SizedBox(height: 24),
                if (offline) const Text('目前是離線示範，不會完成到場見證或提供領取碼。'),
                if (_error != null)
                  Semantics(
                    liveRegion: true,
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 20),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF4F1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        _error!,
                        style: const TextStyle(
                          color: Color(0xFF912E24),
                          fontSize: 16,
                          height: 1.6,
                        ),
                      ),
                    ),
                  ),
                if (_busy)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 16),
                    child: LinearProgressIndicator(semanticsLabel: '正在確認到場資料'),
                  ),
                if (!_completed && !_contextChanged) ...[
                  const Text(
                    '完成旅程條件後，掃描夥伴展示的到場碼。確認時會重新取得位置；只送出這一次的位置，不使用示範座標。',
                    style: TextStyle(fontSize: 16, height: 1.7),
                  ),
                  const SizedBox(height: 20),
                  if (_scanning) ...[
                    SizedBox(
                      height: 280,
                      child: _ArrivalCamera(
                        onRead: (value) {
                          if (!mounted) return;
                          setState(() {
                            _scanning = false;
                            if (isVenueArrivalCode(value)) {
                              _input.text = value;
                              _error = null;
                            } else {
                              _input.clear();
                              _error = '這不是到場碼，請掃描據點目前展示的碼。';
                            }
                          });
                        },
                      ),
                    ),
                    TextButton(
                      onPressed: () => setState(() => _scanning = false),
                      child: const Text('關閉鏡頭'),
                    ),
                  ] else if (!kIsWeb &&
                      (defaultTargetPlatform == TargetPlatform.android ||
                          defaultTargetPlatform == TargetPlatform.iOS ||
                          defaultTargetPlatform == TargetPlatform.macOS))
                    OutlinedButton.icon(
                      onPressed: available
                          ? () => setState(() {
                              _input.clear();
                              _scanning = true;
                              _error = null;
                            })
                          : null,
                      icon: const Icon(Icons.qr_code_scanner),
                      label: const Text('掃描現場到場碼'),
                    ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _input,
                    enabled: available && !_scanning,
                    obscureText: true,
                    autocorrect: false,
                    enableSuggestions: false,
                    maxLength: 48,
                    decoration: const InputDecoration(
                      labelText: '到場碼',
                      helperText: '也可貼上現場夥伴提供的短效碼。',
                      helperMaxLines: 3,
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed:
                        available &&
                            !_scanning &&
                            isVenueArrivalCode(_input.text.trim())
                        ? _complete
                        : null,
                    icon: const Icon(Icons.location_on_outlined),
                    label: const Text('確認位置，留下足跡'),
                  ),
                ],
                if (_completed && !_contextChanged) ...[
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 18, 16, 18),
                    decoration: const BoxDecoration(
                      color: Color(0xFFEEF4EF),
                      border: Border(left: BorderSide(color: forest, width: 3)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              Icons.check_circle_outline,
                              color: forest,
                              size: 28,
                            ),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                '這段旅程已完成',
                                style: TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (_receipt != null) ...[
                          const SizedBox(height: 10),
                          Text(
                            '到場時間 ${_witnessTime(_receipt!.witnessedAt)}',
                            style: const TextStyle(
                              fontSize: 16,
                              height: 1.6,
                              color: mutedInk,
                            ),
                          ),
                        ],
                        const SizedBox(height: 10),
                        const Text(
                          '一起走過的路，已留在你們的年輪裡。',
                          style: TextStyle(fontSize: 16, height: 1.6),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  if (hasOffer) ...[
                    const Text(
                      '現場的小心意',
                      style: TextStyle(
                        fontSize: 16,
                        color: forest,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _receipt!.redeemedAt != null
                          ? '回饋已登記領取，請勿重複領取。'
                          : _receipt!.offer!,
                      style: const TextStyle(fontSize: 18, height: 1.7),
                    ),
                  ] else if (_receipt != null)
                    const Text('這段旅程沒有額外回饋，年輪進度仍已保留。'),
                  if (_receipt == null) const Text('讀取到場紀錄後，即可確認這段旅程是否提供回饋。'),
                  const SizedBox(height: 20),
                  if (_codeExpired)
                    Semantics(
                      liveRegion: true,
                      child: const Padding(
                        padding: EdgeInsets.only(bottom: 16),
                        child: Text(
                          '領取碼已過期。若還在現場，可重新開啟；年輪進度不受影響。',
                          style: TextStyle(
                            fontSize: 16,
                            height: 1.6,
                            color: mutedInk,
                          ),
                        ),
                      ),
                    ),
                  if (_redemption != null && remaining > 0) ...[
                    Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 300),
                        child: QrImageView(
                          data: _redemption!.code,
                          backgroundColor: Colors.white,
                          padding: const EdgeInsets.all(24),
                          semanticsLabel: '請讓現場夥伴掃描此領取碼',
                        ),
                      ),
                    ),
                    Text(
                      '領取碼還有 $remaining 秒有效。請讓現場夥伴掃描。',
                      textAlign: TextAlign.center,
                    ),
                    TextButton(
                      onPressed: () => setState(() => _redemption = null),
                      child: const Text('收起領取碼'),
                    ),
                  ] else if (hasOffer && _receipt!.redeemedAt == null)
                    FilledButton.icon(
                      onPressed: available ? _issue : null,
                      icon: const Icon(Icons.redeem_outlined),
                      label: const Text('我想領取，顯示領取碼'),
                    ),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: available ? _loadReceipt : null,
                    child: Text(hasOffer ? '更新領取狀態' : '更新到場紀錄'),
                  ),
                  const SizedBox(height: 16),
                  const ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    childrenPadding: EdgeInsets.only(bottom: 16),
                    title: Text('這份紀錄代表什麼？', style: TextStyle(fontSize: 16)),
                    children: [
                      Text(
                        '是否領取不影響年輪進度。此紀錄不等於購買、共同在場或已完成植樹。',
                        style: TextStyle(fontSize: 16, height: 1.7),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

String _witnessTime(DateTime time) {
  final local = time.toLocal();
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '${local.year}/${local.month}/${local.day} $hour:$minute';
}

class _ArrivalCamera extends StatefulWidget {
  const _ArrivalCamera({required this.onRead});
  final ValueChanged<String> onRead;
  @override
  State<_ArrivalCamera> createState() => _ArrivalCameraState();
}

class _ArrivalCameraState extends State<_ArrivalCamera> {
  final _camera = MobileScannerController(
    autoStart: false,
    formats: const [BarcodeFormat.qrCode],
  );
  bool _read = false;
  Future<void>? _starting;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _starting = _camera.start();
      // The scanner's errorBuilder presents permission/start errors.
      unawaited(_starting!.catchError((Object _) {}));
    });
  }

  Future<void> _closeCamera() async {
    try {
      // A permission response can arrive after the screen has gone away.
      // Stop the eventual native session before disposing the controller.
      await _starting;
    } catch (_) {
      // Failed initialization still needs controller cleanup.
    }
    try {
      await _camera.stop();
    } finally {
      await _camera.dispose();
    }
  }

  @override
  void dispose() {
    unawaited(_closeCamera());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MobileScanner(
    controller: _camera,
    errorBuilder: (context, error) => const Center(
      child: Text('無法開啟相機。請確認權限，或關閉鏡頭後貼上現場碼。', style: TextStyle(fontSize: 16)),
    ),
    onDetect: (capture) {
      if (_read || !mounted) return;
      for (final barcode in capture.barcodes) {
        final value = barcode.rawValue;
        if (value == null) continue;
        _read = true;
        unawaited(_camera.stop());
        widget.onRead(value);
        break;
      }
    },
  );
}
