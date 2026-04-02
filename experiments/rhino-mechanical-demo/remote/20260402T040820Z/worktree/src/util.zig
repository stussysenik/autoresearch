const std = @import("std");

const ids = struct {
    var counter: std.atomic.Value(u64) = .init(1);
};

pub fn ensureParentDir(io: std.Io, path: []const u8) !void {
    if (std.fs.path.dirname(path)) |dir_path| {
        if (dir_path.len > 0) {
            try std.Io.Dir.cwd().createDirPath(io, dir_path);
        }
    }
}

pub fn stringifyAlloc(allocator: std.mem.Allocator, value: anytype) ![]u8 {
    return stringifyWithOptions(allocator, value, .{ .whitespace = .indent_2 });
}

pub fn stringifyCompactAlloc(allocator: std.mem.Allocator, value: anytype) ![]u8 {
    return stringifyWithOptions(allocator, value, .{});
}

fn stringifyWithOptions(allocator: std.mem.Allocator, value: anytype, options: std.json.Stringify.Options) ![]u8 {
    var out: std.Io.Writer.Allocating = .init(allocator);
    defer out.deinit();
    try std.json.Stringify.value(value, options, &out.writer);
    return try out.toOwnedSlice();
}

pub fn printLine(bytes: []const u8) !void {
    std.debug.print("{s}\n", .{bytes});
}

pub fn timestamp() i64 {
    return @intCast(nextId());
}

pub fn nextId() u64 {
    return ids.counter.fetchAdd(1, .monotonic);
}
