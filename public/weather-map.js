/* global window, document, L */

window.addEventListener("DOMContentLoaded", () => {
  const mapElement = document.getElementById("selectionMap");
  const statusElement = document.getElementById("mapStatus");
  const outputElement = document.getElementById("selectionOutput");
  const copyButton = document.getElementById("copySelectionButton");
  const weatherFrame = document.getElementById("weatherPreviewFrame");
  const weatherPreviewCard = document.getElementById("weatherPreviewCard");
  const historyDaysAgoSelect = document.getElementById("historyDaysAgo");
  const weatherModeInputs = document.querySelectorAll(
    'input[name="weatherMode"]',
  );

  if (
    !mapElement ||
    !statusElement ||
    !outputElement ||
    !copyButton ||
    !weatherFrame ||
    !weatherPreviewCard ||
    !historyDaysAgoSelect ||
    weatherModeInputs.length === 0
  ) {
    return;
  }

  if (typeof L === "undefined") {
    statusElement.textContent =
      "Map library failed to load. Please refresh and try again.";
    statusElement.classList.add("error");
    return;
  }

  const usaCenter = [39.8283, -98.5795];
  const usaZoom = 5;
  const userZoom = 12;
  const markerLayer = L.layerGroup();
  const selectionOutlineLayer = L.layerGroup();
  const weatherOverlayLayer = L.layerGroup();
  let activeWeatherAddress = "";
  let activeSelectionMeta = null;

  const map = L.map(mapElement).setView(usaCenter, usaZoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    subdomains: ["a", "b", "c"],
    referrerPolicy: "strict-origin-when-cross-origin",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);
  markerLayer.addTo(map);
  selectionOutlineLayer.addTo(map);
  weatherOverlayLayer.addTo(map);

  map.addControl(
    new L.Control.Draw({
      edit: false,
      draw: {
        rectangle: {
          repeatMode: true,
          shapeOptions: {
            color: "#2563eb",
            weight: 2,
          },
        },
        marker: true,
        polyline: false,
        polygon: false,
        circle: false,
        circlemarker: false,
      },
    }),
  );

  function setStatus(message, isError) {
    statusElement.textContent = message;
    statusElement.classList.toggle("error", Boolean(isError));
  }

  function rounded(value) {
    return Number(value.toFixed(6));
  }

  function getSelectedWeatherMode() {
    return (
      document.querySelector('input[name="weatherMode"]:checked')?.value ||
      "forecast"
    );
  }

  function formatDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getSelectedWeatherDate() {
    const selectedDate = new Date();
    selectedDate.setHours(12, 0, 0, 0);

    if (getSelectedWeatherMode() === "historical") {
      const daysAgo = Number.parseInt(historyDaysAgoSelect.value || "7", 10);
      selectedDate.setDate(selectedDate.getDate() - daysAgo);
    }

    return formatDateValue(selectedDate);
  }

  function describeSelectedWeatherMode() {
    if (getSelectedWeatherMode() === "historical") {
      const daysAgo = Number.parseInt(historyDaysAgoSelect.value || "7", 10);
      return `historical weather from ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
    }

    return "forecast for today";
  }

  function syncWeatherModeControls() {
    historyDaysAgoSelect.disabled = getSelectedWeatherMode() !== "historical";
  }

  function refreshWeatherPreviewIfNeeded() {
    syncWeatherModeControls();

    if (!activeWeatherAddress) {
      return;
    }

    loadWeatherFrameForAddress(activeWeatherAddress, activeSelectionMeta);
    setStatus(`${describeSelectedWeatherMode()} is loading above.`);
  }

  function clearSelectionOutput() {
    outputElement.textContent =
      "Drop a pin to preview weather for that point, or draw a rectangle to select the bounding box and preview that area above.";
    outputElement.dataset.selection = "";
    copyButton.disabled = true;
    weatherPreviewCard.classList.remove("visible");
    weatherOverlayLayer.clearLayers();
    activeWeatherAddress = "";
    activeSelectionMeta = null;
  }

  function loadWeatherFrameForAddress(address, selectionMeta = null) {
    const weatherUrl = new URL("/weather/day", window.location.origin);
    activeWeatherAddress = address;
    activeSelectionMeta = selectionMeta;
    weatherOverlayLayer.clearLayers();
    weatherUrl.searchParams.set("address", address);
    weatherUrl.searchParams.set("date", getSelectedWeatherDate());
    weatherPreviewCard.classList.add("visible");
    weatherFrame.removeAttribute("srcdoc");
    weatherFrame.src = weatherUrl.toString();
  }

  function loadWeatherFrameForSelection(selection) {
    const bboxAddress = JSON.stringify({
      lowerLeft: {
        lat: selection.lowerLeft.lat,
        lon: selection.lowerLeft.lon,
      },
      upperRight: {
        lat: selection.upperRight.lat,
        lon: selection.upperRight.lon,
      },
    });
    loadWeatherFrameForAddress(bboxAddress, {
      type: "bbox",
      center: {
        lat: rounded((selection.lowerLeft.lat + selection.upperRight.lat) / 2),
        lon: rounded((selection.lowerLeft.lon + selection.upperRight.lon) / 2),
      },
    });
  }

  function addPinMarker(layer) {
    const latLng = layer.getLatLng();
    const lat = rounded(latLng.lat);
    const lon = rounded(latLng.lng);
    const selection = {
      lat,
      lon,
    };
    const formattedSelection = JSON.stringify(selection, null, 2);

    selectionOutlineLayer.clearLayers();
    weatherOverlayLayer.clearLayers();
    outputElement.textContent = formattedSelection;
    outputElement.dataset.selection = formattedSelection;
    copyButton.disabled = false;

    layer
      .bindPopup(`Pinned location<br>lat: ${lat}<br>lon: ${lon}`)
      .openPopup();
    markerLayer.addLayer(layer);
    map.setView([lat, lon], Math.max(map.getZoom(), userZoom + 3));
    loadWeatherFrameForAddress(`${lat}, ${lon}`, {
      type: "pin",
      lat,
      lon,
    });
    setStatus(
      `Pin dropped at lat ${lat}, lon ${lon}. Weather is loading above.`,
    );
  }

  function updateSelectionOutput(layer) {
    const bounds = layer.getBounds();
    const selection = {
      lowerLeft: {
        lat: rounded(bounds.getSouthWest().lat),
        lon: rounded(bounds.getSouthWest().lng),
      },
      upperRight: {
        lat: rounded(bounds.getNorthEast().lat),
        lon: rounded(bounds.getNorthEast().lng),
      },
    };

    const formattedSelection = JSON.stringify(selection, null, 2);
    outputElement.textContent = formattedSelection;
    outputElement.dataset.selection = formattedSelection;
    copyButton.disabled = false;

    map.once("moveend", () => {
      drawnItems.clearLayers();
    });

    map.fitBounds(bounds, {
      padding: [24, 24],
      maxZoom: 17,
    });

    selectionOutlineLayer.clearLayers();
    weatherOverlayLayer.clearLayers();
    L.rectangle(bounds, {
      color: "#ef4444",
      weight: 3,
      fill: false,
      dashArray: "8 6",
    }).addTo(selectionOutlineLayer);
    loadWeatherFrameForSelection(selection);
    setStatus(
      "Bounding box selected. Weather for that area is loading in the frame above.",
    );
  }

  map.on(L.Draw.Event.CREATED, (event) => {
    if (event.layerType === "marker") {
      addPinMarker(event.layer);
      return;
    }

    drawnItems.clearLayers();
    drawnItems.addLayer(event.layer);
    updateSelectionOutput(event.layer);
  });

  function renderWeatherOverlay(summaryElement) {
    if (!activeSelectionMeta) {
      return;
    }

    const iconUrl = summaryElement.dataset.iconUrl || "";
    const temp = summaryElement.dataset.temp || "--";
    const tempUnit = summaryElement.dataset.temperatureUnit || "";
    const rain = summaryElement.dataset.rain || "--";
    const precipUnit = summaryElement.dataset.precipitationUnit || "";
    const wind = summaryElement.dataset.wind || "--";
    const windUnit = summaryElement.dataset.windUnit || "";
    const summary = summaryElement.dataset.summary || "Weather";

    const latLng =
      activeSelectionMeta.type === "bbox"
        ? [activeSelectionMeta.center.lat, activeSelectionMeta.center.lon]
        : [activeSelectionMeta.lat, activeSelectionMeta.lon];

    const weatherMarker = L.marker(latLng, {
      icon: L.divIcon({
        className: "map-weather-overlay-wrapper",
        html: `
          <div class="map-weather-overlay" aria-label="${summary}">
            <div class="map-weather-overlay-top">
              <img src="${iconUrl}" alt="${summary}" class="map-weather-icon" />
              <div class="map-weather-temp">${temp}°${tempUnit}</div>
            </div>
            <div class="map-weather-stats">
              <span>🌧 ${rain} ${precipUnit}</span>
              <span>💨 ${wind} ${windUnit}</span>
            </div>
          </div>
        `,
        iconSize: [160, 72],
        iconAnchor: [80, 72],
      }),
      interactive: false,
    });

    weatherOverlayLayer.clearLayers();
    weatherMarker.addTo(weatherOverlayLayer);
  }

  function handleWeatherFrameLoad() {
    const frameDocument = weatherFrame.contentDocument;
    const summaryElement = frameDocument?.getElementById("mapWeatherSummary");

    if (!summaryElement) {
      return;
    }

    renderWeatherOverlay(summaryElement);
    setStatus(`${describeSelectedWeatherMode()} loaded on the map and above.`);
  }

  map.on(L.Draw.Event.DELETED, () => {
    clearSelectionOutput();
    setStatus("Selection removed. Draw a new pin or rectangle to continue.");
  });

  copyButton.addEventListener("click", async () => {
    const selectionText = outputElement.dataset.selection;

    if (!selectionText) {
      return;
    }

    if (!navigator.clipboard?.writeText) {
      setStatus(
        "Copy is not available in this browser. Coordinates are shown below.",
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(selectionText);
      setStatus("Corner coordinates copied to the clipboard.");
    } catch {
      setStatus(
        "Unable to copy automatically. Coordinates are shown below.",
        true,
      );
    }
  });

  weatherModeInputs.forEach((input) => {
    input.addEventListener("change", refreshWeatherPreviewIfNeeded);
  });

  historyDaysAgoSelect.addEventListener(
    "change",
    refreshWeatherPreviewIfNeeded,
  );
  weatherFrame.addEventListener("load", handleWeatherFrameLoad);

  clearSelectionOutput();
  syncWeatherModeControls();

  window.setTimeout(() => {
    map.invalidateSize();
  }, 0);

  if (!navigator.geolocation) {
    setStatus("Browser location unavailable. Showing a USA map instead.", true);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userCenter = [position.coords.latitude, position.coords.longitude];
      map.setView(userCenter, userZoom);
      L.circleMarker(userCenter, {
        radius: 7,
        color: "#16a34a",
        fillColor: "#22c55e",
        fillOpacity: 0.85,
      })
        .addTo(map)
        .bindPopup("Your browser-reported location")
        .openPopup();
      setStatus("Map centered on your current browser location.");
    },
    () => {
      map.setView(usaCenter, usaZoom);
      setStatus(
        "Location permission denied or unavailable. Showing a USA map instead.",
        true,
      );
    },
    {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 300000,
    },
  );
});
