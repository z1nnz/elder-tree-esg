import 'package:flutter/material.dart';

import 'app_controller.dart';
import 'screens.dart';
import 'theme.dart';

class RootShell extends StatefulWidget {
  const RootShell({required this.controller, super.key});
  final AppController controller;

  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final screens = [
      HomeScreen(controller: widget.controller, onOpenTasks: () => setState(() => index = 1)),
      TasksScreen(controller: widget.controller),
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
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '綠伴',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                ),
                Text(
                  '今天也慢慢來',
                  style: TextStyle(fontSize: 11, color: Color(0xFF6B756F)),
                ),
              ],
            ),
          ],
        ),
        actions: [
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
          IndexedStack(index: index, children: screens),
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
        onDestinationSelected: (value) => setState(() => index = value),
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
