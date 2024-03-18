cmake_minimum_required(VERSION 3.24)
project("Steam Locamotive"
        VERSION 5.05
        DESCRIPTION "CHOO CHOO"
        LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 23)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
list(APPEND SOURCES sl.cpp)
if(WIN32)
        add_compile_definitions(PDC_WIDE)
        list(APPEND SOURCES win32/scandir.cpp)
        
        find_path(CURSES_INCLUDE_DIRS NAMES curses.h REQUIRED)
        find_library(CURSES_LIBRARIES NAMES pdcurses REQUIRED)
        find_program(CURSES_DLL NAMES pdcurses.dll REQUIRED)
        list(APPEND LIBRARIES ${CURSES_LIBRARIES})
        list(APPEND INCLUDE_DIRS ${CURSES_INCLUDE_DIRS})

        install(FILES ${CURSES_DLL} DESTINATION bin)
else()
        find_package(PkgConfig REQUIRED)
        pkg_check_modules(CURSES REQUIRED ncursesw)

        list(APPEND LIBRARIES ${CURSES_LIBRARIES})
        list(APPEND INCLUDE_DIRS ${CURSES_INCLUDE_DIRS})
        list(APPEND CFLAGS_OTHER ${CURSES_CFLAGS_OTHER})
endif()

if(APPLE)
        add_compile_definitions(_XOPEN_SOURCE_EXTENDED)
endif()

add_executable(sl ${SOURCES})
target_link_libraries(sl ${LIBRARIES})
target_include_directories(sl PUBLIC ${INCLUDE_DIRS})
target_compile_options(sl PUBLIC ${CFLAGS_OTHER})

install(TARGETS sl
        RUNTIME DESTINATION bin
        COMPONENT applications)

set(CPACK_PACKAGE_NAME "sl")
set(CPACK_PACKAGE_VENDOR "sl")
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "SL (Steam Locomotive)")
set(CPACK_PACKAGE_VERSION "5.05.0")
set(CPACK_PACKAGE_VERSION_MAJOR "5")
set(CPACK_PACKAGE_VERSION_MINOR "05")
set(CPACK_PACKAGE_VERSION_PATCH "0")
set(CPACK_PACKAGE_INSTALL_DIRECTORY "sl")
set(CPACK_COMPONENTS_ALL applications)
set(CPACK_COMPONENT_APPLICATIONS_DISPLAY_NAME "sl")
set(CPACK_COMPONENT_APPLICATIONS_DESCRIPTION "SL (Steam Locomotive) runs across your terminal")
set(CPACK_COMPONENT_APPLICATIONS_GROUP "Runtime")
set(CPACK_ALL_INSTALL_TYPES Full)
set(CPACK_COMPONENT_APPLICATIONS_INSTALL_TYPES Full)

include(CPack)
