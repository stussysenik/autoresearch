const std = @import("std");
const types = @import("types.zig");
const util = @import("util.zig");

const MockDocument = struct {
    document_id: []const u8,
    unit_system: []const u8 = "Millimeters",
    model_tolerance_mm: f64 = 0.01,
    headless: bool = true,
    document_path: ?[]const u8 = null,

    fn deinit(self: MockDocument, allocator: std.mem.Allocator) void {
        allocator.free(self.document_id);
        if (self.document_path) |path| allocator.free(path);
    }
};

const MockState = struct {
    allocator: std.mem.Allocator,
    documents: std.ArrayList(MockDocument) = .empty,

    fn deinit(self: *MockState) void {
        for (self.documents.items) |document| {
            document.deinit(self.allocator);
        }
        self.documents.deinit(self.allocator);
    }

    fn openDocument(self: *MockState) !*const MockDocument {
        const document_id = try std.fmt.allocPrint(self.allocator, "rhino-doc-{d}", .{util.nextId()});
        try self.documents.append(self.allocator, .{
            .document_id = document_id,
        });
        return &self.documents.items[self.documents.items.len - 1];
    }

    fn findDocument(self: *MockState, document_id: []const u8) ?*const MockDocument {
        for (self.documents.items) |*document| {
            if (std.mem.eql(u8, document.document_id, document_id)) return document;
        }
        return null;
    }

    fn removeDocument(self: *MockState, document_id: []const u8) bool {
        for (self.documents.items, 0..) |document, index| {
            if (std.mem.eql(u8, document.document_id, document_id)) {
                const removed = self.documents.orderedRemove(index);
                removed.deinit(self.allocator);
                return true;
            }
        }
        return false;
    }
};

pub fn serve(io: std.Io, allocator: std.mem.Allocator, socket_path: []const u8) !void {
    try util.ensureParentDir(io, socket_path);
    std.Io.Dir.cwd().deleteFile(io, socket_path) catch |err| switch (err) {
        error.FileNotFound => {},
        else => return err,
    };

    const address = try std.Io.net.UnixAddress.init(socket_path);
    var server = try address.listen(io, .{});
    defer {
        server.deinit(io);
        std.Io.Dir.cwd().deleteFile(io, socket_path) catch {};
    }

    std.debug.print("mock Rhino bridge listening on {s}\n", .{socket_path});

    var state = MockState{
        .allocator = allocator,
    };
    defer state.deinit();

    while (true) {
        var stream = try server.accept(io);
        defer stream.close(io);

        const request_json = try readMessage(io, allocator, stream);
        defer allocator.free(request_json);

        const response_json = processRequest(allocator, &state, request_json, socket_path) catch |err| blk: {
            const response = try buildErrorResponse(allocator, null, 500, @errorName(err));
            break :blk response;
        };
        defer allocator.free(response_json);

        var write_buffer: [512]u8 = undefined;
        var writer = stream.writer(io, &write_buffer);
        writer.interface.writeAll(response_json) catch return writer.err.?;
        writer.interface.writeAll("\n") catch return writer.err.?;
        writer.interface.flush() catch return writer.err.?;
    }
}

fn processRequest(allocator: std.mem.Allocator, state: *MockState, request_json: []const u8, socket_path: []const u8) ![]u8 {
    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, request_json, .{});
    defer parsed.deinit();

    const root = switch (parsed.value) {
        .object => |obj| obj,
        else => return buildErrorResponse(allocator, null, 400, "invalid request"),
    };

    const id = try getOptionalString(root, "id");
    const method = (root.get("method") orelse return buildErrorResponse(allocator, id, 400, "missing method"));
    const method_name = switch (method) {
        .string => |value| value,
        else => return buildErrorResponse(allocator, id, 400, "invalid method"),
    };

    const params_value = root.get("params") orelse return buildErrorResponse(allocator, id, 400, "missing params");
    const params = switch (params_value) {
        .object => |obj| obj,
        else => return buildErrorResponse(allocator, id, 400, "invalid params"),
    };

    if (std.mem.eql(u8, method_name, "rhino.system.ping")) {
        return buildPingResponse(allocator, id);
    }

    if (std.mem.eql(u8, method_name, "rhino.system.describe_runtime")) {
        return buildRuntimeResponse(allocator, id, socket_path);
    }

    if (std.mem.eql(u8, method_name, "rhino.document.open_headless")) {
        const document = try state.openDocument();
        return buildDocumentResponse(allocator, id, document, "mock headless document opened");
    }

    if (std.mem.eql(u8, method_name, "rhino.document.describe")) {
        const document_id = (try getOptionalString(params, "document_id")) orelse return buildErrorResponse(allocator, id, 400, "missing document_id");
        const document = state.findDocument(document_id) orelse return buildErrorResponse(allocator, id, 404, "document not found");
        return buildDocumentResponse(allocator, id, document, "mock document available");
    }

    if (std.mem.eql(u8, method_name, "rhino.document.close")) {
        const document_id = (try getOptionalString(params, "document_id")) orelse return buildErrorResponse(allocator, id, 400, "missing document_id");
        if (!state.removeDocument(document_id)) {
            return buildErrorResponse(allocator, id, 404, "document not found");
        }
        return buildPingResponse(allocator, id);
    }

    if (std.mem.eql(u8, method_name, "rhino.geometry.create_cube")) {
        const document_id = (try getOptionalString(params, "document_id")) orelse return buildErrorResponse(allocator, id, 400, "missing document_id");
        if (state.findDocument(document_id) == null) return buildErrorResponse(allocator, id, 404, "document not found");
        const alias = (try getOptionalString(params, "alias")) orelse "cube";
        return buildObjectSuccessResponse(allocator, id, alias, "cube", "rhino-cube");
    }

    if (std.mem.eql(u8, method_name, "rhino.geometry.create_sphere")) {
        const document_id = (try getOptionalString(params, "document_id")) orelse return buildErrorResponse(allocator, id, 400, "missing document_id");
        if (state.findDocument(document_id) == null) return buildErrorResponse(allocator, id, 404, "document not found");
        const alias = (try getOptionalString(params, "alias")) orelse "sphere";
        return buildObjectSuccessResponse(allocator, id, alias, "sphere", "rhino-sphere");
    }

    if (std.mem.eql(u8, method_name, "rhino.geometry.create_cylinder")) {
        const document_id = (try getOptionalString(params, "document_id")) orelse return buildErrorResponse(allocator, id, 400, "missing document_id");
        if (state.findDocument(document_id) == null) return buildErrorResponse(allocator, id, 404, "document not found");
        const alias = (try getOptionalString(params, "alias")) orelse "cylinder";
        return buildObjectSuccessResponse(allocator, id, alias, "cylinder", "rhino-cylinder");
    }

    if (std.mem.eql(u8, method_name, "rhino.geometry.create_organic_blob")) {
        const document_id = (try getOptionalString(params, "document_id")) orelse return buildErrorResponse(allocator, id, 400, "missing document_id");
        if (state.findDocument(document_id) == null) return buildErrorResponse(allocator, id, 404, "document not found");
        const alias = (try getOptionalString(params, "alias")) orelse "organic-blob";
        return buildObjectSuccessResponse(allocator, id, alias, "organic_blob", "rhino-organic-blob");
    }

    if (std.mem.eql(u8, method_name, "rhino.geometry.create_scientific_shell")) {
        const document_id = (try getOptionalString(params, "document_id")) orelse return buildErrorResponse(allocator, id, 400, "missing document_id");
        if (state.findDocument(document_id) == null) return buildErrorResponse(allocator, id, 404, "document not found");
        const alias = (try getOptionalString(params, "alias")) orelse "scientific-shell";
        return buildObjectSuccessResponse(allocator, id, alias, "scientific_shell", "rhino-scientific-shell");
    }

    if (std.mem.eql(u8, method_name, "rhino.geometry.create_mpc_live_ii_button_cap")) {
        const document_id = (try getOptionalString(params, "document_id")) orelse return buildErrorResponse(allocator, id, 400, "missing document_id");
        if (state.findDocument(document_id) == null) return buildErrorResponse(allocator, id, 404, "document not found");
        const alias = (try getOptionalString(params, "alias")) orelse "mpc-live-ii-play-start-cap";
        return buildObjectSuccessResponse(allocator, id, alias, "mpc_live_ii_button_cap", "rhino-mpc-live-ii-button-cap");
    }

    if (std.mem.eql(u8, method_name, "rhino.geometry.create_mpc_live_ii_panel_demo")) {
        const document_id = (try getOptionalString(params, "document_id")) orelse return buildErrorResponse(allocator, id, 400, "missing document_id");
        if (state.findDocument(document_id) == null) return buildErrorResponse(allocator, id, 404, "document not found");
        const alias = (try getOptionalString(params, "alias")) orelse "mpc-live-ii-panel-demo";
        return buildObjectSuccessResponse(allocator, id, alias, "mpc_live_ii_panel_demo", "rhino-mpc-live-ii-panel-demo");
    }

    if (std.mem.eql(u8, method_name, "rhino.geometry.create_spiral_staircase")) {
        const document_id = (try getOptionalString(params, "document_id")) orelse return buildErrorResponse(allocator, id, 400, "missing document_id");
        if (state.findDocument(document_id) == null) return buildErrorResponse(allocator, id, 404, "document not found");
        const alias = (try getOptionalString(params, "alias")) orelse "staircase";
        return buildObjectSuccessResponse(allocator, id, alias, "spiral_staircase", "rhino-staircase");
    }

    if (std.mem.eql(u8, method_name, "rhino.objects.translate")) {
        const document_id = (try getOptionalString(params, "document_id")) orelse return buildErrorResponse(allocator, id, 400, "missing document_id");
        if (state.findDocument(document_id) == null) return buildErrorResponse(allocator, id, 404, "document not found");
        const host_id = (try getOptionalString(params, "host_id")) orelse return buildErrorResponse(allocator, id, 400, "missing host_id");
        const alias = try getOptionalString(params, "alias");
        return buildMoveResponse(allocator, id, host_id, alias);
    }

    return buildErrorResponse(allocator, id, 404, "unknown method");
}

fn buildPingResponse(allocator: std.mem.Allocator, id: ?[]const u8) ![]u8 {
    const response = struct {
        jsonrpc: []const u8 = "2.0",
        id: ?[]const u8,
        result: struct {
            status: []const u8 = "ok",
            summary: []const u8 = "pong",
        },
    }{
        .id = id,
        .result = .{},
    };

    return util.stringifyCompactAlloc(allocator, response);
}

fn buildRuntimeResponse(allocator: std.mem.Allocator, id: ?[]const u8, socket_path: []const u8) ![]u8 {
    const methods = [_][]const u8{
        "rhino.system.ping",
        "rhino.system.describe_runtime",
        "rhino.document.open_headless",
        "rhino.document.describe",
        "rhino.document.close",
        "rhino.geometry.create_cube",
        "rhino.geometry.create_sphere",
        "rhino.geometry.create_cylinder",
        "rhino.geometry.create_organic_blob",
        "rhino.geometry.create_scientific_shell",
        "rhino.geometry.create_mpc_live_ii_button_cap",
        "rhino.geometry.create_mpc_live_ii_panel_demo",
        "rhino.geometry.create_spiral_staircase",
        "rhino.objects.translate",
    };

    const response = struct {
        jsonrpc: []const u8 = "2.0",
        id: ?[]const u8,
        result: struct {
            status: []const u8 = "ok",
            summary: []const u8 = "mock runtime available",
            runtime: struct {
                bridge_kind: []const u8 = "mock-rhino",
                runtime_version: []const u8 = "mock-1",
                transport: []const u8 = "unix",
                endpoint: []const u8,
                license_status: []const u8 = "not_applicable",
                supported_methods: []const []const u8,
            },
        },
    }{
        .id = id,
        .result = .{
            .runtime = .{
                .endpoint = socket_path,
                .supported_methods = &methods,
            },
        },
    };

    return util.stringifyCompactAlloc(allocator, response);
}

fn buildDocumentResponse(
    allocator: std.mem.Allocator,
    id: ?[]const u8,
    document: *const MockDocument,
    summary: []const u8,
) ![]u8 {
    const response = struct {
        jsonrpc: []const u8 = "2.0",
        id: ?[]const u8,
        result: struct {
            status: []const u8 = "ok",
            summary: []const u8,
            document: struct {
                document_id: []const u8,
                unit_system: []const u8,
                model_tolerance_mm: f64,
                headless: bool,
                document_path: ?[]const u8,
            },
        },
    }{
        .id = id,
        .result = .{
            .summary = summary,
            .document = .{
                .document_id = document.document_id,
                .unit_system = document.unit_system,
                .model_tolerance_mm = document.model_tolerance_mm,
                .headless = document.headless,
                .document_path = document.document_path,
            },
        },
    };

    return util.stringifyCompactAlloc(allocator, response);
}

fn buildObjectSuccessResponse(
    allocator: std.mem.Allocator,
    id: ?[]const u8,
    alias: []const u8,
    kind: []const u8,
    prefix: []const u8,
) ![]u8 {
    const host_id = try std.fmt.allocPrint(allocator, "{s}-{d}", .{ prefix, util.nextId() });
    defer allocator.free(host_id);

    const objects = [_]types.BridgeObject{
        .{
            .alias = alias,
            .host_id = host_id,
            .kind = kind,
        },
    };

    const response = struct {
        jsonrpc: []const u8 = "2.0",
        id: ?[]const u8,
        result: struct {
            status: []const u8 = "ok",
            summary: []const u8 = "mock create completed",
            objects: []const types.BridgeObject,
        },
    }{
        .id = id,
        .result = .{
            .objects = &objects,
        },
    };

    return util.stringifyCompactAlloc(allocator, response);
}

fn buildMoveResponse(
    allocator: std.mem.Allocator,
    id: ?[]const u8,
    host_id: []const u8,
    alias: ?[]const u8,
) ![]u8 {
    const objects = [_]types.BridgeObject{
        .{
            .alias = alias,
            .host_id = host_id,
            .kind = "translated_object",
        },
    };

    const response = struct {
        jsonrpc: []const u8 = "2.0",
        id: ?[]const u8,
        result: struct {
            status: []const u8 = "ok",
            summary: []const u8 = "mock move completed",
            objects: []const types.BridgeObject,
        },
    }{
        .id = id,
        .result = .{
            .objects = &objects,
        },
    };

    return util.stringifyCompactAlloc(allocator, response);
}

fn buildErrorResponse(
    allocator: std.mem.Allocator,
    id: ?[]const u8,
    code: i32,
    message: []const u8,
) ![]u8 {
    const response = struct {
        jsonrpc: []const u8 = "2.0",
        id: ?[]const u8,
        @"error": struct {
            code: i32,
            message: []const u8,
        },
    }{
        .id = id,
        .@"error" = .{
            .code = code,
            .message = message,
        },
    };

    return util.stringifyCompactAlloc(allocator, response);
}

fn readMessage(io: std.Io, allocator: std.mem.Allocator, stream: std.Io.net.Stream) ![]u8 {
    var buffer: [1024]u8 = undefined;
    var reader = stream.reader(io, &buffer);
    const request_json = reader.interface.takeDelimiterExclusive('\n') catch |err| switch (err) {
        error.ReadFailed => return reader.err.?,
        else => return err,
    };
    return try allocator.dupe(u8, request_json);
}

fn getOptionalString(object: std.json.ObjectMap, key: []const u8) !?[]const u8 {
    const value = object.get(key) orelse return null;
    return switch (value) {
        .string => |text| text,
        .null => null,
        else => error.InvalidBridgeResponse,
    };
}
