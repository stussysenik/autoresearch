const std = @import("std");
const types = @import("types.zig");
const util = @import("util.zig");

const open_path = "/usr/bin/open";
const rhino_app_path = "/Applications/Rhino 8.app";
const rhinocode_path = "/Applications/Rhino 8.app/Contents/Resources/bin/rhinocode";
const owned_instance_pid_path = "var/real-rhino/owned-instance.pid";
const cap_calibration_relative_path = "research/mpc-live-ii/cap-calibration.json";

pub const LiveResult = struct {
    document: types.ActiveDocument,
    response_json: []u8,
    host_id: ?[]const u8,

    pub fn deinit(self: *LiveResult, allocator: std.mem.Allocator) void {
        self.document.deinit(allocator);
        allocator.free(self.response_json);
        if (self.host_id) |host_id| allocator.free(host_id);
        self.* = undefined;
    }
};

const RhinoInstance = struct {
    process_id: i64,
    pipe_id: []u8,
    active_doc_title: []u8,
    active_doc_location: []u8,

    fn deinit(self: RhinoInstance, allocator: std.mem.Allocator) void {
        allocator.free(self.pipe_id);
        allocator.free(self.active_doc_title);
        allocator.free(self.active_doc_location);
    }
};

const RhinoListEntry = struct {
    processId: i64,
    pipeId: []const u8,
    activeDoc: struct {
        title: []const u8,
        location: []const u8,
    },
};

const ScriptResult = struct {
    status: []const u8,
    object_id: ?[]const u8 = null,
    message: ?[]const u8 = null,
    export_path: ?[]const u8 = null,
};

pub fn runCreate(
    io: std.Io,
    allocator: std.mem.Allocator,
    session_id: []const u8,
    existing_document: ?types.ActiveDocument,
    action: types.PlanAction,
) !LiveResult {
    switch (action.kind) {
        .create_cube, .create_sphere, .create_cylinder, .create_organic_blob, .create_scientific_shell, .create_mpc_live_ii_button_cap, .create_mpc_live_ii_panel_demo => {},
        else => return error.RhinoLiveDemoUnsupportedAction,
    }

    var document = try ensureDocument(allocator, session_id, existing_document);
    errdefer document.deinit(allocator);
    const normalized_document_path = try normalizePath(allocator, document.document_path orelse return error.InvalidBridgeResponse);
    defer allocator.free(normalized_document_path);
    if (!std.mem.eql(u8, normalized_document_path, document.document_path.?)) {
        allocator.free(document.document_path.?);
        document.document_path = try allocator.dupe(u8, normalized_document_path);
    }
    const document_path = document.document_path.?;

    const reuse_existing_instance = try ensureSafeInstanceState(io, allocator, document_path, existing_document != null);

    const request_tag = try std.fmt.allocPrint(allocator, "{d}-{d}", .{ std.c.getpid(), util.nextId() });
    defer allocator.free(request_tag);

    const export_alias = action.alias orelse kindLabel(action.kind);

    const script_path = try absolutePath(allocator, try std.fmt.allocPrint(allocator, "var/real-rhino/scripts/{s}-{s}.py", .{ session_id, request_tag }));
    defer allocator.free(script_path);
    const result_path = try absolutePath(allocator, try std.fmt.allocPrint(allocator, "var/real-rhino/results/{s}-{s}.json", .{ session_id, request_tag }));
    defer allocator.free(result_path);
    const export_path = try absolutePath(allocator, try std.fmt.allocPrint(allocator, "var/real-rhino/exports/{s}-{s}-{s}.stl", .{ session_id, export_alias, request_tag }));
    defer allocator.free(export_path);
    std.Io.Dir.cwd().deleteFile(io, result_path) catch |err| switch (err) {
        error.FileNotFound => {},
        else => return err,
    };

    try writeScript(io, allocator, script_path, result_path, export_path, document_path, action);

    const doc_exists = try pathExists(io, document_path);
    if (!reuse_existing_instance) {
        try launchRhino(io, allocator, document_path, doc_exists);
    }

    var instance = try waitForInstance(io, allocator);
    defer instance.deinit(allocator);
    try recordOwnedInstance(io, allocator, instance.process_id);
    try runScriptInInstance(io, allocator, instance.pipe_id, script_path);

    const script_result_json = try waitForResult(io, allocator, result_path);
    defer allocator.free(script_result_json);

    const parsed = try parseScriptResult(allocator, script_result_json);
    defer {
        allocator.free(parsed.status);
        if (parsed.object_id) |host_id| allocator.free(host_id);
        if (parsed.message) |message| allocator.free(message);
        if (parsed.export_path) |path| allocator.free(path);
    }

    if (!std.mem.eql(u8, parsed.status, "ok")) return error.RemoteExecutionFailed;
    const host_id = if (parsed.object_id) |value| try allocator.dupe(u8, value) else null;

    const objects = [_]types.BridgeObject{
        .{
            .alias = action.alias,
            .host_id = host_id orelse "",
            .kind = kindLabel(action.kind),
        },
    };

    const response = struct {
        jsonrpc: []const u8 = "2.0",
        id: ?[]const u8 = null,
        result: struct {
            status: []const u8 = "ok",
            summary: []const u8,
            export_path: ?[]const u8 = null,
            objects: []const types.BridgeObject,
        },
    }{
        .result = .{
            .summary = parsed.message orelse resultSummary(action.kind),
            .export_path = parsed.export_path,
            .objects = &objects,
        },
    };

    return .{
        .document = document,
        .response_json = try util.stringifyCompactAlloc(allocator, response),
        .host_id = host_id,
    };
}

fn ensureDocument(
    allocator: std.mem.Allocator,
    session_id: []const u8,
    existing_document: ?types.ActiveDocument,
) !types.ActiveDocument {
    if (existing_document) |document| {
        return .{
            .document_id = try allocator.dupe(u8, document.document_id),
            .unit_system = try allocator.dupe(u8, document.unit_system),
            .model_tolerance_mm = document.model_tolerance_mm,
            .headless = false,
            .document_path = if (document.document_path) |path| try allocator.dupe(u8, path) else null,
        };
    }

    return .{
        .document_id = try std.fmt.allocPrint(allocator, "real-rhino-{s}", .{session_id}),
        .unit_system = try allocator.dupe(u8, "Millimeters"),
        .model_tolerance_mm = 0.01,
        .headless = false,
        .document_path = try std.fmt.allocPrint(allocator, "var/real-rhino/docs/{s}.3dm", .{session_id}),
    };
}

fn ensureSafeInstanceState(
    io: std.Io,
    allocator: std.mem.Allocator,
    document_path: []const u8,
    has_existing_document: bool,
) !bool {
    var attempts: usize = 0;
    while (attempts < 8) : (attempts += 1) {
        const instances = try listInstances(io, allocator);
        defer {
            for (instances) |instance| instance.deinit(allocator);
            allocator.free(instances);
        }

        if (instances.len == 0) return false;
        if (instances.len > 1) return error.RhinoInstanceConflict;

        const active_path = instances[0].active_doc_location;
        const owned = try isOwnedDemoInstance(io, allocator, instances[0]);
        if (owned and has_existing_document and (active_path.len == 0 or std.mem.eql(u8, active_path, document_path))) {
            return true;
        }

        if (owned) {
            try terminateInstance(io, allocator, instances[0].process_id);
            try std.Io.sleep(io, std.Io.Duration.fromMilliseconds(500), .awake);
            continue;
        }
        return error.RhinoInstanceConflict;
    }

    return error.RhinoInstanceConflict;
}

fn listInstances(io: std.Io, allocator: std.mem.Allocator) ![]RhinoInstance {
    const run_result = try std.process.run(allocator, io, .{
        .argv = &.{ rhinocode_path, "list", "--json" },
        .stdout_limit = .limited(64 * 1024),
        .stderr_limit = .limited(16 * 1024),
    });
    defer allocator.free(run_result.stdout);
    defer allocator.free(run_result.stderr);

    switch (run_result.term) {
        .exited => |code| if (code != 0) return error.RhinoUnavailable,
        else => return error.RhinoUnavailable,
    }

    const payload = try jsonPayload(run_result.stdout);
    var parsed = try std.json.parseFromSlice([]RhinoListEntry, allocator, payload, .{
        .ignore_unknown_fields = true,
    });
    defer parsed.deinit();

    var instances: std.ArrayList(RhinoInstance) = .empty;
    defer instances.deinit(allocator);

    for (parsed.value) |entry| {
        try instances.append(allocator, .{
            .process_id = entry.processId,
            .pipe_id = try allocator.dupe(u8, entry.pipeId),
            .active_doc_title = try allocator.dupe(u8, entry.activeDoc.title),
            .active_doc_location = try allocator.dupe(u8, entry.activeDoc.location),
        });
    }

    return try instances.toOwnedSlice(allocator);
}

fn launchRhino(
    io: std.Io,
    allocator: std.mem.Allocator,
    document_path: []const u8,
    doc_exists: bool,
) !void {
    var argv: std.ArrayList([]const u8) = .empty;
    defer argv.deinit(allocator);

    try argv.append(allocator, open_path);
    try argv.append(allocator, "-a");
    try argv.append(allocator, rhino_app_path);
    if (doc_exists) {
        try argv.append(allocator, document_path);
    }
    try argv.append(allocator, "--args");
    try argv.append(allocator, "-nosplash");

    const run_result = try std.process.run(allocator, io, .{
        .argv = argv.items,
        .stdout_limit = .limited(8 * 1024),
        .stderr_limit = .limited(8 * 1024),
    });
    defer allocator.free(run_result.stdout);
    defer allocator.free(run_result.stderr);

    switch (run_result.term) {
        .exited => |code| if (code != 0) return error.RhinoLaunchFailed,
        else => return error.RhinoLaunchFailed,
    }
}

fn waitForInstance(io: std.Io, allocator: std.mem.Allocator) !RhinoInstance {
    var attempt: usize = 0;
    while (attempt < 80) : (attempt += 1) {
        const instances = try listInstances(io, allocator);
        defer {
            for (instances) |instance| instance.deinit(allocator);
            allocator.free(instances);
        }

        if (instances.len == 0) {
            try std.Io.sleep(io, std.Io.Duration.fromMilliseconds(250), .awake);
            continue;
        }
        if (instances.len > 1) return error.RhinoInstanceConflict;

        return .{
            .process_id = instances[0].process_id,
            .pipe_id = try allocator.dupe(u8, instances[0].pipe_id),
            .active_doc_title = try allocator.dupe(u8, instances[0].active_doc_title),
            .active_doc_location = try allocator.dupe(u8, instances[0].active_doc_location),
        };
    }

    return error.RhinoUnavailable;
}

fn runScriptInInstance(
    io: std.Io,
    allocator: std.mem.Allocator,
    pipe_id: []const u8,
    script_path: []const u8,
) !void {
    const run_result = try std.process.run(allocator, io, .{
        .argv = &.{ rhinocode_path, "-r", pipe_id, "script", script_path },
        .stdout_limit = .limited(8 * 1024),
        .stderr_limit = .limited(8 * 1024),
    });
    defer allocator.free(run_result.stdout);
    defer allocator.free(run_result.stderr);

    switch (run_result.term) {
        .exited => |code| if (code != 0) return error.RhinoLaunchFailed,
        else => return error.RhinoLaunchFailed,
    }
}

fn waitForResult(io: std.Io, allocator: std.mem.Allocator, result_path: []const u8) ![]u8 {
    var attempt: usize = 0;
    while (attempt < 200) : (attempt += 1) {
        const bytes = std.Io.Dir.cwd().readFileAlloc(io, result_path, allocator, .limited(64 * 1024)) catch |err| switch (err) {
            error.FileNotFound => {
                try std.Io.sleep(io, std.Io.Duration.fromMilliseconds(250), .awake);
                continue;
            },
            else => return err,
        };
        return bytes;
    }
    return error.RhinoResultTimeout;
}

fn writeScript(
    io: std.Io,
    allocator: std.mem.Allocator,
    script_path: []const u8,
    result_path: []const u8,
    export_path: []const u8,
    document_path: []const u8,
    action: types.PlanAction,
) !void {
    try util.ensureParentDir(io, script_path);
    try util.ensureParentDir(io, result_path);
    try util.ensureParentDir(io, export_path);
    try util.ensureParentDir(io, document_path);

    const alias = action.alias orelse "";
    const size_mm = action.size_mm orelse 0;
    const radius_mm = action.radius_mm orelse 0;
    const height_mm = action.height_mm orelse 0;
    const calibration_path = try normalizePath(allocator, cap_calibration_relative_path);
    defer allocator.free(calibration_path);

    const script = try std.fmt.allocPrint(
        allocator,
        \\import json
        \\import math
        \\
        \\import Rhino
        \\import System
        \\import time
        \\import rhinoscriptsyntax as rs
        \\import scriptcontext as sc
        \\
        \\
        \\PAYLOAD = {{
        \\    "kind": "{s}",
        \\    "alias": "{s}",
        \\    "document_path": "{s}",
        \\    "result_path": "{s}",
        \\    "export_path": "{s}",
        \\    "calibration_path": "{s}",
        \\    "size_mm": {d:.3},
        \\    "radius_mm": {d:.3},
        \\    "height_mm": {d:.3},
        \\}}
        \\
        \\
        \\def write_result(status, object_id=None, message=None, export_path=None):
        \\    result_dir = System.IO.Path.GetDirectoryName(PAYLOAD["result_path"])
        \\    if result_dir:
        \\        System.IO.Directory.CreateDirectory(result_dir)
        \\    payload = json.dumps({{"status": status, "object_id": object_id, "message": message, "export_path": export_path}})
        \\    System.IO.File.WriteAllText(PAYLOAD["result_path"], payload)
        \\
        \\
        \\def stage_pause(seconds=0.45):
        \\    sc.doc.Views.Redraw()
        \\    Rhino.RhinoApp.Wait()
        \\    time.sleep(seconds)
        \\    Rhino.RhinoApp.Wait()
        \\
        \\
        \\def apply_alias(object_id):
        \\    if not PAYLOAD["alias"]:
        \\        return
        \\    attributes = Rhino.DocObjects.ObjectAttributes()
        \\    attributes.Name = PAYLOAD["alias"]
        \\    sc.doc.Objects.ModifyAttributes(object_id, attributes, True)
        \\
        \\
        \\def ensure_layer(layer_name, color):
        \\    if rs.IsLayer(layer_name):
        \\        return layer_name
        \\    rs.AddLayer(layer_name, color)
        \\    return layer_name
        \\
        \\
        \\def assign_layer(object_id, layer_name):
        \\    if object_id is None:
        \\        return
        \\    try:
        \\        rs.ObjectLayer(object_id, layer_name)
        \\    except Exception:
        \\        pass
        \\
        \\
        \\def set_named_view(view_name, display_mode=None):
        \\    try:
        \\        current_view = rs.CurrentView(view_name)
        \\    except Exception:
        \\        current_view = rs.CurrentView()
        \\    if display_mode is not None:
        \\        try:
        \\            rs.ViewDisplayMode(current_view, display_mode)
        \\        except Exception:
        \\            pass
        \\    sc.doc.Views.Redraw()
        \\    return current_view
        \\
        \\
        \\def set_rendered_view():
        \\    try:
        \\        active_view = sc.doc.Views.ActiveView
        \\        if active_view is None:
        \\            return
        \\        rendered_mode = Rhino.Display.DisplayModeDescription.FindByName("Rendered")
        \\        if rendered_mode is not None:
        \\            active_view.ActiveViewport.DisplayMode = rendered_mode
        \\            active_view.Redraw()
        \\    except Exception:
        \\        pass
        \\
        \\
        \\def add_text_dot(text, point, layer_name):
        \\    dot = Rhino.Geometry.TextDot(text, point)
        \\    object_id = sc.doc.Objects.AddTextDot(dot)
        \\    assign_layer(object_id, layer_name)
        \\    return object_id
        \\
        \\
        \\def translated_curve(curve, vector):
        \\    duplicate = curve.DuplicateCurve()
        \\    duplicate.Transform(Rhino.Geometry.Transform.Translation(vector))
        \\    return duplicate
        \\
        \\
        \\def rounded_rect_curve(width, depth, radius, z=0.0):
        \\    half_width = width / 2.0
        \\    half_depth = depth / 2.0
        \\    points = [
        \\        Rhino.Geometry.Point3d(-half_width, -half_depth, z),
        \\        Rhino.Geometry.Point3d(half_width, -half_depth, z),
        \\        Rhino.Geometry.Point3d(half_width, half_depth, z),
        \\        Rhino.Geometry.Point3d(-half_width, half_depth, z),
        \\        Rhino.Geometry.Point3d(-half_width, -half_depth, z),
        \\    ]
        \\    polyline = Rhino.Geometry.PolylineCurve(points)
        \\    filleted = Rhino.Geometry.Curve.CreateFilletCornersCurve(
        \\        polyline,
        \\        radius,
        \\        sc.doc.ModelAbsoluteTolerance,
        \\        sc.doc.ModelAngleToleranceRadians,
        \\    )
        \\    if filleted is not None:
        \\        return filleted
        \\    return polyline.ToNurbsCurve()
        \\
        \\
        \\def safe_corner_radius(width, depth, preferred_radius):
        \\    return max(0.4, min(preferred_radius, min(width, depth) * 0.48))
        \\
        \\
        \\def default_cap_calibration():
        \\    cap_width = PAYLOAD["size_mm"] if PAYLOAD["size_mm"] > 0.0 else 18.0
        \\    cap_depth = max(8.6, cap_width * 0.48)
        \\    cap_height = max(3.4, cap_width * 0.19)
        \\    top_width = max(6.0, cap_width * 0.88)
        \\    top_depth = max(4.0, cap_depth * 0.86)
        \\    shoulder_height = max(0.8, cap_height * 0.40)
        \\    return {{
        \\        "cap_width_mm": cap_width,
        \\        "cap_depth_mm": cap_depth,
        \\        "cap_height_mm": cap_height,
        \\        "top_width_mm": top_width,
        \\        "top_depth_mm": top_depth,
        \\        "corner_radius_mm": 1.7,
        \\        "shoulder_height_mm": shoulder_height,
        \\        "button_family": "MPC Live II transport row Play Start button cap",
        \\        "measured_from": "Fallback inferred proportions",
        \\        "provenance_tier": "inferred-fallback",
        \\        "notes": "Fallback used only when cap-calibration.json is unavailable or invalid.",
        \\        "official_sources": [],
        \\    }}
        \\
        \\
        \\def load_cap_calibration():
        \\    calibration = default_cap_calibration()
        \\    calibration_path = PAYLOAD.get("calibration_path")
        \\    required_numeric = [
        \\        "cap_width_mm",
        \\        "cap_depth_mm",
        \\        "cap_height_mm",
        \\        "top_width_mm",
        \\        "top_depth_mm",
        \\        "corner_radius_mm",
        \\        "shoulder_height_mm",
        \\    ]
        \\    required_text = [
        \\        "button_family",
        \\        "measured_from",
        \\        "provenance_tier",
        \\        "notes",
        \\    ]
        \\    if not calibration_path or not System.IO.File.Exists(calibration_path):
        \\        return calibration, False, "missing calibration artifact"
        \\    try:
        \\        with open(calibration_path, "r", encoding="utf-8") as handle:
        \\            payload = json.load(handle)
        \\    except Exception as exc:
        \\        return calibration, False, "failed to load calibration: " + str(exc)
        \\    if not isinstance(payload, dict):
        \\        return calibration, False, "calibration payload must be an object"
        \\    for key in required_numeric:
        \\        value = payload.get(key)
        \\        if not isinstance(value, (int, float)) or value <= 0:
        \\            return calibration, False, "bad numeric field: " + key
        \\        calibration[key] = float(value)
        \\    for key in required_text:
        \\        value = payload.get(key)
        \\        if not isinstance(value, str) or not value.strip():
        \\            return calibration, False, "missing text field: " + key
        \\        calibration[key] = value.strip()
        \\    official_sources = payload.get("official_sources")
        \\    if isinstance(official_sources, list):
        \\        calibration["official_sources"] = [str(value) for value in official_sources if isinstance(value, str) and value.strip()]
        \\    else:
        \\        calibration["official_sources"] = []
        \\    if len(calibration["official_sources"]) == 0:
        \\        return calibration, False, "official_sources missing Akai URLs"
        \\    return calibration, True, ""
        \\
        \\
        \\def export_selected_mesh(mesh_id):
        \\    mesh_object = sc.doc.Objects.Find(mesh_id)
        \\    if mesh_object is None:
        \\        raise Exception("mesh object not found for export")
        \\    export_mesh = mesh_object.Geometry
        \\    if export_mesh is None:
        \\        raise Exception("mesh geometry missing for export")
        \\    export_dir = System.IO.Path.GetDirectoryName(PAYLOAD["export_path"])
        \\    if export_dir:
        \\        System.IO.Directory.CreateDirectory(export_dir)
        \\    export_doc = Rhino.RhinoDoc.CreateHeadless(None)
        \\    try:
        \\        export_doc.ModelUnitSystem = Rhino.UnitSystem.Millimeters
        \\        export_doc.Objects.AddMesh(export_mesh.DuplicateMesh())
        \\        stl_options = Rhino.FileIO.FileStlWriteOptions()
        \\        stl_options.BinaryFile = True
        \\        if not export_doc.Export(PAYLOAD["export_path"], stl_options.ToDictionary()):
        \\            raise Exception("failed to export mesh")
        \\    finally:
        \\        export_doc.Dispose()
        \\
        \\
        \\def build_object():
        \\    if PAYLOAD["kind"] == "create_cube":
        \\        half = PAYLOAD["size_mm"] / 2.0
        \\        box = Rhino.Geometry.Box(
        \\            Rhino.Geometry.Plane.WorldXY,
        \\            Rhino.Geometry.Interval(-half, half),
        \\            Rhino.Geometry.Interval(-half, half),
        \\            Rhino.Geometry.Interval(-half, half),
        \\        )
        \\        return sc.doc.Objects.AddBrep(box.ToBrep())
        \\    if PAYLOAD["kind"] == "create_sphere":
        \\        sphere = Rhino.Geometry.Sphere(Rhino.Geometry.Point3d.Origin, PAYLOAD["radius_mm"])
        \\        return sc.doc.Objects.AddSphere(sphere)
        \\    if PAYLOAD["kind"] == "create_cylinder":
        \\        cylinder = Rhino.Geometry.Cylinder(
        \\            Rhino.Geometry.Circle(Rhino.Geometry.Plane.WorldXY, PAYLOAD["radius_mm"]),
        \\            PAYLOAD["height_mm"],
        \\        )
        \\        return sc.doc.Objects.AddBrep(cylinder.ToBrep(True, True))
        \\    if PAYLOAD["kind"] == "create_organic_blob":
        \\        base = PAYLOAD["size_mm"] / 2.0
        \\        recipe = [
        \\            ((0.00, 0.00, 0.00), 0.62),
        \\            ((0.40, 0.10, 0.12), 0.38),
        \\            ((-0.34, 0.18, -0.06), 0.34),
        \\            ((0.08, -0.34, 0.18), 0.30),
        \\            ((-0.18, -0.24, -0.22), 0.26),
        \\            ((0.18, 0.34, -0.18), 0.24),
        \\        ]
        \\        blob_breps = []
        \\        for center, radius_scale in recipe:
        \\            sphere = Rhino.Geometry.Sphere(
        \\                Rhino.Geometry.Point3d(
        \\                    center[0] * base,
        \\                    center[1] * base,
        \\                    center[2] * base,
        \\                ),
        \\                radius_scale * base,
        \\            )
        \\            blob_breps.append(sphere.ToBrep())
        \\        merged = Rhino.Geometry.Brep.CreateBooleanUnion(blob_breps, sc.doc.ModelAbsoluteTolerance)
        \\        if not merged:
        \\            raise Exception("organic blob union failed")
        \\        return sc.doc.Objects.AddBrep(merged[0])
        \\    if PAYLOAD["kind"] == "create_scientific_shell":
        \\        base = PAYLOAD["size_mm"] / 2.0
        \\        guides_2d = ensure_layer("ScientificDemo::Guides2D", System.Drawing.Color.FromArgb(94, 125, 171))
        \\        sections_2d = ensure_layer("ScientificDemo::Sections2D", System.Drawing.Color.FromArgb(129, 161, 193))
        \\        guides_3d = ensure_layer("ScientificDemo::Guides3D", System.Drawing.Color.FromArgb(143, 188, 187))
        \\        sections_3d = ensure_layer("ScientificDemo::Sections3D", System.Drawing.Color.FromArgb(163, 190, 140))
        \\        form_layer = ensure_layer("ScientificDemo::Form", System.Drawing.Color.FromArgb(208, 135, 112))
        \\        mesh_layer = ensure_layer("ScientificDemo::Mesh", System.Drawing.Color.FromArgb(235, 203, 139))
        \\        set_named_view("Top", "Wireframe")
        \\
        \\        turns = 2.35
        \\        growth = 0.16
        \\        start_radius = base * 0.14
        \\        shell_height = PAYLOAD["size_mm"] * 0.50
        \\        section_count = 7
        \\        spiral_points_2d = []
        \\        for index in range(72):
        \\            ratio = float(index) / 71.0
        \\            angle = ratio * turns * 2.0 * math.pi
        \\            radius = start_radius * math.exp(growth * angle)
        \\            spiral_points_2d.append(
        \\                Rhino.Geometry.Point3d(
        \\                    radius * math.cos(angle),
        \\                    radius * math.sin(angle),
        \\                    0.0,
        \\                )
        \\            )
        \\        guide_curve_2d = Rhino.Geometry.Curve.CreateInterpolatedCurve(spiral_points_2d, 3)
        \\        x_axis_id = sc.doc.Objects.AddLine(Rhino.Geometry.Line(
        \\            Rhino.Geometry.Point3d(-base * 1.1, 0.0, 0.0),
        \\            Rhino.Geometry.Point3d(base * 1.1, 0.0, 0.0),
        \\        ))
        \\        y_axis_id = sc.doc.Objects.AddLine(Rhino.Geometry.Line(
        \\            Rhino.Geometry.Point3d(0.0, -base * 1.1, 0.0),
        \\            Rhino.Geometry.Point3d(0.0, base * 1.1, 0.0),
        \\        ))
        \\        guide_curve_2d_id = sc.doc.Objects.AddCurve(guide_curve_2d)
        \\        for object_id in [x_axis_id, y_axis_id, guide_curve_2d_id]:
        \\            assign_layer(object_id, guides_2d)
        \\        stage_pause(0.55)
        \\
        \\        section_params_2d = guide_curve_2d.DivideByCount(4, True)
        \\        for index, param in enumerate(section_params_2d):
        \\            center = guide_curve_2d.PointAt(param)
        \\            major = base * (0.18 + (0.06 * float(index)))
        \\            minor = major * 0.72
        \\            ellipse = Rhino.Geometry.Ellipse(Rhino.Geometry.Plane(center, Rhino.Geometry.Vector3d.ZAxis), major, minor)
        \\            section_2d_id = sc.doc.Objects.AddCurve(ellipse.ToNurbsCurve())
        \\            assign_layer(section_2d_id, sections_2d)
        \\        stage_pause(0.55)
        \\
        \\        set_named_view("Perspective", "Shaded")
        \\        shell_points_3d = []
        \\        for index in range(section_count):
        \\            ratio = float(index) / float(section_count - 1)
        \\            angle = ratio * turns * 2.0 * math.pi
        \\            radius = start_radius * math.exp(growth * angle)
        \\            shell_points_3d.append(
        \\                Rhino.Geometry.Point3d(
        \\                    radius * math.cos(angle),
        \\                    radius * math.sin(angle),
        \\                    shell_height * (ratio * ratio),
        \\                )
        \\            )
        \\        guide_curve_3d = Rhino.Geometry.Curve.CreateInterpolatedCurve(shell_points_3d, 3)
        \\        guide_curve_3d_id = sc.doc.Objects.AddCurve(guide_curve_3d)
        \\        assign_layer(guide_curve_3d_id, guides_3d)
        \\
        \\        lifted_curves = []
        \\        for index in range(section_count):
        \\            ratio = float(index) / float(section_count - 1)
        \\            parameter = guide_curve_3d.Domain.ParameterAt(ratio)
        \\            ok, frame = guide_curve_3d.PerpendicularFrameAt(parameter)
        \\            if not ok:
        \\                raise Exception("scientific shell frame failed")
        \\            major = PAYLOAD["size_mm"] * (0.05 + (0.12 * ratio))
        \\            minor = major * (0.72 - (0.12 * ratio))
        \\            ellipse = Rhino.Geometry.Ellipse(frame, major, minor)
        \\            ellipse_curve = ellipse.ToNurbsCurve()
        \\            lifted_curves.append(ellipse_curve)
        \\            lifted_id = sc.doc.Objects.AddCurve(ellipse_curve)
        \\            assign_layer(lifted_id, sections_3d)
        \\        stage_pause(0.55)
        \\
        \\        lofts = Rhino.Geometry.Brep.CreateFromLoft(
        \\            lifted_curves,
        \\            Rhino.Geometry.Point3d.Unset,
        \\            Rhino.Geometry.Point3d.Unset,
        \\            Rhino.Geometry.LoftType.Normal,
        \\            False,
        \\        )
        \\        if not lofts or len(lofts) == 0:
        \\            raise Exception("scientific shell loft failed")
        \\        shell_brep = lofts[0].CapPlanarHoles(sc.doc.ModelAbsoluteTolerance)
        \\        if shell_brep is None:
        \\            shell_brep = lofts[0]
        \\        brep_id = sc.doc.Objects.AddBrep(shell_brep)
        \\        if brep_id is None:
        \\            raise Exception("failed to add scientific shell brep")
        \\        assign_layer(brep_id, form_layer)
        \\        stage_pause(0.60)
        \\
        \\        meshes = Rhino.Geometry.Mesh.CreateFromBrep(shell_brep, Rhino.Geometry.MeshingParameters.Smooth)
        \\        if meshes is None or len(meshes) == 0:
        \\            raise Exception("failed to mesh scientific shell")
        \\        shell_mesh = Rhino.Geometry.Mesh()
        \\        for mesh in meshes:
        \\            shell_mesh.Append(mesh)
        \\        shell_mesh.Normals.ComputeNormals()
        \\        shell_mesh.Compact()
        \\        mesh_id = sc.doc.Objects.AddMesh(shell_mesh)
        \\        if mesh_id is None:
        \\            raise Exception("failed to add scientific shell mesh")
        \\        assign_layer(mesh_id, mesh_layer)
        \\        rs.LayerVisible(guides_2d, False)
        \\        rs.LayerVisible(sections_2d, False)
        \\        rs.LayerVisible(guides_3d, False)
        \\        rs.LayerVisible(sections_3d, False)
        \\        rs.LayerVisible(form_layer, False)
        \\        stage_pause(0.65)
        \\        export_selected_mesh(mesh_id)
        \\        return mesh_id
        \\    if PAYLOAD["kind"] == "create_mpc_live_ii_button_cap":
        \\        official_width = 411.5
        \\        official_depth = 243.8
        \\        official_height = 45.7
        \\        calibration, calibrated, calibration_note = load_cap_calibration()
        \\        cap_width = calibration["cap_width_mm"]
        \\        cap_depth = calibration["cap_depth_mm"]
        \\        cap_height = calibration["cap_height_mm"]
        \\        top_width = min(cap_width - 0.6, calibration["top_width_mm"])
        \\        top_depth = min(cap_depth - 0.4, calibration["top_depth_mm"])
        \\        shoulder_height = min(cap_height * 0.82, calibration["shoulder_height_mm"])
        \\        corner_radius = safe_corner_radius(cap_width, cap_depth, calibration["corner_radius_mm"])
        \\        shoulder_width = max(top_width + 0.4, (cap_width + top_width) * 0.5)
        \\        shoulder_depth = max(top_depth + 0.3, (cap_depth + top_depth) * 0.5)
        \\        source_layer = ensure_layer("MPCLiveII::01_Sources", System.Drawing.Color.FromArgb(94, 129, 172))
        \\        envelope_layer = ensure_layer("MPCLiveII::02_Envelope", System.Drawing.Color.FromArgb(136, 192, 208))
        \\        anchors_layer = ensure_layer("MPCLiveII::03_Anchors", System.Drawing.Color.FromArgb(163, 190, 140))
        \\        family_layer = ensure_layer("MPCLiveII::04_ButtonFamily", System.Drawing.Color.FromArgb(180, 142, 173))
        \\        cap2d_layer = ensure_layer("MPCLiveII::05_Cap2D", System.Drawing.Color.FromArgb(235, 203, 139))
        \\        cap3d_layer = ensure_layer("MPCLiveII::06_Cap3D", System.Drawing.Color.FromArgb(208, 135, 112))
        \\        mesh_layer = ensure_layer("MPCLiveII::07_Mesh", System.Drawing.Color.FromArgb(191, 97, 106))
        \\        export_layer = ensure_layer("MPCLiveII::08_Export", System.Drawing.Color.FromArgb(180, 142, 173))
        \\        set_named_view("Top", "Wireframe")
        \\        add_text_dot("Official chassis: 411.5 x 243.8 x 45.7 mm", Rhino.Geometry.Point3d(-official_width * 0.32, official_depth * 0.40, 0.0), source_layer)
        \\        add_text_dot("Official transport labels: Rec / Overdub / Stop / Play / Play Start / Tap", Rhino.Geometry.Point3d(-official_width * 0.18, -official_depth * 0.34, 0.0), source_layer)
        \\        if calibrated:
        \\            add_text_dot("Cap reference: calibrated estimate", Rhino.Geometry.Point3d(official_width * 0.01, -official_depth * 0.42, 0.0), source_layer)
        \\            add_text_dot("Calibration provenance: " + calibration["provenance_tier"], Rhino.Geometry.Point3d(official_width * 0.02, -official_depth * 0.48, 0.0), source_layer)
        \\        else:
        \\            add_text_dot("Cap geometry: inferred fallback", Rhino.Geometry.Point3d(official_width * 0.04, -official_depth * 0.42, 0.0), source_layer)
        \\        stage_pause(0.55)
        \\
        \\        envelope_id = sc.doc.Objects.AddCurve(rounded_rect_curve(official_width, official_depth, 8.0))
        \\        assign_layer(envelope_id, envelope_layer)
        \\        stage_pause(0.55)
        \\
        \\        cluster_origin = Rhino.Geometry.Point3d(official_width * 0.10, -official_depth * 0.22, 0.0)
        \\        target_offset = Rhino.Geometry.Vector3d(cluster_origin.X + 60.0, cluster_origin.Y, 0.0)
        \\        transport_axis_id = sc.doc.Objects.AddLine(Rhino.Geometry.Line(
        \\            Rhino.Geometry.Point3d(cluster_origin.X - 52.0, cluster_origin.Y, 0.0),
        \\            Rhino.Geometry.Point3d(cluster_origin.X + 100.0, cluster_origin.Y, 0.0),
        \\        ))
        \\        anchor_curve = translated_curve(rounded_rect_curve(cap_width, cap_depth, corner_radius), target_offset)
        \\        anchor_id = sc.doc.Objects.AddCurve(anchor_curve)
        \\        assign_layer(transport_axis_id, anchors_layer)
        \\        assign_layer(anchor_id, anchors_layer)
        \\        add_text_dot("Play Start anchor", Rhino.Geometry.Point3d(cluster_origin.X + 60.0, cluster_origin.Y - 14.0, 0.0), anchors_layer)
        \\        stage_pause(0.55)
        \\
        \\        family_curve = translated_curve(rounded_rect_curve(cap_width, cap_depth, corner_radius), target_offset)
        \\        family_id = sc.doc.Objects.AddCurve(family_curve)
        \\        assign_layer(family_id, family_layer)
        \\        stage_pause(0.55)
        \\
        \\        set_named_view("Perspective", "Shaded")
        \\        bottom_curve = translated_curve(rounded_rect_curve(cap_width, cap_depth, corner_radius, 0.0), target_offset)
        \\        shoulder_curve = translated_curve(rounded_rect_curve(shoulder_width, shoulder_depth, max(0.6, corner_radius - 0.2), shoulder_height), target_offset)
        \\        top_curve = translated_curve(rounded_rect_curve(top_width, top_depth, max(0.5, corner_radius - 0.5), cap_height), target_offset)
        \\        for curve in [bottom_curve, shoulder_curve, top_curve]:
        \\            curve_id = sc.doc.Objects.AddCurve(curve)
        \\            assign_layer(curve_id, cap2d_layer)
        \\        stage_pause(0.55)
        \\
        \\        lofts = Rhino.Geometry.Brep.CreateFromLoft(
        \\            [bottom_curve, shoulder_curve, top_curve],
        \\            Rhino.Geometry.Point3d.Unset,
        \\            Rhino.Geometry.Point3d.Unset,
        \\            Rhino.Geometry.LoftType.Normal,
        \\            False,
        \\        )
        \\        if not lofts or len(lofts) == 0:
        \\            raise Exception("mpc live ii button-cap loft failed")
        \\        cap_brep = lofts[0].CapPlanarHoles(sc.doc.ModelAbsoluteTolerance)
        \\        if cap_brep is None:
        \\            cap_brep = lofts[0]
        \\        cap_id = sc.doc.Objects.AddBrep(cap_brep)
        \\        if cap_id is None:
        \\            raise Exception("failed to add mpc live ii button-cap brep")
        \\        assign_layer(cap_id, cap3d_layer)
        \\        stage_pause(0.55)
        \\
        \\        meshes = Rhino.Geometry.Mesh.CreateFromBrep(cap_brep, Rhino.Geometry.MeshingParameters.Smooth)
        \\        if meshes is None or len(meshes) == 0:
        \\            raise Exception("failed to mesh mpc live ii button-cap")
        \\        cap_mesh = Rhino.Geometry.Mesh()
        \\        for mesh in meshes:
        \\            cap_mesh.Append(mesh)
        \\        cap_mesh.Normals.ComputeNormals()
        \\        cap_mesh.Compact()
        \\        mesh_id = sc.doc.Objects.AddMesh(cap_mesh)
        \\        if mesh_id is None:
        \\            raise Exception("failed to add mpc live ii button-cap mesh")
        \\        assign_layer(mesh_id, mesh_layer)
        \\        stage_pause(0.60)
        \\
        \\        export_mesh_id = sc.doc.Objects.AddMesh(cap_mesh.DuplicateMesh())
        \\        if export_mesh_id is None:
        \\            raise Exception("failed to add mpc live ii export mesh")
        \\        assign_layer(export_mesh_id, export_layer)
        \\        rs.LayerVisible(source_layer, False)
        \\        rs.LayerVisible(envelope_layer, False)
        \\        rs.LayerVisible(anchors_layer, False)
        \\        rs.LayerVisible(family_layer, False)
        \\        rs.LayerVisible(cap2d_layer, False)
        \\        rs.LayerVisible(mesh_layer, False)
        \\        stage_pause(0.60)
        \\        export_selected_mesh(export_mesh_id)
        \\        return export_mesh_id
        \\    if PAYLOAD["kind"] == "create_mpc_live_ii_panel_demo":
        \\        official_width = 411.5
        \\        official_depth = 243.8
        \\        official_height = 45.7
        \\        calibration, calibrated, calibration_note = load_cap_calibration()
        \\        button_width = calibration["cap_width_mm"]
        \\        button_depth = calibration["cap_depth_mm"]
        \\        button_height = calibration["cap_height_mm"]
        \\        top_width = min(button_width - 0.6, calibration["top_width_mm"])
        \\        top_depth = min(button_depth - 0.4, calibration["top_depth_mm"])
        \\        shoulder_height = min(button_height * 0.82, calibration["shoulder_height_mm"])
        \\        corner_radius = safe_corner_radius(button_width, button_depth, calibration["corner_radius_mm"])
        \\        shoulder_width = max(top_width + 0.4, (button_width + top_width) * 0.5)
        \\        shoulder_depth = max(top_depth + 0.3, (button_depth + top_depth) * 0.5)
        \\        source_layer = ensure_layer("MPCLiveII::01_Sources", System.Drawing.Color.FromArgb(94, 129, 172))
        \\        envelope_layer = ensure_layer("MPCLiveII::02_Envelope", System.Drawing.Color.FromArgb(136, 192, 208))
        \\        anchors_layer = ensure_layer("MPCLiveII::03_Anchors", System.Drawing.Color.FromArgb(163, 190, 140))
        \\        family_layer = ensure_layer("MPCLiveII::04_ButtonFamily", System.Drawing.Color.FromArgb(180, 142, 173))
        \\        cap2d_layer = ensure_layer("MPCLiveII::05_Cap2D", System.Drawing.Color.FromArgb(235, 203, 139))
        \\        cap3d_layer = ensure_layer("MPCLiveII::06_Cap3D", System.Drawing.Color.FromArgb(208, 135, 112))
        \\        mesh_layer = ensure_layer("MPCLiveII::07_Mesh", System.Drawing.Color.FromArgb(191, 97, 106))
        \\        export_layer = ensure_layer("MPCLiveII::08_Export", System.Drawing.Color.FromArgb(180, 142, 173))
        \\        set_named_view("Top", "Wireframe")
        \\        add_text_dot("Akai official envelope: 411.5 x 243.8 x 45.7 mm", Rhino.Geometry.Point3d(-official_width * 0.35, official_depth * 0.40, 0.0), source_layer)
        \\        add_text_dot("Transport labels from official user guide: Rec / Overdub / Stop / Play / Play Start / Tap", Rhino.Geometry.Point3d(-official_width * 0.22, -official_depth * 0.42, 0.0), source_layer)
        \\        if calibrated:
        \\            add_text_dot("Play Start cap: calibrated estimate", Rhino.Geometry.Point3d(official_width * 0.02, -official_depth * 0.48, 0.0), source_layer)
        \\        else:
        \\            add_text_dot("Play Start cap: inferred fallback", Rhino.Geometry.Point3d(official_width * 0.02, -official_depth * 0.48, 0.0), source_layer)
        \\        stage_pause(0.55)
        \\
        \\        envelope_id = sc.doc.Objects.AddCurve(rounded_rect_curve(official_width, official_depth, 8.0))
        \\        assign_layer(envelope_id, envelope_layer)
        \\        stage_pause(0.55)
        \\
        \\        cluster_origin = Rhino.Geometry.Point3d(official_width * 0.10, -official_depth * 0.22, 0.0)
        \\        anchor_specs = [
        \\            (-44.0, "Rec", 16.0),
        \\            (-20.0, "Overdub", 20.0),
        \\            (8.0, "Stop", 16.0),
        \\            (32.0, "Play", 16.0),
        \\            (60.0, "Play Start", button_width),
        \\            (92.0, "Tap", 16.0),
        \\        ]
        \\        play_start_curve = None
        \\        for x_offset, label, width in anchor_specs:
        \\            center_offset = Rhino.Geometry.Vector3d(cluster_origin.X + x_offset, cluster_origin.Y, 0.0)
        \\            anchor_curve = translated_curve(rounded_rect_curve(width, button_depth, 1.7), center_offset)
        \\            anchor_id = sc.doc.Objects.AddCurve(anchor_curve)
        \\            assign_layer(anchor_id, anchors_layer)
        \\            add_text_dot(label, Rhino.Geometry.Point3d(cluster_origin.X + x_offset, cluster_origin.Y - 14.0, 0.0), anchors_layer)
        \\            if label == "Play Start":
        \\                play_start_curve = anchor_curve
        \\        stage_pause(0.55)
        \\
        \\        if play_start_curve is None:
        \\            raise Exception("missing play start anchor")
        \\        target_id = sc.doc.Objects.AddCurve(play_start_curve)
        \\        assign_layer(target_id, family_layer)
        \\        stage_pause(0.55)
        \\
        \\        set_named_view("Perspective", "Shaded")
        \\        profile_points = [
        \\            Rhino.Geometry.Point3d(cluster_origin.X + 76.0, 0.0, 0.0),
        \\            Rhino.Geometry.Point3d(cluster_origin.X + 78.0, 0.0, shoulder_height),
        \\            Rhino.Geometry.Point3d(cluster_origin.X + 84.0, 0.0, button_height),
        \\            Rhino.Geometry.Point3d(cluster_origin.X + 92.0, 0.0, button_height * 0.92),
        \\            Rhino.Geometry.Point3d(cluster_origin.X + 100.0, 0.0, 0.0),
        \\        ]
        \\        profile_curve = Rhino.Geometry.Curve.CreateInterpolatedCurve(profile_points, 3)
        \\        profile_id = sc.doc.Objects.AddCurve(profile_curve)
        \\        assign_layer(profile_id, cap2d_layer)
        \\        stage_pause(0.55)
        \\
        \\        panel_box = Rhino.Geometry.Box(
        \\            Rhino.Geometry.Plane.WorldXY,
        \\            Rhino.Geometry.Interval(cluster_origin.X - 86.0, cluster_origin.X + 118.0),
        \\            Rhino.Geometry.Interval(cluster_origin.Y - 28.0, cluster_origin.Y + 28.0),
        \\            Rhino.Geometry.Interval(-2.4, 0.0),
        \\        )
        \\        panel_id = sc.doc.Objects.AddBrep(panel_box.ToBrep())
        \\        assign_layer(panel_id, cap3d_layer)
        \\        play_start_offset = Rhino.Geometry.Vector3d(cluster_origin.X + 60.0, cluster_origin.Y, 0.0)
        \\        bottom_curve = translated_curve(rounded_rect_curve(button_width, button_depth, corner_radius, 0.0), play_start_offset)
        \\        shoulder_curve = translated_curve(rounded_rect_curve(shoulder_width, shoulder_depth, max(0.6, corner_radius - 0.2), shoulder_height), play_start_offset)
        \\        top_curve = translated_curve(rounded_rect_curve(top_width, top_depth, max(0.5, corner_radius - 0.5), button_height), play_start_offset)
        \\        for curve in [bottom_curve, shoulder_curve, top_curve]:
        \\            curve_id = sc.doc.Objects.AddCurve(curve)
        \\            assign_layer(curve_id, cap2d_layer)
        \\        stage_pause(0.55)
        \\
        \\        lofts = Rhino.Geometry.Brep.CreateFromLoft(
        \\            [bottom_curve, shoulder_curve, top_curve],
        \\            Rhino.Geometry.Point3d.Unset,
        \\            Rhino.Geometry.Point3d.Unset,
        \\            Rhino.Geometry.LoftType.Normal,
        \\            False,
        \\        )
        \\        if not lofts or len(lofts) == 0:
        \\            raise Exception("mpc live ii panel demo loft failed")
        \\        cap_brep = lofts[0].CapPlanarHoles(sc.doc.ModelAbsoluteTolerance)
        \\        if cap_brep is None:
        \\            cap_brep = lofts[0]
        \\        cap_id = sc.doc.Objects.AddBrep(cap_brep)
        \\        if cap_id is None:
        \\            raise Exception("failed to add mpc live ii panel-demo cap brep")
        \\        assign_layer(cap_id, cap3d_layer)
        \\        stage_pause(0.60)
        \\
        \\        meshes = Rhino.Geometry.Mesh.CreateFromBrep(cap_brep, Rhino.Geometry.MeshingParameters.Smooth)
        \\        if meshes is None or len(meshes) == 0:
        \\            raise Exception("failed to mesh mpc live ii panel-demo cap")
        \\        cap_mesh = Rhino.Geometry.Mesh()
        \\        for mesh in meshes:
        \\            cap_mesh.Append(mesh)
        \\        cap_mesh.Normals.ComputeNormals()
        \\        cap_mesh.Compact()
        \\        mesh_id = sc.doc.Objects.AddMesh(cap_mesh)
        \\        if mesh_id is None:
        \\            raise Exception("failed to add mpc live ii panel-demo mesh")
        \\        assign_layer(mesh_id, mesh_layer)
        \\        stage_pause(0.60)
        \\
        \\        export_mesh_id = sc.doc.Objects.AddMesh(cap_mesh.DuplicateMesh())
        \\        if export_mesh_id is None:
        \\            raise Exception("failed to add mpc live ii panel-demo export mesh")
        \\        assign_layer(export_mesh_id, export_layer)
        \\        rs.LayerVisible(source_layer, False)
        \\        rs.LayerVisible(envelope_layer, False)
        \\        rs.LayerVisible(anchors_layer, False)
        \\        rs.LayerVisible(family_layer, False)
        \\        rs.LayerVisible(cap2d_layer, False)
        \\        rs.LayerVisible(mesh_layer, False)
        \\        stage_pause(0.65)
        \\        export_selected_mesh(export_mesh_id)
        \\        return export_mesh_id
        \\    raise Exception("unsupported kind: " + PAYLOAD["kind"])
        \\
        \\
        \\def frame_for_demo(object_id):
        \\    try:
        \\        rhino_object = sc.doc.Objects.Find(object_id)
        \\        if rhino_object is None:
        \\            return
        \\        geometry = rhino_object.Geometry
        \\        if geometry is None:
        \\            return
        \\        bbox = geometry.GetBoundingBox(True)
        \\        if not bbox.IsValid:
        \\            return
        \\        bbox.Inflate(max(1.0, PAYLOAD["size_mm"] * 0.08))
        \\        active_view = sc.doc.Views.ActiveView
        \\        if active_view is None:
        \\            return
        \\        active_view.ActiveViewport.ZoomBoundingBox(bbox)
        \\        active_view.Redraw()
        \\    except Exception:
        \\        pass
        \\
        \\
        \\try:
        \\    sc.doc.ModelUnitSystem = Rhino.UnitSystem.Millimeters
        \\    object_id = build_object()
        \\    if object_id is None:
        \\        raise Exception("failed to create object")
        \\    apply_alias(object_id)
        \\    if PAYLOAD["kind"] == "create_organic_blob" or PAYLOAD["kind"] == "create_scientific_shell" or PAYLOAD["kind"] == "create_mpc_live_ii_button_cap" or PAYLOAD["kind"] == "create_mpc_live_ii_panel_demo":
        \\        set_rendered_view()
        \\        frame_for_demo(object_id)
        \\    sc.doc.Views.Redraw()
        \\    current_doc_path = getattr(sc.doc, "Path", None)
        \\    if current_doc_path and current_doc_path == PAYLOAD["document_path"]:
        \\        saved = True
        \\    else:
        \\        document_dir = System.IO.Path.GetDirectoryName(PAYLOAD["document_path"])
        \\        if document_dir:
        \\            System.IO.Directory.CreateDirectory(document_dir)
        \\        saved = sc.doc.WriteFile(PAYLOAD["document_path"], Rhino.FileIO.FileWriteOptions())
        \\        if not saved and System.IO.File.Exists(PAYLOAD["document_path"]):
        \\            saved = True
        \\    if not saved:
        \\        raise Exception("failed to write document")
        \\    exported_path = PAYLOAD["export_path"] if PAYLOAD["kind"] == "create_scientific_shell" or PAYLOAD["kind"] == "create_mpc_live_ii_button_cap" or PAYLOAD["kind"] == "create_mpc_live_ii_panel_demo" else None
        \\    if PAYLOAD["kind"] == "create_mpc_live_ii_button_cap":
        \\        calibration, calibrated, calibration_note = load_cap_calibration()
        \\        if calibrated:
        \\            result_message = "MPC Live II calibrated Play Start cap created from official Akai envelope, transport labels, and a calibrated cap reference estimate"
        \\        else:
        \\            result_message = "MPC Live II Play Start cap created from official Akai envelope with inferred fallback cap geometry"
        \\    elif PAYLOAD["kind"] == "create_mpc_live_ii_panel_demo":
        \\        calibration, calibrated, calibration_note = load_cap_calibration()
        \\        if calibrated:
        \\            result_message = "MPC Live II panel reconstruction completed with official envelope, user-guide transport anchors, and a calibrated Play Start cap estimate"
        \\        else:
        \\            result_message = "MPC Live II panel reconstruction completed with official envelope, user-guide transport anchors, and inferred fallback cap geometry"
        \\    else:
        \\        result_message = "created"
        \\    write_result("ok", str(object_id), result_message, exported_path)
        \\except Exception as exc:
        \\    write_result("error", None, str(exc))
        ,
        .{
            action.actionName(),
            alias,
            document_path,
            result_path,
            export_path,
            calibration_path,
            size_mm,
            radius_mm,
            height_mm,
        },
    );
    defer allocator.free(script);

    try std.Io.Dir.cwd().writeFile(io, .{
        .sub_path = script_path,
        .data = script,
    });
}

fn parseScriptResult(allocator: std.mem.Allocator, bytes: []const u8) !ScriptResult {
    const payload = try jsonPayload(bytes);
    var parsed = try std.json.parseFromSlice(ScriptResult, allocator, payload, .{});
    defer parsed.deinit();

    return .{
        .status = try allocator.dupe(u8, parsed.value.status),
        .object_id = if (parsed.value.object_id) |value| try allocator.dupe(u8, value) else null,
        .message = if (parsed.value.message) |value| try allocator.dupe(u8, value) else null,
        .export_path = if (parsed.value.export_path) |value| try allocator.dupe(u8, value) else null,
    };
}

fn pathExists(io: std.Io, path: []const u8) !bool {
    std.Io.Dir.cwd().access(io, path, .{}) catch |err| switch (err) {
        error.FileNotFound => return false,
        else => return err,
    };
    return true;
}

fn jsonPayload(bytes: []const u8) ![]const u8 {
    const trimmed = std.mem.trim(u8, bytes, &std.ascii.whitespace);
    if (trimmed.len == 0) return error.SyntaxError;
    if (trimmed[0] == '[' or trimmed[0] == '{') return trimmed;

    var candidate: ?usize = null;
    var index: usize = 1;
    while (index < trimmed.len) : (index += 1) {
        if (trimmed[index - 1] == '\n' and (trimmed[index] == '[' or trimmed[index] == '{')) {
            candidate = index;
        }
    }

    if (candidate) |start| return trimmed[start..];
    return error.SyntaxError;
}

fn kindLabel(kind: types.ActionKind) []const u8 {
    return switch (kind) {
        .create_cube => "cube",
        .create_sphere => "sphere",
        .create_cylinder => "cylinder",
        .create_organic_blob => "organic_blob",
        .create_scientific_shell => "scientific_shell",
        .create_mpc_live_ii_button_cap => "mpc_live_ii_button_cap",
        .create_mpc_live_ii_panel_demo => "mpc_live_ii_panel_demo",
        else => "object",
    };
}

fn resultSummary(kind: types.ActionKind) []const u8 {
    return switch (kind) {
        .create_mpc_live_ii_button_cap => "MPC Live II button-cap reference created with official device dimensions and inferred cap geometry",
        .create_mpc_live_ii_panel_demo => "MPC Live II panel demo completed with official envelope, named control anchors, and inferred cap geometry",
        .create_scientific_shell => "real Rhino scientific shell demo completed",
        else => "real Rhino create completed",
    };
}

fn absolutePath(allocator: std.mem.Allocator, relative_path: []const u8) ![]u8 {
    defer allocator.free(relative_path);
    return try normalizePath(allocator, relative_path);
}

fn normalizePath(allocator: std.mem.Allocator, path: []const u8) ![]u8 {
    if (std.fs.path.isAbsolute(path)) return try allocator.dupe(u8, path);
    const cwd_ptr = std.c.getenv("PWD") orelse return error.RhinoLaunchFailed;
    const cwd = std.mem.span(cwd_ptr);
    return try std.fs.path.join(allocator, &.{ cwd, path });
}

fn isOwnedDemoInstance(io: std.Io, allocator: std.mem.Allocator, instance: RhinoInstance) !bool {
    if (try ownedInstanceMatches(io, allocator, instance.process_id)) {
        return true;
    }

    const repo_root = try repoRoot(allocator);
    defer allocator.free(repo_root);

    if (instance.active_doc_location.len > 0 and std.mem.startsWith(u8, instance.active_doc_location, repo_root)) {
        return true;
    }

    const pid_text = try std.fmt.allocPrint(allocator, "{d}", .{instance.process_id});
    defer allocator.free(pid_text);

    const run_result = try std.process.run(allocator, io, .{
        .argv = &.{ "/bin/ps", "-p", pid_text, "-o", "command=" },
        .stdout_limit = .limited(16 * 1024),
        .stderr_limit = .limited(8 * 1024),
    });
    defer allocator.free(run_result.stdout);
    defer allocator.free(run_result.stderr);

    switch (run_result.term) {
        .exited => |code| if (code != 0) return false,
        else => return false,
    }

    return std.mem.indexOf(u8, run_result.stdout, repo_root) != null or
        std.mem.indexOf(u8, run_result.stdout, "var/real-rhino/") != null;
}

fn recordOwnedInstance(io: std.Io, allocator: std.mem.Allocator, process_id: i64) !void {
    try util.ensureParentDir(io, owned_instance_pid_path);
    const pid_text = try std.fmt.allocPrint(allocator, "{d}\n", .{process_id});
    defer allocator.free(pid_text);

    try std.Io.Dir.cwd().writeFile(io, .{
        .sub_path = owned_instance_pid_path,
        .data = pid_text,
    });
}

fn ownedInstanceMatches(io: std.Io, allocator: std.mem.Allocator, process_id: i64) !bool {
    const bytes = std.Io.Dir.cwd().readFileAlloc(io, owned_instance_pid_path, allocator, .limited(128)) catch |err| switch (err) {
        error.FileNotFound => return false,
        else => return err,
    };
    defer allocator.free(bytes);

    const trimmed = std.mem.trim(u8, bytes, &std.ascii.whitespace);
    if (trimmed.len == 0) return false;

    const recorded_pid = std.fmt.parseInt(i64, trimmed, 10) catch return false;
    return recorded_pid == process_id;
}

fn terminateInstance(io: std.Io, allocator: std.mem.Allocator, process_id: i64) !void {
    if (try ownedInstanceMatches(io, allocator, process_id)) {
        clearOwnedInstance(io);
    }

    const pid_text = try std.fmt.allocPrint(allocator, "{d}", .{process_id});
    defer allocator.free(pid_text);

    const run_result = try std.process.run(allocator, io, .{
        .argv = &.{ "/bin/kill", "-TERM", pid_text },
        .stdout_limit = .limited(4 * 1024),
        .stderr_limit = .limited(4 * 1024),
    });
    defer allocator.free(run_result.stdout);
    defer allocator.free(run_result.stderr);

    switch (run_result.term) {
        .exited => |code| if (code != 0) return error.RhinoInstanceConflict,
        else => return error.RhinoInstanceConflict,
    }
}

fn clearOwnedInstance(io: std.Io) void {
    std.Io.Dir.cwd().deleteFile(io, owned_instance_pid_path) catch |err| switch (err) {
        error.FileNotFound => {},
        else => {},
    };
}

fn repoRoot(allocator: std.mem.Allocator) ![]u8 {
    const cwd_ptr = std.c.getenv("PWD") orelse return error.RhinoLaunchFailed;
    return try allocator.dupe(u8, std.mem.span(cwd_ptr));
}

test "parse script result succeeds" {
    const allocator = std.testing.allocator;
    const bytes = "{\"status\":\"ok\",\"object_id\":\"abc-123\",\"message\":\"created\"}";
    const result = try parseScriptResult(allocator, bytes);
    defer {
        allocator.free(result.status);
        if (result.object_id) |host_id| allocator.free(host_id);
        if (result.message) |message| allocator.free(message);
    }

    try std.testing.expectEqualStrings("ok", result.status);
    try std.testing.expectEqualStrings("abc-123", result.object_id.?);
    try std.testing.expectEqualStrings("created", result.message.?);
}

test "json payload ignores rhinocode log lines" {
    const bytes =
        "Error 4/2/2026 2:10:08 AM [rhinocode] Post timeout on rhinocode_remotepipe_90274\n" ++
        "[]\n";

    const payload = try jsonPayload(bytes);
    try std.testing.expectEqualStrings("[]", payload);
}
