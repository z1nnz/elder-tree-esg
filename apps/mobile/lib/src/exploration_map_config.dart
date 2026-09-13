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
      zoom: 15.9,
      pitch: 58,
      bearing: -28,
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
        "background-color": "#9BE9CE"
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
          "wood", "#59D994",
          "grass", "#90EDB0",
          "farmland", "#A8EEC0",
          "#91E7BA"
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
          "residential", "#A9ECCA",
          "commercial", "#A7E5C6",
          "industrial", "#B0E3C4",
          "cemetery", "#78D99F",
          "#9DE8C0"
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
        "fill-color": "#64D98C",
        "fill-outline-color": "#46BF82"
      }
    },
    {
      "id": "game-water",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "water",
      "paint": {
        "fill-color": "#69CAE6"
      }
    },
    {
      "id": "game-waterways",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "waterway",
      "paint": {
        "line-color": "#55C4DE",
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          12, 1,
          18, 5
        ]
      }
    },
    {
      "id": "game-road-casing",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "filter": [
        "match",
        ["get", "class"],
        ["motorway", "trunk", "primary", "secondary", "tertiary"],
        true,
        false
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#F7E5B3",
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          12, 1.8,
          16, 7.5,
          19, 19
        ]
      }
    },
    {
      "id": "game-roads",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "filter": [
        "match",
        ["get", "class"],
        ["motorway", "trunk", "primary", "secondary", "tertiary"],
        true,
        false
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#5E9D99",
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          12, 0.9,
          16, 4.6,
          19, 13
        ]
      }
    },
    {
      "id": "game-walkways",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "filter": [
        "match",
        ["get", "class"],
        ["path", "track", "pedestrian"],
        true,
        false
      ],
      "minzoom": 14.5,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#73AFA0",
        "line-opacity": 0.78,
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          14.5, 0.8,
          17, 2.4,
          19, 4.5
        ]
      }
    }
  ]
}
''';
