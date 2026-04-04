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

# --- Build hash-library (SHA-256) for Emscripten ---
HASHLIBRARY_VERSION="8"

if [ ! -f "$PREFIX/lib/libsha256.a" ]; then
    echo "=== Building hash-library for Emscripten ==="
    cd "$BUILD_DIR"
    if [ ! -d "hash-library-hash_library_v${HASHLIBRARY_VERSION}" ]; then
        curl -L "https://github.com/stbrumme/hash-library/archive/hash_library_v${HASHLIBRARY_VERSION}.tar.gz" | tar xz
    fi
    cd "hash-library-hash_library_v${HASHLIBRARY_VERSION}"
    sed -ie 's/endian.h/sys\/types.h/g' sha256.cpp
    em++ -Wno-deprecated -Wall -pedantic -O3 -funroll-loops -fPIC -c -o libsha256.o sha256.cpp
    emar rc libsha256.a libsha256.o
    mkdir -p "$PREFIX/include/hash-library"
    cp sha256.h "$PREFIX/include/hash-library"
    cp libsha256.a "$PREFIX/lib/"
fi

# --- Build nauty for Emscripten ---
NAUTY_VERSION="2_9_1"

if [ ! -f "$PREFIX/lib/libnauty.a" ]; then
    echo "=== Building nauty for Emscripten ==="
    cd "$BUILD_DIR"
    if [ ! -d "nauty${NAUTY_VERSION}" ]; then
        curl -L "https://users.cecs.anu.edu.au/~bdm/nauty/nauty${NAUTY_VERSION}.tar.gz" | tar xz
    fi
    cd "nauty${NAUTY_VERSION}"
    # wasm is 32-bit, so we use WORDSIZE=32 (nautyW)
    emconfigure ./configure --enable-tls
    emmake make all -j$(nproc 2>/dev/null || sysctl -n hw.ncpu) CFLAGS="-fPIC -O3"
    mkdir -p "$PREFIX/include/nauty"
    cp nauty.h "$PREFIX/include/nauty"
    # wasm32 -> use nautyW.a (32-bit wordsize)
    cp nautyW.a "$PREFIX/lib/libnauty.a"
fi

# --- Build MPFR for Emscripten ---
MPFR_VERSION="4.2.2"

if [ ! -f "$PREFIX/lib/libmpfr.a" ]; then
    echo "=== Building MPFR ${MPFR_VERSION} for Emscripten ==="
    cd "$BUILD_DIR"
    if [ ! -d "mpfr-${MPFR_VERSION}" ]; then
        curl -L "https://ftp.gnu.org/gnu/mpfr/mpfr-${MPFR_VERSION}.tar.xz" | tar xJ
    fi
    cd "mpfr-${MPFR_VERSION}"
    emconfigure ./configure \
        --host=none \
        --prefix="$PREFIX" \
        --with-gmp="$PREFIX" \
        --disable-shared \
        --enable-static \
        CC_FOR_BUILD=cc
    emmake make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu)
    emmake make install
fi

# --- Build FLINT for Emscripten ---
FLINT_VERSION="3.3.1"

if [ ! -f "$PREFIX/lib/libflint.a" ]; then
    echo "=== Building FLINT ${FLINT_VERSION} for Emscripten ==="
    cd "$BUILD_DIR"
    if [ ! -d "flint-${FLINT_VERSION}" ]; then
        curl -L "https://flintlib.org/download/flint-${FLINT_VERSION}.tar.gz" | tar xz
    fi
    cd "flint-${FLINT_VERSION}"
    # Patch configure to skip assembler label suffix check (not needed with --disable-assembly)
    sed -i.bak 's/as_fn_error \$? "Cannot determine label suffix"/gmp_cv_asm_lsym_prefix="L"/' configure
    emconfigure ./configure \
        --prefix="$PREFIX" \
        --with-gmp="$PREFIX" \
        --with-mpfr="$PREFIX" \
        --enable-static \
        --disable-shared \
        --disable-pthread \
        --disable-assembly
    emmake make install -j$(nproc 2>/dev/null || sysctl -n hw.ncpu)
fi

# --- Build normaliz ---
echo "=== Building normaliz.wasm ==="
cd "$BUILD_DIR"
emcmake cmake "$ROOT_DIR" \
    -DCMAKE_PREFIX_PATH="$PREFIX" \
    -DCMAKE_FIND_ROOT_PATH="$PREFIX" \
    -DGMP_INCLUDE_DIR="$PREFIX/include" \
    -DGMP_LIB="$PREFIX/lib/libgmp.a" \
    -DGMPXX_LIB="$PREFIX/lib/libgmpxx.a"
emmake make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu)

# Copy output to dist/
cp normaliz.js normaliz.wasm "$DIST_DIR/"

echo "=== Done! Output in dist/ ==="
