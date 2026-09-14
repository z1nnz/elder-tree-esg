import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('web shell loads the MapLibre runtime before Flutter boots', () {
    final index = File('web/index.html').readAsStringSync();
    final scriptIndex = index.indexOf('maplibre-gl.js');
    final styleIndex = index.indexOf('maplibre-gl.css');
    final flutterIndex = index.indexOf('flutter_bootstrap.js');

    expect(scriptIndex, greaterThanOrEqualTo(0));
    expect(styleIndex, greaterThanOrEqualTo(0));
    expect(flutterIndex, greaterThan(scriptIndex));
    expect(flutterIndex, greaterThan(styleIndex));
  });
}
