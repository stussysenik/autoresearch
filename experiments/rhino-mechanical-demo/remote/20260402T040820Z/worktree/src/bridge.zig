const std = @import("std");
const config = @import("config.zig");
const types = @import("types.zig");
const util = @import("util.zig");

pub const DispatchError = anyerror;

pub const ParsedResult = struct {
    host_id: ?[]const u8 = null,
};

pub const RuntimeDescription = struct {
    bridge_kind: []const u8,
    runtime_version: []const u8,
    transport: []const u8,
    endpoint: []const u8,
    license_status: []const u8,
    supported_methods: []const []const u8,

    pub fn deinit(self: RuntimeDescription, allocator: std.mem.Allocator) void {
        allocator.free(self.bridge_kind);
        allocator.free(self.runtime_version);
        allocator.free(self.transport);
        allocator.free(self.endpoint);
        allocator.free(self.license_status);
        for (self.supported_methods) |method_name| allocator.free(method_name);
        allocator.free(self.supported_methods);
    }
};

const BridgeParams = struct {
    document_id: ?[]const u8 = null,
    alias: ?[]const u8 = null,
    host_id: ?[]const u8 = null,
    size_mm: ?f64 = null,
    radius_mm: ?f64 = null,
    height_mm: ?f64 = null,
    step_count: ?u32 = null,
    distance_mm: ?f64 = null,
    direction: ?types.Direction = null,
};

const Request = struct {
    jsonrpc: []const u8 = "2.0",
    id: []const u8,
    method: []const u8,
    params: BridgeParams,
};

pub fn dispatch(
    io: std.Io,
    allocator: std.mem.Allocator,
    target: config.BridgeTarget,
    action: types.PlanAction,
) DispatchError![]u8 {
    const request_id = try std.fmt.allocPrint(allocator, "{s}-{d}", .{ action.actionName(), util.nextId() });
    defer allocator.free(request_id);
    const request_payload = Request{
        .id = request_id,
        .method = action.method,
        .params = .{
            .document_id = action.document_id,
            .alias = action.alias,
            .host_id = action.host_id,
            .size_mm = action.size_mm,
            .radius_mm = action.radius_mm,
            .height_mm = action.height_mm,
            .step_count = action.step_count,
            .distance_mm = action.distance_mm,
            .direction = action.direction,
        },
    };

    const request_json = try util.stringifyCompactAlloc(allocator, request_payload);
    defer allocator.free(request_json);
    return sendRequest(io, allocator, target.endpoint, request_json);
}

pub fn openHeadlessDocument(
    io: std.Io,
    allocator: std.mem.Allocator,
    target: config.BridgeTarget,
) DispatchError!types.ActiveDocument {
    const request_id = try std.fmt.allocPrint(allocator, "open-document-{d}", .{util.nextId()});
    defer allocator.free(request_id);
    const request = struct {
        jsonrpc: []const u8 = "2.0",
        id: []const u8,
        method: []const u8 = "rhino.document.open_headless",
        params: struct {} = .{},
    }{
        .id = request_id,
    };
    const request_json = try util.stringifyCompactAlloc(allocator, request);
    defer allocator.free(request_json);
    const response_json = try sendRequest(io, allocator, target.endpoint, request_json);
    defer allocator.free(response_json);
    return try parseDocumentDescription(allocator, response_json);
}

pub fn describeDocument(
    io: std.Io,
    allocator: std.mem.Allocator,
    target: config.BridgeTarget,
    document_id: []const u8,
) DispatchError!types.ActiveDocument {
    const request_id = try std.fmt.allocPrint(allocator, "describe-document-{d}", .{util.nextId()});
    defer allocator.free(request_id);
    const request = struct {
        jsonrpc: []const u8 = "2.0",
        id: []const u8,
        method: []const u8 = "rhino.document.describe",
        params: struct {
            document_id: []const u8,
        },
    }{
        .id = request_id,
        .params = .{
            .document_id = document_id,
        },
    };
    const request_json = try util.stringifyCompactAlloc(allocator, request);
    defer allocator.free(request_json);
    const response_json = try sendRequest(io, allocator, target.endpoint, request_json);
    defer allocator.free(response_json);
    return try parseDocumentDescription(allocator, response_json);
}

pub fn closeDocument(
    io: std.Io,
    allocator: std.mem.Allocator,
    target: config.BridgeTarget,
    document_id: []const u8,
) DispatchError!void {
    const request_id = try std.fmt.allocPrint(allocator, "close-document-{d}", .{util.nextId()});
    defer allocator.free(request_id);
    const request = struct {
        jsonrpc: []const u8 = "2.0",
        id: []const u8,
        method: []const u8 = "rhino.document.close",
        params: struct {
            document_id: []const u8,
        },
    }{
        .id = request_id,
        .params = .{
            .document_id = document_id,
        },
    };
    const request_json = try util.stringifyCompactAlloc(allocator, request);
    defer allocator.free(request_json);
    const response_json = try sendRequest(io, allocator, target.endpoint, request_json);
    defer allocator.free(response_json);
    try ensureSuccessResponse(allocator, response_json);
}

pub fn ping(io: std.Io, allocator: std.mem.Allocator, target: config.BridgeTarget) DispatchError!void {
    const request_id = try std.fmt.allocPrint(allocator, "ping-{d}", .{util.nextId()});
    defer allocator.free(request_id);
    const request = struct {
        jsonrpc: []const u8 = "2.0",
        id: []const u8,
        method: []const u8 = "rhino.system.ping",
        params: struct {} = .{},
    }{
        .id = request_id,
    };
    const request_json = try util.stringifyCompactAlloc(allocator, request);
    defer allocator.free(request_json);
    const response_json = try sendRequest(io, allocator, target.endpoint, request_json);
    defer allocator.free(response_json);
    try ensureSuccessResponse(allocator, response_json);
}

pub fn describeRuntime(
    io: std.Io,
    allocator: std.mem.Allocator,
    target: config.BridgeTarget,
) DispatchError!RuntimeDescription {
    const request_id = try std.fmt.allocPrint(allocator, "describe-runtime-{d}", .{util.nextId()});
    defer allocator.free(request_id);
    const request = struct {
        jsonrpc: []const u8 = "2.0",
        id: []const u8,
        method: []const u8 = "rhino.system.describe_runtime",
        params: struct {} = .{},
    }{
        .id = request_id,
    };
    const request_json = try util.stringifyCompactAlloc(allocator, request);
    defer allocator.free(request_json);
    const response_json = try sendRequest(io, allocator, target.endpoint, request_json);
    defer allocator.free(response_json);
    return try parseRuntimeDescription(allocator, response_json);
}

pub fn parseSuccessResponse(allocator: std.mem.Allocator, response_json: []const u8) DispatchError!ParsedResult {
    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, response_json, .{});
    defer parsed.deinit();

    const result_object = try successResultObject(parsed.value);

    const objects_value = result_object.get("objects") orelse return .{};
    const objects_array = switch (objects_value) {
        .array => |array| array,
        else => return error.InvalidBridgeResponse,
    };
    if (objects_array.items.len == 0) return .{};

    const first_object = switch (objects_array.items[0]) {
        .object => |obj| obj,
        else => return error.InvalidBridgeResponse,
    };
    const host_id_value = first_object.get("host_id") orelse return .{};
    const host_id = switch (host_id_value) {
        .string => |value| value,
        else => return error.InvalidBridgeResponse,
    };

    return .{
        .host_id = try allocator.dupe(u8, host_id),
    };
}

pub fn parseRuntimeDescription(allocator: std.mem.Allocator, response_json: []const u8) DispatchError!RuntimeDescription {
    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, response_json, .{});
    defer parsed.deinit();

    const result_object = try successResultObject(parsed.value);
    const runtime_value = result_object.get("runtime") orelse return error.InvalidBridgeResponse;
    const runtime_object = switch (runtime_value) {
        .object => |obj| obj,
        else => return error.InvalidBridgeResponse,
    };

    const supported_methods_value = runtime_object.get("supported_methods") orelse return error.InvalidBridgeResponse;
    const supported_methods_array = switch (supported_methods_value) {
        .array => |array| array,
        else => return error.InvalidBridgeResponse,
    };

    var supported_methods: std.ArrayList([]const u8) = .empty;
    errdefer {
        for (supported_methods.items) |method_name| allocator.free(method_name);
        supported_methods.deinit(allocator);
    }

    for (supported_methods_array.items) |item| {
        const method_name = switch (item) {
            .string => |value| value,
            else => return error.InvalidBridgeResponse,
        };
        try supported_methods.append(allocator, try allocator.dupe(u8, method_name));
    }

    return .{
        .bridge_kind = try allocator.dupe(u8, try requiredString(runtime_object, "bridge_kind")),
        .runtime_version = try allocator.dupe(u8, try requiredString(runtime_object, "runtime_version")),
        .transport = try allocator.dupe(u8, try requiredString(runtime_object, "transport")),
        .endpoint = try allocator.dupe(u8, try requiredString(runtime_object, "endpoint")),
        .license_status = try allocator.dupe(u8, try requiredString(runtime_object, "license_status")),
        .supported_methods = try supported_methods.toOwnedSlice(allocator),
    };
}

pub fn parseDocumentDescription(allocator: std.mem.Allocator, response_json: []const u8) DispatchError!types.ActiveDocument {
    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, response_json, .{});
    defer parsed.deinit();

    const result_object = try successResultObject(parsed.value);
    const document_value = result_object.get("document") orelse return error.InvalidBridgeResponse;
    const document_object = switch (document_value) {
        .object => |obj| obj,
        else => return error.InvalidBridgeResponse,
    };

    return .{
        .document_id = try allocator.dupe(u8, try requiredString(document_object, "document_id")),
        .unit_system = try allocator.dupe(u8, try requiredString(document_object, "unit_system")),
        .model_tolerance_mm = try requiredFloat(document_object, "model_tolerance_mm"),
        .headless = try requiredBool(document_object, "headless"),
        .document_path = try optionalStringDup(allocator, document_object, "document_path"),
    };
}

fn sendRequest(
    io: std.Io,
    allocator: std.mem.Allocator,
    endpoint: config.BridgeEndpoint,
    request_json: []const u8,
) DispatchError![]u8 {
    switch (endpoint.transport) {
        .unix => {
            const address = try std.Io.net.UnixAddress.init(endpoint.path);
            var stream = try address.connect(io);
            defer stream.close(io);

            var write_buffer: [512]u8 = undefined;
            var writer = stream.writer(io, &write_buffer);
            writer.interface.writeAll(request_json) catch return writer.err.?;
            writer.interface.writeAll("\n") catch return writer.err.?;
            writer.interface.flush() catch return writer.err.?;

            var read_buffer: [2048]u8 = undefined;
            var reader = stream.reader(io, &read_buffer);
            const response_json = reader.interface.takeDelimiterExclusive('\n') catch |err| switch (err) {
                error.ReadFailed => return reader.err.?,
                else => return err,
            };
            return try allocator.dupe(u8, response_json);
        },
    }
}

fn ensureSuccessResponse(allocator: std.mem.Allocator, response_json: []const u8) DispatchError!void {
    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, response_json, .{});
    defer parsed.deinit();
    _ = try successResultObject(parsed.value);
}

fn successResultObject(root_value: std.json.Value) DispatchError!std.json.ObjectMap {
    const root_object = switch (root_value) {
        .object => |obj| obj,
        else => return error.InvalidBridgeResponse,
    };

    if (root_object.get("error") != null) return error.RemoteExecutionFailed;
    const result_value = root_object.get("result") orelse return error.InvalidBridgeResponse;
    return switch (result_value) {
        .object => |obj| obj,
        else => return error.InvalidBridgeResponse,
    };
}

fn requiredString(object: std.json.ObjectMap, key: []const u8) DispatchError![]const u8 {
    const value = object.get(key) orelse return error.InvalidBridgeResponse;
    return switch (value) {
        .string => |text| text,
        else => return error.InvalidBridgeResponse,
    };
}

fn requiredFloat(object: std.json.ObjectMap, key: []const u8) DispatchError!f64 {
    const value = object.get(key) orelse return error.InvalidBridgeResponse;
    return switch (value) {
        .float => |number| number,
        .integer => |number| @floatFromInt(number),
        else => return error.InvalidBridgeResponse,
    };
}

fn requiredBool(object: std.json.ObjectMap, key: []const u8) DispatchError!bool {
    const value = object.get(key) orelse return error.InvalidBridgeResponse;
    return switch (value) {
        .bool => |flag| flag,
        else => return error.InvalidBridgeResponse,
    };
}

fn optionalStringDup(allocator: std.mem.Allocator, object: std.json.ObjectMap, key: []const u8) DispatchError!?[]const u8 {
    const value = object.get(key) orelse return null;
    return switch (value) {
        .string => |text| try allocator.dupe(u8, text),
        .null => null,
        else => return error.InvalidBridgeResponse,
    };
}

test "parse runtime description succeeds" {
    const allocator = std.testing.allocator;
    const response =
        \\{"jsonrpc":"2.0","id":"describe-runtime-1","result":{"status":"ok","summary":"ready","runtime":{"bridge_kind":"mock-rhino","runtime_version":"mock-1","transport":"unix","endpoint":"var/rhino.sock","license_status":"not_applicable","supported_methods":["rhino.system.ping","rhino.system.describe_runtime","rhino.geometry.create_cube"]}}}
    ;

    const runtime = try parseRuntimeDescription(allocator, response);
    defer runtime.deinit(allocator);

    try std.testing.expectEqualStrings("mock-rhino", runtime.bridge_kind);
    try std.testing.expectEqualStrings("mock-1", runtime.runtime_version);
    try std.testing.expectEqualStrings("unix", runtime.transport);
    try std.testing.expectEqualStrings("var/rhino.sock", runtime.endpoint);
    try std.testing.expectEqualStrings("not_applicable", runtime.license_status);
    try std.testing.expectEqual(@as(usize, 3), runtime.supported_methods.len);
}

test "parse document description succeeds" {
    const allocator = std.testing.allocator;
    const response =
        \\{"jsonrpc":"2.0","id":"open-document-1","result":{"status":"ok","summary":"opened","document":{"document_id":"rhino-doc-1","unit_system":"Millimeters","model_tolerance_mm":0.01,"headless":true,"document_path":null}}}
    ;

    const document = try parseDocumentDescription(allocator, response);
    defer document.deinit(allocator);

    try std.testing.expectEqualStrings("rhino-doc-1", document.document_id);
    try std.testing.expectEqualStrings("Millimeters", document.unit_system);
    try std.testing.expectEqual(@as(f64, 0.01), document.model_tolerance_mm);
    try std.testing.expect(document.headless);
    try std.testing.expect(document.document_path == null);
}
