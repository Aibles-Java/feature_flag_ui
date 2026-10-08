// Development default for runtime config (window.__ENV__).
// In production this file is regenerated at container start from docker/env.template.js
// using the VITE_API_URL environment variable — see docker/entrypoint.sh.
window.__ENV__ = {
  VITE_API_URL: "http://localhost:8081/api/v1",
  // "true" enables flag-centric navigation (S-1.11); anything else keeps the old env-first UI.
  FLAG_CENTRIC_NAV: "true",
};
