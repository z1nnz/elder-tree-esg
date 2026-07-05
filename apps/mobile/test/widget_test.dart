import 'package:elder_tree_mobile/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows the companion tree home experience', (tester) async {
    await tester.pumpWidget(const ElderTreeApp());
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('綠伴'), findsOneWidget);
    expect(find.text('今天'), findsOneWidget);
    expect(find.text('任務'), findsOneWidget);
    expect(find.text('家人'), findsOneWidget);
    expect(find.text('公益'), findsOneWidget);
    expect(find.text('互動樹'), findsOneWidget);
  });
}
