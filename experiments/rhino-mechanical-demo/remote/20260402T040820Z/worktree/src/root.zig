const std = @import("std");

pub const app = @import("app.zig");
pub const bridge = @import("bridge.zig");
pub const config = @import("config.zig");
pub const document_session = @import("document_session.zig");
pub const mock_bridge = @import("mock_bridge.zig");
pub const planner = @import("planner.zig");
pub const rhino_live_demo = @import("rhino_live_demo.zig");
pub const store = @import("store.zig");
pub const types = @import("types.zig");
pub const util = @import("util.zig");

pub fn appMain(init: std.process.Init) !void {
    try app.main(init);
}

test {
    _ = planner;
    _ = store;
    _ = bridge;
    _ = config;
    _ = document_session;
    _ = mock_bridge;
    _ = rhino_live_demo;
}
