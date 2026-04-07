/* global window, document */

window.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".search-form");
  const addressInput = document.getElementById("address");
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");
  const toast = document.getElementById("addressErrorToast");
  const toastText = document.getElementById("addressErrorToastText");
  const toastClose = document.getElementById("addressErrorToastClose");

  if (!form || !addressInput || !toast || !toastText || !toastClose) {
    return;
  }

  const formatErrorMessage =
    "Invalid address format. Use ZIP only (08873), city and state (Seattle, WA), latitude/longitude (40.7128, -74.0060), or a full address (24 Lake Ave, Somerset, NJ 08873).";
  const requiredErrorMessage = "Please enter an address.";
  const dateRequiredErrorMessage =
    "Please choose both a start date and an end date.";
  const dateOrderErrorMessage = "End date must be on or after the start date.";
  const zipOnlyPattern = /^\d{5}(?:-\d{4})?$/;
  const latLonPattern =
    /^([+-]?\d{1,2}(?:\.\d+)?)\s*,\s*([+-]?\d{1,3}(?:\.\d+)?)$/;
  const cityStatePattern =
    /^[A-Za-z]+(?:[A-Za-z .'-]*[A-Za-z])?,\s*(?:[A-Za-z]{2}|[A-Za-z]+(?:[A-Za-z .'-]*[A-Za-z])?)$/;
  const fullAddressPattern = /^\d+[A-Za-z0-9\-/]*\s+.+$/;
  let hideToastTimer = 0;

  function shakeField(field) {
    if (!field) {
      return;
    }

    field.classList.remove("shake");
    void field.offsetWidth;
    field.classList.add("shake");
  }

  function clearFieldShake(field) {
    if (field) {
      field.classList.remove("shake");
    }
  }

  function showToast(message) {
    toastText.textContent = message;
    toast.classList.add("show");
    toast.setAttribute("aria-hidden", "false");

    if (hideToastTimer) {
      window.clearTimeout(hideToastTimer);
    }

    hideToastTimer = window.setTimeout(hideToast, 6000);
  }

  function hideToast() {
    toast.classList.remove("show");
    toast.setAttribute("aria-hidden", "true");
  }

  function parseBoundingBoxInput(value) {
    const normalized = value.trim();
    if (!normalized) return null;

    try {
      const parsed = JSON.parse(normalized);
      const lowerLeft = parsed?.lowerLeft;
      const upperRight = parsed?.upperRight;
      const lowerLat = Number.parseFloat(String(lowerLeft?.lat));
      const lowerLon = Number.parseFloat(String(lowerLeft?.lon));
      const upperLat = Number.parseFloat(String(upperRight?.lat));
      const upperLon = Number.parseFloat(String(upperRight?.lon));

      if (
        Number.isNaN(lowerLat) ||
        Number.isNaN(lowerLon) ||
        Number.isNaN(upperLat) ||
        Number.isNaN(upperLon) ||
        lowerLat < -90 ||
        lowerLat > 90 ||
        upperLat < -90 ||
        upperLat > 90 ||
        lowerLon < -180 ||
        lowerLon > 180 ||
        upperLon < -180 ||
        upperLon > 180 ||
        lowerLat >= upperLat ||
        lowerLon >= upperLon
      ) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  function isAllowedAddressFormat(value) {
    const normalized = value.trim();
    if (!normalized) return false;
    if (zipOnlyPattern.test(normalized)) return true;

    const latLonMatch = normalized.match(latLonPattern);
    if (latLonMatch) {
      const latitude = Number.parseFloat(latLonMatch[1]);
      const longitude = Number.parseFloat(latLonMatch[2]);

      if (
        !Number.isNaN(latitude) &&
        !Number.isNaN(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
      ) {
        return true;
      }
    }

    if (parseBoundingBoxInput(normalized)) return true;
    if (cityStatePattern.test(normalized)) return true;
    return fullAddressPattern.test(normalized);
  }

  function syncDateConstraints() {
    if (!startDateInput || !endDateInput) {
      return;
    }

    endDateInput.min = startDateInput.value || "";
  }

  toastClose.addEventListener("click", hideToast);

  addressInput.addEventListener("animationend", () => {
    clearFieldShake(addressInput);
  });

  startDateInput?.addEventListener("animationend", () => {
    clearFieldShake(startDateInput);
  });

  endDateInput?.addEventListener("animationend", () => {
    clearFieldShake(endDateInput);
  });

  form.addEventListener("submit", (event) => {
    const value = addressInput.value.trim();

    if (!value) {
      event.preventDefault();
      showToast(requiredErrorMessage);
      shakeField(addressInput);
      addressInput.focus();
      return;
    }

    if (!isAllowedAddressFormat(value)) {
      event.preventDefault();
      showToast(formatErrorMessage);
      shakeField(addressInput);
      addressInput.focus();
      return;
    }

    if (startDateInput && endDateInput) {
      const startValue = startDateInput.value.trim();
      const endValue = endDateInput.value.trim();

      if (!startValue || !endValue) {
        event.preventDefault();
        showToast(dateRequiredErrorMessage);
        const missingField = !startValue ? startDateInput : endDateInput;
        shakeField(missingField);
        missingField.focus();
        return;
      }

      if (endValue < startValue) {
        event.preventDefault();
        showToast(dateOrderErrorMessage);
        shakeField(endDateInput);
        endDateInput.focus();
        return;
      }
    }

    hideToast();
    clearFieldShake(addressInput);
    clearFieldShake(startDateInput);
    clearFieldShake(endDateInput);
  });

  addressInput.addEventListener("input", () => {
    hideToast();
    clearFieldShake(addressInput);
  });

  startDateInput?.addEventListener("input", () => {
    hideToast();
    clearFieldShake(startDateInput);
    syncDateConstraints();

    if (
      endDateInput &&
      startDateInput.value &&
      endDateInput.value &&
      endDateInput.value < startDateInput.value
    ) {
      endDateInput.value = startDateInput.value;
    }
  });

  endDateInput?.addEventListener("input", () => {
    hideToast();
    clearFieldShake(endDateInput);
  });

  syncDateConstraints();
});
