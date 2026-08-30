import 'package:flutter/material.dart';

import 'models.dart';
import 'theme.dart';

class JourneyWitnessProgress extends StatelessWidget {
  const JourneyWitnessProgress({
    required this.witness,
    required this.healthAccessLabel,
    super.key,
  });

  final ExplorationJourneyWitnessModel witness;
  final String healthAccessLabel;

  @override
  Widget build(BuildContext context) {
    final completed = witness.status == 'COMPLETED';
    final missing = <String>[
      if (witness.dwellProgress < 1) '停留',
      if (witness.stepProgress < 1) '步數',
      if (witness.distanceProgress < 1) '距離',
    ];
    final items = <Widget>[
      _WitnessRequirement(
        icon: Icons.schedule_rounded,
        label: '場域內停留',
        current: witness.dwellSeconds,
        requirement: witness.minimumDwellSeconds,
        suffix: '秒',
        progress: witness.dwellProgress,
      ),
      _WitnessRequirement(
        icon: Icons.directions_walk_rounded,
        label: '健康步數',
        current: witness.stepCount,
        requirement: witness.minimumStepCount,
        suffix: '步',
        progress: witness.stepProgress,
      ),
      _WitnessRequirement(
        icon: Icons.route_rounded,
        label: '場域內距離',
        current: witness.distanceMeters,
        requirement: witness.minimumDistanceMeters,
        suffix: '公尺',
        progress: witness.distanceProgress,
      ),
    ];

    return Semantics(
      container: true,
      label: completed ? '三項同行見證已完成' : '三項同行見證尚未完成，還差${missing.join('、')}',
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: completed
              ? lime.withValues(alpha: 0.13)
              : const Color(0xFFF4F8F1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: completed
                ? forest.withValues(alpha: 0.34)
                : const Color(0xFFD9E6D8),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                const Text(
                  '三項同行見證',
                  style: TextStyle(
                    color: forestDark,
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: completed ? forest : warmYellow,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    completed ? '已留下真實足跡' : '還差：${missing.join('、')}',
                    style: TextStyle(
                      color: completed ? Colors.white : ink,
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            LayoutBuilder(
              builder: (context, constraints) {
                if (constraints.maxWidth >= 600) {
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (var index = 0; index < items.length; index++) ...[
                        if (index > 0) const SizedBox(width: 10),
                        Expanded(child: items[index]),
                      ],
                    ],
                  );
                }
                return Column(
                  children: [
                    for (var index = 0; index < items.length; index++) ...[
                      if (index > 0) const SizedBox(height: 10),
                      items[index],
                    ],
                  ],
                );
              },
            ),
            if (!completed) ...[
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.health_and_safety_outlined,
                    color: forest,
                    size: 19,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      healthAccessLabel,
                      style: const TextStyle(
                        color: Color(0xFF53635A),
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        height: 1.45,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 7),
              const Text(
                '步數讀取會要求排除手動輸入；部分 Android 健康資料來源仍可能無法完整辨識。',
                style: TextStyle(
                  color: Color(0xFF6D786F),
                  fontSize: 11,
                  height: 1.45,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _WitnessRequirement extends StatelessWidget {
  const _WitnessRequirement({
    required this.icon,
    required this.label,
    required this.current,
    required this.requirement,
    required this.suffix,
    required this.progress,
  });

  final IconData icon;
  final String label;
  final int current;
  final int requirement;
  final String suffix;
  final double progress;

  @override
  Widget build(BuildContext context) {
    final done = progress >= 1;
    return Semantics(
      label: '$label，$current$suffix，共需$requirement$suffix',
      value: done ? '完成' : '${(progress * 100).round()}%',
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(13),
          border: Border.all(
            color: done
                ? forest.withValues(alpha: 0.28)
                : const Color(0xFFE1E8E2),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: done ? forest : const Color(0xFF65746A)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
                if (done)
                  const Icon(
                    Icons.check_circle_rounded,
                    color: forest,
                    size: 20,
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '$current / $requirement $suffix',
              style: const TextStyle(
                color: forestDark,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 7),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 8,
                color: done ? forest : lime,
                backgroundColor: const Color(0xFFE9EFE8),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
