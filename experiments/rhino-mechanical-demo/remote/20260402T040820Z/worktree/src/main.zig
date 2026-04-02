const std = @import("std");
const rhino_nlcli = @import("rhino_nlcli");

pub fn main(init: std.process.Init) !void {
    try rhino_nlcli.appMain(init);
}
