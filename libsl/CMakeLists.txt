cmake_minimum_required(VERSION 3.30)
project("libsl"
        VERSION 6.07
        DESCRIPTION "CHOO CHOO"
        LANGUAGES C)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

add_library(sl sl.c)

install(TARGETS sl DESTINATION .)
