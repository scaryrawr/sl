cmake_minimum_required(VERSION 3.24)
project("SL"
        VERSION 5.06
        DESCRIPTION "CHOO CHOO"
        LANGUAGES C)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

add_executable(sl sl.c scandir.c sl.h scandir.h)
if(WIN32)
        find_path(CURSES_INCLUDE_DIRS NAMES curses.h REQUIRED)
        find_library(CURSES_LIBRARIES NAMES pdcurses REQUIRED)
        find_program(CURSES_DLL NAMES pdcurses.dll REQUIRED)
        install(FILES ${CURSES_DLL} DESTINATION bin COMPONENT applications)
else()
        find_package(PkgConfig REQUIRED)
        pkg_check_modules(CURSES REQUIRED ncursesw)
endif()

if(APPLE)
        add_compile_definitions(_XOPEN_SOURCE_EXTENDED)
endif()

find_package(cargs CONFIG REQUIRED)

configure_file(config.h.in config.h)

target_link_libraries(sl ${CURSES_LIBRARIES} cargs)
target_include_directories(sl PUBLIC ${CURSES_INCLUDE_DIRS} "${PROJECT_BINARY_DIR}")
target_compile_options(sl PUBLIC ${CURSES_CFLAGS_OTHER})

install(TARGETS sl
        RUNTIME DESTINATION bin
        COMPONENT applications)

set(CPACK_PACKAGE_NAME "sl")
set(CPACK_PACKAGE_VENDOR "sl")
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "SL (Steam Locomotive)")
set(CPACK_PACKAGE_VERSION "5.06.0")
set(CPACK_PACKAGE_VERSION_MAJOR "5")
set(CPACK_PACKAGE_VERSION_MINOR "06")
set(CPACK_PACKAGE_VERSION_PATCH "0")
set(CPACK_PACKAGE_INSTALL_DIRECTORY "sl")
set(CPACK_COMPONENTS_ALL applications)
set(CPACK_COMPONENT_APPLICATIONS_DISPLAY_NAME "sl")
set(CPACK_COMPONENT_APPLICATIONS_DESCRIPTION "SL (Steam Locomotive) runs across your terminal")
set(CPACK_COMPONENT_APPLICATIONS_GROUP "Runtime")
set(CPACK_ALL_INSTALL_TYPES Full)
set(CPACK_COMPONENT_APPLICATIONS_INSTALL_TYPES Full)
set(CPACK_NSIS_MODIFY_PATH ON)
set(CPACK_NSIS_ENABLE_UNINSTALL_BEFORE_INSTALL ON)
set(CPACK_NSIS_URL_INFO_ABOUT "https://github.com/scaryrawr/sl")
set(CPACK_NSIS_HELP_LINK "https://github.com/scaryrawr/sl/issues")
set(CPACK_RESOURCE_FILE_LICENSE "${CMAKE_SOURCE_DIR}/LICENSE")
set(CPACK_RESOURCE_FILE_README "${CMAKE_SOURCE_DIR}/README.md")
set(CPACK_PACKAGE_HOMEPAGE_URL "https://github.com/scaryrawr/sl")

include(CPack)
