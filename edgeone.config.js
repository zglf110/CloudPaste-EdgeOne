export default {
  // EdgeOne Pages configuration for CloudPaste
  // The functions folder has been renamed to node-functions to support more environments

  // Function configuration - specify the functions directory
  functions: {
    // Path to functions directory (renamed from 'functions' to 'node-functions')
    directory: 'node-functions',
  },

  // Build configuration
  build: {
    // Command to build the frontend
    command: 'npm run build:frontend',

    // External modules - don't bundle Node.js built-ins
    // These are Node.js runtime modules that should not be bundled
    external: [
      // Core Node.js modules
      'fs',
      'path',
      'crypto',
      'http',
      'https',
      'net',
      'tls',
      'stream',
      'url',
      'util',
      'zlib',
      'timers',
      'os',
      'events',
      'buffer',
      'querystring',
      'string_decoder',
      'punycode',

      // Node.js module variants
      'fs/promises',
      'stream/promises',
      'stream/web',
      'node:fs',
      'node:path',
      'node:crypto',
      'node:http',
      'node:https',
      'node:stream',
      'node:url',
      'node:os',
      'node:net',
      'node:tls',
      'node:util',
      'node:zlib',
      'node:timers',
      'node:events',
      'node:buffer',
      'node:querystring',

      // Native modules that can't be bundled
      'better-sqlite3',
      'mysql2',
    ],
  },
};
