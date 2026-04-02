const std = @import("std");
const types = @import("types.zig");

pub const PlanError = std.mem.Allocator.Error || error{
    UnsupportedPrompt,
    InvalidMeasurement,
    InvalidStepCount,
    MissingDistance,
    MissingDirection,
    MissingAlias,
    MissingHeight,
};

pub fn supportedPromptHelp() []const u8 {
    return "Supported prompts: `create cube size 2m named block-a`, `create sphere radius 1m named ball-a`, `create cylinder radius 500mm height 2m named column-a`, `create organic blob named pod-a`, `create organic blob size 1.8m named pod-a`, `create scientific shell named shell-a`, `create scientific shell size 2m named shell-a`, `create mpc live ii button cap named play-start-cap`, `create mpc live ii panel demo named mpc-live-ii-demo`, `spiral staircase, 10 steps, 3m tall`, `move staircase 500mm left`";
}

pub fn planPrompt(allocator: std.mem.Allocator, prompt: []const u8) PlanError!types.PlanAction {
    const lowered = try allocator.dupe(u8, prompt);
    lowercaseInPlace(lowered);

    var tokens: std.ArrayList([]const u8) = .empty;
    defer tokens.deinit(allocator);

    var iter = std.mem.tokenizeAny(u8, lowered, " \t\r\n");
    while (iter.next()) |raw_token| {
        const token = trimToken(raw_token);
        if (token.len == 0) continue;
        try tokens.append(allocator, token);
    }

    if (tokens.items.len == 0) return error.UnsupportedPrompt;

    if (std.mem.eql(u8, tokens.items[0], "move")) {
        return try parseMove(tokens.items);
    }

    if (containsToken(tokens.items, "cube")) {
        return try parseCube(tokens.items);
    }

    if (containsToken(tokens.items, "sphere")) {
        return try parseSphere(tokens.items);
    }

    if (containsToken(tokens.items, "cylinder")) {
        return try parseCylinder(tokens.items);
    }

    if (containsToken(tokens.items, "organic") and containsToken(tokens.items, "blob")) {
        return try parseOrganicBlob(tokens.items);
    }

    if (containsToken(tokens.items, "scientific") and containsToken(tokens.items, "shell")) {
        return try parseScientificShell(tokens.items);
    }

    if (containsToken(tokens.items, "mpc") and containsToken(tokens.items, "button") and containsToken(tokens.items, "cap")) {
        return try parseMpcLiveIiButtonCap(tokens.items);
    }

    if (containsToken(tokens.items, "mpc") and containsToken(tokens.items, "panel") and containsToken(tokens.items, "demo")) {
        return try parseMpcLiveIiPanelDemo(tokens.items);
    }

    if (containsToken(tokens.items, "staircase")) {
        return try parseStaircase(tokens.items);
    }

    return error.UnsupportedPrompt;
}

fn parseCube(tokens: []const []const u8) PlanError!types.PlanAction {
    var size_mm: f64 = 1000.0;
    var alias: []const u8 = "cube";

    for (tokens, 0..) |token, index| {
        if (std.mem.eql(u8, token, "size") and index + 1 < tokens.len) {
            size_mm = try parseMeasurement(tokens[index + 1]);
        }
        if ((std.mem.eql(u8, token, "named") or std.mem.eql(u8, token, "name")) and index + 1 < tokens.len) {
            alias = tokens[index + 1];
        }
    }

    return .{
        .kind = .create_cube,
        .method = "rhino.geometry.create_cube",
        .alias = alias,
        .size_mm = size_mm,
    };
}

fn parseSphere(tokens: []const []const u8) PlanError!types.PlanAction {
    var radius_mm: f64 = 500.0;
    var alias: []const u8 = "sphere";

    for (tokens, 0..) |token, index| {
        if (std.mem.eql(u8, token, "radius") and index + 1 < tokens.len) {
            radius_mm = try parseMeasurement(tokens[index + 1]);
        }
        if ((std.mem.eql(u8, token, "named") or std.mem.eql(u8, token, "name")) and index + 1 < tokens.len) {
            alias = tokens[index + 1];
        }
    }

    return .{
        .kind = .create_sphere,
        .method = "rhino.geometry.create_sphere",
        .alias = alias,
        .radius_mm = radius_mm,
    };
}

fn parseCylinder(tokens: []const []const u8) PlanError!types.PlanAction {
    var radius_mm: f64 = 500.0;
    var height_mm: ?f64 = null;
    var alias: []const u8 = "cylinder";

    for (tokens, 0..) |token, index| {
        if (std.mem.eql(u8, token, "radius") and index + 1 < tokens.len) {
            radius_mm = try parseMeasurement(tokens[index + 1]);
        }
        if (std.mem.eql(u8, token, "height") and index + 1 < tokens.len) {
            height_mm = try parseMeasurement(tokens[index + 1]);
        }
        if (std.mem.eql(u8, token, "tall") and index > 0) {
            height_mm = try parseMeasurement(tokens[index - 1]);
        }
        if ((std.mem.eql(u8, token, "named") or std.mem.eql(u8, token, "name")) and index + 1 < tokens.len) {
            alias = tokens[index + 1];
        }
    }

    return .{
        .kind = .create_cylinder,
        .method = "rhino.geometry.create_cylinder",
        .alias = alias,
        .radius_mm = radius_mm,
        .height_mm = height_mm orelse return error.MissingHeight,
    };
}

fn parseOrganicBlob(tokens: []const []const u8) PlanError!types.PlanAction {
    var size_mm: f64 = 1800.0;
    var alias: []const u8 = "organic-blob";

    for (tokens, 0..) |token, index| {
        if (std.mem.eql(u8, token, "size") and index + 1 < tokens.len) {
            size_mm = try parseMeasurement(tokens[index + 1]);
        }
        if ((std.mem.eql(u8, token, "named") or std.mem.eql(u8, token, "name")) and index + 1 < tokens.len) {
            alias = tokens[index + 1];
        }
    }

    return .{
        .kind = .create_organic_blob,
        .method = "rhino.geometry.create_organic_blob",
        .alias = alias,
        .size_mm = size_mm,
    };
}

fn parseScientificShell(tokens: []const []const u8) PlanError!types.PlanAction {
    var size_mm: f64 = 2000.0;
    var alias: []const u8 = "scientific-shell";

    for (tokens, 0..) |token, index| {
        if (std.mem.eql(u8, token, "size") and index + 1 < tokens.len) {
            size_mm = try parseMeasurement(tokens[index + 1]);
        }
        if ((std.mem.eql(u8, token, "named") or std.mem.eql(u8, token, "name")) and index + 1 < tokens.len) {
            alias = tokens[index + 1];
        }
    }

    return .{
        .kind = .create_scientific_shell,
        .method = "rhino.geometry.create_scientific_shell",
        .alias = alias,
        .size_mm = size_mm,
    };
}

fn parseMpcLiveIiButtonCap(tokens: []const []const u8) PlanError!types.PlanAction {
    var size_mm: f64 = 18.0;
    var alias: []const u8 = "mpc-live-ii-play-start-cap";

    for (tokens, 0..) |token, index| {
        if (std.mem.eql(u8, token, "size") and index + 1 < tokens.len) {
            size_mm = try parseMeasurement(tokens[index + 1]);
        }
        if ((std.mem.eql(u8, token, "named") or std.mem.eql(u8, token, "name")) and index + 1 < tokens.len) {
            alias = tokens[index + 1];
        }
    }

    return .{
        .kind = .create_mpc_live_ii_button_cap,
        .method = "rhino.geometry.create_mpc_live_ii_button_cap",
        .alias = alias,
        .size_mm = size_mm,
    };
}

fn parseMpcLiveIiPanelDemo(tokens: []const []const u8) PlanError!types.PlanAction {
    var size_mm: f64 = 411.5;
    var alias: []const u8 = "mpc-live-ii-panel-demo";

    for (tokens, 0..) |token, index| {
        if (std.mem.eql(u8, token, "size") and index + 1 < tokens.len) {
            size_mm = try parseMeasurement(tokens[index + 1]);
        }
        if ((std.mem.eql(u8, token, "named") or std.mem.eql(u8, token, "name")) and index + 1 < tokens.len) {
            alias = tokens[index + 1];
        }
    }

    return .{
        .kind = .create_mpc_live_ii_panel_demo,
        .method = "rhino.geometry.create_mpc_live_ii_panel_demo",
        .alias = alias,
        .size_mm = size_mm,
    };
}

fn parseStaircase(tokens: []const []const u8) PlanError!types.PlanAction {
    var step_count: ?u32 = null;
    var height_mm: ?f64 = null;
    var radius_mm: f64 = 1200.0;
    var alias: []const u8 = "staircase";

    for (tokens, 0..) |token, index| {
        if (std.mem.eql(u8, token, "steps") and index > 0) {
            step_count = std.fmt.parseInt(u32, tokens[index - 1], 10) catch return error.InvalidStepCount;
        }
        if (std.mem.eql(u8, token, "tall") and index > 0) {
            height_mm = try parseMeasurement(tokens[index - 1]);
        }
        if (std.mem.eql(u8, token, "height") and index + 1 < tokens.len) {
            height_mm = try parseMeasurement(tokens[index + 1]);
        }
        if (std.mem.eql(u8, token, "radius") and index + 1 < tokens.len) {
            radius_mm = try parseMeasurement(tokens[index + 1]);
        }
        if ((std.mem.eql(u8, token, "named") or std.mem.eql(u8, token, "name")) and index + 1 < tokens.len) {
            alias = tokens[index + 1];
        }
    }

    return .{
        .kind = .create_spiral_staircase,
        .method = "rhino.geometry.create_spiral_staircase",
        .alias = alias,
        .radius_mm = radius_mm,
        .height_mm = height_mm orelse return error.MissingHeight,
        .step_count = step_count orelse return error.InvalidStepCount,
    };
}

fn parseMove(tokens: []const []const u8) PlanError!types.PlanAction {
    if (tokens.len < 4) return error.MissingDistance;

    const alias = tokens[1];
    if (alias.len == 0) return error.MissingAlias;

    const distance_mm = try parseMeasurement(tokens[2]);
    const direction = parseDirection(tokens[3]) orelse return error.MissingDirection;

    return .{
        .kind = .move_object,
        .method = "rhino.objects.translate",
        .alias = alias,
        .distance_mm = distance_mm,
        .direction = direction,
    };
}

fn parseDirection(token: []const u8) ?types.Direction {
    if (std.mem.eql(u8, token, "left")) return .left;
    if (std.mem.eql(u8, token, "right")) return .right;
    if (std.mem.eql(u8, token, "up")) return .up;
    if (std.mem.eql(u8, token, "down")) return .down;
    if (std.mem.eql(u8, token, "forward")) return .forward;
    if (std.mem.eql(u8, token, "back")) return .back;
    return null;
}

fn parseMeasurement(token: []const u8) PlanError!f64 {
    const cleaned = trimToken(token);
    var split_index: usize = 0;
    while (split_index < cleaned.len and (std.ascii.isDigit(cleaned[split_index]) or cleaned[split_index] == '.')) : (split_index += 1) {}
    if (split_index == 0 or split_index == cleaned.len) return error.InvalidMeasurement;

    const numeric = std.fmt.parseFloat(f64, cleaned[0..split_index]) catch return error.InvalidMeasurement;
    const unit = cleaned[split_index..];

    if (std.mem.eql(u8, unit, "mm")) return numeric;
    if (std.mem.eql(u8, unit, "cm")) return numeric * 10.0;
    if (std.mem.eql(u8, unit, "m")) return numeric * 1000.0;

    return error.InvalidMeasurement;
}

fn containsToken(tokens: []const []const u8, needle: []const u8) bool {
    for (tokens) |token| {
        if (std.mem.eql(u8, token, needle)) return true;
    }
    return false;
}

fn trimToken(token: []const u8) []const u8 {
    return std.mem.trim(u8, token, ",.;:!?()");
}

fn lowercaseInPlace(bytes: []u8) void {
    for (bytes) |*byte| {
        byte.* = std.ascii.toLower(byte.*);
    }
}

test "plans cube creation" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    const plan = try planPrompt(allocator, "create cube size 2m named Block-A");
    try std.testing.expectEqual(types.ActionKind.create_cube, plan.kind);
    try std.testing.expectEqualStrings("block-a", plan.alias.?);
    try std.testing.expectEqual(@as(f64, 2000), plan.size_mm.?);
}

test "plans staircase creation" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    const plan = try planPrompt(allocator, "spiral staircase, 10 steps, 3m tall");
    try std.testing.expectEqual(types.ActionKind.create_spiral_staircase, plan.kind);
    try std.testing.expectEqual(@as(u32, 10), plan.step_count.?);
    try std.testing.expectEqual(@as(f64, 3000), plan.height_mm.?);
}

test "plans sphere creation" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    const plan = try planPrompt(allocator, "create sphere radius 1m named Ball-A");
    try std.testing.expectEqual(types.ActionKind.create_sphere, plan.kind);
    try std.testing.expectEqualStrings("ball-a", plan.alias.?);
    try std.testing.expectEqual(@as(f64, 1000), plan.radius_mm.?);
}

test "plans cylinder creation" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    const plan = try planPrompt(allocator, "create cylinder radius 500mm height 2m named column-a");
    try std.testing.expectEqual(types.ActionKind.create_cylinder, plan.kind);
    try std.testing.expectEqualStrings("column-a", plan.alias.?);
    try std.testing.expectEqual(@as(f64, 500), plan.radius_mm.?);
    try std.testing.expectEqual(@as(f64, 2000), plan.height_mm.?);
}

test "plans organic blob creation" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    const plan = try planPrompt(allocator, "create organic blob size 1.8m named pod-a");
    try std.testing.expectEqual(types.ActionKind.create_organic_blob, plan.kind);
    try std.testing.expectEqualStrings("pod-a", plan.alias.?);
    try std.testing.expectEqual(@as(f64, 1800), plan.size_mm.?);
}

test "plans organic blob creation with default size" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    const plan = try planPrompt(allocator, "create organic blob named pod-a");
    try std.testing.expectEqual(types.ActionKind.create_organic_blob, plan.kind);
    try std.testing.expectEqualStrings("pod-a", plan.alias.?);
    try std.testing.expectEqual(@as(f64, 1800), plan.size_mm.?);
}

test "plans scientific shell creation" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    const plan = try planPrompt(allocator, "create scientific shell size 2m named shell-a");
    try std.testing.expectEqual(types.ActionKind.create_scientific_shell, plan.kind);
    try std.testing.expectEqualStrings("shell-a", plan.alias.?);
    try std.testing.expectEqual(@as(f64, 2000), plan.size_mm.?);
}

test "plans scientific shell creation with default size" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    const plan = try planPrompt(allocator, "create scientific shell named shell-a");
    try std.testing.expectEqual(types.ActionKind.create_scientific_shell, plan.kind);
    try std.testing.expectEqualStrings("shell-a", plan.alias.?);
    try std.testing.expectEqual(@as(f64, 2000), plan.size_mm.?);
}

test "plans mpc live ii button cap creation" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    const plan = try planPrompt(allocator, "create mpc live ii button cap named play-start-cap");
    try std.testing.expectEqual(types.ActionKind.create_mpc_live_ii_button_cap, plan.kind);
    try std.testing.expectEqualStrings("play-start-cap", plan.alias.?);
    try std.testing.expectEqual(@as(f64, 18), plan.size_mm.?);
}

test "plans mpc live ii panel demo creation" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    const plan = try planPrompt(allocator, "create mpc live ii panel demo named live-ii-panel");
    try std.testing.expectEqual(types.ActionKind.create_mpc_live_ii_panel_demo, plan.kind);
    try std.testing.expectEqualStrings("live-ii-panel", plan.alias.?);
    try std.testing.expectEqual(@as(f64, 411.5), plan.size_mm.?);
}

test "plans object movement" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    const plan = try planPrompt(allocator, "move staircase 500mm left");
    try std.testing.expectEqual(types.ActionKind.move_object, plan.kind);
    try std.testing.expectEqualStrings("staircase", plan.alias.?);
    try std.testing.expectEqual(@as(f64, 500), plan.distance_mm.?);
    try std.testing.expectEqual(types.Direction.left, plan.direction.?);
}
