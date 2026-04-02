const std = @import("std");

pub const ConfigError = error{
    EmptyConfigValue,
    EnvFileNotFound,
    InvalidEnvFileLine,
    UnknownBridgeProfile,
};

pub const ValueSource = enum {
    default,
    dotenv,
    env,
    cli,

    pub fn label(self: ValueSource) []const u8 {
        return @tagName(self);
    }
};

pub const BridgeProfile = enum {
    mock_rhino,
    rhino_inside,

    pub fn label(self: BridgeProfile) []const u8 {
        return switch (self) {
            .mock_rhino => "mock-rhino",
            .rhino_inside => "rhino-inside",
        };
    }

    pub fn parse(text: []const u8) ConfigError!BridgeProfile {
        if (std.mem.eql(u8, text, "mock-rhino") or std.mem.eql(u8, text, "mock_rhino")) return .mock_rhino;
        if (std.mem.eql(u8, text, "rhino-inside") or std.mem.eql(u8, text, "rhino_inside")) return .rhino_inside;
        return error.UnknownBridgeProfile;
    }
};

pub const EndpointTransport = enum {
    unix,

    pub fn label(self: EndpointTransport) []const u8 {
        return switch (self) {
            .unix => "unix",
        };
    }
};

pub const BridgeEndpoint = struct {
    transport: EndpointTransport = .unix,
    path: []const u8,
};

pub const BridgeTarget = struct {
    profile: BridgeProfile,
    endpoint: BridgeEndpoint,
};

pub const SourceMap = struct {
    session_id: ValueSource = .default,
    db_path: ValueSource = .default,
    bridge_profile: ValueSource = .default,
    socket_path: ValueSource = .default,
};

pub const EffectiveConfig = struct {
    session_id: []const u8,
    db_path: []const u8,
    bridge: BridgeTarget,
    env_file_path: []const u8,
    env_file_loaded: bool,
    sources: SourceMap,

    pub fn deinit(self: *EffectiveConfig, allocator: std.mem.Allocator) void {
        allocator.free(self.session_id);
        allocator.free(self.db_path);
        allocator.free(self.bridge.endpoint.path);
        allocator.free(self.env_file_path);
        self.* = undefined;
    }

    pub const JsonView = struct {
        session_id: []const u8,
        db_path: []const u8,
        bridge: struct {
            profile: []const u8,
            transport: []const u8,
            endpoint: []const u8,
        },
        env_file: struct {
            path: []const u8,
            loaded: bool,
        },
        sources: struct {
            session_id: []const u8,
            db_path: []const u8,
            bridge_profile: []const u8,
            socket_path: []const u8,
        },
    };

    pub fn jsonView(self: EffectiveConfig) JsonView {
        return .{
            .session_id = self.session_id,
            .db_path = self.db_path,
            .bridge = .{
                .profile = self.bridge.profile.label(),
                .transport = self.bridge.endpoint.transport.label(),
                .endpoint = self.bridge.endpoint.path,
            },
            .env_file = .{
                .path = self.env_file_path,
                .loaded = self.env_file_loaded,
            },
            .sources = .{
                .session_id = self.sources.session_id.label(),
                .db_path = self.sources.db_path.label(),
                .bridge_profile = self.sources.bridge_profile.label(),
                .socket_path = self.sources.socket_path.label(),
            },
        };
    }
};

pub const CliOverrides = struct {
    session_id: ?[]const u8 = null,
    db_path: ?[]const u8 = null,
    bridge_profile: ?[]const u8 = null,
    socket_path: ?[]const u8 = null,
    env_file: ?[]const u8 = null,

    pub fn fromArgs(args: []const []const u8) !CliOverrides {
        return .{
            .session_id = try flagValue(args, "--session"),
            .db_path = try flagValue(args, "--db-path"),
            .bridge_profile = try flagValue(args, "--profile"),
            .socket_path = try flagValue(args, "--socket"),
            .env_file = try flagValue(args, "--env-file"),
        };
    }
};

const DefaultPaths = struct {
    const env_file = ".env.local";
    const db = "var/rhino-nlcli.db";
    const socket = "var/rhino.sock";
    const session = "default";
};

const EnvKey = enum {
    session,
    db_path,
    bridge_profile,
    socket_path,
};

const ProcessPair = struct {
    key: EnvKey,
    value: []const u8,
};

const diagnostics = struct {
    var env_line: usize = 0;
};

pub fn lastEnvLine() usize {
    return diagnostics.env_line;
}

pub fn loadEffective(io: std.Io, allocator: std.mem.Allocator, overrides: CliOverrides) !EffectiveConfig {
    diagnostics.env_line = 0;

    const env_file_path = overrides.env_file orelse DefaultPaths.env_file;
    const env_file_required = overrides.env_file != null;

    var dotenv_text: ?[]u8 = null;
    defer if (dotenv_text) |bytes| allocator.free(bytes);

    var env_loaded = false;
    dotenv_text = std.Io.Dir.cwd().readFileAlloc(io, env_file_path, allocator, .limited(64 * 1024)) catch |err| switch (err) {
        error.FileNotFound => blk: {
            if (env_file_required) return error.EnvFileNotFound;
            break :blk null;
        },
        else => return err,
    };
    env_loaded = dotenv_text != null;

    var process_pairs: std.ArrayList(ProcessPair) = .empty;
    defer {
        for (process_pairs.items) |pair| allocator.free(pair.value);
        process_pairs.deinit(allocator);
    }
    try appendProcessValue(allocator, &process_pairs, .session, "RHINO_NLCLI_SESSION");
    try appendProcessValue(allocator, &process_pairs, .db_path, "RHINO_NLCLI_DB_PATH");
    try appendProcessValue(allocator, &process_pairs, .bridge_profile, "RHINO_NLCLI_BRIDGE_PROFILE");
    try appendProcessValue(allocator, &process_pairs, .socket_path, "RHINO_NLCLI_SOCKET_PATH");

    return resolveEffective(
        allocator,
        env_file_path,
        env_loaded,
        dotenv_text,
        process_pairs.items,
        overrides,
    );
}

fn resolveEffective(
    allocator: std.mem.Allocator,
    env_file_path: []const u8,
    env_file_loaded: bool,
    dotenv_text: ?[]const u8,
    process_pairs: []const ProcessPair,
    overrides: CliOverrides,
) !EffectiveConfig {
    var effective = try initDefaults(allocator, env_file_path);
    errdefer effective.deinit(allocator);
    effective.env_file_loaded = env_file_loaded;

    if (dotenv_text) |text| {
        try applyDotenvText(allocator, &effective, env_file_path, text);
    }

    for (process_pairs) |pair| {
        switch (pair.key) {
            .session => try applySessionValue(allocator, &effective, pair.value, .env),
            .db_path => try applyDbPathValue(allocator, &effective, pair.value, .env, null),
            .bridge_profile => try applyBridgeProfileValue(allocator, &effective, pair.value, .env),
            .socket_path => try applySocketPathValue(allocator, &effective, pair.value, .env, null),
        }
    }

    if (overrides.session_id) |value| try applySessionValue(allocator, &effective, value, .cli);
    if (overrides.db_path) |value| try applyDbPathValue(allocator, &effective, value, .cli, null);
    if (overrides.bridge_profile) |value| try applyBridgeProfileValue(allocator, &effective, value, .cli);
    if (overrides.socket_path) |value| try applySocketPathValue(allocator, &effective, value, .cli, null);

    return effective;
}

fn initDefaults(allocator: std.mem.Allocator, env_file_path: []const u8) !EffectiveConfig {
    return .{
        .session_id = try allocator.dupe(u8, DefaultPaths.session),
        .db_path = try allocator.dupe(u8, DefaultPaths.db),
        .bridge = .{
            .profile = .mock_rhino,
            .endpoint = .{
                .path = try allocator.dupe(u8, DefaultPaths.socket),
            },
        },
        .env_file_path = try allocator.dupe(u8, env_file_path),
        .env_file_loaded = false,
        .sources = .{},
    };
}

fn applyDotenvText(
    allocator: std.mem.Allocator,
    effective: *EffectiveConfig,
    env_file_path: []const u8,
    text: []const u8,
) !void {
    const base_dir = std.fs.path.dirname(env_file_path);

    var line_number: usize = 0;
    var lines = std.mem.splitScalar(u8, text, '\n');
    while (lines.next()) |raw_line| {
        line_number += 1;

        const without_cr = stripTrailingCarriageReturn(raw_line);
        const line = std.mem.trim(u8, without_cr, " \t");
        if (line.len == 0 or line[0] == '#') continue;

        const separator = std.mem.indexOfScalar(u8, line, '=') orelse {
            diagnostics.env_line = line_number;
            return error.InvalidEnvFileLine;
        };

        const key = std.mem.trim(u8, line[0..separator], " \t");
        if (key.len == 0) {
            diagnostics.env_line = line_number;
            return error.InvalidEnvFileLine;
        }

        const raw_value = std.mem.trim(u8, line[separator + 1 ..], " \t");
        const value = stripOptionalQuotes(raw_value);

        if (std.mem.eql(u8, key, "RHINO_NLCLI_SESSION")) {
            if (value.len == 0) {
                diagnostics.env_line = line_number;
                return error.EmptyConfigValue;
            }
            try applySessionValue(allocator, effective, value, .dotenv);
            continue;
        }

        if (std.mem.eql(u8, key, "RHINO_NLCLI_DB_PATH")) {
            if (value.len == 0) {
                diagnostics.env_line = line_number;
                return error.EmptyConfigValue;
            }
            try applyDbPathValue(allocator, effective, value, .dotenv, base_dir);
            continue;
        }

        if (std.mem.eql(u8, key, "RHINO_NLCLI_BRIDGE_PROFILE")) {
            if (value.len == 0) {
                diagnostics.env_line = line_number;
                return error.EmptyConfigValue;
            }
            try applyBridgeProfileValue(allocator, effective, value, .dotenv);
            continue;
        }

        if (std.mem.eql(u8, key, "RHINO_NLCLI_SOCKET_PATH")) {
            if (value.len == 0) {
                diagnostics.env_line = line_number;
                return error.EmptyConfigValue;
            }
            try applySocketPathValue(allocator, effective, value, .dotenv, base_dir);
            continue;
        }
    }
}

fn applySessionValue(
    allocator: std.mem.Allocator,
    effective: *EffectiveConfig,
    value: []const u8,
    source: ValueSource,
) !void {
    if (value.len == 0) return error.EmptyConfigValue;
    try replaceField(allocator, &effective.session_id, value);
    effective.sources.session_id = source;
}

fn applyDbPathValue(
    allocator: std.mem.Allocator,
    effective: *EffectiveConfig,
    value: []const u8,
    source: ValueSource,
    base_dir: ?[]const u8,
) !void {
    if (value.len == 0) return error.EmptyConfigValue;
    const resolved = try resolvePathValue(allocator, value, base_dir);
    replaceOwnedField(allocator, &effective.db_path, resolved);
    effective.sources.db_path = source;
}

fn applyBridgeProfileValue(
    allocator: std.mem.Allocator,
    effective: *EffectiveConfig,
    value: []const u8,
    source: ValueSource,
) !void {
    if (value.len == 0) return error.EmptyConfigValue;
    effective.bridge.profile = try BridgeProfile.parse(value);
    _ = allocator;
    effective.sources.bridge_profile = source;
}

fn applySocketPathValue(
    allocator: std.mem.Allocator,
    effective: *EffectiveConfig,
    value: []const u8,
    source: ValueSource,
    base_dir: ?[]const u8,
) !void {
    if (value.len == 0) return error.EmptyConfigValue;
    const resolved = try resolvePathValue(allocator, value, base_dir);
    replaceOwnedField(allocator, &effective.bridge.endpoint.path, resolved);
    effective.sources.socket_path = source;
}

fn appendProcessValue(
    allocator: std.mem.Allocator,
    items: *std.ArrayList(ProcessPair),
    key: EnvKey,
    env_name: []const u8,
) !void {
    const value = try getenvOwned(allocator, env_name);
    if (value) |text| {
        errdefer allocator.free(text);
        try items.append(allocator, .{
            .key = key,
            .value = text,
        });
    }
}

fn getenvOwned(allocator: std.mem.Allocator, env_name: []const u8) !?[]u8 {
    const env_name_z = try allocator.dupeZ(u8, env_name);
    defer allocator.free(env_name_z);

    const value_ptr = std.c.getenv(env_name_z.ptr) orelse return null;
    return try allocator.dupe(u8, std.mem.span(value_ptr));
}

fn replaceField(allocator: std.mem.Allocator, field: *[]const u8, value: []const u8) !void {
    const copy = try allocator.dupe(u8, value);
    allocator.free(field.*);
    field.* = copy;
}

fn replaceOwnedField(allocator: std.mem.Allocator, field: *[]const u8, value: []const u8) void {
    allocator.free(field.*);
    field.* = value;
}

fn resolvePathValue(allocator: std.mem.Allocator, value: []const u8, base_dir: ?[]const u8) ![]const u8 {
    if (std.fs.path.isAbsolute(value)) return try allocator.dupe(u8, value);

    if (base_dir) |dir_path| {
        if (dir_path.len > 0 and !std.mem.eql(u8, dir_path, ".")) {
            return try std.fs.path.join(allocator, &.{ dir_path, value });
        }
    }

    return try allocator.dupe(u8, value);
}

fn stripTrailingCarriageReturn(line: []const u8) []const u8 {
    if (line.len > 0 and line[line.len - 1] == '\r') return line[0 .. line.len - 1];
    return line;
}

fn stripOptionalQuotes(value: []const u8) []const u8 {
    if (value.len < 2) return value;
    const first = value[0];
    const last = value[value.len - 1];
    if ((first == '"' and last == '"') or (first == '\'' and last == '\'')) {
        return value[1 .. value.len - 1];
    }
    return value;
}

fn flagValue(args: []const []const u8, flag: []const u8) !?[]const u8 {
    for (args, 0..) |arg, index| {
        if (std.mem.eql(u8, arg, flag)) {
            if (index + 1 < args.len) return args[index + 1];
            return error.InvalidArguments;
        }
    }
    return null;
}

test "config precedence prefers cli over env and dotenv" {
    const allocator = std.testing.allocator;

    const dotenv_text =
        \\RHINO_NLCLI_SESSION=from-dotenv
        \\RHINO_NLCLI_DB_PATH=var/from-dotenv.db
        \\RHINO_NLCLI_BRIDGE_PROFILE=rhino-inside
        \\RHINO_NLCLI_SOCKET_PATH=var/from-dotenv.sock
    ;
    const env_pairs = [_]ProcessPair{
        .{ .key = .session, .value = "from-env" },
        .{ .key = .db_path, .value = "var/from-env.db" },
        .{ .key = .bridge_profile, .value = "mock-rhino" },
        .{ .key = .socket_path, .value = "var/from-env.sock" },
    };
    const overrides = CliOverrides{
        .session_id = "from-cli",
        .db_path = "var/from-cli.db",
        .bridge_profile = "rhino-inside",
        .socket_path = "var/from-cli.sock",
    };

    var effective = try resolveEffective(
        allocator,
        ".env.local",
        true,
        dotenv_text,
        &env_pairs,
        overrides,
    );
    defer effective.deinit(allocator);

    try std.testing.expectEqualStrings("from-cli", effective.session_id);
    try std.testing.expectEqualStrings("var/from-cli.db", effective.db_path);
    try std.testing.expectEqual(BridgeProfile.rhino_inside, effective.bridge.profile);
    try std.testing.expectEqualStrings("var/from-cli.sock", effective.bridge.endpoint.path);
    try std.testing.expectEqual(ValueSource.cli, effective.sources.session_id);
    try std.testing.expectEqual(ValueSource.cli, effective.sources.db_path);
    try std.testing.expectEqual(ValueSource.cli, effective.sources.bridge_profile);
    try std.testing.expectEqual(ValueSource.cli, effective.sources.socket_path);
}

test "dotenv relative paths resolve from env file directory" {
    const allocator = std.testing.allocator;
    const dotenv_text =
        \\RHINO_NLCLI_DB_PATH=var/dev.db
        \\RHINO_NLCLI_SOCKET_PATH=sockets/rhino.sock
    ;

    var effective = try resolveEffective(
        allocator,
        "config/dev/.env.local",
        true,
        dotenv_text,
        &.{},
        .{},
    );
    defer effective.deinit(allocator);

    try std.testing.expectEqualStrings("config/dev/var/dev.db", effective.db_path);
    try std.testing.expectEqualStrings("config/dev/sockets/rhino.sock", effective.bridge.endpoint.path);
    try std.testing.expectEqual(ValueSource.dotenv, effective.sources.db_path);
    try std.testing.expectEqual(ValueSource.dotenv, effective.sources.socket_path);
}

test "dotenv malformed line records line number" {
    const allocator = std.testing.allocator;
    try std.testing.expectError(
        error.InvalidEnvFileLine,
        resolveEffective(
            allocator,
            ".env.local",
            true,
            "BROKEN_LINE\nRHINO_NLCLI_DB_PATH=var/data.db\n",
            &.{},
            .{},
        ),
    );
    try std.testing.expectEqual(@as(usize, 1), lastEnvLine());
}
