import 'package:flutter/material.dart';

import 'app_controller.dart';
import 'screens.dart';
import 'theme.dart';

class RootShell extends StatefulWidget {
  const RootShell({
    required this.controller,
    required this.accountEmail,
    required this.onSignOut,
    super.key,
  });
  final AppController controller;
  final String accountEmail;
  final Future<void> Function() onSignOut;

  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> with WidgetsBindingObserver {
  int index = 0;

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
        onOpenTasks: () => setState(() => index = 1),
        onOpenExploration: () => setState(() => index = 2),
        onOpenFamily: () => setState(() => index = 3),
      ),
      TasksScreen(controller: widget.controller),
      ExplorationScreen(controller: widget.controller),
      FamilyScreen(controller: widget.controller),
      ImpactScreen(controller: widget.controller),
      DeviceScreen(controller: widget.controller),
    ];
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        titleSpacing: 18,
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
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                ),
                Text(
                  widget.controller.context?.activeHousehold.name ?? '今天也慢慢來',
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
              itemBuilder: (context) => widget.controller.context!.households
                  .map(
                    (household) => PopupMenuItem(
                      value: household.id,
                      child: Row(
                        children: [
                          Icon(
                            household.id ==
                                    widget.controller.context!.activeHouseholdId
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
          IconButton(
            onPressed: widget.onSignOut,
            tooltip: '登出 ${widget.accountEmail}',
            icon: const Icon(Icons.logout_rounded),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: Stack(
        children: [
          KeyedSubtree(key: ValueKey(index), child: screens[index]),
          if (widget.controller.notice != null)
            Positioned(
              right: 12,
              bottom: 12,
              left: 12,
              child: Material(
                elevation: 4,
                borderRadius: BorderRadius.circular(8),
                color: ink,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          widget.controller.notice!,
                          style: const TextStyle(color: Colors.white),
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
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) {
          if (index == 2 && value != 2 && widget.controller.exploring) {
            widget.controller.stopExploration();
          }
          setState(() => index = value);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: '今天',
          ),
          NavigationDestination(
            icon: Icon(Icons.checklist_outlined),
            selectedIcon: Icon(Icons.checklist_rounded),
            label: '任務',
          ),
          NavigationDestination(
            icon: Icon(Icons.explore_outlined),
            selectedIcon: Icon(Icons.explore_rounded),
            label: '探索',
          ),
          NavigationDestination(
            icon: Icon(Icons.family_restroom_outlined),
            selectedIcon: Icon(Icons.family_restroom_rounded),
            label: '家人',
          ),
          NavigationDestination(
            icon: Icon(Icons.public_outlined),
            selectedIcon: Icon(Icons.public_rounded),
            label: '公益',
          ),
          NavigationDestination(
            icon: Icon(Icons.hub_outlined),
            selectedIcon: Icon(Icons.hub_rounded),
            label: '互動樹',
          ),
        ],
      ),
    );
  }
}
