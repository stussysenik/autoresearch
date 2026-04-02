const std = @import("std");

pub const ActionKind = enum {
    create_cube,
    create_sphere,
    create_cylinder,
    create_organic_blob,
    create_scientific_shell,
    create_mpc_live_ii_button_cap,
    create_mpc_live_ii_panel_demo,
    create_spiral_staircase,
    move_object,
};

pub const Direction = enum {
    left,
    right,
    up,
    down,
    forward,
    back,
};

pub const PlanAction = struct {
    host: []const u8 = "rhino",
    kind: ActionKind,
    method: []const u8,
    document_id: ?[]const u8 = null,
    alias: ?[]const u8 = null,
    host_id: ?[]const u8 = null,
    size_mm: ?f64 = null,
    radius_mm: ?f64 = null,
    height_mm: ?f64 = null,
    step_count: ?u32 = null,
    distance_mm: ?f64 = null,
    direction: ?Direction = null,

    pub fn actionName(self: PlanAction) []const u8 {
        return @tagName(self.kind);
    }
};

pub const BridgeObject = struct {
    alias: ?[]const u8 = null,
    host_id: []const u8,
    kind: ?[]const u8 = null,
};

pub const SessionObject = struct {
    alias: []const u8,
    host: []const u8,
    document_id: []const u8,
    host_id: []const u8,
    kind: []const u8,
};

pub const ActiveDocument = struct {
    document_id: []const u8,
    unit_system: []const u8,
    model_tolerance_mm: f64,
    headless: bool,
    document_path: ?[]const u8 = null,

    pub fn deinit(self: ActiveDocument, allocator: std.mem.Allocator) void {
        allocator.free(self.document_id);
        allocator.free(self.unit_system);
        if (self.document_path) |path| allocator.free(path);
    }
};

pub const SessionSummary = struct {
    command_count: usize,
    active_document: ?ActiveDocument = null,
    objects: []SessionObject,

    pub fn deinit(self: SessionSummary, allocator: std.mem.Allocator) void {
        if (self.active_document) |document| {
            document.deinit(allocator);
        }
        for (self.objects) |object| {
            allocator.free(object.alias);
            allocator.free(object.host);
            allocator.free(object.document_id);
            allocator.free(object.host_id);
            allocator.free(object.kind);
        }
        allocator.free(self.objects);
    }
};
