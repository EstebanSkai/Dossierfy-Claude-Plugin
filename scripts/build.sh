#!/usr/bin/env bash
# Build script — packages the extension into dossierfy.mcpb
# Run from the repo root: bash extension/scripts/build.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==> Building Dossierfy MCP extension"
echo "    Directory: ${EXTENSION_DIR}"
echo ""

# 1. Install production dependencies
echo "==> Installing production dependencies…"
npm install --omit=dev --prefix "${EXTENSION_DIR}"
echo ""

# 2. Validate the manifest
echo "==> Validating manifest.json…"
(cd "${EXTENSION_DIR}" && npx --yes @anthropic-ai/mcpb validate .)
echo ""

# 3. Pack into .mcpb bundle
OUTPUT="${EXTENSION_DIR}/dossierfy.mcpb"
echo "==> Packing extension → ${OUTPUT}"
(cd "${EXTENSION_DIR}" && npx --yes @anthropic-ai/mcpb pack . dossierfy.mcpb)
echo ""

# 4. Report bundle size
if [ -f "${OUTPUT}" ]; then
  SIZE=$(du -sh "${OUTPUT}" | cut -f1)
  echo "==> Done! Bundle: dossierfy.mcpb (${SIZE})"
else
  echo "ERROR: Expected output file not found: ${OUTPUT}" >&2
  exit 1
fi
