import 'dart:convert';

import 'package:elder_tree_mobile/src/exploration_map_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('exploration map presentation', () {
    test('adventure mode uses a pitched, visually quiet game-style map', () {
      final presentation = explorationMapPresentation(
        ExplorationMapMode.adventure,
        streetStyleUrl: 'https://example.com/street-style',
      );
      final style = jsonDecode(presentation.style) as Map<String, dynamic>;
      final sources = style['sources'] as Map<String, dynamic>;
      final layers = (style['layers'] as List)
          .cast<Map<String, dynamic>>()
          .toList();
      final layerIds = layers.map((layer) => layer['id']).toSet();

      expect(presentation.pitch, greaterThanOrEqualTo(45));
      expect(presentation.bearing, isNot(0));
      expect(
        (sources['openmaptiles'] as Map<String, dynamic>)['url'],
        'https://tiles.openfreemap.org/planet',
      );
      expect(
        layerIds,
        containsAll([
          'game-background',
          'game-parks',
          'game-road-casing',
          'game-roads',
          'game-walkways',
        ]),
      );
      expect(layerIds, isNot(contains('game-buildings')));
      expect(layerIds, isNot(contains('game-buildings-3d')));
      final mainRoads = layers.singleWhere(
        (layer) => layer['id'] == 'game-roads',
      );
      expect(mainRoads['filter'], isNotNull);
    });

    test('street mode keeps the configured public map style flat', () {
      final presentation = explorationMapPresentation(
        ExplorationMapMode.street,
        streetStyleUrl: 'https://example.com/street-style',
      );

      expect(presentation.style, 'https://example.com/street-style');
      expect(presentation.pitch, 0);
      expect(presentation.bearing, 0);
    });
  });
}
