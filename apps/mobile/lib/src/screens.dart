import 'dart:async';

import 'package:flutter/material.dart';
import 'package:maplibre/maplibre.dart';

import 'app_controller.dart';
import 'exploration_map_config.dart';
import 'models.dart';
import 'theme.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({
    required this.controller,
    required this.onOpenTasks,
    super.key,
  });

  final AppController controller;
  final VoidCallback onOpenTasks;

  @override
  Widget build(BuildContext context) {
    final incomplete = controller.tasks
        .where((task) => task.status != TaskStatus.completed)
        .toList();
    final nextStage = controller.tree.nextStageAt;
    final progress = nextStage == null
        ? 1.0
        : (controller.tree.growthPoints / nextStage).clamp(0.0, 1.0);
    return RefreshIndicator(
      onRefresh: controller.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          if (controller.offlineDemo)
            const _NoticeBand(
              icon: Icons.cloud_off_rounded,
              text: '離線示範模式：操作仍可體驗，連線後會改用真實 API。',
            ),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              height: 236,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Image.network(
                    'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1200&q=85',
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) =>
                        Container(color: forestDark),
                  ),
                  Container(color: Colors.black.withValues(alpha: 0.42)),
                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 9,
                            vertical: 5,
                          ),
                          color: warmYellow,
                          child: Text(
                            _stageLabel(controller.tree.stage),
                            style: const TextStyle(
                              color: ink,
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        const Spacer(),
                        Text(
                          controller.tree.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 27,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 7),
                        Text(
                          '${controller.tree.householdName}一起累積了 ${controller.tree.growthPoints} 點成長值',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 15),
                        LinearProgressIndicator(
                          value: progress,
                          minHeight: 9,
                          borderRadius: BorderRadius.circular(5),
                          backgroundColor: Colors.white24,
                          color: warmYellow,
                        ),
                        const SizedBox(height: 7),
                        Text(
                          nextStage == null
                              ? '這棵樹已經成熟'
                              : '再 ${nextStage - controller.tree.growthPoints} 點進入下一階段',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          _SectionTitle(
            title: '今天可以做的事',
            subtitle: '不必趕進度，選一件舒服的就好',
            action: TextButton(
              onPressed: onOpenTasks,
              child: const Text('查看全部'),
            ),
          ),
          const SizedBox(height: 10),
          if (incomplete.isEmpty)
            const _EmptyBlock(
              icon: Icons.done_all_rounded,
              title: '今天的任務完成了',
              text: '休息一下，看看家人留給你的訊息。',
            )
          else
            ...incomplete
                .take(2)
                .map(
                  (task) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _TaskTile(task: task, controller: controller),
                  ),
                ),
          const SizedBox(height: 10),
          _SectionTitle(
            title: '家人的陪伴',
            subtitle: controller.messages.isEmpty
                ? '還沒有新訊息'
                : '${controller.messages.first.authorName}剛剛傳來一段話',
          ),
          const SizedBox(height: 10),
          if (controller.messages.isNotEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const CircleAvatar(
                      backgroundColor: warmYellow,
                      foregroundColor: ink,
                      child: Icon(Icons.favorite_rounded),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            controller.messages.first.authorName,
                            style: const TextStyle(fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 5),
                          Text(
                            controller.messages.first.body,
                            style: const TextStyle(height: 1.5),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            controller.messages.first.delivered
                                ? '已送達陪伴樹'
                                : '等待裝置上線',
                            style: TextStyle(
                              color: controller.messages.first.delivered
                                  ? forest
                                  : Colors.orange.shade800,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class TasksScreen extends StatelessWidget {
  const TasksScreen({required this.controller, super.key});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
      children: [
        const _PageHeading(
          title: '生活任務',
          subtitle: '每項任務都可以依照自己的狀況調整，不舒服就先休息。',
        ),
        const SizedBox(height: 14),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: const [
            _FilterPill(label: '全部', selected: true),
            _FilterPill(label: '生活'),
            _FilterPill(label: '自然'),
            _FilterPill(label: '家庭'),
            _FilterPill(label: '永續'),
          ],
        ),
        const SizedBox(height: 18),
        ...controller.tasks.map(
          (task) => Padding(
            padding: const EdgeInsets.only(bottom: 11),
            child: _TaskTile(
              task: task,
              controller: controller,
              expanded: true,
            ),
          ),
        ),
      ],
    );
  }
}

class ExplorationScreen extends StatefulWidget {
  const ExplorationScreen({required this.controller, super.key});

  final AppController controller;

  static const mapStyleUrl = String.fromEnvironment(
    'MAP_STYLE_URL',
    defaultValue: 'https://tiles.openfreemap.org/styles/liberty',
  );

  @override
  State<ExplorationScreen> createState() => _ExplorationScreenState();
}

class _ExplorationScreenState extends State<ExplorationScreen> {
  ExplorationMapMode _mapMode = ExplorationMapMode.adventure;

  AppController get controller => widget.controller;

  @override
  Widget build(BuildContext context) {
    final route = controller.exploration.routes.isEmpty
        ? null
        : controller.exploration.routes.first;
    final pointQuests = controller.exploration.quests
        .where((quest) => quest.latitude != null && quest.longitude != null)
        .toList();
    final mapPresentation = explorationMapPresentation(
      _mapMode,
      streetStyleUrl: ExplorationScreen.mapStyleUrl,
    );
    final routeProgress = route == null || route.totalQuestCount == 0
        ? 0.0
        : route.completedQuestCount / route.totalQuestCount;
    final sessionDistance =
        controller.exploration.activeSession?.distanceMeters ?? 0;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
      children: [
        const _PageHeading(
          title: '城市探索',
          subtitle: '用自己的步調走動；不論是否有家人，每一步都能解鎖新的行動。',
        ),
        if (route != null) ...[
          const SizedBox(height: 12),
          Card(
            color: const Color(0xFFEAF4EC),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.park_rounded, color: forest),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          route.name,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      Text(
                        '${route.completedQuestCount}/${route.totalQuestCount}',
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(route.description),
                  const SizedBox(height: 12),
                  LinearProgressIndicator(
                    value: routeProgress,
                    minHeight: 8,
                    borderRadius: BorderRadius.circular(5),
                    color: forest,
                    backgroundColor: Colors.white,
                  ),
                  if (route.badgeAwarded) ...[
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        const Icon(
                          Icons.workspace_premium_rounded,
                          color: Color(0xFFD98A00),
                        ),
                        const SizedBox(width: 7),
                        Text(
                          '已取得「${route.badgeName}」徽章',
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 14),
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: Column(
            children: [
              Container(
                width: double.infinity,
                color: Colors.white,
                padding: const EdgeInsets.all(8),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: _MapModeSwitch(
                    mode: _mapMode,
                    onChanged: (mode) => setState(() => _mapMode = mode),
                  ),
                ),
              ),
              SizedBox(
                height: 340,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    MapLibreMap(
                      key: ValueKey(_mapMode),
                      options: MapOptions(
                        initStyle: mapPresentation.style,
                        initCenter: const Geographic(
                          lon: 121.5362,
                          lat: 25.0316,
                        ),
                        initZoom: mapPresentation.zoom,
                        initPitch: mapPresentation.pitch,
                        initBearing: mapPresentation.bearing,
                        maxPitch: 60,
                      ),
                      layers: const [],
                      children: [
                        WidgetLayer(
                          markers: pointQuests
                              .map(
                                (quest) => Marker(
                                  point: Geographic(
                                    lon: quest.longitude!,
                                    lat: quest.latitude!,
                                  ),
                                  size: const Size(58, 72),
                                  alignment: Alignment.bottomCenter,
                                  child: _QuestBeacon(quest: quest),
                                ),
                              )
                              .toList(),
                        ),
                        const MapControlButtons(showTrackLocation: true),
                        const SourceAttribution(),
                      ],
                    ),
                    if (_mapMode == ExplorationMapMode.adventure)
                      const Positioned(
                        left: 12,
                        bottom: 12,
                        child: _AdventureMapHint(),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const CircleAvatar(
                  backgroundColor: Color(0xFFDCEBDF),
                  child: Icon(Icons.directions_walk_rounded, color: forest),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$sessionDistance 公尺',
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        controller.exploration.activeSession == null
                            ? '本次路線尚未開始'
                            : '本次路線由伺服器計算',
                      ),
                    ],
                  ),
                ),
                FilledButton.icon(
                  onPressed: controller.exploring
                      ? controller.stopExploration
                      : controller.startExploration,
                  icon: Icon(
                    controller.exploring
                        ? Icons.pause_rounded
                        : Icons.play_arrow_rounded,
                  ),
                  label: Text(controller.exploring ? '暫停' : '開始探索'),
                ),
              ],
            ),
          ),
        ),
        const _NoticeBand(
          icon: Icons.shield_outlined,
          text: '只在此頁開啟定位。伺服器暫存最新一點，結束探索後清除；歷史只留粗略網格。',
        ),
        const SizedBox(height: 8),
        const _SectionTitle(title: '探索任務', subtitle: '走過指定距離或進入地標範圍時自動解鎖'),
        const SizedBox(height: 10),
        if (route == null)
          const _EmptyBlock(
            icon: Icons.map_outlined,
            title: '附近還沒有探索點',
            text: '營運單位建立地標後會出現在這裡；距離任務仍可照常累積。',
          )
        else
          ...route.quests.map(
            (quest) => Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      backgroundColor: quest.completed
                          ? forest
                          : quest.unlocked
                          ? warmYellow
                          : const Color(0xFFE3E7E4),
                      foregroundColor: quest.completed
                          ? Colors.white
                          : forestDark,
                      child: Icon(
                        quest.completed
                            ? Icons.check_rounded
                            : quest.triggerType == 'GEOFENCE'
                            ? Icons.place_rounded
                            : Icons.route_rounded,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${quest.sequence}. ${quest.locationName}',
                            style: const TextStyle(fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 4),
                          Text(quest.title),
                          const SizedBox(height: 5),
                          Text(
                            quest.completed
                                ? '已完成'
                                : quest.unlocked
                                ? '已解鎖，可到任務頁完成'
                                : quest.triggerType == 'DISTANCE'
                                ? '本次路線 ${quest.unlockDistanceMeters ?? 0} 公尺後解鎖'
                                : '進入地標 ${quest.radiusMeters ?? 0} 公尺內解鎖',
                            style: TextStyle(
                              color: quest.unlocked ? forest : Colors.black54,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          if (quest.safetyNote != null) ...[
                            const SizedBox(height: 7),
                            Text(
                              '安全提醒：${quest.safetyNote}',
                              style: const TextStyle(fontSize: 12),
                            ),
                          ],
                          if (quest.accessibilityTags.isNotEmpty) ...[
                            const SizedBox(height: 7),
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: quest.accessibilityTags
                                  .map(
                                    (tag) => Chip(
                                      visualDensity: VisualDensity.compact,
                                      label: Text(tag),
                                    ),
                                  )
                                  .toList(),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _MapModeSwitch extends StatelessWidget {
  const _MapModeSwitch({required this.mode, required this.onChanged});

  final ExplorationMapMode mode;
  final ValueChanged<ExplorationMapMode> onChanged;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.94),
      elevation: 5,
      shadowColor: Colors.black26,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.all(4),
        child: SegmentedButton<ExplorationMapMode>(
          showSelectedIcon: false,
          segments: const [
            ButtonSegment(
              value: ExplorationMapMode.adventure,
              icon: Icon(Icons.explore_rounded, size: 18),
              label: Text('冒險地圖'),
            ),
            ButtonSegment(
              value: ExplorationMapMode.street,
              icon: Icon(Icons.map_outlined, size: 18),
              label: Text('真實地圖'),
            ),
          ],
          selected: {mode},
          onSelectionChanged: (selection) => onChanged(selection.first),
          style: ButtonStyle(
            visualDensity: VisualDensity.compact,
            textStyle: WidgetStateProperty.all(
              const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
            ),
          ),
        ),
      ),
    );
  }
}

class _AdventureMapHint extends StatelessWidget {
  const _AdventureMapHint();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: forestDark.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [
          BoxShadow(color: Colors.black26, blurRadius: 8, offset: Offset(0, 3)),
        ],
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.auto_awesome_rounded, color: warmYellow, size: 16),
          SizedBox(width: 6),
          Text(
            '遊戲視角 · 真實道路',
            style: TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _QuestBeacon extends StatelessWidget {
  const _QuestBeacon({required this.quest});

  final ExplorationQuestModel quest;

  @override
  Widget build(BuildContext context) {
    final color = quest.completed
        ? forest
        : quest.unlocked
        ? const Color(0xFF2F80ED)
        : const Color(0xFF788781);
    final icon = quest.completed
        ? Icons.check_rounded
        : quest.unlocked
        ? Icons.eco_rounded
        : Icons.lock_rounded;

    return Opacity(
      opacity: quest.unlocked ? 1 : 0.78,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color,
              border: Border.all(color: Colors.white, width: 3),
              boxShadow: const [
                BoxShadow(
                  color: Colors.black26,
                  blurRadius: 10,
                  offset: Offset(0, 5),
                ),
              ],
            ),
            child: Stack(
              children: [
                Center(
                  child: Container(
                    width: 31,
                    height: 31,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.22),
                    ),
                    child: Icon(icon, color: Colors.white, size: 20),
                  ),
                ),
                Positioned(
                  right: -1,
                  top: -1,
                  child: Container(
                    width: 20,
                    height: 20,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(
                      color: warmYellow,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      '${quest.sequence}',
                      style: const TextStyle(
                        color: ink,
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Container(width: 5, height: 13, color: color),
          Container(
            width: 19,
            height: 6,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ],
      ),
    );
  }
}

class FamilyScreen extends StatefulWidget {
  const FamilyScreen({required this.controller, super.key});
  final AppController controller;

  @override
  State<FamilyScreen> createState() => _FamilyScreenState();
}

class _FamilyScreenState extends State<FamilyScreen> {
  final messageController = TextEditingController();

  @override
  void dispose() {
    messageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
      children: [
        const _PageHeading(title: '家人的陪伴', subtitle: '不必在同一個地方，也能一起照顧這棵家庭樹。'),
        const SizedBox(height: 14),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.controller.context?.activeHousehold.name ?? '我的家庭',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 5),
                const Text('一個人也能使用；想有人陪伴時，再邀請親友加入。'),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    FilledButton.icon(
                      onPressed: () async {
                        final invite = await widget.controller
                            .createHouseholdInvite();
                        if (invite != null && context.mounted) {
                          await showDialog<void>(
                            context: context,
                            builder: (context) => AlertDialog(
                              title: const Text('家庭邀請碼'),
                              content: SelectableText(
                                invite.code,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 30,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 4,
                                ),
                              ),
                              actions: [
                                FilledButton(
                                  onPressed: () => Navigator.pop(context),
                                  child: const Text('完成'),
                                ),
                              ],
                            ),
                          );
                        }
                      },
                      icon: const Icon(Icons.person_add_alt_1_rounded),
                      label: const Text('邀請親友'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => _showJoinDialog(context),
                      icon: const Icon(Icons.group_add_outlined),
                      label: const Text('加入家庭'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        const _NoticeBand(
          icon: Icons.volunteer_activism_outlined,
          text: '沒有家人也不會被排除；社工、長照機構與志工媒合將以獨立的陪伴關係與同意機制提供。',
        ),
        if (widget.controller.reviews.isNotEmpty) ...[
          const _SectionTitle(title: '等待你的確認', subtitle: '只能覆核同家庭其他成員提交的照片'),
          const SizedBox(height: 10),
          ...widget.controller.reviews.map(
            (review) => Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        review.imageUrl,
                        height: 180,
                        width: double.infinity,
                        fit: BoxFit.cover,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      '${review.participantName} · ${review.taskTitle}',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 4),
                    Text(review.explanation),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () =>
                                widget.controller.decideReview(review, 'FAIL'),
                            child: const Text('請重新拍攝'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: FilledButton(
                            onPressed: () =>
                                widget.controller.decideReview(review, 'PASS'),
                            child: const Text('確認完成'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
        ],
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '傳到客廳陪伴樹',
                  style: TextStyle(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: messageController,
                  maxLength: 120,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    hintText: '例如：今天有空看看窗外的天空嗎？',
                  ),
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: FilledButton.icon(
                    onPressed: () async {
                      await widget.controller.sendFamilyMessage(
                        messageController.text,
                      );
                      messageController.clear();
                    },
                    icon: const Icon(Icons.send_rounded),
                    label: const Text('送到陪伴樹'),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),
        const _SectionTitle(title: '最近訊息', subtitle: '裝置離線時會保留，重新連線後再送達'),
        const SizedBox(height: 10),
        ...widget.controller.messages.map(
          (message) => Padding(
            padding: const EdgeInsets.only(bottom: 9),
            child: Card(
              child: ListTile(
                contentPadding: const EdgeInsets.all(14),
                leading: const CircleAvatar(
                  backgroundColor: Color(0xFFDCEBDF),
                  child: Icon(Icons.person_rounded, color: forest),
                ),
                title: Text(
                  message.authorName,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                subtitle: Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(message.body),
                ),
                trailing: Icon(
                  message.delivered ? Icons.done_all_rounded : Icons.schedule,
                  color: message.delivered ? forest : Colors.orange,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _showJoinDialog(BuildContext context) async {
    final code = TextEditingController();
    final relationship = TextEditingController(text: '家人');
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('加入另一個家庭'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: code,
              maxLength: 8,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(labelText: '8 碼邀請碼'),
            ),
            TextField(
              controller: relationship,
              decoration: const InputDecoration(labelText: '關係，例如：女兒、朋友'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () async {
              await widget.controller.joinHousehold(
                code.text,
                relationship.text,
              );
              if (context.mounted) Navigator.pop(context);
            },
            child: const Text('加入'),
          ),
        ],
      ),
    );
    code.dispose();
    relationship.dispose();
  }
}

class ImpactScreen extends StatelessWidget {
  const ImpactScreen({required this.controller, super.key});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
      children: [
        const _PageHeading(
          title: '永續回饋',
          subtitle: '成熟樹會先進入公益池，再由合作批次留下可追溯的成果。',
        ),
        const SizedBox(height: 14),
        Container(
          decoration: BoxDecoration(
            color: forestDark,
            borderRadius: BorderRadius.circular(8),
          ),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.public_rounded, color: warmYellow, size: 32),
              const SizedBox(height: 24),
              Text(
                '${controller.impact.growthPoints}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 36,
                  fontWeight: FontWeight.w900,
                ),
              ),
              Text(
                '${controller.impact.householdName}的真實成長值',
                style: const TextStyle(color: Color(0xFFBDD3C7)),
              ),
              const SizedBox(height: 18),
              LinearProgressIndicator(
                value: controller.impact.nextStageAt == null
                    ? 1
                    : (controller.impact.growthPoints /
                              controller.impact.nextStageAt!)
                          .clamp(0, 1),
                minHeight: 9,
                color: warmYellow,
                backgroundColor: const Color(0xFF3C715C),
              ),
              const SizedBox(height: 10),
              Text(
                '已進入公益紀錄：${controller.impact.contributedPoints} 點',
                style: const TextStyle(color: Colors.white),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        const _NoticeBand(
          icon: Icons.verified_user_outlined,
          text: '目前展示的是模擬換算，不代表已完成真實植樹，也不構成碳權。',
        ),
        const SizedBox(height: 18),
        const _SectionTitle(
          title: '公益紀錄',
          subtitle: '只呈現可追溯的真實資料，不用固定示範數字冒充成果',
        ),
        const SizedBox(height: 10),
        const _EmptyBlock(
          icon: Icons.eco_outlined,
          title: '尚未進入公益批次',
          text: '家庭樹成熟後，經合作單位建立可稽核的公益紀錄才會顯示在這裡。',
        ),
      ],
    );
  }
}

class DeviceScreen extends StatelessWidget {
  const DeviceScreen({required this.controller, super.key});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final device = controller.devices.firstOrNull;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
      children: [
        const _PageHeading(
          title: '陪伴互動樹',
          subtitle: '長者完成設定後，可以直接在樹上看任務、讀訊息與按鍵回應。',
        ),
        const SizedBox(height: 14),
        if (device == null)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(22),
              child: Column(
                children: [
                  const Icon(Icons.park_outlined, color: forest, size: 42),
                  const SizedBox(height: 8),
                  const Text(
                    '尚未綁定陪伴樹',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 5),
                  const Text(
                    'App 的任務、探索與家庭功能仍可獨立使用。',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: controller.scanForCompanionTrees,
                          icon: const Icon(Icons.bluetooth_searching_rounded),
                          label: const Text('搜尋裝置'),
                        ),
                      ),
                      const SizedBox(width: 9),
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: () => _showClaimDialog(context),
                          icon: const Icon(Icons.qr_code_scanner_rounded),
                          label: const Text('認領裝置'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        if (device != null)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCEBDF),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.park_rounded,
                          color: forest,
                          size: 38,
                        ),
                      ),
                      const SizedBox(width: 13),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              device.serialNumber,
                              style: const TextStyle(
                                color: Color(0xFF6B756F),
                                fontSize: 11,
                              ),
                            ),
                            Text(
                              device.name,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ],
                        ),
                      ),
                      _StatusPill(online: device.online),
                    ],
                  ),
                  const Divider(height: 30),
                  GridView.count(
                    crossAxisCount: 2,
                    childAspectRatio: 2.2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                    children: [
                      _SensorCell(
                        icon: Icons.thermostat_rounded,
                        label: '室溫',
                        value: '${device.temperatureC ?? '--'}°C',
                      ),
                      _SensorCell(
                        icon: Icons.water_drop_outlined,
                        label: '濕度',
                        value: '${device.humidityPercent ?? '--'}%',
                      ),
                      _SensorCell(
                        icon: Icons.light_mode_outlined,
                        label: '光照',
                        value: '${device.ambientLux ?? '--'} lux',
                      ),
                      _SensorCell(
                        icon: Icons.sensors_rounded,
                        label: '人在感測',
                        value: device.presence == true ? '有人靠近' : '待機',
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: controller.scanForCompanionTrees,
                          icon: const Icon(Icons.bluetooth_searching_rounded),
                          label: const Text('搜尋裝置'),
                        ),
                      ),
                      const SizedBox(width: 9),
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: () => _showClaimDialog(context),
                          icon: const Icon(Icons.qr_code_scanner_rounded),
                          label: const Text('認領裝置'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        if (controller.discoveredTrees.isNotEmpty) ...[
          const SizedBox(height: 16),
          const _SectionTitle(title: '附近裝置', subtitle: '選擇後會進入 Wi-Fi 配網流程'),
          const SizedBox(height: 8),
          ...controller.discoveredTrees.map(
            (name) => Card(
              child: ListTile(
                leading: const Icon(Icons.bluetooth_rounded, color: forest),
                title: Text(name),
                subtitle: const Text('訊號良好 · 尚未配網'),
                trailing: const Icon(Icons.chevron_right_rounded),
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        const _NoticeBand(
          icon: Icons.lock_outline_rounded,
          text: '陪伴樹沒有相機與麥克風，只回傳按鍵、裝置狀態與環境感測資料。',
        ),
      ],
    );
  }

  Future<void> _showClaimDialog(BuildContext context) async {
    final serial = TextEditingController();
    final code = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('認領陪伴樹'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: serial,
              decoration: const InputDecoration(labelText: '序號'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: code,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: '六位認領碼'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () async {
              await controller.claimDevice(serial.text, code.text);
              if (context.mounted) Navigator.pop(context);
            },
            child: const Text('認領'),
          ),
        ],
      ),
    );
    serial.dispose();
    code.dispose();
  }
}

class _TaskTile extends StatelessWidget {
  const _TaskTile({
    required this.task,
    required this.controller,
    this.expanded = false,
  });

  final DailyTask task;
  final AppController controller;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final completed = task.status == TaskStatus.completed;
    final verifying = task.status == TaskStatus.verifying;
    final supported =
        task.verificationMode == VerificationMode.photoAi ||
        task.verificationMode == VerificationMode.selfCheck ||
        task.verificationMode == VerificationMode.timer;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(15),
        child: Column(
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: _taskColor(task.verificationMode),
                    borderRadius: BorderRadius.circular(7),
                  ),
                  child: Icon(_taskIcon(task.verificationMode), color: ink),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        task.title,
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        task.description,
                        maxLines: expanded ? 3 : 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFF69736D),
                          height: 1.45,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '+${task.growthPoints}',
                  style: const TextStyle(
                    color: forest,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: completed
                  ? OutlinedButton.icon(
                      onPressed: null,
                      icon: const Icon(Icons.done_all_rounded),
                      label: const Text('已完成'),
                    )
                  : verifying
                  ? OutlinedButton.icon(
                      onPressed: null,
                      icon: const Icon(Icons.fact_check_outlined),
                      label: const Text('等待 AI／人工覆核'),
                    )
                  : !task.capabilityEnabled
                  ? OutlinedButton.icon(
                      onPressed: () => controller.photographTask(task),
                      icon: const Icon(Icons.lock_outline_rounded),
                      label: const Text('照片驗證服務尚未開放'),
                    )
                  : !supported
                  ? OutlinedButton.icon(
                      onPressed: null,
                      icon: const Icon(Icons.construction_rounded),
                      label: const Text('這類任務尚未開放'),
                    )
                  : task.verificationMode == VerificationMode.timer
                  ? _TimerTaskButton(task: task, controller: controller)
                  : FilledButton.icon(
                      onPressed: () async {
                        if (task.verificationMode == VerificationMode.photoAi) {
                          await controller.photographTask(task);
                          return;
                        }
                        final confirmed = await showDialog<bool>(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('確認完成任務'),
                            content: Text('你已完成「${task.title}」嗎？'),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(context, false),
                                child: const Text('還沒有'),
                              ),
                              FilledButton(
                                onPressed: () => Navigator.pop(context, true),
                                child: const Text('已完成'),
                              ),
                            ],
                          ),
                        );
                        if (confirmed == true) {
                          await controller.completeTask(task);
                        }
                      },
                      icon: Icon(
                        task.verificationMode == VerificationMode.photoAi
                            ? Icons.camera_alt_rounded
                            : Icons.check_circle_outline_rounded,
                      ),
                      label: Text(
                        task.verificationMode == VerificationMode.photoAi
                            ? '拍照完成任務'
                            : '我完成了',
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TimerTaskButton extends StatefulWidget {
  const _TimerTaskButton({required this.task, required this.controller});

  final DailyTask task;
  final AppController controller;

  @override
  State<_TimerTaskButton> createState() => _TimerTaskButtonState();
}

class _TimerTaskButtonState extends State<_TimerTaskButton> {
  Timer? timer;

  @override
  void initState() {
    super.initState();
    if (widget.task.startedAt != null) {
      timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void didUpdateWidget(covariant _TimerTaskButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.task.startedAt == null && widget.task.startedAt != null) {
      timer ??= Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final startedAt = widget.task.startedAt;
    if (startedAt == null) {
      return FilledButton.icon(
        onPressed: () => widget.controller.startTask(widget.task),
        icon: const Icon(Icons.timer_outlined),
        label: Text('開始 ${((widget.task.minimumSeconds ?? 0) / 60).ceil()} 分鐘'),
      );
    }
    final elapsed = DateTime.now().difference(startedAt).inSeconds;
    final remaining = (widget.task.minimumSeconds ?? 0) - elapsed;
    if (remaining <= 0) {
      return FilledButton.icon(
        onPressed: () => widget.controller.completeTask(widget.task),
        icon: const Icon(Icons.check_circle_outline_rounded),
        label: const Text('時間到了，完成任務'),
      );
    }
    final minutes = remaining ~/ 60;
    final seconds = remaining % 60;
    return OutlinedButton.icon(
      onPressed: null,
      icon: const Icon(Icons.timer_rounded),
      label: Text('$minutes:${seconds.toString().padLeft(2, '0')} 後可完成'),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    required this.title,
    required this.subtitle,
    this.action,
  });

  final String title;
  final String subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                subtitle,
                style: const TextStyle(color: Color(0xFF69736D), fontSize: 12),
              ),
            ],
          ),
        ),
        ?action,
      ],
    );
  }
}

class _PageHeading extends StatelessWidget {
  const _PageHeading({required this.title, required this.subtitle});
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 6),
        Text(
          subtitle,
          style: const TextStyle(color: Color(0xFF69736D), height: 1.5),
        ),
      ],
    );
  }
}

class _FilterPill extends StatelessWidget {
  const _FilterPill({required this.label, this.selected = false});
  final String label;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    );
  }
}

class _NoticeBand extends StatelessWidget {
  const _NoticeBand({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7DE),
        border: Border.all(color: const Color(0xFFE7D28C)),
        borderRadius: BorderRadius.circular(7),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: const Color(0xFF765F1D)),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(color: Color(0xFF765F1D), height: 1.45),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyBlock extends StatelessWidget {
  const _EmptyBlock({
    required this.icon,
    required this.title,
    required this.text,
  });
  final IconData icon;
  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Icon(icon, color: forest, size: 32),
            const SizedBox(height: 8),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Text(text, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.online});
  final bool online;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: online ? const Color(0xFFDAF0E2) : const Color(0xFFECEFED),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        online ? '在線' : '離線',
        style: TextStyle(
          color: online ? forest : const Color(0xFF66706A),
          fontSize: 11,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _SensorCell extends StatelessWidget {
  const _SensorCell({
    required this.icon,
    required this.label,
    required this.value,
  });
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: canvas,
        borderRadius: BorderRadius.circular(7),
      ),
      child: Row(
        children: [
          Icon(icon, color: forest, size: 22),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: Color(0xFF69736D),
                    fontSize: 10,
                  ),
                ),
                Text(
                  value,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

IconData _taskIcon(VerificationMode mode) => switch (mode) {
  VerificationMode.photoAi => Icons.photo_camera_outlined,
  VerificationMode.selfCheck => Icons.water_drop_outlined,
  VerificationMode.timer => Icons.directions_walk_rounded,
  VerificationMode.stepCount => Icons.directions_walk_outlined,
  VerificationMode.locationCheckIn => Icons.location_on_outlined,
  VerificationMode.deviceConfirm => Icons.touch_app_outlined,
};

Color _taskColor(VerificationMode mode) => switch (mode) {
  VerificationMode.photoAi => const Color(0xFFDCEBDF),
  VerificationMode.selfCheck => const Color(0xFFD7E6EF),
  VerificationMode.timer => const Color(0xFFF8E6B1),
  VerificationMode.stepCount => const Color(0xFFF8D2CB),
  VerificationMode.locationCheckIn => const Color(0xFFDDE1F0),
  VerificationMode.deviceConfirm => const Color(0xFFECE1F0),
};

String _stageLabel(String stage) => switch (stage) {
  'SEED' => '種子',
  'SPROUT' => '萌芽',
  'SEEDLING' => '幼苗',
  'YOUNG_TREE' => '小樹',
  'MATURE' => '成熟樹',
  _ => stage,
};
