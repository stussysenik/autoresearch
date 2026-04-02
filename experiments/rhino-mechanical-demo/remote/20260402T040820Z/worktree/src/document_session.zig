const std = @import("std");
const bridge = @import("bridge.zig");
const config = @import("config.zig");
const store_mod = @import("store.zig");
const types = @import("types.zig");

pub const DocumentSessionError = error{
    NoActiveDocument,
    ActiveDocumentUnavailable,
};

pub fn ensureActive(
    io: std.Io,
    allocator: std.mem.Allocator,
    store: *store_mod.Store,
    session_id: []const u8,
    target: config.BridgeTarget,
    preferred_document_id: ?[]const u8,
    allow_create: bool,
) (DocumentSessionError || bridge.DispatchError || store_mod.StoreError || std.mem.Allocator.Error)!types.ActiveDocument {
    if (try store.loadActiveDocument(allocator, session_id)) |stored| {
        errdefer stored.deinit(allocator);
        return try validateAndPersist(io, allocator, store, session_id, target, stored.document_id);
    }

    if (preferred_document_id) |document_id| {
        return validateAndPersist(io, allocator, store, session_id, target, document_id) catch |err| switch (err) {
            error.RemoteExecutionFailed => error.ActiveDocumentUnavailable,
            else => err,
        };
    }

    if (!allow_create) return error.NoActiveDocument;

    const opened = try bridge.openHeadlessDocument(io, allocator, target);
    errdefer opened.deinit(allocator);
    try store.upsertActiveDocument(session_id, opened);
    return opened;
}

pub fn closeActive(
    io: std.Io,
    allocator: std.mem.Allocator,
    store: *store_mod.Store,
    session_id: []const u8,
    target: config.BridgeTarget,
) (DocumentSessionError || bridge.DispatchError || store_mod.StoreError || std.mem.Allocator.Error)!void {
    const stored = try store.loadActiveDocument(allocator, session_id) orelse return error.NoActiveDocument;
    defer stored.deinit(allocator);

    try bridge.closeDocument(io, allocator, target, stored.document_id);
    try store.clearActiveDocument(session_id);
    try store.clearObjects(session_id);
}

fn validateAndPersist(
    io: std.Io,
    allocator: std.mem.Allocator,
    store: *store_mod.Store,
    session_id: []const u8,
    target: config.BridgeTarget,
    document_id: []const u8,
) (DocumentSessionError || bridge.DispatchError || store_mod.StoreError || std.mem.Allocator.Error)!types.ActiveDocument {
    const live = bridge.describeDocument(io, allocator, target, document_id) catch |err| switch (err) {
        error.RemoteExecutionFailed => return error.ActiveDocumentUnavailable,
        else => return err,
    };
    errdefer live.deinit(allocator);
    try store.upsertActiveDocument(session_id, live);
    return live;
}
