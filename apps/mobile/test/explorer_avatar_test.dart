import 'package:elder_tree_mobile/src/screens.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('exploration uses the authored player artwork', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: ExplorerAvatar())),
    );

    final image = tester.widget<Image>(find.byType(Image));
    expect(image.image, isA<AssetImage>());
    expect(
      (image.image as AssetImage).assetName,
      'assets/characters/explorer_v1.png',
    );
  });
}
