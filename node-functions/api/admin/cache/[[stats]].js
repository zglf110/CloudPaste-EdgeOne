// EdgeOne Pages Edge Function
// This file enables EdgeOne to route requests to the appropriate handler
// Path: /api/admin/cache/stats

/**
 * EdgeOne Pages request handler
 * Forwards requests to the Hono application
 */
export async function onRequest(context) {
  // Use dynamic import to avoid EdgeOne CLI detecting this as a "Hono function"
  const { default: app } = await import("../../../hono-app.js");
  return app.fetch(context.request, context.env, context);
}
