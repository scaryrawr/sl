cmake_minimum_required(VERSION 3.30)
project("libsl"
        VERSION 6.07
        DESCRIPTION "CHOO CHOO"
        LANGUAGES C)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

add_library(sl sl.c scandir.c)

if(WIN32)
        find_package(unofficial-pdcurses CONFIG REQUIRED)
        set(CURSES_LIBRARIES unofficial::pdcurses::pdcurses)
        find_program(CURSES_DLL NAMES pdcurses.dll REQUIRED)
        install(FILES ${CURSES_DLL} DESTINATION .)
else()
        find_package(PkgConfig REQUIRED)
        pkg_check_modules(CURSES REQUIRED ncursesw)
endif()

if(APPLE)
        add_compile_definitions(_XOPEN_SOURCE_EXTENDED)
endif()

configure_file(config.h.in config.h)

target_link_libraries(sl ${CURSES_LIBRARIES})
target_include_directories(sl PUBLIC ${CURSES_INCLUDE_DIRS} "${PROJECT_BINARY_DIR}")
target_compile_options(sl PUBLIC ${CURSES_CFLAGS_OTHER})

install(TARGETS sl DESTINATION .)
