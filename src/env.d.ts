/// <reference types="vite/client" />

// Runtime configuration injected by the container entrypoint (see docker/entrypoint.sh).
// In dev this comes from public/env.js; in production it is regenerated at container
// start from docker/env.template.js using the VITE_API_URL environment variable.
interface Window {
  __ENV__?: {
    VITE_API_URL?: string
  }
}
