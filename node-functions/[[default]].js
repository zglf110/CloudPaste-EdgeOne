// EdgeOne Pages Function Entry Point - Catch-All Handler
// This file exports the onRequest handler required by EdgeOne Pages
//
// This is a catch-all handler that processes all requests not matched by
// specific route files in the node-functions/api/ directory.
//
// EdgeOne Pages routing priority:
// 1. Static files from public/ directory
// 2. Exact match route files (e.g., node-functions/api/admin/login.js for /api/admin/login)
// 3. This [[default]].js catch-all handler (for dynamic routes, WebDAV, etc.)
//
// For more information about EdgeOne edge functions, see:
// https://cloud.tencent.com/document/product/1552/127419

import app from "./_app.js";
import { ApiStatus } from "./constants/index.js";
import { ensureDatabaseReady } from "./db/index.js";
import { registerTaskHandlers } from "./storage/fs/tasks/registerHandlers.js";
import { registerJobTypes, validateJobTypesConsistency } from "./storage/fs/tasks/registerJobTypes.js";
import { registerScheduledHandlers } from "./scheduled/ScheduledTaskRegistry.js";
import { getCloudPlatform } from "./utils/environmentUtils.js";
import { createLogger } from "./utils/logger.js";

// Register all task handlers and job types at module load time
registerTaskHandlers();
registerJobTypes();
validateJobTypesConsistency();
registerScheduledHandlers();

// Database initialization state
let dbInitPromise = null;
let dbAdapter = null;

/**
 * Ensure database is ready (singleton pattern)
 * @param {Object} env - Environment variables
 * @returns {Promise} Database adapter
 */
async function ensureDbReadyOnce(env) {
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    const platform = getCloudPlatform(env);
    const logger = createLogger("EdgeOne/Init", env);

    // EdgeOne Pages environment: use MySQL database
    if (platform === "edgeone") {
      logger.info("Detected EdgeOne Pages environment, initializing MySQL connection");

      // Dynamically import MySQL adapter (load only when needed)
      const { createMySQLAdapterFromEnv } = await import("./adapters/MySQLAdapter.js");

      try {
        dbAdapter = await createMySQLAdapterFromEnv(env);
        await ensureDatabaseReady({ db: dbAdapter, env, providerName: "mysql" });
        logger.info("MySQL database connection successful, EdgeOne Pages environment ready");
        return dbAdapter;
      } catch (error) {
        logger.error("MySQL connection failed", error);
        throw new Error(`MySQL connection failed: ${error.message}. Please ensure MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE environment variables are properly configured.`);
      }
    }

    // Fallback error for other platforms
    logger.error("Unsupported platform for EdgeOne Pages deployment", { platform });
    throw new Error(`Unsupported platform: ${platform}. EdgeOne Pages requires CLOUD_PLATFORM=edgeone`);
  })();

  try {
    await dbInitPromise;
  } catch (error) {
    // Allow retry on initialization failure
    dbInitPromise = null;
    dbAdapter = null;
    throw error;
  }

  return dbInitPromise;
}

/**
 * Check if the request is for a static file
 * @param {string} pathname - Request pathname
 * @returns {boolean} True if static file
 */
function isStaticFile(pathname) {
  const staticExtensions = [
    '.js', '.css', '.json', '.xml', '.txt',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.mp4', '.webm', '.mp3', '.wav',
    '.pdf', '.zip', '.map', '.html'
  ];
  
  const lowerPath = pathname.toLowerCase();
  return staticExtensions.some(ext => lowerPath.endsWith(ext));
}

/**
 * EdgeOne Pages onRequest handler
 * This is the main entry point called by EdgeOne Pages for each request
 * 
 * @param {Object} context - EdgeOne Pages context object
 * @param {Request} context.request - The incoming request
 * @param {Object} context.env - Environment variables
 * @param {Object} context.waitUntil - Function to extend execution time
 * @returns {Promise<Response>} The response
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Pass through static files to EdgeOne Pages platform
  // This includes frontend assets like JS, CSS, images, etc.
  if (isStaticFile(pathname) && !pathname.startsWith('/api/')) {
    return fetch(request);
  }

  // For root path, serve index.html
  if (pathname === '/') {
    const indexUrl = new URL('/index.html', url.origin);
    const response = await fetch(indexUrl.toString());
    
    if (response.ok) {
      const newHeaders = new Headers(response.headers);
      newHeaders.set('x-powered-by', 'EdgeOne Pages');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }
  }

  // Handle API requests through Hono app
  const logger = createLogger("EdgeOne/Request", env);

  try {
    // Validate required environment variables
    if (!env || !env.ENCRYPTION_SECRET) {
      logger.error("ENCRYPTION_SECRET not configured");
      throw new Error("ENCRYPTION_SECRET not configured. Please set security key in environment variables.");
    }

    // Ensure database is initialized
    logger.debug("Preparing to handle API request", { 
      url: request.url, 
      method: request.method 
    });

    const db = await ensureDbReadyOnce(env);

    // Create bindings object for Hono app
    const bindings = {
      ...env,
      DB: db,
      ENCRYPTION_SECRET: env.ENCRYPTION_SECRET,
    };

    // Pass request to Hono app
    return await app.fetch(request, bindings, context);

  } catch (error) {
    logger.error("Error handling request", error);
    
    return new Response(
      JSON.stringify({
        code: ApiStatus.INTERNAL_ERROR,
        message: "Internal Server Error",
        error: error.message,
        success: false,
        data: null,
      }),
      {
        status: ApiStatus.INTERNAL_ERROR,
        headers: { 
          "Content-Type": "application/json",
          "X-EdgeOne-Error": "true"
        },
      }
    );
  }
}
