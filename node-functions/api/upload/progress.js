// EdgeOne Pages Edge Function
// This file enables EdgeOne to route requests to the appropriate handler
// Path: /api/upload/progress

import app from "../../_app.js";

/**
 * EdgeOne Pages request handler
 * Forwards requests to the Hono application
 */
export async function onRequest(context) {
  return app.fetch(context.request, context.env, context);
}
