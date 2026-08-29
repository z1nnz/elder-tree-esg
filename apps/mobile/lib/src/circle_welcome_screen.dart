import 'package:flutter/material.dart';

import 'app_controller.dart';
import 'circle_membership_screen.dart';
import 'circle_profile_screen.dart';
import 'theme.dart';

class CircleWelcomeScreen extends StatelessWidget {
  const CircleWelcomeScreen({required this.controller, super.key});
  final AppController controller;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('樹伴')),
    body: SafeArea(
      top: false,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(24, 32, 24, 32),
            children: [
              const Icon(
                Icons.spa_outlined,
                size: 52,
                color: forest,
                semanticLabel: '生命樹的新芽',
              ),
              const SizedBox(height: 28),
              const Text(
                '你的第一棵生命樹，\n準備開始了。',
                style: TextStyle(
                  fontSize: 30,
                  height: 1.35,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                '從一個樹伴圈開始。和家人、朋友或社區夥伴，把一起走過的日常留在樹上。',
                style: TextStyle(fontSize: 16, color: mutedInk, height: 1.65),
              ),
              const SizedBox(height: 28),
              const Text(
                '不必一次找齊所有人',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              const Text(
                '可以先替樹伴圈取名，之後再邀請同行的人；也可以使用別人給你的邀請碼。',
                style: TextStyle(fontSize: 16, color: mutedInk, height: 1.65),
              ),
              const SizedBox(height: 28),
              FilledButton(
                onPressed: controller.membershipBusy
                    ? null
                    : () => openCircleProfile(
                        context,
                        controller,
                        profile: controller.context!.activeHousehold,
                      ),
                child: const Text('為樹伴圈取名'),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: controller.membershipBusy
                    ? null
                    : () => openCircleMembership(
                        context,
                        controller,
                        joining: true,
                      ),
                child: const Text('我有邀請碼'),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: controller.membershipBusy
                    ? null
                    : controller.deferCircleSetup,
                child: const Text('稍後設定，先看看'),
              ),
              const SizedBox(height: 24),
              const Text(
                '日常行動免費參與。真實植樹由合作單位執行，需另行確認資金與種植名額。',
                style: TextStyle(fontSize: 14, color: mutedInk, height: 1.6),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
