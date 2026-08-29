import 'package:flutter/material.dart';

import 'app_controller.dart';
import 'models.dart';
import 'theme.dart';

Future<bool?> openJourneyLibrary(
  BuildContext context,
  AppController controller,
) {
  final theme = Theme.of(context);
  final scaler = MediaQuery.textScalerOf(context);
  return Navigator.of(context).push<bool>(
    MaterialPageRoute(
      builder: (context) => Theme(
        data: theme,
        child: MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: scaler),
          child: JourneyLibraryScreen(controller: controller),
        ),
      ),
    ),
  );
}

String _day(DateTime value) {
  final date = value.toLocal();
  return '${date.year} 年 ${date.month} 月 ${date.day} 日';
}

class JourneyLibraryScreen extends StatefulWidget {
  const JourneyLibraryScreen({required this.controller, super.key});
  final AppController controller;
  @override
  State<JourneyLibraryScreen> createState() => _JourneyLibraryScreenState();
}

class _JourneyLibraryScreenState extends State<JourneyLibraryScreen> {
  bool choosing = false;
  AppController get controller => widget.controller;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) controller.loadJourneyShelf();
    });
  }

  Future<void> _start(JourneyChoiceModel choice) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        scrollable: true,
        title: Text('一起開始「${choice.title}」？'),
        content: const Text(
          '這會切換整個樹伴圈目前的旅程，已完成的紀錄都會保留。還沒有人接棒時可以換一段；開始接力後，先一起完成再出發。',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('再想一下'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('一起出發'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final started = await controller.startJourney(choice);
    if (mounted && started) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) {
      final shelf = controller.journeyShelf;
      final busy = controller.journeyStarting;
      return PopScope(
        canPop: !busy,
        child: Scaffold(
          appBar: AppBar(
            title: const Text('共同年輪'),
            leading: IconButton(
              tooltip: '返回',
              onPressed: busy ? null : () => Navigator.of(context).maybePop(),
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            actions: [
              IconButton(
                tooltip: '重新整理共同紀錄',
                onPressed: busy || controller.journeyLoading
                    ? null
                    : controller.loadJourneyShelf,
                icon: const Icon(Icons.refresh_rounded),
              ),
            ],
          ),
          body: SafeArea(
            top: false,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 680),
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(24, 22, 24, 40),
                  children: [
                    const Text(
                      '把我們的日常，留在樹上。',
                      style: TextStyle(
                        fontSize: 28,
                        height: 1.4,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      shelf == null
                          ? '每一段共行旅程，都有值得回看的片刻。'
                          : '一起完成 ${shelf.completedCount} 段旅程。紀念枝、參與的樹伴和走過的篇章，都留在這裡。',
                      style: const TextStyle(
                        fontSize: 16,
                        height: 1.65,
                        color: mutedInk,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Wrap(
                      spacing: 12,
                      runSpacing: 8,
                      children: [
                        ChoiceChip(
                          label: const Text('旅程紀錄'),
                          selected: !choosing,
                          padding: const EdgeInsets.all(12),
                          onSelected: busy
                              ? null
                              : (_) => setState(() => choosing = false),
                        ),
                        ChoiceChip(
                          label: const Text('選下一段'),
                          selected: choosing,
                          padding: const EdgeInsets.all(12),
                          onSelected: busy
                              ? null
                              : (_) => setState(() => choosing = true),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    if (controller.journeyLoading)
                      const Padding(
                        padding: EdgeInsets.only(bottom: 20),
                        child: LinearProgressIndicator(
                          semanticsLabel: '正在讀取共同紀錄',
                        ),
                      ),
                    if (controller.journeyError != null) ...[
                      Semantics(
                        liveRegion: true,
                        child: Text(
                          controller.journeyError!,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                            fontSize: 16,
                            height: 1.6,
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed:
                            busy ||
                                controller.journeyLoading ||
                                controller.offlineDemo
                            ? null
                            : controller.loadJourneyShelf,
                        child: const Text('重新讀取旅程'),
                      ),
                      const SizedBox(height: 20),
                    ],
                    if (shelf != null && !choosing) ...[
                      if (shelf.results.isEmpty) ...[
                        const Icon(Icons.spa_outlined, color: forest, size: 52),
                        const SizedBox(height: 18),
                        const Text(
                          '第一片共同的葉子，\n等你們一起留下。',
                          style: TextStyle(
                            fontSize: 24,
                            height: 1.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          '完成一段共行旅程後，就能在這裡回看大家的參與紀錄。不需要消費，也不用急著一次完成。',
                          style: TextStyle(
                            fontSize: 16,
                            height: 1.65,
                            color: mutedInk,
                          ),
                        ),
                      ],
                      for (final result in shelf.results) ...[
                        _JourneyRecord(result: result),
                        const SizedBox(height: 24),
                      ],
                      if (shelf.nextCursor != null)
                        OutlinedButton(
                          onPressed: busy || controller.journeyLoading
                              ? null
                              : () => controller.loadJourneyShelf(more: true),
                          child: const Text('看看更早的年輪'),
                        ),
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: busy
                            ? null
                            : () => setState(() => choosing = true),
                        child: const Text('選擇下一段旅程'),
                      ),
                    ],
                    if (shelf != null && choosing) ...[
                      const Text(
                        '挑一段現在做得到的',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        '不同的旅程，留下不同的紀念枝。同一段完成後，從出發日算起滿七天才再次開放。',
                        style: TextStyle(
                          fontSize: 16,
                          height: 1.65,
                          color: mutedInk,
                        ),
                      ),
                      const SizedBox(height: 24),
                      if (shelf.choices.isEmpty)
                        const Text('目前沒有開放的旅程，稍後再來看看。'),
                      for (final choice in shelf.choices) ...[
                        Text(
                          choice.title,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${choice.minimumContributors} 位樹伴 · ${choice.chapterCount} 個篇章 · 收藏「${choice.keepsakeName}」',
                          style: const TextStyle(
                            color: forest,
                            fontSize: 15,
                            height: 1.65,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          choice.description,
                          style: const TextStyle(fontSize: 16, height: 1.65),
                        ),
                        const SizedBox(height: 16),
                        if (choice.unavailableReason != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Text(
                              _reason(choice),
                              style: const TextStyle(
                                fontSize: 16,
                                color: mutedInk,
                                height: 1.6,
                              ),
                            ),
                          ),
                        if (choice.actionId ==
                                controller.circle.activeAction?.id &&
                            controller.circle.activeAction?.completed == false)
                          OutlinedButton(
                            onPressed: busy
                                ? null
                                : () => Navigator.of(context).pop(true),
                            child: const Text('回到進行中的旅程'),
                          )
                        else
                          OutlinedButton(
                            onPressed:
                                busy ||
                                    controller.journeyLoading ||
                                    controller.offlineDemo ||
                                    choice.unavailableReason != null
                                ? null
                                : () => _start(choice),
                            child: Text(busy ? '正在準備…' : '開始這段旅程'),
                          ),
                        const SizedBox(height: 24),
                        const Divider(),
                        const SizedBox(height: 24),
                      ],
                    ],
                    const SizedBox(height: 24),
                    const Text(
                      '這裡記錄數位生命樹的基本年輪。自我確認不等於現場認證、公益時數或已完成真實植樹；真實植樹需另行確認資金與合作執行。',
                      style: TextStyle(
                        color: mutedInk,
                        fontSize: 14,
                        height: 1.65,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    },
  );

  String _reason(JourneyChoiceModel choice) =>
      switch (choice.unavailableReason) {
        'IN_PROGRESS' => '先一起完成目前的旅程，再接下一段。',
        'COOLDOWN' =>
          choice.availableAt == null
              ? '這段旅程稍後再開放。'
              : '${_day(choice.availableAt!)}後再開放；可以先選另一段。',
        'NOT_ENOUGH_MEMBERS' =>
          '需要至少 ${choice.minimumContributors} 位樹伴，先邀請同行的人。',
        _ => '這段旅程目前無法開啟，請重新整理。',
      };
}

class _JourneyRecord extends StatelessWidget {
  const _JourneyRecord({required this.result});
  final JourneyResultModel result;
  @override
  Widget build(BuildContext context) => Material(
    color: const Color(0xFFEAF2EB),
    borderRadius: BorderRadius.circular(24),
    clipBehavior: Clip.antiAlias,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.eco_outlined, color: forest, size: 36),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  result.keepsakeName,
                  style: const TextStyle(
                    fontSize: 26,
                    color: forest,
                    fontWeight: FontWeight.w700,
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            result.title,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${_day(result.completedAt)} · ${result.contributions.map((item) => item.memberId).toSet().length} 位樹伴同行',
            style: const TextStyle(fontSize: 15, color: mutedInk, height: 1.65),
          ),
          const SizedBox(height: 8),
          Text(
            '留下 ${result.growthPoints} 點基本年輪',
            style: const TextStyle(fontSize: 16, color: forest, height: 1.6),
          ),
          if (result.historicalImport)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                '這段較早的旅程依既有紀錄整理，姓名為整理時的資料。',
                style: TextStyle(fontSize: 14, color: mutedInk, height: 1.6),
              ),
            ),
          const SizedBox(height: 12),
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: const Text('回看大家留下的片刻'),
            children: [
              for (final contribution in result.contributions)
                Padding(
                  padding: const EdgeInsets.only(bottom: 20),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          contribution.displayName,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          contribution.actionTitle,
                          style: const TextStyle(fontSize: 16, height: 1.6),
                        ),
                        Text(
                          '${switch (contribution.witnessTier) {
                            ActionWitnessTier.selfCheck => '自我確認',
                            ActionWitnessTier.process => '流程見證',
                            ActionWitnessTier.composite => '複合見證',
                            ActionWitnessTier.partner => '合作單位見證',
                          }} · ${_day(contribution.witnessedAt)}${contribution.usedAlternative ? ' · 採替代行動' : ''}',
                          style: const TextStyle(
                            fontSize: 14,
                            color: mutedInk,
                            height: 1.6,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    ),
  );
}
