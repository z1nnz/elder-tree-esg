import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_controller.dart';
import 'models.dart';
import 'theme.dart';

class CirclePeopleHeader extends StatelessWidget {
  const CirclePeopleHeader({required this.controller, super.key});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final circle = controller.circle;
    final name = controller.context?.activeHousehold.name ?? circle.name;
    final members = circle.members;
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 4, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '樹伴圈',
            style: TextStyle(
              color: forest,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            name,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            members.isEmpty
                ? '先邀一位同行的人，讓旅程有個開始。'
                : '${members.map((member) => member.displayName).take(3).join('、')}${members.length > 3 ? '等 ${members.length} 位樹伴' : ''}，一起留下生活的足跡。',
            style: const TextStyle(color: mutedInk, fontSize: 16, height: 1.6),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => openCircleMembership(context, controller),
            icon: const Icon(Icons.people_outline_rounded, size: 20),
            label: const Text('邀請與加入樹伴圈'),
          ),
        ],
      ),
    );
  }
}

Future<void> openCircleMembership(
  BuildContext context,
  AppController controller, {
  bool joining = false,
}) {
  final theme = Theme.of(context);
  final scaler = MediaQuery.textScalerOf(context);
  return Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (context) => Theme(
        data: theme,
        child: MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: scaler),
          child: CircleMembershipScreen(
            controller: controller,
            joining: joining,
          ),
        ),
      ),
    ),
  );
}

/// One place to invite, join and switch; no family relationship is required.
class CircleMembershipScreen extends StatefulWidget {
  const CircleMembershipScreen({
    required this.controller,
    this.joining = false,
    super.key,
  });

  final AppController controller;
  final bool joining;

  @override
  State<CircleMembershipScreen> createState() => _CircleMembershipScreenState();
}

class _CircleMembershipScreenState extends State<CircleMembershipScreen> {
  final _formKey = GlobalKey<FormState>();
  final _code = TextEditingController();
  final _relationship = TextEditingController(text: '朋友');
  late bool _joining = widget.joining;
  HouseholdInviteModel? _invite;
  String? _inviteCircleId;
  String? _error;
  bool _copied = false;
  Timer? _expiryTimer;

  AppController get controller => widget.controller;

  @override
  void dispose() {
    _code.dispose();
    _relationship.dispose();
    _expiryTimer?.cancel();
    super.dispose();
  }

  Future<void> _createInvite() async {
    setState(() => _error = null);
    final circleId = controller.context?.activeHouseholdId;
    final invite = await controller.createHouseholdInvite();
    if (!mounted) return;
    setState(() {
      _error = controller.membershipError;
      _invite = invite;
      _inviteCircleId = circleId;
      _copied = false;
    });
    _expiryTimer?.cancel();
    if (invite != null) {
      final remaining = invite.expiresAt.difference(DateTime.now());
      if (remaining.isNegative) return;
      _expiryTimer = Timer(remaining, () {
        if (mounted) setState(() => _copied = false);
      });
    }
  }

  Future<void> _join() async {
    if (controller.membershipBusy || !_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _error = null);
    final joined = await controller.joinHousehold(
      _code.text,
      _relationship.text,
    );
    if (!mounted) return;
    if (joined) {
      Navigator.of(context).pop();
    } else {
      setState(() => _error = controller.membershipError);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final busy = controller.membershipBusy;
        final account = controller.context;
        final circle = controller.circle;
        final sameCircle =
            account == null || account.activeHouseholdId == circle.id;
        final name = account?.activeHousehold.name ?? circle.name;
        final invite = _inviteCircleId == account?.activeHouseholdId
            ? _invite
            : null;
        final expired =
            invite != null && !invite.expiresAt.isAfter(DateTime.now());
        return PopScope(
          canPop: !busy,
          child: Scaffold(
            appBar: AppBar(
              title: const Text('我的樹伴圈'),
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
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(24, 20, 24, 40),
                    children: [
                      const Text(
                        '一起走，才有我們的故事',
                        style: TextStyle(
                          color: forest,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        name,
                        style: const TextStyle(
                          fontSize: 28,
                          height: 1.3,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        '家人、朋友、鄰居或志工，都能成為同行的樹伴。',
                        style: TextStyle(
                          color: mutedInk,
                          fontSize: 16,
                          height: 1.6,
                        ),
                      ),
                      const SizedBox(height: 24),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          ChoiceChip(
                            label: const Text('邀請同行'),
                            selected: !_joining,
                            onSelected: busy
                                ? null
                                : (_) => setState(() {
                                    _joining = false;
                                    _error = null;
                                  }),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 12,
                            ),
                          ),
                          ChoiceChip(
                            label: const Text('我有邀請碼'),
                            selected: _joining,
                            onSelected: busy
                                ? null
                                : (_) => setState(() {
                                    _joining = true;
                                    _error = null;
                                  }),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 12,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      if (controller.offlineDemo)
                        const _MembershipNotice(
                          text: '目前是離線示範。連上服務後，才能邀請或加入樹伴圈。',
                        ),
                      if (_joining) ...[
                        const Text(
                          '接住一份邀請',
                          style: TextStyle(
                            fontSize: 21,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          '加入後會切換到對方的樹伴圈；原本的樹伴圈與紀錄仍會保留。',
                          style: TextStyle(
                            color: mutedInk,
                            fontSize: 16,
                            height: 1.6,
                          ),
                        ),
                        const SizedBox(height: 20),
                        Form(
                          key: _formKey,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              TextFormField(
                                controller: _code,
                                enabled: !busy,
                                autocorrect: false,
                                enableSuggestions: false,
                                textCapitalization:
                                    TextCapitalization.characters,
                                textInputAction: TextInputAction.next,
                                decoration: const InputDecoration(
                                  labelText: '8 碼邀請碼',
                                  helperText: '英文字母與數字，不分大小寫',
                                  helperMaxLines: 3,
                                  errorMaxLines: 3,
                                ),
                                validator: (value) =>
                                    RegExp(
                                      r'^[a-zA-Z0-9]{8}$',
                                    ).hasMatch(value?.trim() ?? '')
                                    ? null
                                    : '請填入完整的 8 碼英文字母與數字',
                              ),
                              const SizedBox(height: 18),
                              TextFormField(
                                controller: _relationship,
                                enabled: !busy,
                                maxLength: 24,
                                textInputAction: TextInputAction.done,
                                onFieldSubmitted: (_) => _join(),
                                decoration: const InputDecoration(
                                  labelText: '你和樹伴的關係',
                                  hintText: '例如：朋友、鄰居、志工',
                                  errorMaxLines: 3,
                                ),
                                validator: (value) =>
                                    (value?.trim().isEmpty ?? true)
                                    ? '請填寫關係，例如朋友或志工'
                                    : (value!.trim().length > 24
                                          ? '關係請在 24 個字以內'
                                          : null),
                              ),
                              const SizedBox(height: 12),
                              FilledButton.icon(
                                onPressed: busy || controller.offlineDemo
                                    ? null
                                    : _join,
                                icon: const Icon(Icons.group_add_outlined),
                                label: Text(busy ? '正在加入…' : '加入樹伴圈'),
                              ),
                            ],
                          ),
                        ),
                      ] else ...[
                        const Text(
                          '邀請一位，從這裡開始',
                          style: TextStyle(
                            fontSize: 21,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          '把邀請碼私下傳給對方。每組只能使用一次；邀請下一位時，再產生新的邀請碼。',
                          style: TextStyle(
                            color: mutedInk,
                            fontSize: 16,
                            height: 1.6,
                          ),
                        ),
                        const SizedBox(height: 20),
                        if (invite != null) ...[
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: canvas,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: outline),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  expired ? '邀請碼已過期' : '你的同行邀請碼',
                                  style: const TextStyle(
                                    color: mutedInk,
                                    fontSize: 14,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                // Wrap whole chunks rather than shrinking large text.
                                Wrap(
                                  spacing: 16,
                                  runSpacing: 4,
                                  children: [
                                    for (final chunk in [
                                      invite.code.substring(0, 4),
                                      invite.code.substring(4),
                                    ])
                                      Text(
                                        chunk,
                                        style: const TextStyle(
                                          fontSize: 28,
                                          fontWeight: FontWeight.w700,
                                          letterSpacing: 3,
                                          color: forestDark,
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  '有效至 ${_expiryLabel(invite.expiresAt.toLocal())}',
                                  style: const TextStyle(
                                    color: mutedInk,
                                    fontSize: 14,
                                    height: 1.5,
                                  ),
                                ),
                                const SizedBox(height: 16),
                                OutlinedButton.icon(
                                  onPressed: expired
                                      ? null
                                      : () async {
                                          try {
                                            await Clipboard.setData(
                                              ClipboardData(text: invite.code),
                                            );
                                            if (mounted) {
                                              setState(() => _copied = true);
                                            }
                                          } catch (_) {
                                            if (mounted) {
                                              setState(
                                                () => _error =
                                                    '無法複製，請手動記下畫面上的邀請碼。',
                                              );
                                            }
                                          }
                                        },
                                  icon: Icon(
                                    _copied
                                        ? Icons.check_rounded
                                        : Icons.copy_rounded,
                                  ),
                                  label: Text(_copied ? '邀請碼已複製' : '複製邀請碼'),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],
                        FilledButton.icon(
                          onPressed: busy || controller.offlineDemo
                              ? null
                              : _createInvite,
                          icon: const Icon(Icons.person_add_alt_1_outlined),
                          label: Text(
                            busy
                                ? '正在準備…'
                                : invite == null
                                ? '產生邀請碼'
                                : '為下一位產生邀請碼',
                          ),
                        ),
                      ],
                      if (_error != null) ...[
                        const SizedBox(height: 16),
                        _MembershipNotice(text: _error!, error: true),
                      ],
                      const SizedBox(height: 18),
                      const Text(
                        '加入同一樹伴圈後，成員能看見共同旅程、成員名稱與圈內分享。請只邀請你信任的人。',
                        style: TextStyle(
                          color: mutedInk,
                          fontSize: 14,
                          height: 1.6,
                        ),
                      ),
                      const SizedBox(height: 28),
                      const Divider(),
                      const SizedBox(height: 24),
                      const Text(
                        '現在和你同行的人',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (!sameCircle || circle.members.isEmpty)
                        const Text(
                          '成員資料尚未載入，請返回後重新整理。',
                          style: TextStyle(color: mutedInk, height: 1.6),
                        )
                      else
                        for (final member in circle.members)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const CircleAvatar(
                                  backgroundColor: canvas,
                                  foregroundColor: forest,
                                  child: Icon(Icons.person_outline_rounded),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '${member.displayName}${member.id == circle.currentMemberId ? '（你）' : ''}',
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      if (member.relationship.isNotEmpty)
                                        Text(
                                          member.relationship == 'SELF'
                                              ? '本人'
                                              : member.relationship,
                                          style: const TextStyle(
                                            color: mutedInk,
                                            fontSize: 14,
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                      if ((account?.households.length ?? 0) > 1) ...[
                        const SizedBox(height: 24),
                        const Text(
                          '切換樹伴圈',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        for (final household in account!.households)
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(household.name),
                            subtitle: Text(
                              household.id == account.activeHouseholdId
                                  ? '目前所在'
                                  : '點一下切換',
                            ),
                            trailing: Icon(
                              household.id == account.activeHouseholdId
                                  ? Icons.check_circle_outline_rounded
                                  : Icons.chevron_right_rounded,
                              color: forest,
                            ),
                            enabled: !busy && !controller.offlineDemo,
                            onTap: () async {
                              final changed = await controller.switchHousehold(
                                household.id,
                              );
                              if (!mounted) return;
                              setState(() {
                                _invite = null;
                                _error = changed
                                    ? null
                                    : controller.membershipError;
                              });
                            },
                          ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  String _expiryLabel(DateTime date) =>
      '${date.year}/${date.month}/${date.day} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
}

class _MembershipNotice extends StatelessWidget {
  const _MembershipNotice({required this.text, this.error = false});
  final String text;
  final bool error;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Text(
        text,
        style: TextStyle(
          color: error ? Theme.of(context).colorScheme.error : mutedInk,
          fontSize: 16,
          height: 1.6,
        ),
      ),
    ),
  );
}
