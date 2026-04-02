const std = @import("std");
const types = @import("types.zig");
const util = @import("util.zig");

const c = @cImport({
    @cInclude("sqlite3.h");
});

pub const StoreError = error{
    DatabaseOpenFailed,
    DatabaseExecFailed,
    DatabasePrepareFailed,
    DatabaseBindFailed,
    DatabaseStepFailed,
};

pub const Store = struct {
    db: *c.sqlite3,
    allocator: std.mem.Allocator,

    pub fn init(io: std.Io, allocator: std.mem.Allocator, path: []const u8) !Store {
        try util.ensureParentDir(io, path);

        const path_z = try allocator.dupeZ(u8, path);
        defer allocator.free(path_z);

        var db_ptr: ?*c.sqlite3 = null;
        const flags = c.SQLITE_OPEN_READWRITE | c.SQLITE_OPEN_CREATE;
        if (c.sqlite3_open_v2(path_z.ptr, &db_ptr, flags, null) != c.SQLITE_OK) {
            if (db_ptr) |handle| _ = c.sqlite3_close(handle);
            return error.DatabaseOpenFailed;
        }

        var store = Store{
            .db = db_ptr.?,
            .allocator = allocator,
        };
        try store.bootstrap();
        return store;
    }

    pub fn deinit(self: *Store) void {
        _ = c.sqlite3_close(self.db);
        self.* = undefined;
    }

    pub fn ensureSession(self: *Store, session_id: []const u8) StoreError!void {
        const now = util.timestamp();
        var statement = try Statement.prepare(self, "INSERT OR IGNORE INTO sessions (id, created_at) VALUES (?, ?);");
        defer statement.deinit();
        try statement.bindText(1, session_id);
        try statement.bindInt(2, now);
        try statement.stepDone();
    }

    pub fn recordCommand(
        self: *Store,
        session_id: []const u8,
        prompt: []const u8,
        action_kind: []const u8,
        plan_json: []const u8,
        result_json: []const u8,
    ) StoreError!void {
        const now = util.timestamp();
        var statement = try Statement.prepare(
            self,
            "INSERT INTO command_history (session_id, prompt, action_kind, plan_json, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?);",
        );
        defer statement.deinit();
        try statement.bindText(1, session_id);
        try statement.bindText(2, prompt);
        try statement.bindText(3, action_kind);
        try statement.bindText(4, plan_json);
        try statement.bindText(5, result_json);
        try statement.bindInt(6, now);
        try statement.stepDone();
    }

    pub fn upsertActiveDocument(
        self: *Store,
        session_id: []const u8,
        document: types.ActiveDocument,
    ) StoreError!void {
        const now = util.timestamp();
        var statement = try Statement.prepare(
            self,
            \\INSERT INTO active_documents (session_id, document_id, unit_system, model_tolerance_mm, headless, document_path, created_at, updated_at)
            \\VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            \\ON CONFLICT(session_id)
            \\DO UPDATE SET document_id = excluded.document_id, unit_system = excluded.unit_system, model_tolerance_mm = excluded.model_tolerance_mm, headless = excluded.headless, document_path = excluded.document_path, updated_at = excluded.updated_at;
        );
        defer statement.deinit();
        try statement.bindText(1, session_id);
        try statement.bindText(2, document.document_id);
        try statement.bindText(3, document.unit_system);
        try statement.bindFloat(4, document.model_tolerance_mm);
        try statement.bindInt(5, if (document.headless) 1 else 0);
        try statement.bindOptionalText(6, document.document_path);
        try statement.bindInt(7, now);
        try statement.bindInt(8, now);
        try statement.stepDone();
    }

    pub fn loadActiveDocument(
        self: *Store,
        allocator: std.mem.Allocator,
        session_id: []const u8,
    ) (StoreError || std.mem.Allocator.Error)!?types.ActiveDocument {
        var statement = try Statement.prepare(
            self,
            "SELECT document_id, unit_system, model_tolerance_mm, headless, document_path FROM active_documents WHERE session_id = ? LIMIT 1;",
        );
        defer statement.deinit();
        try statement.bindText(1, session_id);

        const rc = c.sqlite3_step(statement.stmt);
        if (rc == c.SQLITE_ROW) {
            return .{
                .document_id = try statement.columnTextDup(allocator, 0),
                .unit_system = try statement.columnTextDup(allocator, 1),
                .model_tolerance_mm = statement.columnFloat(2),
                .headless = statement.columnInt(3) != 0,
                .document_path = try statement.columnOptionalTextDup(allocator, 4),
            };
        }
        if (rc == c.SQLITE_DONE) return null;
        return error.DatabaseStepFailed;
    }

    pub fn clearActiveDocument(self: *Store, session_id: []const u8) StoreError!void {
        var statement = try Statement.prepare(
            self,
            "DELETE FROM active_documents WHERE session_id = ?;",
        );
        defer statement.deinit();
        try statement.bindText(1, session_id);
        try statement.stepDone();
    }

    pub fn clearObjects(self: *Store, session_id: []const u8) StoreError!void {
        var mapping_statement = try Statement.prepare(
            self,
            "DELETE FROM object_documents WHERE session_id = ?;",
        );
        defer mapping_statement.deinit();
        try mapping_statement.bindText(1, session_id);
        try mapping_statement.stepDone();

        var object_statement = try Statement.prepare(
            self,
            "DELETE FROM objects WHERE session_id = ?;",
        );
        defer object_statement.deinit();
        try object_statement.bindText(1, session_id);
        try object_statement.stepDone();
    }

    pub fn upsertObject(
        self: *Store,
        session_id: []const u8,
        alias: []const u8,
        host: []const u8,
        document_id: []const u8,
        host_id: []const u8,
        kind: []const u8,
    ) StoreError!void {
        const now = util.timestamp();
        var statement = try Statement.prepare(
            self,
            \\INSERT INTO objects (session_id, alias, host, host_id, kind, created_at, updated_at)
            \\VALUES (?, ?, ?, ?, ?, ?, ?)
            \\ON CONFLICT(session_id, alias)
            \\DO UPDATE SET host = excluded.host, host_id = excluded.host_id, kind = excluded.kind, updated_at = excluded.updated_at;
        );
        defer statement.deinit();
        try statement.bindText(1, session_id);
        try statement.bindText(2, alias);
        try statement.bindText(3, host);
        try statement.bindText(4, host_id);
        try statement.bindText(5, kind);
        try statement.bindInt(6, now);
        try statement.bindInt(7, now);
        try statement.stepDone();

        var mapping_statement = try Statement.prepare(
            self,
            \\INSERT INTO object_documents (session_id, alias, document_id, updated_at)
            \\VALUES (?, ?, ?, ?)
            \\ON CONFLICT(session_id, alias)
            \\DO UPDATE SET document_id = excluded.document_id, updated_at = excluded.updated_at;
        );
        defer mapping_statement.deinit();
        try mapping_statement.bindText(1, session_id);
        try mapping_statement.bindText(2, alias);
        try mapping_statement.bindText(3, document_id);
        try mapping_statement.bindInt(4, now);
        try mapping_statement.stepDone();
    }

    pub fn lookupObject(
        self: *Store,
        allocator: std.mem.Allocator,
        session_id: []const u8,
        alias: []const u8,
    ) (StoreError || std.mem.Allocator.Error)!?types.SessionObject {
        var statement = try Statement.prepare(
            self,
            \\SELECT o.alias, o.host, od.document_id, o.host_id, o.kind
            \\FROM objects o
            \\JOIN object_documents od ON od.session_id = o.session_id AND od.alias = o.alias
            \\WHERE o.session_id = ? AND o.alias = ? LIMIT 1;
        );
        defer statement.deinit();
        try statement.bindText(1, session_id);
        try statement.bindText(2, alias);

        const rc = c.sqlite3_step(statement.stmt);
        if (rc == c.SQLITE_ROW) {
            return .{
                .alias = try statement.columnTextDup(allocator, 0),
                .host = try statement.columnTextDup(allocator, 1),
                .document_id = try statement.columnTextDup(allocator, 2),
                .host_id = try statement.columnTextDup(allocator, 3),
                .kind = try statement.columnTextDup(allocator, 4),
            };
        }
        if (rc == c.SQLITE_DONE) return null;
        return error.DatabaseStepFailed;
    }

    pub fn loadSessionSummary(
        self: *Store,
        allocator: std.mem.Allocator,
        session_id: []const u8,
    ) (StoreError || std.mem.Allocator.Error)!types.SessionSummary {
        const command_count = try self.commandCount(session_id);
        const active_document = try self.loadActiveDocument(allocator, session_id);

        var statement = try Statement.prepare(
            self,
            \\SELECT o.alias, o.host, od.document_id, o.host_id, o.kind
            \\FROM objects o
            \\JOIN object_documents od ON od.session_id = o.session_id AND od.alias = o.alias
            \\WHERE o.session_id = ?
            \\ORDER BY o.alias ASC;
        );
        defer statement.deinit();
        try statement.bindText(1, session_id);

        var objects: std.ArrayList(types.SessionObject) = .empty;
        defer objects.deinit(allocator);

        while (true) {
            const rc = c.sqlite3_step(statement.stmt);
            if (rc == c.SQLITE_DONE) break;
            if (rc != c.SQLITE_ROW) return error.DatabaseStepFailed;

            try objects.append(allocator, .{
                .alias = try statement.columnTextDup(allocator, 0),
                .host = try statement.columnTextDup(allocator, 1),
                .document_id = try statement.columnTextDup(allocator, 2),
                .host_id = try statement.columnTextDup(allocator, 3),
                .kind = try statement.columnTextDup(allocator, 4),
            });
        }

        return .{
            .command_count = command_count,
            .active_document = active_document,
            .objects = try objects.toOwnedSlice(allocator),
        };
    }

    fn commandCount(self: *Store, session_id: []const u8) StoreError!usize {
        var statement = try Statement.prepare(
            self,
            "SELECT COUNT(*) FROM command_history WHERE session_id = ?;",
        );
        defer statement.deinit();
        try statement.bindText(1, session_id);

        const rc = c.sqlite3_step(statement.stmt);
        if (rc != c.SQLITE_ROW) return error.DatabaseStepFailed;
        return @intCast(c.sqlite3_column_int64(statement.stmt, 0));
    }

    fn bootstrap(self: *Store) !void {
        try self.exec(
            \\CREATE TABLE IF NOT EXISTS sessions (
            \\  id TEXT PRIMARY KEY,
            \\  created_at INTEGER NOT NULL
            \\);
            \\
            \\CREATE TABLE IF NOT EXISTS objects (
            \\  session_id TEXT NOT NULL,
            \\  alias TEXT NOT NULL,
            \\  host TEXT NOT NULL,
            \\  host_id TEXT NOT NULL,
            \\  kind TEXT NOT NULL,
            \\  created_at INTEGER NOT NULL,
            \\  updated_at INTEGER NOT NULL,
            \\  PRIMARY KEY (session_id, alias)
            \\);
            \\
            \\CREATE TABLE IF NOT EXISTS active_documents (
            \\  session_id TEXT PRIMARY KEY,
            \\  document_id TEXT NOT NULL,
            \\  unit_system TEXT NOT NULL,
            \\  model_tolerance_mm REAL NOT NULL,
            \\  headless INTEGER NOT NULL,
            \\  document_path TEXT,
            \\  created_at INTEGER NOT NULL,
            \\  updated_at INTEGER NOT NULL
            \\);
            \\
            \\CREATE TABLE IF NOT EXISTS object_documents (
            \\  session_id TEXT NOT NULL,
            \\  alias TEXT NOT NULL,
            \\  document_id TEXT NOT NULL,
            \\  updated_at INTEGER NOT NULL,
            \\  PRIMARY KEY (session_id, alias)
            \\);
            \\
            \\CREATE TABLE IF NOT EXISTS command_history (
            \\  id INTEGER PRIMARY KEY AUTOINCREMENT,
            \\  session_id TEXT NOT NULL,
            \\  prompt TEXT NOT NULL,
            \\  action_kind TEXT NOT NULL,
            \\  plan_json TEXT NOT NULL,
            \\  result_json TEXT NOT NULL,
            \\  created_at INTEGER NOT NULL
            \\);
        );
    }

    fn exec(self: *Store, sql: []const u8) !void {
        const sql_z = try self.allocator.dupeZ(u8, sql);
        defer self.allocator.free(sql_z);

        const rc = c.sqlite3_exec(self.db, sql_z.ptr, null, null, null);
        if (rc != c.SQLITE_OK) {
            return error.DatabaseExecFailed;
        }
    }
};

const Statement = struct {
    store: *Store,
    stmt: *c.sqlite3_stmt,

    fn prepare(store: *Store, sql: []const u8) StoreError!Statement {
        var stmt_ptr: ?*c.sqlite3_stmt = null;
        if (c.sqlite3_prepare_v2(store.db, sql.ptr, @intCast(sql.len), &stmt_ptr, null) != c.SQLITE_OK) {
            return error.DatabasePrepareFailed;
        }
        return .{
            .store = store,
            .stmt = stmt_ptr.?,
        };
    }

    fn deinit(self: *Statement) void {
        _ = c.sqlite3_finalize(self.stmt);
    }

    fn bindText(self: *Statement, index: c_int, text: []const u8) StoreError!void {
        if (c.sqlite3_bind_text(self.stmt, index, text.ptr, @intCast(text.len), null) != c.SQLITE_OK) {
            return error.DatabaseBindFailed;
        }
    }

    fn bindInt(self: *Statement, index: c_int, value: i64) StoreError!void {
        if (c.sqlite3_bind_int64(self.stmt, index, value) != c.SQLITE_OK) {
            return error.DatabaseBindFailed;
        }
    }

    fn bindFloat(self: *Statement, index: c_int, value: f64) StoreError!void {
        if (c.sqlite3_bind_double(self.stmt, index, value) != c.SQLITE_OK) {
            return error.DatabaseBindFailed;
        }
    }

    fn bindOptionalText(self: *Statement, index: c_int, text: ?[]const u8) StoreError!void {
        if (text) |value| return self.bindText(index, value);
        if (c.sqlite3_bind_null(self.stmt, index) != c.SQLITE_OK) {
            return error.DatabaseBindFailed;
        }
    }

    fn stepDone(self: *Statement) StoreError!void {
        const rc = c.sqlite3_step(self.stmt);
        if (rc != c.SQLITE_DONE) return error.DatabaseStepFailed;
    }

    fn columnTextDup(self: *Statement, allocator: std.mem.Allocator, index: c_int) std.mem.Allocator.Error![]const u8 {
        const text_ptr = c.sqlite3_column_text(self.stmt, index);
        if (text_ptr == null) return allocator.dupe(u8, "");
        const text: [*:0]const u8 = @ptrCast(text_ptr);
        return allocator.dupe(u8, std.mem.span(text));
    }

    fn columnOptionalTextDup(self: *Statement, allocator: std.mem.Allocator, index: c_int) std.mem.Allocator.Error!?[]const u8 {
        if (c.sqlite3_column_type(self.stmt, index) == c.SQLITE_NULL) return null;
        return try self.columnTextDup(allocator, index);
    }

    fn columnFloat(self: *Statement, index: c_int) f64 {
        return c.sqlite3_column_double(self.stmt, index);
    }

    fn columnInt(self: *Statement, index: c_int) i64 {
        return c.sqlite3_column_int64(self.stmt, index);
    }
};

test "active document and object mappings roundtrip" {
    const allocator = std.testing.allocator;
    var tmp = std.testing.tmpDir(.{});
    defer tmp.cleanup();

    const db_path = try std.fs.path.join(allocator, &.{ ".zig-cache", "tmp", tmp.sub_path[0..], "store.db" });
    defer allocator.free(db_path);

    var store = try Store.init(std.testing.io, allocator, db_path);
    defer store.deinit();

    try store.ensureSession("demo");

    var document = types.ActiveDocument{
        .document_id = try allocator.dupe(u8, "rhino-doc-1"),
        .unit_system = try allocator.dupe(u8, "Millimeters"),
        .model_tolerance_mm = 0.01,
        .headless = true,
        .document_path = null,
    };
    defer document.deinit(allocator);

    try store.upsertActiveDocument("demo", document);
    try store.upsertObject("demo", "staircase", "rhino", "rhino-doc-1", "rhino-staircase-1", "create_spiral_staircase");

    const loaded_document = try store.loadActiveDocument(allocator, "demo") orelse return error.TestUnexpectedResult;
    defer loaded_document.deinit(allocator);
    try std.testing.expectEqualStrings("rhino-doc-1", loaded_document.document_id);
    try std.testing.expectEqualStrings("Millimeters", loaded_document.unit_system);
    try std.testing.expectEqual(@as(f64, 0.01), loaded_document.model_tolerance_mm);
    try std.testing.expect(loaded_document.headless);

    const loaded_object = try store.lookupObject(allocator, "demo", "staircase") orelse return error.TestUnexpectedResult;
    defer {
        allocator.free(loaded_object.alias);
        allocator.free(loaded_object.host);
        allocator.free(loaded_object.document_id);
        allocator.free(loaded_object.host_id);
        allocator.free(loaded_object.kind);
    }
    try std.testing.expectEqualStrings("rhino-doc-1", loaded_object.document_id);
    try std.testing.expectEqualStrings("rhino-staircase-1", loaded_object.host_id);

    try store.clearObjects("demo");
    const missing_object = try store.lookupObject(allocator, "demo", "staircase");
    try std.testing.expect(missing_object == null);
}
