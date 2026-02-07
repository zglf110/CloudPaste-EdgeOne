#!/bin/bash
# Script to generate EdgeOne Pages edge function files for all API routes
# This script creates individual .js files matching the API path structure

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_FUNCTIONS_DIR="$SCRIPT_DIR/../node-functions"
API_DIR="$NODE_FUNCTIONS_DIR/api"

echo "Generating EdgeOne Pages edge function files..."
echo "Target directory: $API_DIR"

# Create the base template content
create_edge_function() {
  local path="$1"
  local file="$2"

  mkdir -p "$(dirname "$file")"

  # Calculate relative import path from file to _app.js
  # Count how many directories deep the file is from node-functions/api/
  local rel_path="${path#/api/}"  # Remove leading /api/
  local depth=$(echo "$rel_path" | tr -cd '/' | wc -c)

  local import_path="../"
  for ((i=0; i<depth; i++)); do
    import_path="${import_path}../"
  done

  cat > "$file" << EOF
// EdgeOne Pages Edge Function
// This file enables EdgeOne to route requests to the appropriate handler
// Path: $path

import app from "${import_path}_app.js";

/**
 * EdgeOne Pages request handler
 * Forwards requests to the Hono application
 */
export async function onRequest(context) {
  return app.fetch(context.request, context.env, context);
}
EOF

  echo "✓ Created: $file (for route: $path)"
}

# Remove existing api directory and recreate
if [ -d "$API_DIR" ]; then
  echo "Cleaning existing api directory..."
  rm -rf "$API_DIR"
fi

mkdir -p "$API_DIR"

# Generate edge function files for all API routes
# These are the main API endpoints used by the application

# Admin routes
create_edge_function "/api/admin/login" "$API_DIR/admin/login.js"
create_edge_function "/api/admin/logout" "$API_DIR/admin/logout.js"
create_edge_function "/api/admin/change-password" "$API_DIR/admin/change-password.js"
create_edge_function "/api/admin/cache/stats" "$API_DIR/admin/cache/stats.js"
create_edge_function "/api/admin/cache/clear" "$API_DIR/admin/cache/clear.js"
create_edge_function "/api/admin/dashboard/stats" "$API_DIR/admin/dashboard/stats.js"
create_edge_function "/api/admin/storage-usage/report" "$API_DIR/admin/storage-usage/report.js"
create_edge_function "/api/admin/storage-usage/refresh" "$API_DIR/admin/storage-usage/refresh.js"
create_edge_function "/api/admin/settings" "$API_DIR/admin/settings.js"
create_edge_function "/api/admin/settings/groups" "$API_DIR/admin/settings/groups.js"
create_edge_function "/api/admin/settings/metadata" "$API_DIR/admin/settings/metadata.js"
create_edge_function "/api/admin/backup/create" "$API_DIR/admin/backup/create.js"
create_edge_function "/api/admin/backup/restore" "$API_DIR/admin/backup/restore.js"
create_edge_function "/api/admin/backup/restore/preview" "$API_DIR/admin/backup/restore/preview.js"
create_edge_function "/api/admin/backup/modules" "$API_DIR/admin/backup/modules.js"

# System routes
create_edge_function "/api/health" "$API_DIR/health.js"
create_edge_function "/api/version" "$API_DIR/version.js"
create_edge_function "/api/system/max-upload-size" "$API_DIR/system/max-upload-size.js"

# User/cache routes
create_edge_function "/api/user/cache/clear" "$API_DIR/user/cache/clear.js"

# Test routes
create_edge_function "/api/test/admin-token" "$API_DIR/test/admin-token.js"

# Upload progress
create_edge_function "/api/upload/progress" "$API_DIR/upload/progress.js"

# Mount routes
create_edge_function "/api/mount/list" "$API_DIR/mount/list.js"
create_edge_function "/api/mount/create" "$API_DIR/mount/create.js"

# Storage config routes
create_edge_function "/api/storage-config/list" "$API_DIR/storage-config/list.js"
create_edge_function "/api/storage-config/create" "$API_DIR/storage-config/create.js"

# API key routes
create_edge_function "/api/api-keys/list" "$API_DIR/api-keys/list.js"
create_edge_function "/api/api-keys/create" "$API_DIR/api-keys/create.js"

# File routes
create_edge_function "/api/files" "$API_DIR/files.js"

# Share routes
create_edge_function "/api/share/upload" "$API_DIR/share/upload.js"

# Pastes routes
create_edge_function "/api/pastes" "$API_DIR/pastes.js"

# FS routes - Note: These use catch-all patterns
create_edge_function "/api/fs/browse" "$API_DIR/fs/browse.js"
create_edge_function "/api/fs/write" "$API_DIR/fs/write.js"

echo ""
echo "✅ Edge function files generated successfully!"
echo ""
echo "⚠️  Important Notes:"
echo "1. The [[default]].js file will handle any routes not explicitly defined here"
echo "2. Dynamic routes (e.g., /api/files/:id) will be handled by [[default]].js"
echo "3. If you add new API routes, update this script and regenerate the files"
echo ""
echo "To regenerate these files in the future, run:"
echo "  ./scripts/generate-edge-functions.sh"
