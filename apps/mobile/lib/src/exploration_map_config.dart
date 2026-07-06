enum ExplorationMapMode { adventure, street }

class ExplorationMapPresentation {
  const ExplorationMapPresentation({
    required this.style,
    required this.zoom,
    required this.pitch,
    required this.bearing,
  });

  final String style;
  final double zoom;
  final double pitch;
  final double bearing;
}

ExplorationMapPresentation explorationMapPresentation(
  ExplorationMapMode mode, {
  required String streetStyleUrl,
}) {
  return switch (mode) {
    ExplorationMapMode.adventure => const ExplorationMapPresentation(
      style: adventureMapStyle,
      zoom: 15.4,
      pitch: 52,
      bearing: -18,
    ),
    ExplorationMapMode.street => ExplorationMapPresentation(
      style: streetStyleUrl,
      zoom: 14.4,
      pitch: 0,
      bearing: 0,
    ),
  };
}

const adventureMapStyle = r'''
{
  "version": 8,
  "name": "Green Companion Adventure",
  "sources": {
    "openmaptiles": {
      "type": "vector",
      "url": "https://tiles.openfreemap.org/planet"
    }
  },
  "layers": [
    {
      "id": "game-background",
      "type": "background",
      "paint": {
        "background-color": "#8BE89A"
      }
    },
    {
      "id": "game-landcover",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "paint": {
        "fill-color": [
          "match",
          ["get", "class"],
          "wood", "#55D58A",
          "grass", "#8EEF83",
          "farmland", "#A4EF8E",
          "#86E895"
        ],
        "fill-opacity": 0.86
      }
    },
    {
      "id": "game-landuse",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landuse",
      "paint": {
        "fill-color": [
          "match",
          ["get", "class"],
          "residential", "#A5EEA0",
          "commercial", "#A2E7A4",
          "industrial", "#A8E4A8",
          "cemetery", "#73D98A",
          "#92EA98"
        ],
        "fill-opacity": 0.72
      }
    },
    {
      "id": "game-parks",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "park",
      "paint": {
        "fill-color": "#54DE78",
        "fill-outline-color": "#42C76B"
      }
    },
    {
      "id": "game-water",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "water",
      "paint": {
        "fill-color": "#74DAEA"
      }
    },
    {
      "id": "game-waterways",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "waterway",
      "paint": {
        "line-color": "#65D3E6",
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          12, 1,
          18, 5
        ]
      }
    },
    {
      "id": "game-buildings",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "building",
      "minzoom": 13,
      "maxzoom": 15.5,
      "paint": {
        "fill-color": "#B9F0B2",
        "fill-outline-color": "#89D89C",
        "fill-opacity": 0.82
      }
    },
    {
      "id": "game-buildings-3d",
      "type": "fill-extrusion",
      "source": "openmaptiles",
      "source-layer": "building",
      "minzoom": 15.5,
      "paint": {
        "fill-extrusion-color": "#B8EFB5",
        "fill-extrusion-height": [
          "coalesce",
          ["get", "render_height"],
          8
        ],
        "fill-extrusion-base": [
          "coalesce",
          ["get", "render_min_height"],
          0
        ],
        "fill-extrusion-opacity": 0.82
      }
    },
    {
      "id": "game-road-casing",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#D8F3DC",
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          12, 2.4,
          16, 10,
          19, 25
        ]
      }
    },
    {
      "id": "game-roads",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": [
          "match",
          ["get", "class"],
          "path", "#4F9F8E",
          "track", "#4F9F8E",
          "service", "#468F82",
          "#397F75"
        ],
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          12, 1.2,
          16, 6.5,
          19, 18
        ]
      }
    }
  ]
}
''';
