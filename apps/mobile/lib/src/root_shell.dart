import 'package:flutter/material.dart';

import 'app_controller.dart';
import 'screens.dart';
import 'theme.dart';

class RootShell extends StatefulWidget {
  const RootShell({
    required this.controller,
    required this.accountEmail,
    required this.onSignOut,
    this.initialIndex = 2,
    super.key,
  });
  final AppController controller;
  final String accountEmail;
  final Future<void> Function() onSignOut;
  final int initialIndex;

  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> with WidgetsBindingObserver {
  late int index = widget.initialIndex;

  void _selectIndex(int value) {
    if (index == 2 && value != 2 && widget.controller.exploring) {
      widget.controller.stopExploration();
    }
    setState(() => index = value);
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed && widget.controller.exploring) {
      widget.controller.pauseExplorationTracking();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      HomeScreen(
        controller: widget.controller,
        onOpenTasks: () => _selectIndex(1),
        onOpenExploration: () => _selectIndex(2),
        onOpenFamily: () => _selectIndex(3),
      ),
      TasksScreen(controller: widget.controller),
      ExplorationScreen(
        controller: widget.controller,
        onNavigate: _selectIndex,
      ),
      FamilyScreen(controller: widget.controller),
      ImpactScreen(controller: widget.controller),
      TreeGrowthScreen(controller: widget.controller),
      SettingsScreen(
        controller: widget.controller,
        accountEmail: widget.accountEmail,
        onSignOut: widget.onSignOut,
      ),
    ];
    final immersiveExploration = index == 2;
    final safePadding = MediaQuery.paddingOf(context);
    final noticeTopInset = immersiveExploration ? safePadding.top + 94.0 : null;
    final noticeBottomInset = immersiveExploration
        ? null
        : 12.0 + safePadding.bottom;
    return Scaffold(
      extendBodyBehindAppBar: immersiveExploration,
      appBar: immersiveExploration
          ? null
          : AppBar(
              backgroundColor: Colors.white,
              surfaceTintColor: Colors.white,
              titleSpacing: 18,
              leading: IconButton(
                tooltip: '回到地圖',
                onPressed: () => _selectIndex(2),
                icon: const Icon(Icons.close_rounded),
              ),
              title: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: lime,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.spa_rounded, color: forestDark),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '綠伴',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        widget.controller.context?.activeHousehold.name ??
                            '今天也慢慢來',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF6B756F),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              actions: [
                if ((widget.controller.context?.households.length ?? 0) > 1)
                  PopupMenuButton<String>(
                    tooltip: '切換家庭',
                    icon: const Icon(Icons.swap_horiz_rounded),
                    onSelected: widget.controller.switchHousehold,
                    itemBuilder: (context) => widget
                        .controller
                        .context!
                        .households
                        .map(
                          (household) => PopupMenuItem(
                            value: household.id,
                            child: Row(
                              children: [
                                Icon(
                                  household.id ==
                                          widget
                                              .controller
                                              .context!
                                              .activeHouseholdId
                                      ? Icons.check_circle_rounded
                                      : Icons.circle_outlined,
                                  size: 18,
                                ),
                                const SizedBox(width: 8),
                                Text(household.name),
                              ],
                            ),
                          ),
                        )
                        .toList(),
                  ),
                Row(
                  children: [
                    const Icon(Icons.text_fields_rounded, size: 19),
                    Switch(
                      value: widget.controller.elderMode,
                      onChanged: widget.controller.toggleElderMode,
                    ),
                  ],
                ),
                IconButton(
                  onPressed: widget.controller.refresh,
                  tooltip: '重新整理',
                  icon: widget.controller.loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.refresh_rounded),
                ),
                const SizedBox(width: 6),
              ],
            ),
      body: Stack(
        children: [
          KeyedSubtree(key: ValueKey(index), child: screens[index]),
          if (widget.controller.notice != null)
            Positioned(
              right: 14,
              top: noticeTopInset,
              bottom: noticeBottomInset,
              left: 14,
              child: Material(
                elevation: 8,
                borderRadius: BorderRadius.circular(18),
                color: ink.withValues(alpha: 0.94),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(15, 12, 6, 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          widget.controller.notice!,
                          style: const TextStyle(
                            color: Colors.white,
                            height: 1.35,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: widget.controller.clearNotice,
                        tooltip: '關閉',
                        icon: const Icon(Icons.close, color: Colors.white),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: null,
    );
  }
}
