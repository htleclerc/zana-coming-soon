#!/bin/bash
# Build script for Vercel: replaces env placeholders in static files
mkdir -p dist

for f in index.html privacy.html terms.html favicon.svg; do
  if [ -f "$f" ]; then
    sed "s|__SB_URL__|${SUPABASE_URL}|g; s|__SB_KEY__|${SUPABASE_ANON_KEY}|g" "$f" > "dist/$f"
  fi
done

# Copy static assets
cp -f og-image.png dist/ 2>/dev/null || true
echo "Build complete — dist/ ready"
