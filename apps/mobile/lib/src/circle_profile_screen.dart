import 'dart:math';

import 'package:flutter/material.dart';

import 'app_controller.dart';
import 'models.dart';
import 'theme.dart';

const circleKindLabels = {
  'FAMILY': '家庭',
  'FRIENDS': '朋友',
  'COMMUNITY': '社區',
  'COMPANY': '公司',
  'SCHOOL': '學校',
  'CARE_SITE': '長照據點',
  'VOLUNTEER': '志工團體',
  'INTEREST': '興趣社團',
};

Future<bool?> openCircleProfile(
  BuildContext context,
  AppController controller, {
  HouseholdSummaryModel? profile,
}) {
  final theme = Theme.of(context);
  final scaler = MediaQuery.textScalerOf(context);
  return Navigator.of(context).push<bool>(
    MaterialPageRoute(
      builder: (context) => Theme(
        data: theme,
        child: MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: scaler),
          child: CircleProfileScreen(controller: controller, profile: profile),
        ),
      ),
    ),
  );
}

class CircleProfileScreen extends StatefulWidget {
  const CircleProfileScreen({
    required this.controller,
    this.profile,
    super.key,
  });
  final AppController controller;
  final HouseholdSummaryModel? profile;

  @override
  State<CircleProfileScreen> createState() => _CircleProfileScreenState();
}

class _CircleProfileScreenState extends State<CircleProfileScreen> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(
    text: widget.profile?.needsSetup == false ? widget.profile!.name : '',
  );
  late String? _kind = widget.profile?.needsSetup == false
      ? widget.profile!.kind
      : null;
  late int _revision = widget.profile?.settingsRevision ?? 0;
  // One key per form, including retries; editing after an uncertain response
  // cannot silently turn the original request into another circle.
  final _creationKey = List.generate(
    4,
    (_) => Random.secure().nextInt(1 << 32).toRadixString(16).padLeft(8, '0'),
  ).join();
  String? _error;
  bool _kindMissing = false;
  bool _reloading = false;

  AppController get controller => widget.controller;
  bool get creating => widget.profile == null;
  bool get canEdit {
    if (creating) return true;
    final context = controller.context;
    if (context == null) return widget.profile?.canManageCircle ?? false;
    return context.households
            .where((item) => item.id == widget.profile!.id)
            .firstOrNull
            ?.canManageCircle ??
        false;
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (controller.membershipBusy ||
        _reloading ||
        controller.offlineDemo ||
        !canEdit) {
      return;
    }
    final valid = _form.currentState!.validate();
    setState(() {
      _kindMissing = _kind == null;
      _error = null;
    });
    if (!valid || _kindMissing) return;
    FocusScope.of(context).unfocus();
    final saved = creating
        ? await controller.createCircle(
            name: _name.text,
            kind: _kind!,
            idempotencyKey: _creationKey,
          )
        : await controller.updateCircle(
            circleId: widget.profile!.id,
            name: _name.text,
            kind: _kind!,
            expectedRevision: _revision,
          );
    if (!mounted) return;
    if (saved) {
      Navigator.of(context).pop(true);
    } else {
      setState(() => _error = controller.membershipError ?? '設定暫時無法儲存，請稍後再試。');
    }
  }

  Future<void> _reload() async {
    if (_reloading || controller.membershipBusy) return;
    setState(() => _reloading = true);
    final latest = await controller.reloadCircleProfile(widget.profile!.id);
    if (!mounted) return;
    setState(() {
      _reloading = false;
      if (latest == null) {
        _error = controller.membershipError;
      } else {
        _name.text = latest.name;
        _kind = latest.kind;
        _revision = latest.settingsRevision;
        _error = latest.canManageCircle ? null : '目前沒有管理權限，請聯絡樹伴圈管理者。';
      }
    });
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) {
      final busy = controller.membershipBusy || _reloading;
      return PopScope(
        canPop: !busy,
        child: Scaffold(
          appBar: AppBar(
            title: Text(creating ? '建立樹伴圈' : '樹伴圈設定'),
            leading: IconButton(
              tooltip: '返回',
              onPressed: busy ? null : () => Navigator.of(context).maybePop(),
              icon: const Icon(Icons.arrow_back_rounded),
            ),
          ),
          body: SafeArea(
            top: false,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 640),
                child: Form(
                  key: _form,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(24, 20, 24, 40),
                    children: [
                      const Text(
                        '同行，從我們開始',
                        style: TextStyle(
                          color: forest,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        '給這段同行，\n取個名字。',
                        style: TextStyle(
                          fontSize: 30,
                          fontWeight: FontWeight.w700,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        creating
                            ? '為另一群同行的人留一個位置。新的生命樹與旅程會分開記錄，原本的樹伴圈都會保留。'
                            : '讓大家一眼認出，這是屬於我們的地方。調整名稱與類型，不會清除旅程或生命樹。',
                        style: const TextStyle(
                          color: mutedInk,
                          fontSize: 16,
                          height: 1.65,
                        ),
                      ),
                      const SizedBox(height: 28),
                      TextFormField(
                        controller: _name,
                        enabled: !busy && canEdit,
                        maxLength: 40,
                        textInputAction: TextInputAction.done,
                        decoration: const InputDecoration(
                          labelText: '樹伴圈名稱',
                          hintText: '例如：週末慢步的我們',
                          errorMaxLines: 3,
                        ),
                        validator: (value) {
                          final name = value?.trim() ?? '';
                          if (name.isEmpty) return '先替你們的樹伴圈取個名字';
                          if (name.length > 40) return '名稱請在 40 個字以內';
                          if (RegExp(r'[\x00-\x1F\x7F]').hasMatch(name)) {
                            return '名稱不能包含換行或控制字元';
                          }
                          return null;
                        },
                        onFieldSubmitted: (_) => _save(),
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        '你們是怎樣的一群人？',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        '選最接近你們的一種，之後還能調整。',
                        style: TextStyle(
                          fontSize: 16,
                          color: mutedInk,
                          height: 1.6,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final kind in circleKindLabels.entries)
                            ChoiceChip(
                              label: Text(kind.value),
                              selected: _kind == kind.key,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 12,
                              ),
                              onSelected: busy || !canEdit
                                  ? null
                                  : (_) => setState(() {
                                      _kind = kind.key;
                                      _kindMissing = false;
                                    }),
                            ),
                        ],
                      ),
                      if (_kindMissing)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Text(
                            '請選擇樹伴圈類型',
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                              fontSize: 16,
                            ),
                          ),
                        ),
                      const SizedBox(height: 24),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(
                            Icons.spa_outlined,
                            color: forest,
                            size: 24,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              creating
                                  ? '建立後，你可以管理這個樹伴圈的名稱與類型；受邀成員仍可一起參與旅程。'
                                  : '只有管理者能修改這份設定。樹伴成員仍可一起參與、接力與分享。',
                              style: const TextStyle(
                                color: mutedInk,
                                fontSize: 14,
                                height: 1.6,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (controller.offlineDemo || !canEdit)
                        Padding(
                          padding: const EdgeInsets.only(top: 16),
                          child: Text(
                            controller.offlineDemo
                                ? '離線示範不能建立或修改樹伴圈。'
                                : '目前沒有管理權限，請聯絡樹伴圈管理者。',
                            style: const TextStyle(
                              color: mutedInk,
                              fontSize: 16,
                              height: 1.6,
                            ),
                          ),
                        ),
                      if (_error != null) ...[
                        const SizedBox(height: 16),
                        Semantics(
                          liveRegion: true,
                          child: Text(
                            _error!,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                              fontSize: 16,
                              height: 1.6,
                            ),
                          ),
                        ),
                        if (!creating)
                          TextButton(
                            onPressed: busy ? null : _reload,
                            child: const Text('重新載入最新設定'),
                          ),
                      ],
                      const SizedBox(height: 24),
                      FilledButton(
                        onPressed: busy || controller.offlineDemo || !canEdit
                            ? null
                            : _save,
                        child: Text(
                          busy
                              ? '正在儲存…'
                              : creating
                              ? '建立並開啟'
                              : '儲存設定',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    },
  );
}
