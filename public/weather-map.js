/* global window, document, L */

window.addEventListener("DOMContentLoaded", () => {
  const mapElement = document.getElementById("selectionMap");
  const statusElement = document.getElementById("mapStatus");

  if (!mapElement || !statusElement) {
    return;
  }

  if (typeof L === "undefined") {
    statusElement.textContent =
      "Map library failed to load. Please refresh and try again.";
    statusElement.classList.add("error");
    return;
  }

  const returnTo = new URLSearchParams(window.location.search).get("returnTo");

  function buildReturnUrl(address) {
    const landingUrl = new URL("/", window.location.origin);
    landingUrl.searchParams.set("address", address);
    landingUrl.searchParams.set("fromMap", "1");
    return landingUrl.toString();
  }

  const usaCenter = [39.8283, -98.5795];
  const usaZoom = 5;
  const userZoom = 12;
  const markerLayer = L.layerGroup();
  const selectionOutlineLayer = L.layerGroup();
  const selectionPinIcon = L.divIcon({
    className: "selection-pin-icon",
    html: '<span class="selection-pin-dot" aria-hidden="true"></span>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

  if (L.drawLocal?.draw?.handlers?.marker?.tooltip) {
    L.drawLocal.draw.handlers.marker.tooltip.start = "Drop a pin";
  }

  const map = L.map(mapElement).setView(usaCenter, usaZoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    subdomains: ["a", "b", "c"],
    referrerPolicy: "strict-origin-when-cross-origin",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  markerLayer.addTo(map);
  selectionOutlineLayer.addTo(map);

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
        marker: {
          repeatMode: true,
          icon: selectionPinIcon,
        },
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

  function returnSelection(address, message) {
    setStatus(message);

    if (returnTo !== "range-landing") {
      return;
    }

    try {
      window.sessionStorage.setItem("weatherMapSelectedAddress", address);
    } catch {
      // Ignore storage errors and fall back to the query string only.
    }

    window.location.assign(buildReturnUrl(address));
  }

  function handlePinSelection(layer) {
    const latLng = layer.getLatLng();
    const lat = rounded(latLng.lat);
    const lon = rounded(latLng.lng);

    markerLayer.clearLayers();
    selectionOutlineLayer.clearLayers();

    layer.setIcon(selectionPinIcon);
    layer.bindTooltip("Drop a pin", {
      direction: "top",
      offset: [0, -10],
    });
    markerLayer.addLayer(layer);
    map.setView([lat, lon], Math.max(map.getZoom(), userZoom + 3));

    const rawAddress = `${lat}, ${lon}`;
    returnSelection(
      rawAddress,
      returnTo === "range-landing"
        ? `Pin selected at lat ${lat}, lon ${lon}. Returning to the landing page...`
        : `Pin selected at lat ${lat}, lon ${lon}.`,
    );
  }

  function handleRectangleSelection(layer) {
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

    markerLayer.clearLayers();
    selectionOutlineLayer.clearLayers();

    map.fitBounds(bounds, {
      padding: [24, 24],
      maxZoom: 17,
    });

    L.rectangle(bounds, {
      color: "#ef4444",
      weight: 3,
      fill: false,
      dashArray: "8 6",
    }).addTo(selectionOutlineLayer);

    const rawAddress = JSON.stringify(selection);
    returnSelection(
      rawAddress,
      returnTo === "range-landing"
        ? "Area selected. Returning to the landing page..."
        : "Area selected on the map.",
    );
  }

  map.on(L.Draw.Event.CREATED, (event) => {
    if (event.layerType === "marker") {
      handlePinSelection(event.layer);
      return;
    }

    handleRectangleSelection(event.layer);
  });

  map.on(L.Draw.Event.DELETED, () => {
    markerLayer.clearLayers();
    selectionOutlineLayer.clearLayers();
    setStatus("Selection removed. Draw a new pin or rectangle to continue.");
  });

  window.setTimeout(() => {
    map.invalidateSize();
  }, 0);

  setStatus("Drop a pin");

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
