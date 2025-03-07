import { useEffect, useState, useCallback } from "react";
import { Map, Source, Layer, Popup, Marker } from "react-map-gl";
import maplibregl from "maplibre-gl";
import * as turf from "@turf/turf";
import "maplibre-gl/dist/maplibre-gl.css";

function App() {
  const [geojson, setGeojson] = useState(null);
  const [linesGeoJSON, setLinesGeoJSON] = useState(null);
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [nearestPoints, setNearestPoints] = useState([]);
  const [distances, setDistances] = useState([]);
  const [coordInput, setCoordInput] = useState({
    latDeg: "",
    latMin: "",
    latSec: "",
    lngDeg: "",
    lngMin: "",
    lngSec: "",
  });
  const [originPoint, setOriginPoint] = useState(null);

  useEffect(() => {
    fetch("/puntos.geojson")
      .then((response) => response.json())
      .then((data) => setGeojson(data))
      .catch((error) => console.error("Error cargando el GeoJSON:", error));
  }, []);

  const pointLayer = {
    id: "puntos",
    type: "circle",
    paint: {
      "circle-radius": 3, // Reducido de 8 a 6
      "circle-color": [
        "case",
        ["in", ["get", "id"], ["literal", nearestPoints.map((p) => p.id)]],
        "#00FF00", // Cambiado a verde
        "#FF00FF", // Cambiado a magenta
      ],
      "circle-stroke-width": 2, // Aumentado para que el borde sea más visible
      "circle-stroke-color": "#0000FF", // Cambiado a azul
      "circle-stroke-opacity": 1, // Opacidad completa para el borde
    },
  };

  const textLayer = {
    id: "labels",
    type: "symbol",
    layout: {
      "text-field": ["get", "Nombre"],
      "text-size": 16,
      "text-offset": [0, 1.1],
      "text-anchor": "top",
    },
    paint: {
      "text-color": "#000",
      "text-halo-color": "#FFF",
      "text-halo-width": 2,
    },
  };

  const lineLayer = {
    id: "lines",
    type: "line",
    paint: {
      "line-color": "#007AFF", // Color de la línea principal
      "line-width": 2, // Ancho de la línea principal
    },
  };

  const lineBorderLayer = {
    id: "lines-border",
    type: "line",
    paint: {
      "line-color": "#000000", // Color del borde
      "line-width": 4, // Ancho del borde (más ancho que la línea principal)
      "line-opacity": 1, // Opacidad del borde
    },
  };

  const calculateTrackingTime = (distance) => {
    return 15 + 5 * distance;
  };

  const formatTime = (minutes) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes === 0
        ? `${hours} h`
        : `${hours} h ${remainingMinutes} min`;
    }
    return `${minutes} min`;
  };

  const findNearestPoints = (lng, lat) => {
    if (!geojson) return;

    const clickedPoint = turf.point([lng, lat]);
    const points = geojson.features;

    const nearest = points
      .map((feature) => {
        const distance = turf.distance(clickedPoint, feature, {
          units: "kilometers",
        });
        const trackingTime = Math.ceil(calculateTrackingTime(distance));
        return {
          ...feature,
          id: feature.properties.id,
          distance: distance.toFixed(2),
          trackingTimeFormatted: formatTime(trackingTime),
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 6);

    setNearestPoints(nearest);
    setDistances(
      nearest.map((p) => ({
        name: p.properties.Nombre,
        distance: p.distance,
        trackingTime: p.trackingTimeFormatted,
      }))
    );

    const lines = {
      type: "FeatureCollection",
      features: nearest.map((point) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [[lng, lat], point.geometry.coordinates],
        },
      })),
    };

    setLinesGeoJSON(lines);
    setOriginPoint({ lng, lat });
  };

  const handleHover = useCallback((event) => {
    const feature = event.features?.[0];
    if (feature) {
      setHoveredFeature({
        properties: feature.properties,
        coordinates: feature.geometry.coordinates,
      });
    } else {
      setHoveredFeature(null);
    }
  }, []);

  const handleCoordInputChange = (e) => {
    const { name, value } = e.target;
    setCoordInput((prev) => ({ ...prev, [name]: value }));
  };

  const handleCoordInputSubmit = () => {
    const { latDeg, latMin, latSec, lngDeg, lngMin, lngSec } = coordInput;
    const lat = convertDMStoDecimal(latDeg, latMin, latSec);
    const lng = -convertDMStoDecimal(lngDeg, lngMin, lngSec); // Multiplicar por -1
    findNearestPoints(lng, lat);
  };

  const convertDMStoDecimal = (deg, min, sec) => {
    return parseFloat(deg) + parseFloat(min) / 60 + parseFloat(sec) / 3600;
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          findNearestPoints(longitude, latitude);
        },
        (error) => {
          console.error("Error obteniendo la ubicación:", error);
        }
      );
    } else {
      console.error("Geolocalización no soportada por el navegador.");
    }
  };

  return (
    <div id="map-container">
      <Map
        mapLib={maplibregl}
        initialViewState={{
          longitude: -74.0721,
          latitude: 4.71098,
          zoom: 5,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={`https://api.maptiler.com/maps/backdrop/style.json?key=Wnai4G4s1koZsp2dtjyh`}
        interactiveLayerIds={["puntos"]}
        onMouseEnter={() => {
          document.body.style.cursor = "default"; // Cambia el cursor a una flecha
        }}
        onMouseLeave={() => {
          document.body.style.cursor = ""; // Restaura el cursor a su estado predeterminado
        }}
        onClick={(event) => {
          if (!hoveredFeature) {
            const { lng, lat } = event.lngLat;
            findNearestPoints(lng, lat);
          }
        }}
        onMouseMove={handleHover}
      >
        {geojson && (
          <Source id="puntos" type="geojson" data={geojson}>
            <Layer {...pointLayer} />
            <Layer {...textLayer} />
          </Source>
        )}

        {linesGeoJSON && (
          <Source id="lines" type="geojson" data={linesGeoJSON}>
            <Layer {...lineBorderLayer} />
            <Layer {...lineLayer} />
          </Source>
        )}

        {originPoint && (
          <Marker
            longitude={originPoint.lng}
            latitude={originPoint.lat}
            anchor="center"
          >
            <div className="custom-marker"></div>
          </Marker>
        )}

        {hoveredFeature && (
          <Popup
            longitude={hoveredFeature.coordinates[0]}
            latitude={hoveredFeature.coordinates[1]}
            closeButton={false}
            closeOnClick={false}
            offset={[0, -10]}
          >
            <div className="popup-content">
              <h3 className="popup-title">
                {hoveredFeature.properties.Nombre}
              </h3>
              {Object.entries(hoveredFeature.properties).map(([key, value]) => (
                <div key={key} className="popup-item">
                  <strong>{key}:</strong> {value}
                </div>
              ))}
            </div>
          </Popup>
        )}
      </Map>

      {distances.length > 0 && (
        <div className="distance-box">
          <h3>Distancias y Tiempo GNSS</h3>
          <ul>
            {distances.map((point, index) => (
              <li key={index}>
                <strong>{point.name}:</strong> {point.distance} km -{" "}
                {point.trackingTime}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="coord-input-box">
        <h4>Ingresar Coordenadas</h4>
        <div>
          <label>Latitud:</label>
          <input
            type="text"
            name="latDeg"
            value={coordInput.latDeg}
            onChange={handleCoordInputChange}
            placeholder="Grados"
          />
          <input
            type="text"
            name="latMin"
            value={coordInput.latMin}
            onChange={handleCoordInputChange}
            placeholder="Minutos"
          />
          <input
            type="text"
            name="latSec"
            value={coordInput.latSec}
            onChange={handleCoordInputChange}
            placeholder="Segundos"
          />
        </div>
        <div>
          <label>Longitud:</label>
          <input
            type="text"
            name="lngDeg"
            value={coordInput.lngDeg}
            onChange={handleCoordInputChange}
            placeholder="Grados"
          />
          <input
            type="text"
            name="lngMin"
            value={coordInput.lngMin}
            onChange={handleCoordInputChange}
            placeholder="Minutos"
          />
          <input
            type="text"
            name="lngSec"
            value={coordInput.lngSec}
            onChange={handleCoordInputChange}
            placeholder="Segundos"
          />
        </div>
        <button onClick={handleCoordInputSubmit}>Buscar</button>
      </div>
      <div className="footer-label">By Sebastian Martinez</div>

      <button className="gps-button" onClick={getUserLocation}>
        Usar GPS
      </button>
    </div>
  );
}

export default App;
