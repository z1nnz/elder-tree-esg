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
                        _AnimatedTreeProgress(
                          progress: progress,
                          growthPoints: controller.tree.growthPoints,
                          nextStage: nextStage,
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
    final radarMissions = controller.radar.missions;
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
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 30),
      children: [
        _ExplorationHeroCard(
          route: route,
          progress: routeProgress,
          active: controller.exploring,
          radarCount: radarMissions.length,
          unlockedCount: radarMissions
              .where((mission) => mission.status == 'UNLOCKED')
              .length,
        ),
        const SizedBox(height: 14),
        Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: Colors.white, width: 3),
            boxShadow: [
              BoxShadow(
                color: forestDark.withValues(alpha: 0.18),
                blurRadius: 28,
                offset: const Offset(0, 14),
              ),
            ],
          ),
          child: SizedBox(
            height: 430,
            child: Stack(
              fit: StackFit.expand,
              children: [
                MapLibreMap(
                  key: ValueKey(_mapMode),
                  options: MapOptions(
                    initStyle: mapPresentation.style,
                    initCenter: const Geographic(lon: 121.5362, lat: 25.0316),
                    initZoom: mapPresentation.zoom,
                    initPitch: mapPresentation.pitch,
                    initBearing: mapPresentation.bearing,
                    maxPitch: 60,
                  ),
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
                            size: const Size(62, 78),
                            alignment: Alignment.bottomCenter,
                            child: _QuestBeacon(quest: quest),
                          ),
                        ),
                        ...radarMissions.map(
                          (mission) => Marker(
                            point: Geographic(
                              lon: mission.longitude,
                              lat: mission.latitude,
                            ),
                            size: const Size(74, 88),
                            alignment: Alignment.bottomCenter,
                            child: _RadarBeacon(mission: mission),
                          ),
                        ),
                      ],
                    ),
                    const MapControlButtons(showTrackLocation: true),
                    const SourceAttribution(),
                  ],
                ),
                const _AdventureMapOverlay(),
                Positioned(
                  left: 14,
                  top: 14,
                  child: _MapModeSwitch(
                    mode: _mapMode,
                    onChanged: (mode) => setState(() => _mapMode = mode),
                  ),
                ),
                if (_mapMode == ExplorationMapMode.adventure)
                  const Positioned(
                    left: 14,
                    bottom: 92,
                    child: _AdventureMapHint(),
                  ),
                const Positioned(
                  left: 0,
                  right: 0,
                  bottom: 124,
                  child: IgnorePointer(child: _ExplorerAvatar()),
                ),
                Positioned(
                  left: 14,
                  right: 14,
                  bottom: 14,
                  child: _ExplorationStartPanel(
                    distanceMeters: sessionDistance,
                    exploring: controller.exploring,
                    hasSession: controller.exploration.activeSession != null,
                    onPressed: controller.exploring
                        ? controller.stopExploration
                        : controller.startExploration,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        const _NoticeBand(
          icon: Icons.shield_outlined,
          text: '只在探索頁開啟定位。完成任務會讓生命樹成長；重送不會重複增加成長值。',
        ),
        const SizedBox(height: 8),
        const _SectionTitle(title: '任務雷達', subtitle: '靠近光點後接取任務，完成後生命樹長出新葉'),
        const SizedBox(height: 10),
        if (radarMissions.isEmpty)
          const _EmptyBlock(
            icon: Icons.radar_rounded,
            title: '目前沒有雷達任務',
            text: '營運單位發布城市任務後，會在這裡顯示剩餘時間與接取半徑。',
          )
        else
          ...radarMissions.map(
            (mission) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _RadarMissionCard(
                mission: mission,
                controller: controller,
              ),
            ),
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
            (quest) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _QuestEventCard(quest: quest),
            ),
          ),
      ],
    );
  }
}

class _ExplorationHeroCard extends StatelessWidget {
  const _ExplorationHeroCard({
    required this.route,
    required this.progress,
    required this.active,
    required this.radarCount,
    required this.unlockedCount,
  });

  final ExplorationRouteModel? route;
  final double progress;
  final bool active;
  final int radarCount;
  final int unlockedCount;

  @override
  Widget build(BuildContext context) {
    final routeName = route?.name ?? '台北城市任務雷達';
    final badgeName = route?.badgeName ?? '今日綠伴徽章';
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          colors: [Color(0xFFFFF7DE), Color(0xFFDFF8E8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: Colors.white, width: 2),
        boxShadow: [
          BoxShadow(
            color: forest.withValues(alpha: 0.12),
            blurRadius: 26,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const LinearGradient(
                    colors: [lime, forest],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: lime.withValues(alpha: 0.42),
                      blurRadius: 22,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: const Icon(Icons.auto_awesome_rounded, color: ink),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 9,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: active ? forestDark : Colors.white,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            active ? '探索中' : '溫柔冒險模式',
                            style: TextStyle(
                              color: active ? Colors.white : forestDark,
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 7),
                    Text(
                      routeName,
                      style: const TextStyle(
                        fontSize: 24,
                        height: 1.05,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            route?.description ??
                '像 Pokémon GO 一樣看見城市任務，但目標是補水、觀察自然、慢慢走，讓生命樹長出新的葉子。',
            style: const TextStyle(
              color: Color(0xFF536159),
              height: 1.55,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _AdventureStatPill(
                  icon: Icons.radar_rounded,
                  label: '雷達任務',
                  value: '$radarCount 個',
                ),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: _AdventureStatPill(
                  icon: Icons.location_on_rounded,
                  label: '可接取',
                  value: '$unlockedCount 個',
                ),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: _AdventureStatPill(
                  icon: Icons.workspace_premium_rounded,
                  label: '徽章',
                  value: badgeName,
                ),
              ),
            ],
          ),
          if (route != null) ...[
            const SizedBox(height: 15),
            TweenAnimationBuilder<double>(
              tween: Tween<double>(end: progress),
              duration: const Duration(milliseconds: 760),
              curve: Curves.easeOutCubic,
              builder: (context, value, child) => ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: value,
                  minHeight: 10,
                  color: forest,
                  backgroundColor: Colors.white.withValues(alpha: 0.72),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _AdventureStatPill extends StatelessWidget {
  const _AdventureStatPill({
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
      constraints: const BoxConstraints(minHeight: 78),
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: forest, size: 18),
          const Spacer(),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF68746D),
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
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

class _ExplorationStartPanel extends StatelessWidget {
  const _ExplorationStartPanel({
    required this.distanceMeters,
    required this.exploring,
    required this.hasSession,
    required this.onPressed,
  });

  final int distanceMeters;
  final bool exploring;
  final bool hasSession;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(24),
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
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: exploring ? forestDark : const Color(0xFFEAF5DE),
            ),
            child: Icon(
              exploring ? Icons.directions_walk_rounded : Icons.spa_rounded,
              color: exploring ? lime : forest,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$distanceMeters 公尺',
                  style: const TextStyle(
                    fontSize: 21,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  hasSession ? '伺服器計算距離，生命樹等待成長' : '按下開始後，附近任務光點會被偵測',
                  style: const TextStyle(
                    color: Color(0xFF68746D),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          FilledButton.icon(
            onPressed: onPressed,
            icon: Icon(
              exploring ? Icons.pause_rounded : Icons.play_arrow_rounded,
            ),
            label: Text(exploring ? '暫停' : '開始'),
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.92),
              borderRadius: BorderRadius.circular(999),
              boxShadow: const [
                BoxShadow(
                  color: Colors.black26,
                  blurRadius: 10,
                  offset: Offset(0, 4),
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
          const SizedBox(height: 4),
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [forestDark, forest],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 4),
              boxShadow: [
                BoxShadow(
                  color: forestDark.withValues(alpha: 0.32),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: const Icon(
              Icons.emoji_people_rounded,
              color: warmYellow,
              size: 30,
            ),
          ),
          Container(
            width: 28,
            height: 9,
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(999),
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
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: [color.withValues(alpha: 0.82), color],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              border: Border.all(color: Colors.white, width: 3),
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.35),
                  blurRadius: 18,
                  offset: const Offset(0, 7),
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

class _RadarBeacon extends StatelessWidget {
  const _RadarBeacon({required this.mission});

  final RadarMissionModel mission;

  @override
  Widget build(BuildContext context) {
    final color = _radarAccentColor(mission);
    final completed = mission.status == 'COMPLETED';
    final unlocked = mission.status == 'UNLOCKED';
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.94),
            borderRadius: BorderRadius.circular(999),
            boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 8)],
          ),
          child: Text(
            mission.tag,
            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900),
          ),
        ),
        const SizedBox(height: 4),
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: completed
                  ? [forestDark, forest]
                  : unlocked
                  ? [warmYellow, color]
                  : [Colors.white, color.withValues(alpha: 0.82)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 3),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.36),
                blurRadius: 22,
                spreadRadius: unlocked ? 2 : 0,
                offset: const Offset(0, 9),
              ),
            ],
          ),
          child: Icon(
            completed ? Icons.done_all_rounded : _radarIcon(mission),
            color: completed || unlocked ? Colors.white : color,
            size: 25,
          ),
        ),
        Container(width: 5, height: 12, color: color),
        Container(
          width: 20,
          height: 6,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(999),
          ),
        ),
      ],
    );
  }
}

class _RadarMissionCard extends StatelessWidget {
  const _RadarMissionCard({required this.mission, required this.controller});

  final RadarMissionModel mission;
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final accent = _radarAccentColor(mission);
    final completed = mission.status == 'COMPLETED';
    final unlocked = mission.status == 'UNLOCKED';
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
                          _RadarStatusChip(status: mission.status),
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
                _InfoPill(
                  icon: Icons.radar_rounded,
                  label: '${mission.radiusMeters}m 內接取',
                ),
                _InfoPill(
                  icon: Icons.timer_outlined,
                  label: _formatRemaining(mission.remainingSeconds),
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
                      onPressed: () async {
                        final confirmed = await showDialog<bool>(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('完成雷達任務'),
                            content: Text('確認完成「${mission.title}」，讓生命樹長出新葉嗎？'),
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
                          await controller.completeRadarMission(mission);
                        }
                      },
                      icon: const Icon(Icons.check_circle_outline_rounded),
                      label: const Text('完成並讓樹成長'),
                    )
                  : OutlinedButton.icon(
                      onPressed: null,
                      icon: Icon(
                        mission.status == 'EXPIRED'
                            ? Icons.event_busy_rounded
                            : Icons.location_searching_rounded,
                      ),
                      label: Text(_radarActionText(mission.status)),
                    ),
            ),
          ],
        ),
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
  const _RadarStatusChip({required this.status});

  final String status;

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
                      label: const Text('照片 AI 等 Blaze 開放'),
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

String _radarActionText(String status) => switch (status) {
  'UPCOMING' => '尚未開始',
  'EXPIRED' => '任務已結束',
  _ => '走進半徑後可接取',
};

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
