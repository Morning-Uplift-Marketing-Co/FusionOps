#!/bin/bash
# Elastic Credits - Setup & Run Script
# Usage: bash setup.sh

set -e

echo "============================================"
echo "  Elastic Credits - Setup Script"
echo "============================================"
echo ""

# Check for bun or npm
if command -v bun &> /dev/null; then
    PKG="bun"
    echo "[✓] Using Bun"
elif command -v npm &> /dev/null; then
    PKG="npm"
    echo "[✓] Using npm"
else
    echo "[✗] Please install Bun (https://bun.sh) or Node.js first"
    exit 1
fi

# Verify project structure
if [ ! -f "package.json" ]; then
    echo "[✗] Run this script from the elastic-credits project folder"
    echo "    cd elastic-credits && bash setup.sh"
    exit 1
fi

# Check src structure
if [ ! -d "src/pages" ]; then
    echo "[!] Fixing project structure..."
    mkdir -p src/pages src/components src/layouts src/styles src/lib

    # Move misplaced folders into src/ if they exist at root
    [ -d "pages" ] && mv pages/* src/pages/ 2>/dev/null && rmdir pages
    [ -d "components" ] && mv components/* src/components/ 2>/dev/null && rmdir components
    [ -d "layouts" ] && mv layouts/* src/layouts/ 2>/dev/null && rmdir layouts
    [ -d "styles" ] && mv styles/* src/styles/ 2>/dev/null && rmdir styles
    [ -d "lib" ] && mv lib/* src/lib/ 2>/dev/null && rmdir lib

    echo "[✓] Project structure fixed"
fi

# Install dependencies
echo ""
echo "[...] Installing dependencies..."
if [ "$PKG" = "bun" ]; then
    bun install
else
    npm install
fi
echo "[✓] Dependencies installed"

# Build check
echo ""
echo "[...] Building project..."
if [ "$PKG" = "bun" ]; then
    bun run build
else
    npm run build
fi
echo "[✓] Build successful"

echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
echo ""
echo "  Start dev server:"
echo "    $PKG run dev"
echo ""
echo "  Preview production build:"
echo "    $PKG run preview"
echo ""
echo "  Deploy: upload the dist/ folder"
echo "============================================"
