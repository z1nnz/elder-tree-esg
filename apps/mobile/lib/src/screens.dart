// ignore_for_file: unused_element

import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:maplibre/maplibre.dart';

import 'app_controller.dart';
import 'exploration_map_config.dart';
import 'models.dart';
import 'theme.dart';

ui.ImageFilter get uiBlur => ui.ImageFilter.blur(sigmaX: 18, sigmaY: 18);

const double _nearbyDockCollapsedWidth = 104;
const double _nearbyDockCollapsedHeight = 96;
const double _missionCueDockClearance = 118;
const double _missionCueBottom = 128;
const double _missionSheetBottom = 118;

class HomeScreen extends StatelessWidget {
  const HomeScreen({
    required this.controller,
    required this.onOpenTasks,
    required this.onOpenExploration,
    required this.onOpenFamily,
    super.key,
  });

  final AppController controller;
  final VoidCallback onOpenTasks;
  final VoidCallback onOpenExploration;
  final VoidCallback onOpenFamily;

  @override
  Widget build(BuildContext context) {
    final home = controller.home;
    final homeTaskCards = home?.taskCards
        .where((card) => card.task.status != TaskStatus.completed)
        .toList();
    final fallbackTasks = controller.tasks
        .where((task) => task.status != TaskStatus.completed)
        .toList();
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
          _TodayCompanionHero(
            controller: controller,
            home: home,
            onOpenTasks: onOpenTasks,
            onOpenExploration: onOpenExploration,
            onOpenFamily: onOpenFamily,
          ),
          const SizedBox(height: 20),
          if (home?.alerts.isNotEmpty ?? false) ...[
            _HomeAlertStrip(alerts: home!.alerts),
            const SizedBox(height: 18),
          ],
          _SectionTitle(
            title: '任務卡堆疊',
            subtitle: '可開始、進行中、待覆核都放在這裡',
            action: TextButton(
              onPressed: onOpenTasks,
              child: const Text('查看全部'),
            ),
          ),
          const SizedBox(height: 10),
          if ((homeTaskCards ?? fallbackTasks).isEmpty)
            const _EmptyBlock(
              icon: Icons.done_all_rounded,
              title: '今天的任務完成了',
              text: '休息一下，看看家人留給你的訊息。',
            )
          else if (homeTaskCards != null)
            ...homeTaskCards
                .take(3)
                .map(
                  (card) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _HomeTaskCardTile(
                      card: card,
                      controller: controller,
                    ),
                  ),
                )
          else
            ...fallbackTasks
                .take(3)
                .map(
                  (task) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _TaskTile(task: task, controller: controller),
                  ),
                ),
          if (home?.featuredRadarMission != null) ...[
            const SizedBox(height: 8),
            _SectionTitle(
              title: '最近的城市任務',
              subtitle: '走近任務半徑後才會解鎖',
              action: TextButton(
                onPressed: onOpenExploration,
                child: const Text('去探索'),
              ),
            ),
            const SizedBox(height: 10),
            _HomeRadarPreview(
              mission: home!.featuredRadarMission!,
              onPressed: onOpenExploration,
            ),
          ],
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

class _TodayCompanionHero extends StatelessWidget {
  const _TodayCompanionHero({
    required this.controller,
    required this.home,
    required this.onOpenTasks,
    required this.onOpenExploration,
    required this.onOpenFamily,
  });

  final AppController controller;
  final HomeSummaryModel? home;
  final VoidCallback onOpenTasks;
  final VoidCallback onOpenExploration;
  final VoidCallback onOpenFamily;

  @override
  Widget build(BuildContext context) {
    final tree = home?.tree ?? controller.tree;
    final nextStage = tree.nextStageAt;
    final progress = nextStage == null
        ? 1.0
        : (tree.growthPoints / nextStage).clamp(0.0, 1.0);
    final action = home?.nextAction;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(30),
        gradient: const LinearGradient(
          colors: [Color(0xFF0F3B2A), Color(0xFF2B6A4D)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: forestDark.withValues(alpha: 0.24),
            blurRadius: 26,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      home == null ? '今日陪伴' : '${home!.displayName}，今天慢慢來',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 25,
                        height: 1.08,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      home?.activeHouseholdName ?? tree.householdName,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.72),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: lime,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        _stageLabel(tree.stage),
                        style: const TextStyle(
                          color: forestDark,
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              _CompanionSprite(sprite: home?.companionSprite),
            ],
          ),
          const SizedBox(height: 18),
          _AnimatedTreeProgress(
            progress: progress,
            growthPoints: tree.growthPoints,
            nextStage: nextStage,
          ),
          const SizedBox(height: 16),
          _HomeNextActionCard(
            action: action,
            onPressed: () => _handleNextAction(context, action),
          ),
        ],
      ),
    );
  }

  Future<void> _handleNextAction(
    BuildContext context,
    HomeNextActionModel? action,
  ) async {
    if (action == null) {
      onOpenTasks();
      return;
    }
    switch (action.kind) {
      case HomeNextActionKind.reviewPhoto:
      case HomeNextActionKind.readMessage:
        onOpenFamily();
      case HomeNextActionKind.startExploration:
        onOpenExploration();
      case HomeNextActionKind.takePhoto:
        final task = controller.taskById(action.taskId);
        if (task == null) return onOpenTasks();
        await controller.photographTask(task);
      case HomeNextActionKind.startTimer:
        final task = controller.taskById(action.taskId);
        if (task == null) return onOpenTasks();
        if (task.status == TaskStatus.available) {
          await controller.startTask(task);
        } else {
          onOpenTasks();
        }
      case HomeNextActionKind.completeTask:
        final task = controller.taskById(action.taskId);
        if (task == null) return onOpenTasks();
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
      case HomeNextActionKind.rest:
        onOpenTasks();
    }
  }
}

class _CompanionSprite extends StatelessWidget {
  const _CompanionSprite({required this.sprite});

  final CompanionSpriteStateModel? sprite;

  @override
  Widget build(BuildContext context) {
    final mood = sprite?.mood ?? CompanionSpriteMood.ready;
    final icon = switch (mood) {
      CompanionSpriteMood.walking => Icons.directions_walk_rounded,
      CompanionSpriteMood.waiting => Icons.hourglass_top_rounded,
      CompanionSpriteMood.resting => Icons.self_improvement_rounded,
      CompanionSpriteMood.growing => Icons.eco_rounded,
      CompanionSpriteMood.ready => Icons.auto_awesome_rounded,
    };
    return Column(
      children: [
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.92, end: 1),
          duration: const Duration(milliseconds: 680),
          curve: Curves.easeOutBack,
          builder: (context, value, child) =>
              Transform.scale(scale: value, child: child),
          child: Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: lime,
              boxShadow: [
                BoxShadow(
                  color: lime.withValues(alpha: 0.38),
                  blurRadius: 26,
                  spreadRadius: 4,
                ),
              ],
            ),
            child: Icon(icon, color: forestDark, size: 34),
          ),
        ),
        const SizedBox(height: 7),
        SizedBox(
          width: 92,
          child: Text(
            sprite?.label ?? '小葉靈在這裡',
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.76),
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }
}

class _HomeNextActionCard extends StatelessWidget {
  const _HomeNextActionCard({required this.action, required this.onPressed});

  final HomeNextActionModel? action;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Color(0xFFE7F66A),
            ),
            child: Icon(_homeActionIcon(action?.kind), color: forestDark),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  action?.title ?? '今天可以做一件小事',
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  action?.description ?? '選一件舒服的任務，讓生命樹慢慢長大。',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF5E6A63),
                    height: 1.4,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          FilledButton(
            onPressed: onPressed,
            child: Text(action?.ctaLabel ?? '開始'),
          ),
        ],
      ),
    );
  }
}

class _HomeAlertStrip extends StatelessWidget {
  const _HomeAlertStrip({required this.alerts});

  final List<HomeAlertModel> alerts;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 74,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: alerts.length,
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final alert = alerts[index];
          return Container(
            width: 210,
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF8E3),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE8D8AA)),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: warmYellow,
                  foregroundColor: ink,
                  child: Text('${alert.count}'),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        alert.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                      Text(
                        alert.description,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFF68746D),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _HomeRadarPreview extends StatelessWidget {
  const _HomeRadarPreview({required this.mission, required this.onPressed});

  final RadarMissionModel mission;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.all(14),
        leading: CircleAvatar(
          backgroundColor: _radarAccentColor(mission).withValues(alpha: 0.16),
          foregroundColor: _radarAccentColor(mission),
          child: Icon(_radarIcon(mission)),
        ),
        title: Text(
          mission.title,
          style: const TextStyle(fontWeight: FontWeight.w900),
        ),
        subtitle: Text(
          '半徑 ${mission.radiusMeters}m · 生命樹 +${mission.growthPoints}',
        ),
        trailing: FilledButton(onPressed: onPressed, child: const Text('查看')),
      ),
    );
  }
}

class _AnimatedTreeProgress extends StatelessWidget {
  const _AnimatedTreeProgress({
    required this.progress,
    required this.growthPoints,
    required this.nextStage,
  });

  final double progress;
  final int growthPoints;
  final int? nextStage;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TweenAnimationBuilder<double>(
          tween: Tween<double>(end: progress),
          duration: const Duration(milliseconds: 850),
          curve: Curves.easeOutCubic,
          builder: (context, value, child) => Stack(
            clipBehavior: Clip.none,
            children: [
              LinearProgressIndicator(
                value: value,
                minHeight: 11,
                borderRadius: BorderRadius.circular(7),
                backgroundColor: Colors.white24,
                color: warmYellow,
              ),
              Positioned(
                left: (MediaQuery.sizeOf(context).width - 72) * value,
                top: -12,
                child: Transform.scale(
                  scale: 0.86 + (value * 0.18),
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: warmYellow,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: warmYellow.withValues(alpha: 0.45),
                          blurRadius: 18,
                          spreadRadius: 3,
                        ),
                      ],
                    ),
                    child: const Icon(Icons.eco_rounded, color: ink, size: 17),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 320),
          child: Text(
            nextStage == null
                ? '這棵樹已經成熟'
                : '再 ${(nextStage! - growthPoints).clamp(0, nextStage!)} 點進入下一階段',
            key: ValueKey('$growthPoints-$nextStage'),
            style: const TextStyle(color: Colors.white, fontSize: 12),
          ),
        ),
      ],
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
  const ExplorationScreen({
    required this.controller,
    required this.onNavigate,
    super.key,
  });

  final AppController controller;
  final ValueChanged<int> onNavigate;

  static const mapStyleUrl = String.fromEnvironment(
    'MAP_STYLE_URL',
    defaultValue: 'https://tiles.openfreemap.org/styles/liberty',
  );

  @override
  State<ExplorationScreen> createState() => _ExplorationScreenState();
}

class _ExplorationScreenState extends State<ExplorationScreen> {
  ExplorationMapMode _mapMode = ExplorationMapMode.adventure;
  String? _selectedRadarMissionId;
  bool _nearbyPanelOpen = false;
  bool _treeMenuOpen = false;
  bool _missionSheetOpen = false;
  bool _cameraOutOfRange = false;
  bool _recenteringMap = false;
  MapController? _mapController;

  AppController get controller => widget.controller;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(controller.startExploration());
    });
  }

  @override
  Widget build(BuildContext context) {
    final pointQuests = controller.exploration.quests
        .where((quest) => quest.latitude != null && quest.longitude != null)
        .toList();
    final radarMissionViews = controller.radarMissionViews;
    final mapPresentation = explorationMapPresentation(
      _mapMode,
      streetStyleUrl: ExplorationScreen.mapStyleUrl,
    );
    RadarMissionViewState? selectedMission;
    for (final view in radarMissionViews) {
      if (view.mission.id == _selectedRadarMissionId) {
        selectedMission = view;
        break;
      }
    }
    final featuredMission =
        selectedMission ?? controller.featuredRadarMissionView;
    final safeTop = MediaQuery.paddingOf(context).top;
    final safeBottom = MediaQuery.paddingOf(context).bottom;
    final hasCurrentLocation =
        controller.latestLatitude != null && controller.latestLongitude != null;
    final mapCenter = hasCurrentLocation
        ? Geographic(
            lon: controller.latestLongitude!,
            lat: controller.latestLatitude!,
          )
        : const Geographic(lon: 121.5362, lat: 25.0316);
    final selectedMissionForSheet = selectedMission ?? featuredMission;
    final selectedMissionScreenBearing =
        hasCurrentLocation && selectedMissionForSheet != null
        ? _bearingRadians(
                controller.latestLatitude!,
                controller.latestLongitude!,
                selectedMissionForSheet.mission.latitude,
                selectedMissionForSheet.mission.longitude,
              ) -
              _degreesToRadians(mapPresentation.bearing)
        : null;
    final visibleRadarMissionViews = _visibleRadarMissionViews(
      radarMissionViews,
      selectedMissionId: _selectedRadarMissionId,
      featuredMissionId: featuredMission?.mission.id,
    );
    return Stack(
      fit: StackFit.expand,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: _mapMode == ExplorationMapMode.adventure
                  ? const [Color(0xFFDDF6E8), Color(0xFFFFF2C8)]
                  : const [Color(0xFFF3F7F2), Color(0xFFE8F1EC)],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
        ),
        Positioned.fill(
          child: MapLibreMap(
            key: ValueKey(
              '$_mapMode-${hasCurrentLocation ? "located" : "city"}',
            ),
            options: MapOptions(
              initStyle: mapPresentation.style,
              initCenter: mapCenter,
              initZoom: mapPresentation.zoom,
              initPitch: mapPresentation.pitch,
              initBearing: mapPresentation.bearing,
              minZoom: 14.2,
              maxZoom: 18.8,
              maxPitch: 60,
              gestures: const MapGestures.all(),
            ),
            onMapCreated: (controller) => _mapController = controller,
            onEvent: _handleMapEvent,
            layers: const [],
            children: [
              WidgetLayer(
                markers: [
                  ...pointQuests.map(
                    (quest) => Marker(
                      point: Geographic(
                        lon: quest.longitude!,
                        lat: quest.latitude!,
                      ),
                      size: const Size(76, 96),
                      alignment: Alignment.bottomCenter,
                      child: _QuestBeacon(quest: quest),
                    ),
                  ),
                  ...visibleRadarMissionViews.map(
                    (view) => Marker(
                      point: Geographic(
                        lon: view.mission.longitude,
                        lat: view.mission.latitude,
                      ),
                      size: view.mission.id == featuredMission?.mission.id
                          ? const Size(126, 138)
                          : const Size(92, 112),
                      alignment: Alignment.bottomCenter,
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => _selectRadarMission(view),
                        child: _RadarBeacon(
                          view: view,
                          featured:
                              view.mission.id == featuredMission?.mission.id,
                        ),
                      ),
                    ),
                  ),
                  if (controller.latestLatitude != null &&
                      controller.latestLongitude != null)
                    Marker(
                      point: Geographic(
                        lon: controller.latestLongitude!,
                        lat: controller.latestLatitude!,
                      ),
                      size: const Size(94, 112),
                      alignment: Alignment.bottomCenter,
                      child: const _ExplorerAvatar(),
                    ),
                ],
              ),
              const SourceAttribution(),
            ],
          ),
        ),
        const _AdventureMapOverlay(),
        if (!_treeMenuOpen &&
            _selectedRadarMissionId != null &&
            selectedMissionForSheet != null &&
            selectedMissionScreenBearing != null)
          Positioned.fill(
            child: IgnorePointer(
              child: _MissionDirectionBeam(
                angle: selectedMissionScreenBearing,
                color: _radarAccentColor(selectedMissionForSheet.mission),
              ),
            ),
          ),
        Positioned(
          left: 14,
          top: 12 + safeTop,
          child: _CompactMapStatusCapsule(
            contextModel: controller.context,
            tree: controller.tree,
            hasLocation: hasCurrentLocation,
            locationStatus: hasCurrentLocation
                ? controller.explorationLocationStatus
                : '模擬器定位未設定，先以大安森林公園示範',
          ),
        ),
        if (_cameraOutOfRange)
          const Positioned.fill(child: IgnorePointer(child: _MapScopeFog())),
        if (controller.latestLatitude == null)
          const Positioned(
            left: 18,
            right: 18,
            top: 198,
            child: IgnorePointer(child: _SimulatorLocationNotice()),
          ),
        if (controller.lastGrowthAwardPoints != null)
          Positioned(
            left: 14,
            right: 14,
            top: 136 + safeTop,
            child: _GrowthCelebrationBand(
              title: controller.lastGrowthAwardTitle ?? '城市任務',
              points: controller.lastGrowthAwardPoints!,
            ),
          ),
        if (!_treeMenuOpen &&
            !_nearbyPanelOpen &&
            selectedMissionForSheet != null &&
            !_missionSheetOpen)
          Positioned(
            left: 14,
            right: _missionCueDockClearance,
            bottom: _missionCueBottom + safeBottom,
            child: _MissionNavigationCueCard(
              view: selectedMissionForSheet,
              screenBearingRadians: selectedMissionScreenBearing,
              onFocus: () => _focusRadarMission(selectedMissionForSheet),
            ),
          ),
        if (!_treeMenuOpen &&
            !_nearbyPanelOpen &&
            selectedMissionForSheet != null &&
            _missionSheetOpen)
          Positioned(
            left: 14,
            right: 14,
            bottom: _missionSheetBottom + safeBottom,
            child: _MissionDetailPanel(
              view: selectedMissionForSheet,
              onClose: () => setState(() => _missionSheetOpen = false),
              onFocus: () => _focusRadarMission(selectedMissionForSheet),
              onComplete: selectedMissionForSheet.mission.isCompleted
                  ? null
                  : () => _confirmCompleteRadarMission(selectedMissionForSheet),
            ),
          ),
        if (!_missionSheetOpen)
          Positioned(
            right: 14,
            bottom: 122 + safeBottom,
            child: AnimatedScale(
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOutCubic,
              scale: _treeMenuOpen ? 0.92 : 1,
              child: AnimatedOpacity(
                duration: const Duration(milliseconds: 160),
                opacity: _treeMenuOpen ? 0 : 1,
                child: IgnorePointer(
                  ignoring: _treeMenuOpen,
                  child: _NearbyMissionDock(
                    missions: radarMissionViews,
                    selectedMissionId: _selectedRadarMissionId,
                    expanded: _nearbyPanelOpen,
                    onToggle: _toggleNearbyPanel,
                    onSelect: _selectRadarMission,
                  ),
                ),
              ),
            ),
          ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 20 + safeBottom,
          child: Center(
            child: _TreeCoreMenu(
              expanded: _treeMenuOpen,
              onToggle: _toggleTreeMenu,
              onNavigate: (index) {
                setState(() => _treeMenuOpen = false);
                widget.onNavigate(index);
              },
              onSettings: _showSettingsSheet,
            ),
          ),
        ),
      ],
    );
  }

  void _selectRadarMission(RadarMissionViewState view) {
    setState(() {
      _selectedRadarMissionId = view.mission.id;
      _missionSheetOpen = true;
      _nearbyPanelOpen = false;
      _treeMenuOpen = false;
    });
    unawaited(_focusRadarMission(view));
  }

  void _toggleNearbyPanel() {
    setState(() {
      _nearbyPanelOpen = !_nearbyPanelOpen;
      if (_nearbyPanelOpen) {
        _treeMenuOpen = false;
        _missionSheetOpen = false;
      }
    });
  }

  void _toggleTreeMenu() {
    setState(() {
      _treeMenuOpen = !_treeMenuOpen;
      if (_treeMenuOpen) {
        _nearbyPanelOpen = false;
        _missionSheetOpen = false;
      }
    });
  }

  Future<void> _focusRadarMission(RadarMissionViewState view) async {
    await _mapController?.animateCamera(
      center: Geographic(
        lon: view.mission.longitude,
        lat: view.mission.latitude,
      ),
      zoom: 17,
      pitch: 42,
      bearing: 18,
      nativeDuration: const Duration(milliseconds: 650),
    );
  }

  void _handleMapEvent(MapEvent event) {
    if (event is! MapEventMoveCamera) return;
    final playerLat = controller.latestLatitude ?? 25.0316;
    final playerLng = controller.latestLongitude ?? 121.5362;
    final distance = _haversineMeters(
      playerLat,
      playerLng,
      event.camera.center.lat,
      event.camera.center.lon,
    );
    final outOfRange = distance > 850;
    if (outOfRange != _cameraOutOfRange && mounted) {
      setState(() => _cameraOutOfRange = outOfRange);
    }
    if (distance > 1250 && !_recenteringMap) {
      _recenteringMap = true;
      unawaited(
        _mapController
            ?.animateCamera(
              center: Geographic(lon: playerLng, lat: playerLat),
              zoom: event.camera.zoom.clamp(14.8, 17.4).toDouble(),
              pitch: event.camera.pitch,
              bearing: event.camera.bearing,
              nativeDuration: const Duration(milliseconds: 520),
            )
            .whenComplete(() {
              _recenteringMap = false;
              if (mounted) setState(() => _cameraOutOfRange = false);
            }),
      );
    }
  }

  void _showSettingsSheet() {
    setState(() => _treeMenuOpen = false);
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '地圖設定',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 12),
              _MapModeSwitch(
                mode: _mapMode,
                onChanged: (mode) {
                  setState(() => _mapMode = mode);
                  Navigator.pop(context);
                },
              ),
              const SizedBox(height: 12),
              const _NoticeBand(
                icon: Icons.touch_app_rounded,
                text: '地圖可用雙指縮放與拖曳；拖太遠時會自動回到你附近。',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _confirmCompleteRadarMission(RadarMissionViewState view) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('完成雷達任務'),
        content: Text('確認完成「${view.mission.title}」，讓生命樹長出新葉嗎？'),
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
      await controller.completeRadarMission(view.mission);
    }
  }
}

class _CompactMapStatusCapsule extends StatelessWidget {
  const _CompactMapStatusCapsule({
    required this.contextModel,
    required this.tree,
    required this.locationStatus,
    required this.hasLocation,
  });

  final AppContextModel? contextModel;
  final TreeSummary tree;
  final String locationStatus;
  final bool hasLocation;

  @override
  Widget build(BuildContext context) {
    final householdName =
        contextModel?.activeHousehold.name ?? tree.householdName;
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 278),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: BackdropFilter(
          filter: uiBlur,
          child: Container(
            padding: const EdgeInsets.fromLTRB(10, 9, 13, 9),
            decoration: BoxDecoration(
              color: forestDark.withValues(alpha: 0.78),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.18),
                  blurRadius: 18,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: hasLocation ? lime : warmYellow,
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: Icon(
                    hasLocation
                        ? Icons.navigation_rounded
                        : Icons.location_searching_rounded,
                    color: forestDark,
                    size: 21,
                  ),
                ),
                const SizedBox(width: 9),
                Flexible(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        householdName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        locationStatus,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.72),
                          fontWeight: FontWeight.w700,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AdventureModeChip extends StatelessWidget {
  const _AdventureModeChip({required this.mode, required this.onChanged});

  final ExplorationMapMode mode;
  final ValueChanged<ExplorationMapMode> onChanged;

  @override
  Widget build(BuildContext context) {
    final adventure = mode == ExplorationMapMode.adventure;
    return GestureDetector(
      onTap: () => onChanged(
        adventure ? ExplorationMapMode.street : ExplorationMapMode.adventure,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: BackdropFilter(
          filter: uiBlur,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.88),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: forest.withValues(alpha: 0.16)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  adventure ? Icons.auto_awesome_rounded : Icons.map_rounded,
                  color: forest,
                  size: 18,
                ),
                const SizedBox(width: 6),
                Text(
                  adventure ? '遊戲視角' : '真實道路',
                  style: const TextStyle(
                    color: forestDark,
                    fontWeight: FontWeight.w900,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MapScopeFog extends StatelessWidget {
  const _MapScopeFog();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: RadialGradient(
          colors: [
            Colors.transparent,
            forestDark.withValues(alpha: 0.1),
            forestDark.withValues(alpha: 0.34),
          ],
          stops: const [0.46, 0.74, 1],
        ),
      ),
      child: Align(
        alignment: Alignment.topCenter,
        child: Padding(
          padding: EdgeInsets.only(top: MediaQuery.paddingOf(context).top + 94),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
            decoration: BoxDecoration(
              color: forestDark.withValues(alpha: 0.82),
              borderRadius: BorderRadius.circular(999),
            ),
            child: const Text(
              '你離探索範圍有點遠，地圖會帶你回到附近。',
              style: TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SimulatorLocationNotice extends StatelessWidget {
  const _SimulatorLocationNotice();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.92),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: warmYellow.withValues(alpha: 0.55)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.12),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.info_outline_rounded, color: forest, size: 18),
            SizedBox(width: 7),
            Text(
              '目前用大安森林公園示範位置',
              style: TextStyle(
                color: forestDark,
                fontWeight: FontWeight.w900,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NearbyMissionDock extends StatelessWidget {
  const _NearbyMissionDock({
    required this.missions,
    required this.selectedMissionId,
    required this.expanded,
    required this.onToggle,
    required this.onSelect,
  });

  final List<RadarMissionViewState> missions;
  final String? selectedMissionId;
  final bool expanded;
  final VoidCallback onToggle;
  final ValueChanged<RadarMissionViewState> onSelect;

  @override
  Widget build(BuildContext context) {
    final nearest = missions.isEmpty ? null : missions.first;
    final actionable = missions
        .where(
          (view) =>
              view.mission.status == 'UNLOCKED' ||
              view.adventureState == AdventureMissionState.insideRadius ||
              view.adventureState == AdventureMissionState.readyToComplete,
        )
        .length;
    final screenWidth = MediaQuery.sizeOf(context).width;
    final expandedWidth = math.min(screenWidth - 28, 340.0);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 240),
      curve: Curves.easeOutCubic,
      width: expanded ? expandedWidth : _nearbyDockCollapsedWidth,
      constraints: BoxConstraints(
        maxHeight: expanded ? 414 : _nearbyDockCollapsedHeight,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: expanded
              ? [
                  forestDark.withValues(alpha: 0.96),
                  const Color(0xFF114D42).withValues(alpha: 0.92),
                ]
              : [
                  Colors.white.withValues(alpha: 0.92),
                  const Color(0xFFE4FFD3).withValues(alpha: 0.86),
                ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(expanded ? 28 : 34),
        border: Border.all(
          color: expanded
              ? Colors.white.withValues(alpha: 0.2)
              : forestDark.withValues(alpha: 0.12),
        ),
        boxShadow: [
          BoxShadow(
            color: forestDark.withValues(alpha: expanded ? 0.36 : 0.2),
            blurRadius: expanded ? 30 : 20,
            offset: const Offset(0, 16),
          ),
          if (!expanded)
            BoxShadow(
              color: lime.withValues(alpha: 0.24),
              blurRadius: 24,
              spreadRadius: 2,
            ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(expanded ? 28 : 32),
          onTap: expanded ? null : onToggle,
          child: Padding(
            padding: EdgeInsets.all(expanded ? 13 : 9),
            child: expanded
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.radar_rounded, color: lime),
                          const SizedBox(width: 8),
                          const Expanded(
                            child: Text(
                              '附近任務',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                fontSize: 18,
                              ),
                            ),
                          ),
                          IconButton(
                            onPressed: onToggle,
                            icon: const Icon(
                              Icons.close_rounded,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                      if (nearest != null) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(11),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color: lime.withValues(alpha: 0.22),
                            ),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.navigation_rounded,
                                color: lime,
                                size: 18,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  '最近：${nearest.mission.title} · ${nearest.distanceLabel}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 9),
                      ],
                      const SizedBox(height: 8),
                      if (missions.isEmpty)
                        Text(
                          '附近還沒有任務，稍後重新整理看看。',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.72),
                            fontWeight: FontWeight.w700,
                          ),
                        )
                      else
                        Flexible(
                          child: ListView(
                            shrinkWrap: true,
                            padding: EdgeInsets.zero,
                            children: missions
                                .take(6)
                                .map(
                                  (view) => _NearbyMissionTile(
                                    view: view,
                                    selected:
                                        view.mission.id == selectedMissionId,
                                    onTap: () => onSelect(view),
                                  ),
                                )
                                .toList(),
                          ),
                        ),
                    ],
                  )
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFFCFFF61), Color(0xFF88E77A)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.9),
                            width: 3,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: lime.withValues(alpha: 0.42),
                              blurRadius: 22,
                              spreadRadius: 1,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.radar_rounded,
                          color: forestDark,
                          size: 25,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        actionable > 0 ? '$actionable 可接' : '附近',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: forestDark,
                          fontWeight: FontWeight.w900,
                          fontSize: 12,
                        ),
                      ),
                      if (nearest != null)
                        Text(
                          nearest.distanceLabel,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: forestDark.withValues(alpha: 0.62),
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class _NearbyMissionTile extends StatelessWidget {
  const _NearbyMissionTile({
    required this.view,
    required this.selected,
    required this.onTap,
  });

  final RadarMissionViewState view;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final mission = view.mission;
    final accent = _radarAccentColor(mission);
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.all(11),
          decoration: BoxDecoration(
            color: selected
                ? lime.withValues(alpha: 0.2)
                : Colors.white.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: selected ? lime : Colors.white.withValues(alpha: 0.12),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.22),
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Icon(_radarIcon(mission), color: lime, size: 22),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      mission.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${view.distanceLabel} · ${view.stateLabel}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.66),
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 180),
                child: selected
                    ? Container(
                        key: const ValueKey('guiding'),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.near_me_rounded,
                              color: Colors.white,
                              size: 14,
                            ),
                            SizedBox(width: 4),
                            Text(
                              '導引',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      )
                    : Text(
                        '+${mission.growthPoints}',
                        key: const ValueKey('points'),
                        style: const TextStyle(
                          color: warmYellow,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MissionNavigationCueCard extends StatelessWidget {
  const _MissionNavigationCueCard({
    required this.view,
    required this.onFocus,
    this.screenBearingRadians,
  });

  final RadarMissionViewState view;
  final VoidCallback onFocus;
  final double? screenBearingRadians;

  @override
  Widget build(BuildContext context) {
    final accent = _radarAccentColor(view.mission);
    return ClipRRect(
      borderRadius: BorderRadius.circular(22),
      child: BackdropFilter(
        filter: uiBlur,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.88),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: accent.withValues(alpha: 0.28)),
          ),
          child: Row(
            children: [
              Transform.rotate(
                angle: screenBearingRadians ?? -0.55,
                child: Icon(Icons.navigation_rounded, color: accent),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  '${view.mission.title} · ${view.distanceLabel} · ${view.helperText}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: forestDark,
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                  ),
                ),
              ),
              TextButton.icon(
                onPressed: onFocus,
                icon: const Icon(Icons.my_location_rounded, size: 16),
                label: const Text('帶我過去'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MissionDetailPanel extends StatefulWidget {
  const _MissionDetailPanel({
    required this.view,
    required this.onClose,
    required this.onFocus,
    required this.onComplete,
  });

  final RadarMissionViewState view;
  final VoidCallback onClose;
  final VoidCallback onFocus;
  final VoidCallback? onComplete;

  @override
  State<_MissionDetailPanel> createState() => _MissionDetailPanelState();
}

class _MissionDetailPanelState extends State<_MissionDetailPanel> {
  Timer? _timer;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _syncTimer();
  }

  @override
  void didUpdateWidget(covariant _MissionDetailPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.view.mission.id != widget.view.mission.id ||
        oldWidget.view.mission.unlockedAt != widget.view.mission.unlockedAt ||
        oldWidget.view.mission.status != widget.view.mission.status) {
      _syncTimer();
    }
  }

  void _syncTimer() {
    _timer?.cancel();
    _now = DateTime.now();
    if (widget.view.mission.isTimer &&
        widget.view.mission.status == 'UNLOCKED') {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!mounted) return;
        setState(() => _now = DateTime.now());
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mission = widget.view.mission;
    final accent = _radarAccentColor(mission);
    final timerRemaining = mission.timerRemainingAt(_now);
    final canComplete =
        mission.canCompleteAt(_now) && widget.onComplete != null;
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: accent.withValues(alpha: 0.24)),
        boxShadow: [
          BoxShadow(
            color: forestDark.withValues(alpha: 0.2),
            blurRadius: 26,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(17),
                ),
                child: Icon(_radarIcon(mission), color: accent),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      mission.title,
                      style: const TextStyle(
                        color: ink,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${widget.view.distanceLabel} · 半徑 ${mission.radiusMeters}m · +${mission.growthPoints} 新葉',
                      style: const TextStyle(
                        color: Color(0xFF66706A),
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: widget.onClose,
                icon: const Icon(Icons.close_rounded),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            mission.description,
            style: const TextStyle(
              color: Color(0xFF516058),
              height: 1.45,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: widget.onFocus,
                  icon: const Icon(Icons.near_me_rounded),
                  label: const Text('導航到任務點'),
                ),
              ),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 11,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: accent.withValues(alpha: 0.2)),
                ),
                child: Text(
                  widget.view.stateLabel,
                  style: TextStyle(
                    color: accent,
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: mission.isCompleted
                ? OutlinedButton.icon(
                    onPressed: null,
                    icon: const Icon(Icons.done_all_rounded),
                    label: const Text('已完成，生命樹已長出新葉'),
                  )
                : FilledButton.icon(
                    onPressed: canComplete ? widget.onComplete : null,
                    icon: Icon(
                      mission.isTimer && timerRemaining > Duration.zero
                          ? Icons.hourglass_bottom_rounded
                          : Icons.check_circle_outline_rounded,
                    ),
                    label: Text(
                      mission.isTimer && timerRemaining > Duration.zero
                          ? '還需 ${_formatDuration(timerRemaining)}'
                          : mission.status == 'UNLOCKED'
                          ? '我完成了'
                          : widget.view.primaryActionLabel,
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _TreeCoreMenu extends StatelessWidget {
  const _TreeCoreMenu({
    required this.expanded,
    required this.onToggle,
    required this.onNavigate,
    required this.onSettings,
  });

  final bool expanded;
  final VoidCallback onToggle;
  final ValueChanged<int> onNavigate;
  final VoidCallback onSettings;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 330,
      height: expanded ? 198 : 96,
      child: Stack(
        alignment: Alignment.bottomCenter,
        children: [
          AnimatedOpacity(
            opacity: expanded ? 1 : 0,
            duration: const Duration(milliseconds: 180),
            child: IgnorePointer(
              ignoring: !expanded,
              child: Container(
                width: 278,
                height: 148,
                margin: const EdgeInsets.only(bottom: 30),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  gradient: RadialGradient(
                    colors: [
                      lime.withValues(alpha: 0.18),
                      forestDark.withValues(alpha: 0.1),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ),
          AnimatedOpacity(
            opacity: expanded ? 1 : 0,
            duration: const Duration(milliseconds: 180),
            child: IgnorePointer(
              ignoring: !expanded,
              child: Stack(
                alignment: Alignment.bottomCenter,
                children: [
                  _TreeMenuLeaf(
                    label: '今天',
                    icon: Icons.home_rounded,
                    offset: const Offset(-128, -48),
                    onTap: () => onNavigate(0),
                  ),
                  _TreeMenuLeaf(
                    label: '任務',
                    icon: Icons.checklist_rounded,
                    offset: const Offset(-78, -102),
                    onTap: () => onNavigate(1),
                  ),
                  _TreeMenuLeaf(
                    label: '生命樹',
                    icon: Icons.park_rounded,
                    offset: const Offset(0, -128),
                    onTap: () => onNavigate(5),
                  ),
                  _TreeMenuLeaf(
                    label: '家人',
                    icon: Icons.family_restroom_rounded,
                    offset: const Offset(78, -102),
                    onTap: () => onNavigate(3),
                  ),
                  _TreeMenuLeaf(
                    label: '公益',
                    icon: Icons.public_rounded,
                    offset: const Offset(128, -48),
                    onTap: () => onNavigate(4),
                  ),
                  _TreeMenuLeaf(
                    label: '設定',
                    icon: Icons.settings_rounded,
                    offset: const Offset(0, -58),
                    onTap: onSettings,
                  ),
                ],
              ),
            ),
          ),
          GestureDetector(
            onTap: onToggle,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              width: expanded ? 84 : 78,
              height: expanded ? 84 : 78,
              decoration: BoxDecoration(
                gradient: expanded
                    ? const LinearGradient(
                        colors: [Colors.white, Color(0xFFE9FFD6)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      )
                    : const LinearGradient(
                        colors: [Color(0xFFD8FF66), Color(0xFF72E082)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 5),
                boxShadow: [
                  BoxShadow(
                    color: lime.withValues(alpha: 0.42),
                    blurRadius: 28,
                    offset: const Offset(0, 12),
                  ),
                ],
              ),
              child: Icon(
                expanded ? Icons.close_rounded : Icons.eco_rounded,
                color: forestDark,
                size: 36,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TreeMenuLeaf extends StatelessWidget {
  const _TreeMenuLeaf({
    required this.label,
    required this.icon,
    required this.offset,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Offset offset;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Transform.translate(
      offset: offset,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 68,
          height: 56,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Colors.white.withValues(alpha: 0.98),
                const Color(0xFFEFFFF3).withValues(alpha: 0.92),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(28),
              topRight: Radius.circular(20),
              bottomLeft: Radius.circular(20),
              bottomRight: Radius.circular(28),
            ),
            border: Border.all(color: forest.withValues(alpha: 0.16)),
            boxShadow: [
              BoxShadow(
                color: forestDark.withValues(alpha: 0.16),
                blurRadius: 20,
                offset: const Offset(0, 9),
              ),
            ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: forest, size: 22),
              const SizedBox(height: 2),
              Text(
                label,
                style: const TextStyle(
                  color: forestDark,
                  fontWeight: FontWeight.w900,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AdventureMapHud extends StatelessWidget {
  const _AdventureMapHud({
    required this.active,
    required this.contextModel,
    required this.tree,
    required this.route,
    required this.routeProgress,
    required this.radarCount,
    required this.unlockedCount,
    required this.locationStatus,
  });

  final bool active;
  final AppContextModel? contextModel;
  final TreeSummary tree;
  final ExplorationRouteModel? route;
  final double routeProgress;
  final int radarCount;
  final int unlockedCount;
  final String locationStatus;

  @override
  Widget build(BuildContext context) {
    final householdName =
        contextModel?.activeHousehold.name ?? tree.householdName;
    final routeName = route?.name ?? '台北任務雷達';
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: forestDark.withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.22),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: lime,
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: [
                    BoxShadow(
                      color: lime.withValues(alpha: 0.32),
                      blurRadius: 18,
                      spreadRadius: 1,
                    ),
                  ],
                ),
                child: const Icon(Icons.explore_rounded, color: forestDark),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 6,
                      runSpacing: 5,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          active ? '地圖定位中' : '溫柔冒險',
                          style: const TextStyle(
                            color: lime,
                            fontSize: 12,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        Text(
                          householdName,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.72),
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      routeName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 21,
                        fontWeight: FontWeight.w900,
                        height: 1.05,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      locationStatus,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.68),
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              _HudMetric(label: '任務', value: '$radarCount'),
              const SizedBox(width: 6),
              _HudMetric(label: '可接', value: '$unlockedCount'),
              const SizedBox(width: 6),
              _HudMetric(label: '樹', value: '+${tree.growthPoints}'),
            ],
          ),
          if (route != null) ...[
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: routeProgress,
                minHeight: 6,
                color: lime,
                backgroundColor: Colors.white.withValues(alpha: 0.16),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _HudMetric extends StatelessWidget {
  const _HudMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 46),
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.13)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.62),
              fontSize: 10,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _AdventureBottomSheet extends StatelessWidget {
  const _AdventureBottomSheet({
    required this.controller,
    required this.distanceMeters,
    required this.exploring,
    required this.hasSession,
    required this.sendingLocation,
    required this.locationStatus,
    required this.mission,
    required this.radarMissionViews,
    required this.totalRadarMissionCount,
    required this.showAllRadarMissions,
    required this.route,
    required this.routeProgress,
    required this.showRouteDetails,
    required this.scrollController,
    required this.onCompleteMission,
    required this.onMissionSelected,
    required this.onToggleRadarMissions,
    required this.onToggleRouteDetails,
  });

  final AppController controller;
  final int distanceMeters;
  final bool exploring;
  final bool hasSession;
  final bool sendingLocation;
  final String locationStatus;
  final RadarMissionViewState? mission;
  final List<RadarMissionViewState> radarMissionViews;
  final int totalRadarMissionCount;
  final bool showAllRadarMissions;
  final ExplorationRouteModel? route;
  final double routeProgress;
  final bool showRouteDetails;
  final ScrollController scrollController;
  final VoidCallback? onCompleteMission;
  final ValueChanged<RadarMissionViewState> onMissionSelected;
  final VoidCallback? onToggleRadarMissions;
  final VoidCallback? onToggleRouteDetails;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: canvas,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        boxShadow: [
          BoxShadow(
            color: forestDark.withValues(alpha: 0.22),
            blurRadius: 28,
            offset: const Offset(0, -12),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: ListView(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 28),
          children: [
            Center(
              child: Container(
                width: 48,
                height: 5,
                decoration: BoxDecoration(
                  color: forestDark.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            const SizedBox(height: 12),
            _ExplorationMissionDock(
              distanceMeters: distanceMeters,
              exploring: exploring,
              hasSession: hasSession,
              sendingLocation: sendingLocation,
              locationStatus: locationStatus,
              mission: mission,
              onCompleteMission: onCompleteMission,
            ),
            const SizedBox(height: 12),
            const _NoticeBand(
              icon: Icons.shield_outlined,
              text: '進入探索頁就會顯示目前位置。靠近任務會自動解鎖；完成後生命樹才會成長。',
            ),
            const SizedBox(height: 16),
            _SectionTitle(
              title: '任務雷達',
              subtitle: '點任務卡或地圖光點，底部任務會同步切換',
              action: onToggleRadarMissions == null
                  ? null
                  : TextButton(
                      onPressed: onToggleRadarMissions,
                      child: Text(showAllRadarMissions ? '收起' : '全部'),
                    ),
            ),
            const SizedBox(height: 10),
            if (radarMissionViews.isEmpty)
              const _EmptyBlock(
                icon: Icons.radar_rounded,
                title: '目前沒有雷達任務',
                text: '營運單位發布城市任務後，會在地圖上出現任務光點。',
              )
            else
              ...radarMissionViews.map(
                (view) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    onTap: () => onMissionSelected(view),
                    child: _RadarMissionCard(
                      view: view,
                      controller: controller,
                    ),
                  ),
                ),
              ),
            if (!showAllRadarMissions && totalRadarMissionCount > 3) ...[
              const SizedBox(height: 2),
              Text(
                '還有 ${totalRadarMissionCount - 3} 個任務，展開後可查看完整清單。',
                style: const TextStyle(
                  color: Color(0xFF69736D),
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
            const SizedBox(height: 16),
            _SectionTitle(
              title: '路線旅程',
              subtitle: '地標與距離任務先收在這裡，主畫面保持乾淨',
              action: onToggleRouteDetails == null
                  ? null
                  : TextButton(
                      onPressed: onToggleRouteDetails,
                      child: Text(showRouteDetails ? '收起' : '展開'),
                    ),
            ),
            const SizedBox(height: 10),
            if (route == null)
              const _EmptyBlock(
                icon: Icons.map_outlined,
                title: '附近還沒有探索點',
                text: '營運單位建立地標後會出現在這裡；雷達任務仍可照常解鎖。',
              )
            else if (!showRouteDetails)
              _RouteSummaryCard(route: route!, progress: routeProgress)
            else
              ...route!.quests.map(
                (quest) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _QuestEventCard(quest: quest),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _AdventureMapOverlay extends StatelessWidget {
  const _AdventureMapOverlay();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              forestDark.withValues(alpha: 0.1),
              Colors.transparent,
              forestDark.withValues(alpha: 0.28),
            ],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
      ),
    );
  }
}

class _MissionDirectionBeam extends StatelessWidget {
  const _MissionDirectionBeam({required this.angle, required this.color});

  final double angle;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: 1),
      duration: const Duration(milliseconds: 560),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return CustomPaint(
          painter: _MissionDirectionBeamPainter(
            angle: angle,
            color: color,
            progress: value,
          ),
        );
      },
    );
  }
}

class _MissionDirectionBeamPainter extends CustomPainter {
  const _MissionDirectionBeamPainter({
    required this.angle,
    required this.color,
    required this.progress,
  });

  final double angle;
  final Color color;
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final start = Offset(size.width * 0.5, size.height * 0.58);
    final direction = Offset(math.sin(angle), -math.cos(angle));
    final distance = math.min(size.width, size.height) * 0.31 * progress;
    final end = start + direction * distance;
    final normal = Offset(-direction.dy, direction.dx);
    final control = Offset.lerp(start, end, 0.52)! + normal * 34 * progress;
    final path = Path()
      ..moveTo(start.dx, start.dy)
      ..quadraticBezierTo(control.dx, control.dy, end.dx, end.dy);

    final glowPaint = Paint()
      ..color = color.withValues(alpha: 0.24 * progress)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 18
      ..strokeCap = StrokeCap.round
      ..maskFilter = const ui.MaskFilter.blur(ui.BlurStyle.normal, 11);
    canvas.drawPath(path, glowPaint);

    final beamPaint = Paint()
      ..shader = ui.Gradient.linear(
        start,
        end,
        [
          color.withValues(alpha: 0),
          lime.withValues(alpha: 0.5 * progress),
          Colors.white.withValues(alpha: 0.78 * progress),
        ],
        const [0, 0.56, 1],
      )
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round;
    canvas.drawPath(path, beamPaint);

    final dashPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.76 * progress)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..strokeCap = StrokeCap.round;
    final dashCount = 4;
    for (var index = 1; index <= dashCount; index++) {
      final t = index / (dashCount + 1);
      final point = _quadraticPoint(start, control, end, t);
      final dashStart = point - direction * 9;
      final dashEnd = point + direction * 9;
      canvas.drawLine(dashStart, dashEnd, dashPaint);
    }

    final targetPaint = Paint()
      ..color = color.withValues(alpha: 0.28 * progress)
      ..style = PaintingStyle.fill;
    final targetStroke = Paint()
      ..color = Colors.white.withValues(alpha: 0.8 * progress)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    canvas.drawCircle(end, 18 * progress, targetPaint);
    canvas.drawCircle(end, 18 * progress, targetStroke);

    final arrowPath = Path()
      ..moveTo((end + direction * 14).dx, (end + direction * 14).dy)
      ..lineTo(
        (end - direction * 10 + normal * 8).dx,
        (end - direction * 10 + normal * 8).dy,
      )
      ..lineTo((end - direction * 6).dx, (end - direction * 6).dy)
      ..lineTo(
        (end - direction * 10 - normal * 8).dx,
        (end - direction * 10 - normal * 8).dy,
      )
      ..close();
    canvas.drawPath(
      arrowPath,
      Paint()..color = Colors.white.withValues(alpha: 0.88 * progress),
    );
  }

  Offset _quadraticPoint(Offset start, Offset control, Offset end, double t) {
    final inverse = 1 - t;
    return start * (inverse * inverse) +
        control * (2 * inverse * t) +
        end * (t * t);
  }

  @override
  bool shouldRepaint(covariant _MissionDirectionBeamPainter oldDelegate) {
    return oldDelegate.angle != angle ||
        oldDelegate.color != color ||
        oldDelegate.progress != progress;
  }
}

class _ExplorationMissionDock extends StatelessWidget {
  const _ExplorationMissionDock({
    required this.distanceMeters,
    required this.exploring,
    required this.hasSession,
    required this.sendingLocation,
    required this.locationStatus,
    required this.mission,
    required this.onCompleteMission,
  });

  final int distanceMeters;
  final bool exploring;
  final bool hasSession;
  final bool sendingLocation;
  final String locationStatus;
  final RadarMissionViewState? mission;
  final VoidCallback? onCompleteMission;

  @override
  Widget build(BuildContext context) {
    final view = mission;
    final accent = view == null ? forest : _radarAccentColor(view.mission);
    final canComplete = view?.canComplete ?? false;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.white.withValues(alpha: 0.96),
            accent.withValues(alpha: 0.13),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: canComplete ? accent.withValues(alpha: 0.5) : Colors.white,
          width: canComplete ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: forestDark.withValues(alpha: 0.2),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          _MissionDockOrb(
            color: accent,
            progress: view?.proximityProgress ?? 0,
            icon: view == null
                ? sendingLocation
                      ? Icons.radar_rounded
                      : exploring
                      ? Icons.directions_walk_rounded
                      : Icons.spa_rounded
                : _radarIcon(view.mission),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.13),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        view?.stateLabel ?? (exploring ? '地圖定位中' : '定位中'),
                        style: TextStyle(
                          color: accent,
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    Text(
                      view == null ? '$distanceMeters 公尺' : view.distanceLabel,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  view == null
                      ? hasSession
                            ? '正在比對附近任務 · $locationStatus'
                            : '地圖會自動顯示目前位置，靠近光點就能接取任務。'
                      : '${view.mission.title} · ${view.helperText}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF68746D),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          if (canComplete) ...[
            const SizedBox(width: 10),
            FilledButton(
              onPressed: onCompleteMission,
              child: Text(view!.primaryActionLabel),
            ),
          ],
        ],
      ),
    );
  }
}

class _ExplorationQuickRail extends StatelessWidget {
  const _ExplorationQuickRail({required this.onNavigate});

  final ValueChanged<int> onNavigate;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: forestDark.withValues(alpha: 0.88),
      elevation: 8,
      shadowColor: Colors.black45,
      borderRadius: BorderRadius.circular(24),
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _LeafMenuButton(
              icon: Icons.home_rounded,
              label: '今天',
              onTap: () => onNavigate(0),
            ),
            _LeafMenuButton(
              icon: Icons.checklist_rounded,
              label: '任務',
              onTap: () => onNavigate(1),
            ),
            _LeafMenuButton(
              highlighted: true,
              icon: Icons.explore_rounded,
              label: '地圖',
              onTap: () {},
            ),
            _LeafMenuButton(
              icon: Icons.family_restroom_rounded,
              label: '家人',
              onTap: () => onNavigate(3),
            ),
            _LeafMenuButton(
              icon: Icons.public_rounded,
              label: '公益',
              onTap: () => onNavigate(4),
            ),
            _LeafMenuButton(
              icon: Icons.hub_rounded,
              label: '互動樹',
              onTap: () => onNavigate(5),
            ),
          ],
        ),
      ),
    );
  }
}

class _LeafMenuButton extends StatelessWidget {
  const _LeafMenuButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.highlighted = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: label,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: highlighted
                  ? lime.withValues(alpha: 0.92)
                  : Colors.white.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: highlighted
                    ? Colors.white.withValues(alpha: 0.5)
                    : Colors.white.withValues(alpha: 0.1),
              ),
            ),
            child: Icon(icon, color: highlighted ? forestDark : lime, size: 22),
          ),
        ),
      ),
    );
  }
}

class _MissionDockOrb extends StatelessWidget {
  const _MissionDockOrb({
    required this.color,
    required this.progress,
    required this.icon,
  });

  final Color color;
  final double progress;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(end: progress),
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Stack(
          alignment: Alignment.center,
          children: [
            SizedBox(
              width: 62,
              height: 62,
              child: CircularProgressIndicator(
                value: value,
                strokeWidth: 5,
                color: color,
                backgroundColor: color.withValues(alpha: 0.14),
              ),
            ),
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: forestDark,
                boxShadow: [
                  BoxShadow(
                    color: color.withValues(alpha: 0.38),
                    blurRadius: 18,
                    spreadRadius: value >= 1 ? 2 : 0,
                  ),
                ],
              ),
              child: Icon(icon, color: lime),
            ),
          ],
        );
      },
    );
  }
}

class _GrowthCelebrationBand extends StatelessWidget {
  const _GrowthCelebrationBand({required this.title, required this.points});

  final String title;
  final int points;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF113F2B), Color(0xFF6B8E23)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: forest.withValues(alpha: 0.24),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.84, end: 1),
            duration: const Duration(milliseconds: 520),
            curve: Curves.elasticOut,
            builder: (context, scale, child) =>
                Transform.scale(scale: scale, child: child),
            child: Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: lime,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: lime.withValues(alpha: 0.46),
                    blurRadius: 24,
                    spreadRadius: 3,
                  ),
                ],
              ),
              child: const Icon(Icons.eco_rounded, color: forestDark),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '生命樹長出新葉 +$points',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  title,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.78),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
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

class _ExplorerAvatar extends StatelessWidget {
  const _ExplorerAvatar();

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.center,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned(
            bottom: 10,
            child: Container(
              width: 48,
              height: 13,
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          Container(
            width: 92,
            height: 92,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.72),
                width: 4,
              ),
              color: lime.withValues(alpha: 0.16),
            ),
          ),
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const RadialGradient(
                colors: [Color(0xFF22C78A), Color(0xFF0C5D47)],
              ),
              border: Border.all(color: Colors.white, width: 5),
              boxShadow: [
                BoxShadow(
                  color: forestDark.withValues(alpha: 0.36),
                  blurRadius: 24,
                  offset: const Offset(0, 10),
                ),
                BoxShadow(
                  color: lime.withValues(alpha: 0.34),
                  blurRadius: 30,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: const Icon(
              Icons.navigation_rounded,
              color: warmYellow,
              size: 34,
            ),
          ),
          Positioned(
            top: 2,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.94),
                borderRadius: BorderRadius.circular(999),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.16),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Text(
                '你',
                style: TextStyle(
                  color: forestDark,
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
          Positioned(
            right: 15,
            top: 22,
            child: Transform.rotate(
              angle: 0.62,
              child: Container(
                width: 18,
                height: 28,
                decoration: BoxDecoration(
                  color: warmYellow,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: Colors.white, width: 2),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AdventureBeaconBase extends StatelessWidget {
  const _AdventureBeaconBase({
    required this.color,
    required this.child,
    this.featured = false,
    this.pulse = false,
    this.completed = false,
  });

  final Color color;
  final Widget child;
  final bool featured;
  final bool pulse;
  final bool completed;

  @override
  Widget build(BuildContext context) {
    final coreSize = featured ? 58.0 : 48.0;
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(end: pulse ? 1 : 0),
      duration: const Duration(milliseconds: 620),
      curve: Curves.easeOutCubic,
      builder: (context, value, _) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  width: featured ? 98 : 78,
                  height: featured ? 98 : 78,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.86),
                      width: 3,
                    ),
                    color: color.withValues(alpha: 0.08 + value * 0.08),
                  ),
                ),
                if (pulse)
                  Container(
                    width: (featured ? 116 : 96) + value * 18,
                    height: (featured ? 116 : 96) + value * 18,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: color.withValues(alpha: 0.34 * (1 - value)),
                        width: 3,
                      ),
                    ),
                  ),
                Container(
                  width: coreSize,
                  height: coreSize,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      colors: completed
                          ? [forestDark, forest]
                          : [Colors.white, color.withValues(alpha: 0.9)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    border: Border.all(color: Colors.white, width: 4),
                    boxShadow: [
                      BoxShadow(
                        color: color.withValues(alpha: featured ? 0.46 : 0.34),
                        blurRadius: featured ? 30 : 22,
                        spreadRadius: featured ? 2 : 0,
                        offset: const Offset(0, 9),
                      ),
                    ],
                  ),
                  child: child,
                ),
              ],
            ),
            Container(
              width: 4,
              height: featured ? 18 : 14,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.86),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            Container(
              width: featured ? 22 : 18,
              height: 7,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.88),
                borderRadius: BorderRadius.circular(999),
                boxShadow: [
                  BoxShadow(
                    color: color.withValues(alpha: 0.28),
                    blurRadius: 8,
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _BeaconLabel extends StatelessWidget {
  const _BeaconLabel({required this.text, required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 88),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.18)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.14),
            blurRadius: 9,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Text(
        text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: forestDark,
          fontSize: 10,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _BeaconSequenceBadge extends StatelessWidget {
  const _BeaconSequenceBadge({required this.sequence});

  final int sequence;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 20,
      height: 20,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: warmYellow,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2),
      ),
      child: Text(
        '$sequence',
        style: const TextStyle(
          color: ink,
          fontSize: 10,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _QuestBeacon extends StatelessWidget {
  const _QuestBeacon({required this.quest});

  final ExplorationQuestModel quest;

  @override
  Widget build(BuildContext context) {
    final color = _questAccentColor(quest);
    final icon = _questIcon(quest);
    final active = quest.unlocked || quest.completed;

    return Opacity(
      opacity: active ? 1 : 0.76,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (active) ...[
            _BeaconLabel(text: quest.locationName, color: color),
            const SizedBox(height: 3),
          ],
          Stack(
            clipBehavior: Clip.none,
            children: [
              _AdventureBeaconBase(
                color: color,
                pulse: quest.unlocked && !quest.completed,
                completed: quest.completed,
                child: Icon(
                  icon,
                  color: quest.completed ? Colors.white : color,
                  size: 23,
                ),
              ),
              Positioned(
                right: 10,
                top: 8,
                child: _BeaconSequenceBadge(sequence: quest.sequence),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RadarBeacon extends StatelessWidget {
  const _RadarBeacon({required this.view, required this.featured});

  final RadarMissionViewState view;
  final bool featured;

  @override
  Widget build(BuildContext context) {
    final mission = view.mission;
    final color = _radarAccentColor(mission);
    final completed = mission.status == 'COMPLETED';
    final unlocked = mission.status == 'UNLOCKED';
    final pulse =
        view.adventureState == AdventureMissionState.readyToComplete ||
        view.adventureState == AdventureMissionState.insideRadius ||
        featured;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (featured) ...[
          _BeaconLabel(text: mission.tag, color: color),
          const SizedBox(height: 4),
        ],
        _AdventureBeaconBase(
          color: color,
          featured: featured,
          pulse: pulse,
          completed: completed,
          child: Icon(
            completed ? Icons.done_all_rounded : _radarIcon(mission),
            color: completed || unlocked ? Colors.white : color,
            size: featured ? 30 : 25,
          ),
        ),
      ],
    );
  }
}

class _RadarMissionCard extends StatefulWidget {
  const _RadarMissionCard({required this.view, required this.controller});

  final RadarMissionViewState view;
  final AppController controller;

  @override
  State<_RadarMissionCard> createState() => _RadarMissionCardState();
}

class _RadarMissionCardState extends State<_RadarMissionCard> {
  Timer? _timer;
  DateTime _now = DateTime.now();

  RadarMissionViewState get view => widget.view;
  RadarMissionModel get mission => widget.view.mission;
  AppController get controller => widget.controller;

  @override
  void initState() {
    super.initState();
    _syncTimer();
  }

  @override
  void didUpdateWidget(covariant _RadarMissionCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.view.mission.id != widget.view.mission.id ||
        oldWidget.view.mission.status != widget.view.mission.status ||
        oldWidget.view.mission.unlockedAt != widget.view.mission.unlockedAt) {
      _syncTimer();
    }
  }

  void _syncTimer() {
    _timer?.cancel();
    _now = DateTime.now();
    if (mission.isTimer && mission.status == 'UNLOCKED') {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!mounted) return;
        setState(() => _now = DateTime.now());
        if (mission.timerRemainingAt(_now) == Duration.zero) {
          _timer?.cancel();
          _timer = null;
        }
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final accent = _radarAccentColor(mission);
    final completed = mission.status == 'COMPLETED';
    final unlocked = mission.status == 'UNLOCKED';
    final timerRemaining = mission.timerRemainingAt(_now);
    final canComplete = mission.canCompleteAt(_now);
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(
          colors: completed
              ? const [Color(0xFFE8F6DF), Color(0xFFFFFFFF)]
              : [accent.withValues(alpha: 0.14), Colors.white],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: accent.withValues(alpha: 0.22)),
        boxShadow: [
          BoxShadow(
            color: accent.withValues(alpha: 0.1),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(15),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: completed
                          ? [forest, accent]
                          : [Colors.white, accent.withValues(alpha: 0.22)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: accent.withValues(alpha: 0.22),
                        blurRadius: 16,
                        offset: const Offset(0, 7),
                      ),
                    ],
                  ),
                  child: Icon(
                    _radarIcon(mission),
                    color: completed ? Colors.white : accent,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              mission.title,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                          _RadarStatusChip(
                            status: mission.status,
                            label: view.stateLabel,
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        mission.description,
                        style: const TextStyle(
                          color: Color(0xFF66706A),
                          height: 1.45,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _InfoPill(icon: Icons.radar_rounded, label: view.distanceLabel),
                _InfoPill(
                  icon: Icons.timer_outlined,
                  label:
                      unlocked &&
                          mission.isTimer &&
                          timerRemaining > Duration.zero
                      ? '計時 ${_formatDuration(timerRemaining)}'
                      : _formatRemaining(mission.remainingSeconds),
                ),
                _InfoPill(
                  icon: mission.verificationMode == VerificationMode.timer
                      ? Icons.hourglass_bottom_rounded
                      : Icons.touch_app_rounded,
                  label: mission.verificationMode == VerificationMode.timer
                      ? '計時任務'
                      : '自我確認',
                ),
                if (view.distanceMeters != null && !mission.isCompleted)
                  _InfoPill(
                    icon: view.insideRadius
                        ? Icons.radio_button_checked_rounded
                        : Icons.near_me_outlined,
                    label: view.insideRadius
                        ? '可接取範圍內'
                        : '半徑 ${mission.radiusMeters}m',
                  ),
                _InfoPill(
                  icon: Icons.energy_savings_leaf_outlined,
                  label: '生命樹 +${mission.growthPoints}',
                ),
                if (mission.badgeName != null)
                  _InfoPill(
                    icon: Icons.workspace_premium_outlined,
                    label: mission.badgeName!,
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
                      label: const Text('已完成，生命樹已成長'),
                    )
                  : unlocked
                  ? FilledButton.icon(
                      onPressed: canComplete
                          ? () async {
                              final confirmed = await showDialog<bool>(
                                context: context,
                                builder: (context) => AlertDialog(
                                  title: const Text('完成雷達任務'),
                                  content: Text(
                                    '確認完成「${mission.title}」，讓生命樹長出新葉嗎？',
                                  ),
                                  actions: [
                                    TextButton(
                                      onPressed: () =>
                                          Navigator.pop(context, false),
                                      child: const Text('還沒有'),
                                    ),
                                    FilledButton(
                                      onPressed: () =>
                                          Navigator.pop(context, true),
                                      child: const Text('已完成'),
                                    ),
                                  ],
                                ),
                              );
                              if (confirmed == true) {
                                await controller.completeRadarMission(mission);
                              }
                            }
                          : null,
                      icon: Icon(
                        canComplete
                            ? Icons.check_circle_outline_rounded
                            : Icons.hourglass_bottom_rounded,
                      ),
                      label: Text(
                        canComplete
                            ? '完成並讓樹成長'
                            : '還需 ${_formatDuration(timerRemaining)}',
                      ),
                    )
                  : OutlinedButton.icon(
                      onPressed: null,
                      icon: Icon(
                        mission.status == 'EXPIRED'
                            ? Icons.event_busy_rounded
                            : Icons.location_searching_rounded,
                      ),
                      label: Text(_radarViewActionText(view)),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RouteSummaryCard extends StatelessWidget {
  const _RouteSummaryCard({required this.route, required this.progress});

  final ExplorationRouteModel route;
  final double progress;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          colors: [Color(0xFFFFFFFF), Color(0xFFEAF6DD)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: const Color(0xFFDCE9D6)),
        boxShadow: [
          BoxShadow(
            color: forest.withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: forestDark,
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Icon(Icons.route_rounded, color: lime),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  route.name,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  '${route.completedQuestCount}/${route.totalQuestCount} 個地標完成 · 點「展開」看完整旅程',
                  style: const TextStyle(
                    color: Color(0xFF66706A),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 8,
                    color: forest,
                    backgroundColor: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _QuestEventCard extends StatelessWidget {
  const _QuestEventCard({required this.quest});

  final ExplorationQuestModel quest;

  @override
  Widget build(BuildContext context) {
    final accent = _questAccentColor(quest);
    final icon = _questIcon(quest);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Container(
        decoration: BoxDecoration(
          border: Border(left: BorderSide(color: accent, width: 5)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: accent.withValues(
                        alpha: quest.completed ? 1 : 0.16,
                      ),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: quest.unlocked || quest.completed
                            ? accent
                            : const Color(0xFFD4DAD6),
                        width: 2,
                      ),
                    ),
                    child: Icon(
                      icon,
                      color: quest.completed ? Colors.white : accent,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                '${quest.sequence}. ${quest.locationName}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                            _QuestStatusChip(quest: quest),
                          ],
                        ),
                        const SizedBox(height: 5),
                        Text(
                          quest.title,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          quest.description,
                          style: const TextStyle(
                            color: Color(0xFF66706A),
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF4F7F5),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Icon(
                      quest.triggerType == 'DISTANCE'
                          ? Icons.route_rounded
                          : Icons.location_on_rounded,
                      color: accent,
                      size: 19,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _questUnlockText(quest),
                        style: TextStyle(
                          color: quest.unlocked ? forest : Colors.black54,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (quest.safetyNote != null) ...[
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.health_and_safety_outlined,
                      color: forest,
                      size: 18,
                    ),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Text(
                        '安全提醒：${quest.safetyNote}',
                        style: const TextStyle(fontSize: 12, height: 1.4),
                      ),
                    ),
                  ],
                ),
              ],
              if (quest.accessibilityTags.isNotEmpty) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: quest.accessibilityTags
                      .map(
                        (tag) => Chip(
                          visualDensity: VisualDensity.compact,
                          backgroundColor: Colors.white,
                          side: const BorderSide(color: Color(0xFFDCE5DF)),
                          label: Text(tag),
                        ),
                      )
                      .toList(),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _QuestStatusChip extends StatelessWidget {
  const _QuestStatusChip({required this.quest});

  final ExplorationQuestModel quest;

  @override
  Widget build(BuildContext context) {
    final color = _questAccentColor(quest);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: quest.completed ? 1 : 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        quest.completed
            ? '完成'
            : quest.unlocked
            ? '事件開啟'
            : '未解鎖',
        style: TextStyle(
          color: quest.completed ? Colors.white : color,
          fontSize: 11,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _RadarStatusChip extends StatelessWidget {
  const _RadarStatusChip({required this.status, this.label});

  final String status;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'COMPLETED' => forest,
      'UNLOCKED' => const Color(0xFF2F80ED),
      'EXPIRED' => const Color(0xFF8A5A44),
      'UPCOMING' => const Color(0xFFD98A00),
      _ => const Color(0xFF6A7770),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: status == 'COMPLETED' ? 1 : 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label ??
            switch (status) {
              'COMPLETED' => '完成',
              'UNLOCKED' => '可完成',
              'EXPIRED' => '已結束',
              'UPCOMING' => '即將開始',
              _ => '靠近解鎖',
            },
        style: TextStyle(
          color: status == 'COMPLETED' ? Colors.white : color,
          fontSize: 11,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(icon, size: 16, color: forest),
      label: Text(label),
      visualDensity: VisualDensity.compact,
      backgroundColor: const Color(0xFFF4F7F5),
      side: const BorderSide(color: Color(0xFFDCE5DF)),
      labelStyle: const TextStyle(fontWeight: FontWeight.w800),
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
        const SizedBox(height: 12),
        _LineCompanionCard(controller: widget.controller),
        const SizedBox(height: 12),
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

class _LineCompanionCard extends StatelessWidget {
  const _LineCompanionCard({required this.controller});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final activeBindings = controller.lineBindings
        .where((binding) => binding.active)
        .toList();
    final code = controller.latestLineBindingCode;
    final codeStillValid =
        code != null && code.expiresAt.isAfter(DateTime.now());
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const CircleAvatar(
                  backgroundColor: Color(0xFFE2F4C3),
                  foregroundColor: forest,
                  child: Icon(Icons.chat_bubble_rounded),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'LINE 陪伴入口',
                        style: TextStyle(fontWeight: FontWeight.w900),
                      ),
                      SizedBox(height: 3),
                      Text('提醒、待覆核與快速求助會從這裡靠近。'),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: controller.refreshLineBindings,
                  tooltip: '更新 LINE 綁定',
                  icon: const Icon(Icons.refresh_rounded),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (activeBindings.isEmpty)
              const _InfoPill(
                icon: Icons.info_outline_rounded,
                label: '尚未綁定 LINE。產生 8 碼綁定碼後，到綠伴 LINE 官方帳號輸入即可。',
              )
            else
              ...activeBindings.map(
                (binding) => _LineBindingTile(
                  binding: binding,
                  onRevoke: () => controller.revokeLineBinding(binding),
                ),
              ),
            if (codeStillValid) ...[
              const SizedBox(height: 12),
              _LineBindingCodePanel(code: code),
            ],
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: () async {
                final code = await controller.createLineBindingCode();
                if (code != null && context.mounted) {
                  await showDialog<void>(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: const Text('LINE 綁定碼'),
                      content: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _LineBindingCodePanel(code: code),
                          const SizedBox(height: 10),
                          Text(code.instructions),
                          if (code.qrPayload.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            SelectableText(
                              code.qrPayload,
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 12),
                            ),
                          ],
                        ],
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
              icon: const Icon(Icons.qr_code_2_rounded),
              label: const Text('產生 LINE 綁定碼'),
            ),
          ],
        ),
      ),
    );
  }
}

class _LineBindingTile extends StatelessWidget {
  const _LineBindingTile({required this.binding, required this.onRevoke});

  final LineBindingModel binding;
  final VoidCallback onRevoke;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF4FAEA),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFD6E9B5)),
      ),
      child: Row(
        children: [
          const Icon(Icons.check_circle_rounded, color: forest),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  binding.householdName,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 2),
                Text(
                  '已綁定 · ${binding.createdAt.month}/${binding.createdAt.day}，會收到提醒與待覆核通知',
                  style: const TextStyle(
                    color: Color(0xFF657168),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          TextButton(onPressed: onRevoke, child: const Text('解除')),
        ],
      ),
    );
  }
}

class _LineBindingCodePanel extends StatelessWidget {
  const _LineBindingCodePanel({required this.code});

  final LineBindingCodeModel code;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFECF8D4), Color(0xFFFFFFFF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFCAE698)),
      ),
      child: Column(
        children: [
          const Text(
            '在 LINE 官方帳號輸入這 8 碼',
            style: TextStyle(
              color: forest,
              fontWeight: FontWeight.w900,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 8),
          SelectableText(
            code.code,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 34,
              fontWeight: FontWeight.w900,
              letterSpacing: 5,
              color: forestDark,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '有效到 ${_formatLineExpiry(code.expiresAt)} · 單次使用',
            style: const TextStyle(
              color: Color(0xFF657168),
              fontWeight: FontWeight.w800,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

String _formatLineExpiry(DateTime value) {
  final local = value.toLocal();
  String two(int number) => number.toString().padLeft(2, '0');
  return '${two(local.hour)}:${two(local.minute)}';
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

class TreeGrowthScreen extends StatelessWidget {
  const TreeGrowthScreen({required this.controller, super.key});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final tree = controller.tree;
    final stage = _TreeGrowthStage.fromPoints(tree.growthPoints);
    final next = _TreeGrowthStage.nextAfter(stage);
    final progress = next == null
        ? 1.0
        : ((tree.growthPoints - stage.threshold) /
                  (next.threshold - stage.threshold))
              .clamp(0.0, 1.0);
    final recentTasks = controller.tasks
        .where((task) => task.status == TaskStatus.completed)
        .take(4)
        .toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 30),
      children: [
        const _PageHeading(title: '生命樹', subtitle: '每一次任務完成，都會讓家庭共同照顧的樹長出新葉。'),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF0D4E3A), Color(0xFF197254)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(30),
            boxShadow: [
              BoxShadow(
                color: forest.withValues(alpha: 0.22),
                blurRadius: 26,
                offset: const Offset(0, 14),
              ),
            ],
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          tree.householdName,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.74),
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          stage.label,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 32,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '${tree.growthPoints} 點共同成長值',
                          style: const TextStyle(
                            color: lime,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _TreeStageIllustration(stage: stage),
                ],
              ),
              const SizedBox(height: 24),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 12,
                  color: lime,
                  backgroundColor: Colors.white.withValues(alpha: 0.16),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Text(
                    stage.label,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    next == null
                        ? '已到目前最高階段'
                        : '下一階段：${next.label} · 還差 ${math.max(0, next.threshold - tree.growthPoints)} 點',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.78),
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const _SectionTitle(
          title: '成長階段',
          subtitle: '先用真實成長值推導階段，之後可接上更完整的 2D/3D 樹動畫。',
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: _TreeGrowthStage.values
              .map(
                (item) => _TreeStageChip(
                  stage: item,
                  active: item == stage,
                  reached: tree.growthPoints >= item.threshold,
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 22),
        const _SectionTitle(
          title: '最近讓樹長大的任務',
          subtitle: '不做本地假加分，只顯示後端確認完成的紀錄。',
        ),
        const SizedBox(height: 10),
        if (recentTasks.isEmpty)
          const _EmptyBlock(
            icon: Icons.eco_outlined,
            title: '還沒有完成紀錄',
            text: '去探索地圖完成第一個任務，生命樹就會長出新葉。',
          )
        else
          ...recentTasks.map(
            (task) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _TreeGrowthTaskTile(task: task),
            ),
          ),
      ],
    );
  }
}

enum _TreeGrowthStage {
  seed('種子', 0, Icons.grain_rounded),
  sprout('發芽', 20, Icons.spa_rounded),
  seedling('幼苗', 60, Icons.eco_rounded),
  youngTree('小樹', 140, Icons.park_outlined),
  matureTree('成樹', 280, Icons.park_rounded),
  greatTree('大樹', 500, Icons.forest_rounded);

  const _TreeGrowthStage(this.label, this.threshold, this.icon);

  final String label;
  final int threshold;
  final IconData icon;

  static _TreeGrowthStage fromPoints(int points) {
    var current = _TreeGrowthStage.seed;
    for (final stage in _TreeGrowthStage.values) {
      if (points >= stage.threshold) current = stage;
    }
    return current;
  }

  static _TreeGrowthStage? nextAfter(_TreeGrowthStage current) {
    final index = _TreeGrowthStage.values.indexOf(current);
    if (index < 0 || index == _TreeGrowthStage.values.length - 1) {
      return null;
    }
    return _TreeGrowthStage.values[index + 1];
  }
}

class _TreeStageIllustration extends StatelessWidget {
  const _TreeStageIllustration({required this.stage});

  final _TreeGrowthStage stage;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0.92, end: 1),
      duration: const Duration(milliseconds: 900),
      curve: Curves.easeOutBack,
      builder: (context, value, child) =>
          Transform.scale(scale: value, child: child),
      child: Container(
        width: 112,
        height: 112,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.12),
          shape: BoxShape.circle,
          border: Border.all(color: lime.withValues(alpha: 0.42)),
        ),
        child: Icon(stage.icon, color: lime, size: 58),
      ),
    );
  }
}

class _TreeStageChip extends StatelessWidget {
  const _TreeStageChip({
    required this.stage,
    required this.active,
    required this.reached,
  });

  final _TreeGrowthStage stage;
  final bool active;
  final bool reached;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 104,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: active ? forestDark : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: active
              ? lime
              : reached
              ? forest.withValues(alpha: 0.2)
              : const Color(0xFFE0E7E2),
        ),
      ),
      child: Column(
        children: [
          Icon(stage.icon, color: active ? lime : forest),
          const SizedBox(height: 6),
          Text(
            stage.label,
            style: TextStyle(
              color: active ? Colors.white : ink,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '${stage.threshold}+',
            style: TextStyle(
              color: active
                  ? Colors.white.withValues(alpha: 0.68)
                  : const Color(0xFF69736D),
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _TreeGrowthTaskTile extends StatelessWidget {
  const _TreeGrowthTaskTile({required this.task});

  final DailyTask task;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE0E7E2)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: lime.withValues(alpha: 0.28),
              borderRadius: BorderRadius.circular(15),
            ),
            child: const Icon(Icons.energy_savings_leaf_rounded, color: forest),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              task.title,
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
          Text(
            '+${task.growthPoints}',
            style: const TextStyle(color: forest, fontWeight: FontWeight.w900),
          ),
        ],
      ),
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
                      label: Text(controller.photoTaskActionLabel(task)),
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

class _HomeTaskCardTile extends StatelessWidget {
  const _HomeTaskCardTile({required this.card, required this.controller});

  final HomeTaskCardModel card;
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final task = card.task;
    final canAct =
        task.status != TaskStatus.completed &&
        task.status != TaskStatus.verifying &&
        task.capabilityEnabled;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: canAct ? () => _actOnTask(context, task) : null,
        child: Padding(
          padding: const EdgeInsets.all(15),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: _taskColor(task.verificationMode),
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Icon(_taskIcon(task.verificationMode), color: ink),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            task.title,
                            style: const TextStyle(fontWeight: FontWeight.w900),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: lime.withValues(alpha: 0.35),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            card.stateLabel,
                            style: const TextStyle(
                              color: forestDark,
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      task.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFF69736D),
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Text(
                          card.actionLabel,
                          style: const TextStyle(
                            color: forest,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '+${task.growthPoints}',
                          style: const TextStyle(
                            color: Color(0xFF69736D),
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                canAct ? Icons.arrow_forward_rounded : Icons.lock_clock_rounded,
                color: canAct ? forest : const Color(0xFF9BA79F),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _actOnTask(BuildContext context, DailyTask task) async {
    if (task.verificationMode == VerificationMode.photoAi) {
      await controller.photographTask(task);
      return;
    }
    if (task.verificationMode == VerificationMode.timer) {
      if (task.status == TaskStatus.available) {
        await controller.startTask(task);
      } else {
        await controller.completeTask(task);
      }
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

String _questUnlockText(ExplorationQuestModel quest) {
  if (quest.completed) return '已完成，樹成長值已記錄';
  if (quest.unlocked) return '已解鎖，可前往任務頁完成行動';
  if (quest.triggerType == 'DISTANCE') {
    return '本次路線累積 ${quest.unlockDistanceMeters ?? 0} 公尺後開啟';
  }
  return '進入地標 ${quest.radiusMeters ?? 0} 公尺範圍內開啟';
}

String _formatRemaining(int seconds) {
  if (seconds <= 0) return '已結束';
  final hours = seconds ~/ 3600;
  final minutes = (seconds % 3600) ~/ 60;
  if (hours > 0) return '剩 $hours 小時 $minutes 分';
  return '剩 $minutes 分';
}

String _formatDuration(Duration duration) {
  final safe = duration.isNegative ? Duration.zero : duration;
  final minutes = safe.inMinutes;
  final seconds = safe.inSeconds % 60;
  if (minutes > 0) {
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }
  return '${seconds}s';
}

String _radarViewActionText(RadarMissionViewState view) {
  if (view.adventureState == AdventureMissionState.timerRunning) {
    return '計時中，還需 ${_formatDuration(view.timerRemaining)}';
  }
  return view.primaryActionLabel;
}

IconData _radarIcon(RadarMissionModel mission) {
  if (mission.status == 'COMPLETED') return Icons.check_rounded;
  if (mission.status == 'UNLOCKED') return Icons.radio_button_checked_rounded;
  return switch (mission.category) {
    'NATURE' => Icons.eco_rounded,
    'WELLNESS' => Icons.self_improvement_rounded,
    'HYDRATION' => Icons.water_drop_rounded,
    'WALK' => Icons.directions_walk_rounded,
    _ => Icons.radar_rounded,
  };
}

Color _radarAccentColor(RadarMissionModel mission) {
  if (mission.status == 'COMPLETED') return forest;
  if (mission.status == 'UNLOCKED') return const Color(0xFF2F80ED);
  if (mission.status == 'EXPIRED') return const Color(0xFF8A5A44);
  return switch (mission.category) {
    'NATURE' => const Color(0xFF1B7A4A),
    'WELLNESS' => const Color(0xFF7357D8),
    'HYDRATION' => const Color(0xFF2F80ED),
    'WALK' => const Color(0xFFD98A00),
    _ => const Color(0xFF6A7770),
  };
}

List<RadarMissionViewState> _visibleRadarMissionViews(
  List<RadarMissionViewState> views, {
  required String? selectedMissionId,
  required String? featuredMissionId,
}) {
  const maxVisible = 9;
  final visible = <RadarMissionViewState>[];
  final seen = <String>{};

  void addIfNeeded(RadarMissionViewState view) {
    if (seen.add(view.mission.id)) {
      visible.add(view);
    }
  }

  for (final view in views) {
    if (view.mission.id == selectedMissionId ||
        view.mission.id == featuredMissionId) {
      addIfNeeded(view);
    }
  }
  for (final view in views) {
    if (visible.length >= maxVisible) break;
    addIfNeeded(view);
  }
  return visible;
}

IconData _homeActionIcon(HomeNextActionKind? kind) => switch (kind) {
  HomeNextActionKind.takePhoto => Icons.photo_camera_rounded,
  HomeNextActionKind.startTimer => Icons.hourglass_bottom_rounded,
  HomeNextActionKind.reviewPhoto => Icons.fact_check_rounded,
  HomeNextActionKind.startExploration => Icons.explore_rounded,
  HomeNextActionKind.readMessage => Icons.favorite_rounded,
  HomeNextActionKind.rest => Icons.self_improvement_rounded,
  _ => Icons.check_circle_outline_rounded,
};

IconData _questIcon(ExplorationQuestModel quest) {
  if (quest.completed) return Icons.check_rounded;
  if (!quest.unlocked) return Icons.lock_rounded;
  if (quest.triggerType == 'DISTANCE') return Icons.route_rounded;
  return switch (quest.category) {
    'NATURE' => Icons.eco_rounded,
    'WELLNESS' => Icons.self_improvement_rounded,
    'HYDRATION' => Icons.water_drop_rounded,
    _ => Icons.place_rounded,
  };
}

Color _questAccentColor(ExplorationQuestModel quest) {
  if (quest.completed) return forest;
  if (!quest.unlocked) return const Color(0xFF7A8680);
  return switch (quest.category) {
    'NATURE' => const Color(0xFF1B7A4A),
    'WELLNESS' => const Color(0xFF7357D8),
    'HYDRATION' => const Color(0xFF2F80ED),
    _ => const Color(0xFFD98A00),
  };
}

double _haversineMeters(double lat1, double lon1, double lat2, double lon2) {
  const earthRadiusMeters = 6371000.0;
  final dLat = _degreesToRadians(lat2 - lat1);
  final dLon = _degreesToRadians(lon2 - lon1);
  final a =
      math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(_degreesToRadians(lat1)) *
          math.cos(_degreesToRadians(lat2)) *
          math.sin(dLon / 2) *
          math.sin(dLon / 2);
  final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

double _degreesToRadians(double degrees) => degrees * math.pi / 180;

double _bearingRadians(double lat1, double lon1, double lat2, double lon2) {
  final startLat = _degreesToRadians(lat1);
  final endLat = _degreesToRadians(lat2);
  final deltaLon = _degreesToRadians(lon2 - lon1);
  final y = math.sin(deltaLon) * math.cos(endLat);
  final x =
      math.cos(startLat) * math.sin(endLat) -
      math.sin(startLat) * math.cos(endLat) * math.cos(deltaLon);
  return math.atan2(y, x);
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
