const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const libsl = b.addStaticLibrary(.{
        .name = "sl",
        .target = target,
        .optimize = optimize,
    });

    libsl.addCSourceFile(.{ .file = b.path("sl.c") });

    b.installArtifact(libsl);
}
