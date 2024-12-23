const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const libsl = b.addStaticLibrary(.{ .name = "sl", .target = target, .optimize = optimize, .root_source_file = b.path("src/sl.zig") });

    const zg = b.dependency("zg", .{});
    libsl.root_module.addImport("grapheme", zg.module("grapheme"));
    libsl.addIncludePath(b.path("."));
    libsl.addCSourceFile(.{ .file = b.path("sl.c") });

    b.installArtifact(libsl);
}