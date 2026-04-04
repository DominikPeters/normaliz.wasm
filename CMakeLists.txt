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
target_compile_options(normaliz_static PRIVATE -O2)

# Build the normaliz CLI as the wasm entry point
add_executable(normaliz ${NMZ_SRC}/normaliz.cpp)
target_link_libraries(normaliz normaliz_static ${GMPXX_LIB} ${GMP_LIB})

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
        "
    )
endif()
