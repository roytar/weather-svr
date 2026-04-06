/* global window, document */

function toggleMinutely(idx) {
  const detail = document.getElementById(`m15-${idx}`);
  const caret = document.getElementById(`caret-${idx}`);

  if (!detail || !caret) {
    return;
  }

  const isOpen = detail.style.display !== "none";
  detail.style.display = isOpen ? "none" : "table-row";
  caret.classList.toggle("open", !isOpen);
}

function initTooltips() {
  const skip = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON"]);
  document.querySelectorAll("[title]").forEach((element) => {
    if (skip.has(element.tagName)) {
      return;
    }

    const title = element.getAttribute("title");
    if (!title) {
      return;
    }

    element.dataset.tooltip = title;
    element.removeAttribute("title");
  });
}

function initMinutelyToggleRows() {
  document.querySelectorAll("[data-minutely-toggle]").forEach((row) => {
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");

    row.addEventListener("click", () => {
      const idx = row.getAttribute("data-minutely-toggle");
      if (idx !== null) {
        toggleMinutely(idx);
      }
    });

    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const idx = row.getAttribute("data-minutely-toggle");
        if (idx !== null) {
          toggleMinutely(idx);
        }
      }
    });
  });
}

function initPageState() {
  const params = new URLSearchParams(window.location.search);
  const urlDate = params.get("date") || "";
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const dateStatusBadge = document.getElementById("dateStatusBadge");

  if (!dateStatusBadge) {
    return;
  }

  if (!urlDate || urlDate === todayKey) {
    dateStatusBadge.textContent = "";
  } else if (urlDate < todayKey) {
    dateStatusBadge.textContent = "Historic";
  } else {
    dateStatusBadge.textContent = "Forecast";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initTooltips();
  initMinutelyToggleRows();
  initPageState();
});
