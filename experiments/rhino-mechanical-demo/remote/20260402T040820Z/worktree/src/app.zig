const std = @import("std");
const bridge = @import("bridge.zig");
const config_mod = @import("config.zig");
const document_session = @import("document_session.zig");
const mock_bridge = @import("mock_bridge.zig");
const planner = @import("planner.zig");
const rhino_live_demo = @import("rhino_live_demo.zig");
const store_mod = @import("store.zig");
const types = @import("types.zig");
const util = @import("util.zig");

pub fn main(init: std.process.Init) !void {
    run(init) catch |err| {
        try printError(err);
        std.process.exit(1);
    };
}

fn run(init: std.process.Init) !void {
    const gpa = init.gpa;

    var args_iter = std.process.Args.Iterator.init(init.minimal.args);
    var args: std.ArrayList([]const u8) = .empty;
    defer args.deinit(gpa);
    while (args_iter.next()) |arg| {
        try args.append(gpa, arg);
    }

    if (args.items.len < 2) {
        try printUsage();
        return;
    }

    if (std.mem.eql(u8, args.items[1], "plan")) {
        try handlePlan(gpa, args.items[2..]);
        return;
    }

    if (std.mem.eql(u8, args.items[1], "run")) {
        try handleRun(init.io, gpa, args.items[2..]);
        return;
    }

    if (std.mem.eql(u8, args.items[1], "session")) {
        try handleSession(init.io, gpa, args.items[2..]);
        return;
    }

    if (std.mem.eql(u8, args.items[1], "document")) {
        try handleDocument(init.io, gpa, args.items[2..]);
        return;
    }

    if (std.mem.eql(u8, args.items[1], "config")) {
        try handleConfig(init.io, gpa, args.items[2..]);
        return;
    }

    if (std.mem.eql(u8, args.items[1], "runtime")) {
        try handleRuntime(init.io, gpa, args.items[2..]);
        return;
    }

    if (std.mem.eql(u8, args.items[1], "bridge")) {
        try handleBridge(init.io, gpa, args.items[2..]);
        return;
    }

    try printUsage();
}

fn handlePlan(gpa: std.mem.Allocator, args: []const []const u8) !void {
    const prompt = try requiredValue(args, "--prompt");
    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();
    const allocator = arena.allocator();

    const plan = try planner.planPrompt(allocator, prompt);
    const plan_json = try util.stringifyAlloc(allocator, plan);
    try util.printLine(plan_json);
}

fn handleRun(io: std.Io, gpa: std.mem.Allocator, args: []const []const u8) !void {
    const prompt = try requiredValue(args, "--prompt");
    var config = try config_mod.loadEffective(io, gpa, try config_mod.CliOverrides.fromArgs(args));
    defer config.deinit(gpa);

    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();
    const allocator = arena.allocator();

    var store = try store_mod.Store.init(io, gpa, config.db_path);
    defer store.deinit();
    try store.ensureSession(config.session_id);

    var plan = try planner.planPrompt(allocator, prompt);
    if (config.bridge.profile == .rhino_inside) {
        try handleLiveRhinoRun(io, allocator, &store, config.session_id, prompt, plan);
        return;
    }

    var resolved_object: ?types.SessionObject = null;
    if (plan.kind == .move_object) {
        const alias = plan.alias orelse return error.AliasNotFound;
        resolved_object = try store.lookupObject(allocator, config.session_id, alias);
        if (resolved_object == null) return error.AliasNotFound;
    }

    _ = try bridge.describeRuntime(io, allocator, config.bridge);
    const preferred_document_id = if (resolved_object) |object| object.document_id else null;
    const active_document = try document_session.ensureActive(
        io,
        allocator,
        &store,
        config.session_id,
        config.bridge,
        preferred_document_id,
        plan.kind != .move_object,
    );

    if (resolved_object) |object| {
        if (!std.mem.eql(u8, object.document_id, active_document.document_id)) return error.AliasDocumentMismatch;
        plan.host_id = object.host_id;
    }
    plan.document_id = active_document.document_id;

    const response_json = try bridge.dispatch(io, allocator, config.bridge, plan);
    const parsed = try bridge.parseSuccessResponse(allocator, response_json);

    if (plan.kind == .create_cube or plan.kind == .create_sphere or plan.kind == .create_cylinder or plan.kind == .create_organic_blob or plan.kind == .create_scientific_shell or plan.kind == .create_mpc_live_ii_button_cap or plan.kind == .create_mpc_live_ii_panel_demo or plan.kind == .create_spiral_staircase) {
        if (plan.alias) |alias| {
            if (parsed.host_id) |host_id| {
                try store.upsertObject(config.session_id, alias, plan.host, active_document.document_id, host_id, plan.actionName());
            }
        }
    }

    const plan_json = try util.stringifyAlloc(allocator, plan);
    try store.recordCommand(config.session_id, prompt, plan.actionName(), plan_json, response_json);
    try util.printLine(response_json);
}

fn handleLiveRhinoRun(
    io: std.Io,
    allocator: std.mem.Allocator,
    store: *store_mod.Store,
    session_id: []const u8,
    prompt: []const u8,
    plan: types.PlanAction,
) !void {
    const existing_document = try store.loadActiveDocument(allocator, session_id);
    defer if (existing_document) |document| document.deinit(allocator);

    var live = try rhino_live_demo.runCreate(io, allocator, session_id, existing_document, plan);
    defer live.deinit(allocator);

    try store.upsertActiveDocument(session_id, live.document);
    if (plan.alias) |alias| {
        if (live.host_id) |host_id| {
            try store.upsertObject(session_id, alias, plan.host, live.document.document_id, host_id, plan.actionName());
        }
    }

    const plan_json = try util.stringifyAlloc(allocator, plan);
    try store.recordCommand(session_id, prompt, plan.actionName(), plan_json, live.response_json);
    try util.printLine(live.response_json);
}

fn handleSession(io: std.Io, gpa: std.mem.Allocator, args: []const []const u8) !void {
    if (args.len == 0 or !std.mem.eql(u8, args[0], "show")) return error.InvalidArguments;

    var config = try config_mod.loadEffective(io, gpa, try config_mod.CliOverrides.fromArgs(args[1..]));
    defer config.deinit(gpa);

    var store = try store_mod.Store.init(io, gpa, config.db_path);
    defer store.deinit();

    const summary = try store.loadSessionSummary(gpa, config.session_id);
    defer summary.deinit(gpa);

    std.debug.print("Session: {s}\n", .{config.session_id});
    std.debug.print("Commands: {d}\n", .{summary.command_count});
    if (summary.active_document) |document| {
        std.debug.print(
            "Document: {s} [{s}, tolerance={d:.3}mm, headless={s}]\n",
            .{
                document.document_id,
                document.unit_system,
                document.model_tolerance_mm,
                if (document.headless) "true" else "false",
            },
        );
    } else {
        std.debug.print("Document: none\n", .{});
    }
    if (summary.objects.len == 0) {
        std.debug.print("Objects: none\n", .{});
        return;
    }

    std.debug.print("Objects:\n", .{});
    for (summary.objects) |object| {
        std.debug.print("- {s} -> {s} ({s}, doc={s})\n", .{ object.alias, object.host_id, object.kind, object.document_id });
    }
}

fn handleDocument(io: std.Io, gpa: std.mem.Allocator, args: []const []const u8) !void {
    if (args.len == 0 or !std.mem.eql(u8, args[0], "close")) return error.InvalidArguments;

    var config = try config_mod.loadEffective(io, gpa, try config_mod.CliOverrides.fromArgs(args[1..]));
    defer config.deinit(gpa);

    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();
    const allocator = arena.allocator();

    var store = try store_mod.Store.init(io, gpa, config.db_path);
    defer store.deinit();

    _ = try bridge.describeRuntime(io, allocator, config.bridge);
    try document_session.closeActive(io, allocator, &store, config.session_id, config.bridge);
    std.debug.print("Closed active document for session {s}\n", .{config.session_id});
}

fn handleBridge(io: std.Io, gpa: std.mem.Allocator, args: []const []const u8) !void {
    if (args.len == 0) return error.InvalidArguments;

    if (std.mem.eql(u8, args[0], "mock-rhino")) {
        var config = try config_mod.loadEffective(io, gpa, try config_mod.CliOverrides.fromArgs(args[1..]));
        defer config.deinit(gpa);
        try mock_bridge.serve(io, gpa, config.bridge.endpoint.path);
        return;
    }

    if (std.mem.eql(u8, args[0], "status")) {
        try handleBridgeStatus(io, gpa, args[1..]);
        return;
    }

    return error.InvalidArguments;
}

fn handleConfig(io: std.Io, gpa: std.mem.Allocator, args: []const []const u8) !void {
    if (args.len == 0 or !std.mem.eql(u8, args[0], "show")) return error.InvalidArguments;

    var config = try config_mod.loadEffective(io, gpa, try config_mod.CliOverrides.fromArgs(args[1..]));
    defer config.deinit(gpa);

    if (hasFlag(args[1..], "--json")) {
        const payload = try util.stringifyAlloc(gpa, config.jsonView());
        defer gpa.free(payload);
        try util.printLine(payload);
        return;
    }

    std.debug.print("Session: {s} ({s})\n", .{ config.session_id, config.sources.session_id.label() });
    std.debug.print("DB Path: {s} ({s})\n", .{ config.db_path, config.sources.db_path.label() });
    std.debug.print("Bridge Profile: {s} ({s})\n", .{ config.bridge.profile.label(), config.sources.bridge_profile.label() });
    std.debug.print("Transport: {s}\n", .{config.bridge.endpoint.transport.label()});
    std.debug.print("Endpoint: {s} ({s})\n", .{ config.bridge.endpoint.path, config.sources.socket_path.label() });
    std.debug.print("Env File: {s} ({s})\n", .{ config.env_file_path, if (config.env_file_loaded) "loaded" else "missing" });
}

fn handleRuntime(io: std.Io, gpa: std.mem.Allocator, args: []const []const u8) !void {
    try handleConfig(io, gpa, args);
}

fn handleBridgeStatus(io: std.Io, gpa: std.mem.Allocator, args: []const []const u8) !void {
    var config = try config_mod.loadEffective(io, gpa, try config_mod.CliOverrides.fromArgs(args));
    defer config.deinit(gpa);

    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();
    const allocator = arena.allocator();

    try bridge.ping(io, allocator, config.bridge);
    const runtime = try bridge.describeRuntime(io, allocator, config.bridge);

    if (hasFlag(args, "--json")) {
        const payload = try util.stringifyAlloc(allocator, struct {
            bridge_profile: []const u8,
            transport: []const u8,
            endpoint: []const u8,
            runtime: bridge.RuntimeDescription,
        }{
            .bridge_profile = config.bridge.profile.label(),
            .transport = config.bridge.endpoint.transport.label(),
            .endpoint = config.bridge.endpoint.path,
            .runtime = runtime,
        });
        try util.printLine(payload);
        return;
    }

    std.debug.print("Bridge Profile: {s}\n", .{config.bridge.profile.label()});
    std.debug.print("Runtime Kind: {s}\n", .{runtime.bridge_kind});
    std.debug.print("Runtime Version: {s}\n", .{runtime.runtime_version});
    std.debug.print("Transport: {s}\n", .{runtime.transport});
    std.debug.print("Endpoint: {s}\n", .{runtime.endpoint});
    std.debug.print("License Status: {s}\n", .{runtime.license_status});
    std.debug.print("Supported Methods:\n", .{});
    for (runtime.supported_methods) |method_name| {
        std.debug.print("- {s}\n", .{method_name});
    }
}

fn requiredValue(args: []const []const u8, flag: []const u8) ![]const u8 {
    return try optionalValue(args, flag) orelse error.InvalidArguments;
}

fn optionalValue(args: []const []const u8, flag: []const u8) !?[]const u8 {
    for (args, 0..) |arg, index| {
        if (std.mem.eql(u8, arg, flag)) {
            if (index + 1 < args.len) return args[index + 1];
            return error.InvalidArguments;
        }
    }
    return null;
}

fn hasFlag(args: []const []const u8, flag: []const u8) bool {
    for (args) |arg| {
        if (std.mem.eql(u8, arg, flag)) return true;
    }
    return false;
}

fn printUsage() !void {
    try util.printLine(
        \\Usage:
        \\  rhino-nlcli plan --prompt "spiral staircase, 10 steps, 3m tall"
        \\  rhino-nlcli run --prompt "create cube size 2m named block-a" [--session demo] [--profile mock-rhino] [--socket var/rhino.sock] [--db-path var/rhino-nlcli.db] [--env-file .env.local]
        \\  rhino-nlcli run --prompt "create sphere radius 1m named ball-a" [--session demo]
        \\  rhino-nlcli run --prompt "create cylinder radius 500mm height 2m named column-a" [--session demo]
        \\  rhino-nlcli run --prompt "move block-a 500mm left" [--session demo]
        \\  rhino-nlcli session show [--session default] [--db-path var/rhino-nlcli.db]
        \\  rhino-nlcli document close [--session default]
        \\  rhino-nlcli config show [--json]
        \\  rhino-nlcli runtime show [--json]
        \\  rhino-nlcli bridge status [--json] [--profile mock-rhino] [--socket var/rhino.sock]
        \\  rhino-nlcli bridge mock-rhino [--socket var/rhino.sock]
    );
}

fn printError(err: anyerror) !void {
    switch (err) {
        error.InvalidArguments => try printUsage(),
        error.UnsupportedPrompt => try util.printLine(planner.supportedPromptHelp()),
        error.InvalidMeasurement => try util.printLine("Invalid measurement. Use metric values like 500mm, 20cm, or 2m."),
        error.InvalidStepCount => try util.printLine("Invalid step count. Example: `spiral staircase, 10 steps, 3m tall`."),
        error.MissingHeight => try util.printLine("Missing staircase height. Example: `spiral staircase, 10 steps, 3m tall`."),
        error.MissingDirection => try util.printLine("Missing move direction. Use left, right, up, down, forward, or back."),
        error.AliasNotFound => try util.printLine("Object alias not found in the active session."),
        error.AliasDocumentMismatch => try util.printLine("Stored alias belongs to a different Rhino document than the active session document."),
        error.InvalidBridgeResponse => try util.printLine("Bridge returned an invalid JSON-RPC response."),
        error.NoActiveDocument => try util.printLine("No active Rhino document exists for this session."),
        error.ActiveDocumentUnavailable => try util.printLine("The active Rhino document is no longer available on the bridge."),
        error.RemoteExecutionFailed => try util.printLine("Bridge reported execution failure."),
        error.RhinoLiveDemoUnsupportedAction => try util.printLine("The live Rhino demo currently supports cube, sphere, cylinder, organic blob, scientific shell, MPC Live II button-cap, and MPC Live II panel demo creation."),
        error.RhinoInstanceConflict => try util.printLine("Live Rhino execution refused to continue because existing Rhino instances are ambiguous for this session."),
        error.RhinoLaunchFailed => try util.printLine("Failed to launch Rhino for the live demo command."),
        error.RhinoResultTimeout => try util.printLine("Rhino did not produce a result file before the live demo timeout."),
        error.RhinoUnavailable => try util.printLine("Rhino 8 or the RhinoCode CLI is not available on this machine."),
        error.UnknownBridgeProfile => try util.printLine("Unknown bridge profile. Use `mock-rhino` or `rhino-inside`."),
        error.EmptyConfigValue => {
            const line = config_mod.lastEnvLine();
            if (line > 0) {
                std.debug.print("Empty runtime config value in env file at line {d}.\n", .{line});
            } else {
                try util.printLine("Empty runtime config values are not allowed.");
            }
        },
        error.InvalidEnvFileLine => {
            const line = config_mod.lastEnvLine();
            if (line > 0) {
                std.debug.print("Invalid env file line {d}. Use KEY=VALUE.\n", .{line});
            } else {
                try util.printLine("Invalid env file format. Use KEY=VALUE.");
            }
        },
        error.EnvFileNotFound => try util.printLine("Configured env file not found."),
        error.FileNotFound, error.ConnectionRefused => try util.printLine("Bridge socket unavailable at the configured endpoint."),
        else => std.debug.print("error: {s}\n", .{@errorName(err)}),
    }
}
