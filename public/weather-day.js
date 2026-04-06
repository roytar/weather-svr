/* global window, document, fetch */

function renderMinutelyRows(rows) {
  return rows
    .map(
      (row) => `
        <tr>
          <td>${row.time}</td>
          <td>${row.temperature}</td>
          <td>${row.rain}</td>
          <td>${row.visibility}</td>
          <td>${row.sunshine_duration}</td>
        </tr>
      `,
    )
    .join("");
}

async function loadMinutelyDetails(row, idx) {
  const detail = document.getElementById(`m15-${idx}`);
  const body = document.getElementById(`m15-body-${idx}`);
  const url = row.getAttribute("data-minutely-url");

  if (!detail || !body || !url) {
    return;
  }

  if (detail.dataset.loaded === "true" || detail.dataset.loading === "true") {
    return;
  }

  detail.dataset.loading = "true";
  body.innerHTML = `
    <tr>
      <td colspan="5">
        <span class="loading-state">
          <span class="spinner" aria-hidden="true"></span>
          <span>Loading 15-minute details…</span>
        </span>
      </td>
    </tr>
  `;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        typeof payload.error === "string" && payload.error.trim()
          ? payload.error.trim()
          : `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    const rows = Array.isArray(payload.rows) ? payload.rows : [];

    body.innerHTML = rows.length
      ? renderMinutelyRows(rows)
      : `
        <tr>
          <td colspan="5">No 15-minute data is available for this hour.</td>
        </tr>
      `;
    detail.dataset.loaded = "true";
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unable to load 15-minute details right now.";

    body.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="inline-error-box">${message}</div>
        </td>
      </tr>
    `;
  } finally {
    detail.dataset.loading = "false";
  }
}

async function toggleMinutely(row, idx) {
  const detail = document.getElementById(`m15-${idx}`);
  const caret = document.getElementById(`caret-${idx}`);

  if (!detail || !caret) {
    return;
  }

  const isOpen = detail.style.display !== "none";
  if (isOpen) {
    detail.style.display = "none";
    caret.classList.remove("open");
    return;
  }

  detail.style.display = "table-row";
  caret.classList.add("open");
  await loadMinutelyDetails(row, idx);
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
        void toggleMinutely(row, idx);
      }
    });

    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const idx = row.getAttribute("data-minutely-toggle");
        if (idx !== null) {
          void toggleMinutely(row, idx);
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
