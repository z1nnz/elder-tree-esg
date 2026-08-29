import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import 'theme.dart';

/// A data-driven, replaceable animation container for the circle's life tree.
///
/// The painter is the first production-safe fallback while the approved layered
/// art pack is being built. It deliberately receives only verified state from
/// the caller and never invents a keepsake locally.
class LifeTreeArtwork extends StatefulWidget {
  const LifeTreeArtwork({
    required this.stageIndex,
    required this.stageCount,
    required this.stageLabel,
    required this.keepsakeCount,
    this.size = 112,
    super.key,
  }) : assert(stageCount > 0),
       assert(stageIndex >= 0 && stageIndex < stageCount),
       assert(keepsakeCount >= 0);

  final int stageIndex;
  final int stageCount;
  final String stageLabel;
  final int keepsakeCount;
  final double size;

  @override
  State<LifeTreeArtwork> createState() => _LifeTreeArtworkState();
}

class _LifeTreeArtworkState extends State<LifeTreeArtwork>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _motion;
  bool? _reduceMotion;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    );
    _motion = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOutCubic,
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    if (_reduceMotion == reduceMotion) return;
    _reduceMotion = reduceMotion;
    if (reduceMotion) {
      _controller.stop();
      _controller.value = 1;
    } else {
      _controller.forward(from: 0);
    }
  }

  @override
  void didUpdateWidget(covariant LifeTreeArtwork oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.stageIndex != widget.stageIndex ||
        oldWidget.keepsakeCount != widget.keepsakeCount) {
      if (_reduceMotion == true) {
        _controller.value = 1;
      } else {
        _controller.forward(from: 0);
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = _reduceMotion ?? true;
    final semantics = widget.keepsakeCount == 0
        ? '生命樹目前是${widget.stageLabel}，還沒有共同紀念枝'
        : '生命樹目前是${widget.stageLabel}，已有 ${widget.keepsakeCount} 個共同紀念';
    return Semantics(
      image: true,
      label: semantics,
      child: ExcludeSemantics(
        child: SizedBox.square(
          dimension: widget.size,
          child: reduceMotion
              ? CustomPaint(
                  painter: LifeTreePainter(
                    stageIndex: widget.stageIndex,
                    stageCount: widget.stageCount,
                    keepsakeCount: widget.keepsakeCount,
                    motion: 1,
                  ),
                )
              : AnimatedBuilder(
                  animation: _motion,
                  builder: (_, _) => CustomPaint(
                    painter: LifeTreePainter(
                      stageIndex: widget.stageIndex,
                      stageCount: widget.stageCount,
                      keepsakeCount: widget.keepsakeCount,
                      motion: _motion.value,
                    ),
                  ),
                ),
        ),
      ),
    );
  }
}

@visibleForTesting
class LifeTreePainter extends CustomPainter {
  const LifeTreePainter({
    required this.stageIndex,
    required this.stageCount,
    required this.keepsakeCount,
    required this.motion,
  });

  final int stageIndex;
  final int stageCount;
  final int keepsakeCount;
  final double motion;

  @override
  void paint(Canvas canvas, Size size) {
    final growth = (stageIndex + 1) / stageCount;
    final breeze = math.sin(motion * math.pi * 2) * 1.8 * growth;
    final groundCenter = Offset(size.width / 2, size.height * 0.84);
    canvas.drawOval(
      Rect.fromCenter(
        center: groundCenter,
        width: size.width * (0.56 + growth * 0.18),
        height: size.height * 0.13,
      ),
      Paint()..color = Colors.white.withValues(alpha: 0.18),
    );

    if (stageIndex == 0) {
      _paintSeed(canvas, size, motion);
      return;
    }

    final trunkBottom = Offset(size.width / 2, size.height * 0.82);
    final trunkHeight = ui.lerpDouble(34, 65, growth)!;
    final trunkTop = trunkBottom.translate(breeze * 0.35, -trunkHeight);
    _paintTrunk(canvas, trunkBottom, trunkTop, growth);
    _paintBranches(canvas, trunkTop, growth, breeze);
    _paintCanopy(canvas, trunkTop, growth, breeze);
    _paintKeepsakes(canvas, trunkTop, growth, breeze);
    _paintGrowthLight(canvas, trunkBottom, trunkTop, motion);
  }

  void _paintSeed(Canvas canvas, Size size, double progress) {
    final center = Offset(size.width / 2, size.height * 0.68);
    canvas.drawOval(
      Rect.fromCenter(center: center, width: 26, height: 19),
      Paint()
        ..shader = ui.Gradient.linear(
          center.translate(-12, -8),
          center.translate(12, 8),
          const [warmYellow, Color(0xFF9B6A2F)],
        ),
    );
    canvas.drawCircle(
      center,
      17 + math.sin(progress * math.pi) * 4,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = lime.withValues(alpha: 0.22 + progress * 0.24),
    );
  }

  void _paintTrunk(Canvas canvas, Offset bottom, Offset top, double growth) {
    final width = ui.lerpDouble(8, 21, growth)!;
    final path = Path()
      ..moveTo(bottom.dx - width / 2, bottom.dy)
      ..cubicTo(
        bottom.dx - width * 0.78,
        bottom.dy - (bottom.dy - top.dy) * 0.38,
        top.dx - width * 0.44,
        top.dy + (bottom.dy - top.dy) * 0.2,
        top.dx - width * 0.15,
        top.dy,
      )
      ..lineTo(top.dx + width * 0.15, top.dy)
      ..cubicTo(
        top.dx + width * 0.48,
        top.dy + (bottom.dy - top.dy) * 0.18,
        bottom.dx + width * 0.74,
        bottom.dy - (bottom.dy - top.dy) * 0.35,
        bottom.dx + width / 2,
        bottom.dy,
      )
      ..close();
    canvas.drawPath(
      path,
      Paint()
        ..shader = ui.Gradient.linear(
          bottom.translate(-14, 0),
          top.translate(18, 0),
          const [Color(0xFF7A4A2A), Color(0xFF3F2418)],
        ),
    );
  }

  void _paintBranches(
    Canvas canvas,
    Offset trunkTop,
    double growth,
    double breeze,
  ) {
    final branchCount = math.min(5, stageIndex + 1);
    final paint = Paint()
      ..color = const Color(0xFF5C3421)
      ..style = PaintingStyle.stroke
      ..strokeWidth = ui.lerpDouble(3, 6, growth)!
      ..strokeCap = StrokeCap.round;
    for (var index = 0; index < branchCount; index++) {
      final left = index.isEven;
      final direction = left ? -1.0 : 1.0;
      final start = trunkTop.translate(direction * 2, 8 + index * 6.5);
      final reach = 18 + growth * 18 - index * 1.4;
      final end = start.translate(
        direction * reach + breeze * (0.4 + index * 0.08),
        -13 + index * 1.8,
      );
      final path = Path()
        ..moveTo(start.dx, start.dy)
        ..quadraticBezierTo(
          start.dx + direction * reach * 0.55,
          start.dy - 3,
          end.dx,
          end.dy,
        );
      canvas.drawPath(path, paint);
    }
  }

  void _paintCanopy(
    Canvas canvas,
    Offset trunkTop,
    double growth,
    double breeze,
  ) {
    final radius = ui.lerpDouble(17, 39, growth)!;
    final center = trunkTop.translate(breeze, -radius * 0.25);
    final canopyPaint = Paint()
      ..shader = ui.Gradient.radial(
        center.translate(-radius * 0.3, -radius * 0.35),
        radius * 1.25,
        const [lime, Color(0xFF5DBA62), Color(0xFF176B4A), forestDark],
        const [0, 0.32, 0.74, 1],
      );
    final clusters = <Offset>[
      center,
      center.translate(-radius * 0.55, radius * 0.08),
      center.translate(radius * 0.54, radius * 0.09),
      center.translate(-radius * 0.08, -radius * 0.48),
      center.translate(-radius * 0.16, radius * 0.44),
    ];
    for (var index = 0; index < clusters.length; index++) {
      if (stageIndex == 1 && index > 1) break;
      canvas.drawCircle(
        clusters[index],
        radius * (index == 0 ? 0.62 : 0.53),
        canopyPaint,
      );
    }

    final leafPaint = Paint()..color = lime.withValues(alpha: 0.88);
    final leafCount = math.max(2, stageIndex * 4);
    for (var index = 0; index < leafCount; index++) {
      final angle = (index / leafCount) * math.pi * 2;
      final distance = radius * (0.34 + (index % 3) * 0.16);
      final leafCenter = center.translate(
        math.cos(angle) * distance + breeze * (index.isEven ? 0.2 : 0.35),
        math.sin(angle) * distance * 0.72,
      );
      canvas.save();
      canvas.translate(leafCenter.dx, leafCenter.dy);
      canvas.rotate(angle + 0.7);
      canvas.drawOval(
        Rect.fromCenter(center: Offset.zero, width: 5.5, height: 13),
        leafPaint,
      );
      canvas.restore();
    }
  }

  void _paintKeepsakes(
    Canvas canvas,
    Offset trunkTop,
    double growth,
    double breeze,
  ) {
    if (stageIndex < 3 || keepsakeCount == 0) return;
    final visibleCount = math.min(keepsakeCount, 6);
    final slots = <Offset>[
      const Offset(-0.29, -0.34),
      const Offset(0.31, -0.3),
      const Offset(-0.47, 0.02),
      const Offset(0.5, 0.08),
      const Offset(-0.2, 0.26),
      const Offset(0.24, 0.28),
    ];
    final crownRadius = ui.lerpDouble(17, 39, growth)!;
    final crownCenter = trunkTop.translate(breeze, -crownRadius * 0.25);
    for (var index = 0; index < visibleCount; index++) {
      final slot = slots[index];
      final center = crownCenter.translate(
        slot.dx * crownRadius * 1.8,
        slot.dy * crownRadius * 1.8,
      );
      final color = index.isEven ? warmYellow : const Color(0xFFED8A62);
      canvas.drawLine(
        center.translate(0, -7),
        center,
        Paint()
          ..color = Colors.white.withValues(alpha: 0.72)
          ..strokeWidth = 1.4,
      );
      canvas.drawCircle(center, 5.2, Paint()..color = color);
      canvas.drawCircle(
        center.translate(-1.6, -1.8),
        1.2,
        Paint()..color = Colors.white.withValues(alpha: 0.68),
      );
    }
  }

  void _paintGrowthLight(
    Canvas canvas,
    Offset bottom,
    Offset top,
    double progress,
  ) {
    if (progress <= 0 || progress >= 1) return;
    final point = Offset.lerp(bottom, top, progress)!;
    canvas.drawCircle(
      point,
      3.4,
      Paint()
        ..color = warmYellow.withValues(alpha: 0.9)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
    );
  }

  @override
  bool shouldRepaint(covariant LifeTreePainter oldDelegate) {
    return oldDelegate.stageIndex != stageIndex ||
        oldDelegate.stageCount != stageCount ||
        oldDelegate.keepsakeCount != keepsakeCount ||
        oldDelegate.motion != motion;
  }
}
