const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const slzig = b.addStaticLibrary(.{ .name = "slzig", .target = target, .optimize = optimize, .root_source_file = b.path("src/sl.zig") });
    const libsl = b.addStaticLibrary(.{ .name = "slc", .target = target, .optimize = optimize });
    slzig.addIncludePath(b.path("."));
    libsl.addCSourceFile(.{ .file = b.path("sl.c") });

    b.installArtifact(libsl);
    b.installArtifact(slzig);
}
