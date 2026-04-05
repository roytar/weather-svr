/* global window, document */

window.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".search-form");
  const addressInput = document.getElementById("address");
  const toast = document.getElementById("addressErrorToast");
  const toastText = document.getElementById("addressErrorToastText");
  const toastClose = document.getElementById("addressErrorToastClose");

  if (!form || !addressInput || !toast || !toastText || !toastClose) {
    return;
  }

  const formatErrorMessage =
    "Invalid address format. Use ZIP only (08873), city and state (Seattle, WA), or full address i.e. (24 Lake Ave, Somerset, NJ 08873).";
  const requiredErrorMessage = "Please enter an address.";
  const zipOnlyPattern = /^\d{5}(?:-\d{4})?$/;
  const cityStatePattern =
    /^[A-Za-z]+(?:[A-Za-z .'-]*[A-Za-z])?,\s*(?:[A-Za-z]{2}|[A-Za-z]+(?:[A-Za-z .'-]*[A-Za-z])?)$/;
  const fullAddressPattern = /^\d+[A-Za-z0-9\-/]*\s+.+$/;
  let hideToastTimer = 0;

  function shakeInput() {
    addressInput.classList.remove("shake");
    void addressInput.offsetWidth;
    addressInput.classList.add("shake");
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

  function isAllowedAddressFormat(value) {
    const normalized = value.trim();
    if (!normalized) return false;
    if (zipOnlyPattern.test(normalized)) return true;
    if (cityStatePattern.test(normalized)) return true;
    return fullAddressPattern.test(normalized);
  }

  toastClose.addEventListener("click", hideToast);

  addressInput.addEventListener("animationend", () => {
    addressInput.classList.remove("shake");
  });

  form.addEventListener("submit", (event) => {
    const value = addressInput.value.trim();

    if (!value) {
      event.preventDefault();
      showToast(requiredErrorMessage);
      shakeInput();
      addressInput.focus();
      return;
    }

    if (!isAllowedAddressFormat(value)) {
      event.preventDefault();
      showToast(formatErrorMessage);
      shakeInput();
      addressInput.focus();
      return;
    }

    hideToast();
    addressInput.classList.remove("shake");
  });

  addressInput.addEventListener("input", () => {
    hideToast();
    addressInput.classList.remove("shake");
  });
});
