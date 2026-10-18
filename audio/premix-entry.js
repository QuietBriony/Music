// Decide before first paint/legacy boot. Explicit practice, audition and HAZAMA
// links keep their existing engine; ordinary Tabasco listening streams the mix.
(function () {
  const p = new URLSearchParams(location.search);
  const band = p.get("band") || p.get("bandId") || "tabasco";
  const mode = p.get("mode");
  const original = band === "tabasco" && !p.has("safe") && !p.has("mix") &&
    (mode === "original" || (!mode && !location.hash));
  document.documentElement.dataset.brSurface = original ? "original" : "practice";
})();
