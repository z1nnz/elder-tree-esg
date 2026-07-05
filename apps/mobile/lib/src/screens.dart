import 'package:flutter/material.dart';

import 'app_controller.dart';
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
            ...incomplete.take(2).map(
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
            child: _TaskTile(task: task, controller: controller, expanded: true),
          ),
        ),
      ],
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
        const _PageHeading(
          title: '家人的陪伴',
          subtitle: '不必在同一個地方，也能一起照顧這棵家庭樹。',
        ),
        const SizedBox(height: 14),
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
                      await widget.controller
                          .sendFamilyMessage(messageController.text);
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
        const _SectionTitle(
          title: '最近訊息',
          subtitle: '裝置離線時會保留，重新連線後再送達',
        ),
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
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.public_rounded, color: warmYellow, size: 32),
              SizedBox(height: 24),
              Text(
                '24,750',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 36,
                  fontWeight: FontWeight.w900,
                ),
              ),
              Text(
                '公益池累積成長值',
                style: TextStyle(color: Color(0xFFBDD3C7)),
              ),
              SizedBox(height: 18),
              LinearProgressIndicator(
                value: .74,
                minHeight: 9,
                color: warmYellow,
                backgroundColor: Color(0xFF3C715C),
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
          title: '本期示範批次',
          subtitle: '每一筆分配都會保留狀態與稽核紀錄',
        ),
        const SizedBox(height: 10),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.forest_rounded, color: forest),
                    const SizedBox(width: 9),
                    const Expanded(
                      child: Text(
                        '七月社區綠化示範批次',
                        style: TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF1C5),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text(
                        'SIMULATED',
                        style: TextStyle(
                          color: Color(0xFF795F12),
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ],
                ),
                const Divider(height: 28),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _ImpactValue(label: '分配成長值', value: '12,800'),
                    _ImpactValue(label: '示範換算', value: '12.8 棵'),
                    _ImpactValue(label: '狀態', value: '待公開'),
                  ],
                ),
              ],
            ),
          ),
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
          const _SectionTitle(
            title: '附近裝置',
            subtitle: '選擇後會進入 Wi-Fi 配網流程',
          ),
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
    final serial = TextEditingController(text: 'TREE-DEMO-001');
    final code = TextEditingController(text: '246810');
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
                      : FilledButton.icon(
                          onPressed: () => task.verificationMode ==
                                  VerificationMode.photoAi
                              ? controller.photographTask(task)
                              : controller.completeTask(task),
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
                style: const TextStyle(
                  color: Color(0xFF69736D),
                  fontSize: 12,
                ),
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
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
      ),
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
              style: const TextStyle(
                color: Color(0xFF765F1D),
                height: 1.45,
              ),
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

class _ImpactValue extends StatelessWidget {
  const _ImpactValue({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(color: Color(0xFF69736D), fontSize: 11),
        ),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w900)),
      ],
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
