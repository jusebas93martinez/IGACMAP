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
  const [cachedLocation, setCachedLocation] = useState(null); // Cache de ubicación

  // Cargar el GeoJSON al iniciar
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}puntos.geojson`)
      .then((response) => response.json())
      .then((data) => setGeojson(data))
      .catch((error) => console.error("Error cargando el GeoJSON:", error));
  }, []);

  // Capa de puntos
  const pointLayer = {
    id: "puntos",
    type: "circle",
    paint: {
      "circle-radius": [
        "case",
        ["in", ["get", "id"], ["literal", nearestPoints.map((p) => p.id)]],
        8, // Tamaño ampliado para los puntos seleccionados
        6, // Tamaño normal para los puntos no seleccionados
      ],
      "circle-color": [
        "case",
        ["in", ["get", "id"], ["literal", nearestPoints.map((p) => p.id)]],
        "#00FF00", // Color para los puntos seleccionados
        "#FF00FF", // Color para los puntos no seleccionados
      ],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#0000FF",
      "circle-stroke-opacity": 1,
    },
  };

  // Capa de texto
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

  // Capa de líneas
  const lineLayer = {
    id: "lines",
    type: "line",
    paint: {
      "line-color": "#007AFF",
      "line-width": 2,
    },
  };

  // Capa de borde de líneas
  const lineBorderLayer = {
    id: "lines-border",
    type: "line",
    paint: {
      "line-color": "#000000",
      "line-width": 4,
      "line-opacity": 1,
    },
  };

  // Calcular el tiempo de seguimiento
  const calculateTrackingTime = (distance) => {
    return 15 + 5 * distance;
  };

  // Formatear el tiempo
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

  // Encontrar los puntos más cercanos
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

  // Manejar el clic en el mapa
  const handleMapClick = useCallback(
    (event) => {
      const map = event.target;
      const features = map.queryRenderedFeatures(event.point, {
        layers: ["puntos"],
      });

      if (features.length > 0) {
        // Clic en un punto
        const feature = features[0];
        setHoveredFeature({
          properties: feature.properties,
          coordinates: feature.geometry.coordinates,
        });
      } else {
        // Clic en el mapa
        const { lng, lat } = event.lngLat;
        findNearestPoints(lng, lat);
        setHoveredFeature(null); // Ocultar el popup si se hace clic en el mapa
      }
    },
    [geojson]
  );

  // Manejar el movimiento del mouse para cambiar el cursor
  const handleMouseMove = useCallback((event) => {
    const map = event.target;
    const features = map.queryRenderedFeatures(event.point, {
      layers: ["puntos"],
    });

    if (features.length > 0) {
      map.getCanvas().style.cursor = "pointer";
    } else {
      map.getCanvas().style.cursor = "default";
    }
  }, []);

  // Manejar cambios en los inputs de coordenadas
  const handleCoordInputChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;

    // Validaciones para cada campo
    if (name.includes("Deg")) {
      newValue = value.slice(0, 3); // Máximo 3 dígitos
      if (newValue > 360) newValue = 360;
    } else if (name.includes("Min")) {
      newValue = value.slice(0, 2); // Máximo 2 dígitos
      if (newValue > 60) newValue = 60;
    } else if (name.includes("Sec")) {
      const regex = /^\d{0,2}(\.\d{0,5})?$/; // Máximo 2 dígitos enteros y 5 decimales
      if (!regex.test(value)) {
        newValue = coordInput[name]; // Mantener el valor anterior si no cumple con la expresión regular
      } else if (parseFloat(value) > 60) {
        newValue = "60.00000";
      }
    }

    setCoordInput((prev) => ({ ...prev, [name]: newValue }));
  };

  // Manejar el envío de coordenadas
  const handleCoordInputSubmit = () => {
    const { latDeg, latMin, latSec, lngDeg, lngMin, lngSec } = coordInput;

    if (!latDeg || !latMin || !latSec || !lngDeg || !lngMin || !lngSec) {
      alert("Por favor, completa todos los campos.");
      return;
    }

    const lat = convertDMStoDecimal(latDeg, latMin, latSec);
    const lng = -convertDMStoDecimal(lngDeg, lngMin, lngSec); // Multiplicar por -1
    findNearestPoints(lng, lat);
  };

  // Convertir grados, minutos y segundos a decimal
  const convertDMStoDecimal = (deg, min, sec) => {
    return parseFloat(deg) + parseFloat(min) / 60 + parseFloat(sec) / 3600;
  };

  // Obtener la ubicación del usuario con cache
  const getUserLocation = () => {
    const now = Date.now();
    const cacheExpirationTime = 5 * 60 * 1000; // 5 minutos en milisegundos

    // Verificar si la ubicación en caché es válida
    if (
      cachedLocation &&
      now - cachedLocation.timestamp < cacheExpirationTime
    ) {
      const { latitude, longitude } = cachedLocation;
      findNearestPoints(longitude, latitude);
      return;
    }

    // Si no hay caché válida, obtener una nueva ubicación
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCachedLocation({ latitude, longitude, timestamp: now }); // Guardar en caché
          findNearestPoints(longitude, latitude);
        },
        (error) => {
          console.error("Error obteniendo la ubicación:", error);
          alert("No se pudo obtener la ubicación. Intenta nuevamente.");
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    } else {
      alert("Tu navegador no soporta geolocalización.");
    }
  };

  return (
    <div id="map-container">
      <Map
        id="main-map"
        mapLib={maplibregl}
        initialViewState={{
          longitude: -74.0721,
          latitude: 4.71098,
          zoom: 5,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://tiles.basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        interactiveLayerIds={geojson ? ["puntos"] : []}
        onClick={handleMapClick}
        onMouseMove={handleMouseMove}
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
                  <strong>{key}:</strong>{" "}
                  {key === "Enlace" ? (
                    <a href={value} target="_blank" rel="noopener noreferrer">
                      Ver enlace
                    </a>
                  ) : (
                    value
                  )}
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
            maxLength={3}
          />
          <input
            type="text"
            name="latMin"
            value={coordInput.latMin}
            onChange={handleCoordInputChange}
            placeholder="Minutos"
            maxLength={2}
          />
          <input
            type="text"
            name="latSec"
            value={coordInput.latSec}
            onChange={handleCoordInputChange}
            placeholder="Segundos"
            pattern="^\d{0,2}(\.\d{0,5})?$"
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
            maxLength={3}
          />
          <input
            type="text"
            name="lngMin"
            value={coordInput.lngMin}
            onChange={handleCoordInputChange}
            placeholder="Minutos"
            maxLength={2}
          />
          <input
            type="text"
            name="lngSec"
            value={coordInput.lngSec}
            onChange={handleCoordInputChange}
            placeholder="Segundos"
            pattern="^\d{0,2}(\.\d{0,5})?$"
          />
        </div>
        <button onClick={handleCoordInputSubmit}>Buscar</button>
      </div>

      <div className="footer-label">By Sebastian Martinez</div>

      <button className="gps-button" onClick={getUserLocation}>
        Usar Ubicación Actual
      </button>
    </div>
  );
}

export default App;
