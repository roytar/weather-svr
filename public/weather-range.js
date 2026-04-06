/* global window, document */

function toggleDayDetail(idx) {
  const detail = document.getElementById(`day-detail-${idx}`);
  const caret = document.getElementById(`day-caret-${idx}`);

  if (!detail || !caret) {
    return;
  }

  const isOpen = detail.style.display !== "none";
  detail.style.display = isOpen ? "none" : "table-row";
  caret.classList.toggle("open", !isOpen);
}

window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-day-toggle]").forEach((row) => {
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");

    row.addEventListener("click", () => {
      const idx = row.getAttribute("data-day-toggle");
      if (idx !== null) {
        toggleDayDetail(idx);
      }
    });

    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const idx = row.getAttribute("data-day-toggle");
        if (idx !== null) {
          toggleDayDetail(idx);
        }
      }
    });
  });
});
