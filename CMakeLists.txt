cmake_minimum_required(VERSION 3.15)
project(normaliz-wasm C CXX)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Path to normaliz source
set(NMZ_SRC ${CMAKE_SOURCE_DIR}/lib/normaliz/source)

# GMP must be built separately and installed to a prefix
# (see build/build.sh)
find_path(GMP_INCLUDE_DIR gmp.h REQUIRED)
find_library(GMP_LIB gmp REQUIRED)
find_library(GMPXX_LIB gmpxx REQUIRED)

# Optional: nauty (automorphism groups)
find_library(NAUTY_LIB nauty)
find_path(NAUTY_INCLUDE_DIR nauty/nauty.h)

# Optional: FLINT (polynomial arithmetic)
find_library(FLINT_LIB flint)
find_path(FLINT_INCLUDE_DIR flint/flint.h)
find_library(MPFR_LIB mpfr)

# Optional: hash-library (SHA-256)
find_library(HASHLIBRARY_LIB sha256)
find_path(HASHLIBRARY_INCLUDE_DIR hash-library/sha256.h)

# Collect libnormaliz sources
file(GLOB NMZ_LIB_SOURCES ${NMZ_SRC}/libnormaliz/*.cpp)

# Build libnormaliz as a static library
add_library(normaliz_static STATIC ${NMZ_LIB_SOURCES})
target_include_directories(normaliz_static PUBLIC
    ${NMZ_SRC}
    ${NMZ_SRC}/libnormaliz
    ${GMP_INCLUDE_DIR}
)
target_compile_definitions(normaliz_static PUBLIC
    NMZ_MAKEFILE_CLASSIC
    NMZ_DEVELOP
    NDEBUG
)

if(NAUTY_LIB AND NAUTY_INCLUDE_DIR)
    target_compile_definitions(normaliz_static PUBLIC NMZ_NAUTY NMZ_NAUTYNAUTY NMZ_NAUTY_TLS)
    target_include_directories(normaliz_static PUBLIC ${NAUTY_INCLUDE_DIR})
endif()

if(FLINT_LIB AND FLINT_INCLUDE_DIR)
    target_compile_definitions(normaliz_static PUBLIC NMZ_FLINT)
    target_include_directories(normaliz_static PUBLIC ${FLINT_INCLUDE_DIR})
endif()

if(HASHLIBRARY_LIB AND HASHLIBRARY_INCLUDE_DIR)
    target_compile_definitions(normaliz_static PUBLIC NMZ_HASHLIBRARY)
    target_include_directories(normaliz_static PUBLIC ${HASHLIBRARY_INCLUDE_DIR})
endif()

target_compile_options(normaliz_static PRIVATE -O2)

# Build the normaliz CLI as the wasm entry point
add_executable(normaliz ${NMZ_SRC}/normaliz.cpp)

set(LINK_LIBS normaliz_static ${GMPXX_LIB} ${GMP_LIB})
if(FLINT_LIB)
    list(APPEND LINK_LIBS ${FLINT_LIB})
endif()
if(MPFR_LIB)
    list(APPEND LINK_LIBS ${MPFR_LIB})
endif()
if(NAUTY_LIB)
    list(APPEND LINK_LIBS ${NAUTY_LIB})
endif()
if(HASHLIBRARY_LIB)
    list(APPEND LINK_LIBS ${HASHLIBRARY_LIB})
endif()
target_link_libraries(normaliz ${LINK_LIBS})

if(EMSCRIPTEN)
    set_target_properties(normaliz PROPERTIES
        SUFFIX ".js"
        LINK_FLAGS "\
            -s ALLOW_MEMORY_GROWTH=1 \
            -s MODULARIZE=1 \
            -s EXPORT_NAME='createNormaliz' \
            -s INVOKE_RUN=0 \
            -s EXIT_RUNTIME=0 \
            -s ENVIRONMENT='web,node' \
            -s FILESYSTEM=1 \
            -s EXPORTED_RUNTIME_METHODS=['callMain','FS'] \
            -s EXPORT_ES6=1 \
        "
    )
endif()
