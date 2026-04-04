#!/bin/bash
set -e

# This script builds normaliz as a WebAssembly module using Emscripten.
# Prerequisites: emsdk activated (source emsdk_env.sh)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build/wasm"
PREFIX="$ROOT_DIR/build/deps"
DIST_DIR="$ROOT_DIR/dist"

mkdir -p "$BUILD_DIR" "$PREFIX" "$DIST_DIR"

# --- Build GMP for Emscripten ---
GMP_VERSION="6.3.0"
GMP_DIR="$BUILD_DIR/gmp-${GMP_VERSION}"

if [ ! -f "$PREFIX/lib/libgmp.a" ]; then
    echo "=== Building GMP ${GMP_VERSION} for Emscripten ==="
    cd "$BUILD_DIR"
    if [ ! -d "$GMP_DIR" ]; then
        curl -L "https://gmplib.org/download/gmp/gmp-${GMP_VERSION}.tar.xz" | tar xJ
    fi
    cd "$GMP_DIR"
    emconfigure ./configure \
        --host=none \
        --prefix="$PREFIX" \
        --disable-assembly \
        --enable-cxx \
        --disable-shared \
        --enable-static \
        CC_FOR_BUILD=cc
    emmake make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu)
    emmake make install
fi

# --- Build normaliz ---
echo "=== Building normaliz.wasm ==="
cd "$BUILD_DIR"
emcmake cmake "$ROOT_DIR" \
    -DCMAKE_PREFIX_PATH="$PREFIX" \
    -DGMP_INCLUDE_DIR="$PREFIX/include" \
    -DGMP_LIB="$PREFIX/lib/libgmp.a" \
    -DGMPXX_LIB="$PREFIX/lib/libgmpxx.a"
emmake make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu)

# Copy output to dist/
cp normaliz.js normaliz.wasm "$DIST_DIR/"

echo "=== Done! Output in dist/ ==="
