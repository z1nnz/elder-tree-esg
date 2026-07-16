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
      "id": "game-buildings",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "building",
      "minzoom": 13,
      "maxzoom": 15.5,
      "paint": {
        "fill-color": "#A7E8C8",
        "fill-outline-color": "#7BCAA6",
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
        "fill-extrusion-color": "#AFE7C8",
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
        "line-color": "#F7E5B3",
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
          "path", "#4D91A3",
          "track", "#4D91A3",
          "service", "#477F91",
          "#367A8F"
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
