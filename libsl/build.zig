const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const libsl = b.addStaticLibrary(.{ .name = "sl", .target = target, .optimize = optimize, .root_source_file = b.path("src/sl.zig"), .pic = true });

    switch (optimize) {
        .Debug, .ReleaseSafe => libsl.bundle_compiler_rt = true,
        .ReleaseFast, .ReleaseSmall => {},
    }

    b.installArtifact(libsl);
}
