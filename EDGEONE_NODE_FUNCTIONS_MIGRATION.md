# EdgeOne Pages Node-Functions Migration Guide

## Overview

This document explains the changes made to adapt CloudPaste to the renamed `node-functions` folder structure and fix EdgeOne Pages deployment errors.

## Changes Made

### 1. Functions Folder Rename

The `functions` folder has been renamed to `node-functions` to support more deployment environments. This change affects:

- **Root directory**: `/functions` → `/node-functions`
- **Frontend Functions**: The `frontend/functions` folder remains for Cloudflare Pages-specific functions (middleware)

### 2. EdgeOne Configuration (`edgeone.config.js`)

Created a new `edgeone.config.js` file at the project root with:

```javascript
export default {
  functions: {
    directory: 'node-functions',  // Specify the renamed functions directory
  },
  build: {
    command: 'npm run build:frontend',
    external: [
      // All Node.js built-in modules listed
      'fs', 'path', 'crypto', 'http', 'https', 'net', 'tls',
      'stream', 'url', 'util', 'zlib', 'timers', 'os', etc.
    ],
  },
};
```

**Purpose**: This configuration tells EdgeOne Pages to:
- Look for functions in the `node-functions` directory
- Treat Node.js built-in modules as external (don't bundle them)
- Prevent bundling errors for server-side code

### 3. GitHub Workflow Updates

Updated `.github/workflows/deploy-frontend-cloudflare.yml`:

```yaml
- name: Copy Cloudflare Functions
  run: |
    # Updated comment explaining the structure
    if [ -d "functions" ]; then
      mkdir -p dist/functions
      cp -r functions/* dist/functions/
    else
      echo "No frontend/functions directory found (expected for this setup)"
    fi
```

This change clarifies that:
- `frontend/functions` is for Cloudflare Pages middleware
- `node-functions` (at root) is for EdgeOne Pages backend functions

## Error Analysis

### Original Errors

The deployment errors you encountered were:

1. **Node.js Built-in Module Bundling Errors**:
   ```
   ✘ [ERROR] Could not resolve "fs"
   ✘ [ERROR] Could not resolve "crypto"
   ✘ [ERROR] Could not resolve "path"
   ```

   **Cause**: EdgeOne Pages build was trying to bundle Node.js built-in modules (fs, crypto, path, etc.) which should only be available at runtime in a Node.js environment.

   **Solution**: Added `edgeone.config.js` with all Node.js built-in modules marked as `external`.

2. **Dynamic Import Warnings** (Non-Critical):
   ```
   (!) /frontend/src/i18n/index.js is dynamically imported by router but also statically imported
   (!) /frontend/src/stores/siteConfigStore.js is dynamically imported but also statically imported
   ```

   **Cause**: These modules are imported both statically (at the top of files) and dynamically (with `import()`). Vite warns that dynamic imports won't create separate chunks.

   **Impact**: This is just a warning, not an error. The application will work correctly. The dynamic import won't create a separate chunk because the module is already in the main bundle.

   **Solution**: No changes needed. These warnings can be safely ignored.

## Directory Structure

```
CloudPaste/
├── node-functions/          # Backend functions for EdgeOne Pages (renamed from 'functions')
│   ├── index.js
│   ├── [[default]].js
│   ├── _unified-entry.js
│   ├── adapters/
│   ├── routes/
│   ├── storage/
│   ├── services/
│   └── ...
├── frontend/
│   ├── functions/           # Cloudflare Pages middleware (separate from node-functions)
│   │   └── _middleware.js
│   └── ...
├── edgeone.config.js        # NEW: EdgeOne Pages configuration
├── package.json             # Root package.json for EdgeOne deployment
└── ...
```

## Deployment Platforms

### EdgeOne Pages (Current Setup)
- Uses `node-functions/` directory
- Configured via `edgeone.config.js`
- Deploys with: `npm run deploy` or `edgeone pages deploy`
- Backend runs on Node.js runtime with MySQL

### Cloudflare Pages (Alternative)
- Frontend uses `frontend/functions/` for middleware
- Backend uses Cloudflare Workers (separate deployment)
- Configured via GitHub Actions workflows

## Testing the Changes

To verify the deployment:

1. **Local Development**:
   ```bash
   npm run dev
   ```
   This should start the EdgeOne Pages development server.

2. **Build Test**:
   ```bash
   npm run build:frontend
   ```
   This builds the frontend. The `node-functions` folder should not be bundled.

3. **Deploy**:
   ```bash
   npm run deploy
   ```
   This deploys to EdgeOne Pages. The build should now complete without Node.js module errors.

## Troubleshooting

### If you still see "Could not resolve" errors:

1. Verify `edgeone.config.js` exists at project root
2. Check that the module name is listed in the `external` array
3. Ensure you're running the latest version of EdgeOne CLI: `npm update edgeone`

### If functions are not found:

1. Verify the `node-functions` directory exists
2. Check `edgeone.config.js` has the correct `functions.directory` setting
3. Ensure entry files (`[[default]].js` or `index.js`) are present

## Migration Checklist

- [x] Rename `functions/` to `node-functions/` (completed by user)
- [x] Create `edgeone.config.js` with external modules configuration
- [x] Update GitHub workflows to reflect new structure
- [x] Document changes in this migration guide
- [ ] Test local development: `npm run dev`
- [ ] Test build: `npm run build:frontend`
- [ ] Deploy to EdgeOne Pages: `npm run deploy`
- [ ] Verify all API endpoints work correctly
- [ ] Verify database connections (MySQL for EdgeOne)

## Additional Notes

- The dynamic import warnings for `i18n` and `siteConfigStore` are cosmetic and do not affect functionality
- The `frontend/functions/_middleware.js` is specifically for Cloudflare Pages and is separate from EdgeOne functions
- All Node.js built-in modules are now properly marked as external to prevent bundling errors
- The configuration supports both prefixed (`node:fs`) and non-prefixed (`fs`) module imports

## References

- EdgeOne Pages Documentation: [EdgeOne CLI Guide](https://www.tencentcloud.com/document/product/1145)
- Node.js Built-in Modules: [Node.js API Documentation](https://nodejs.org/api/)
- Vite Build Configuration: [Vite External Option](https://vitejs.dev/config/build-options.html#build-external)
