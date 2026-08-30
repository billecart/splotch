const { describe, it, before } = require("node:test");
const assert = require("assert");
const path = require("path");

// Must be required before anything that pulls in `electron`.
const stub = require("./helpers/electronStub.js");

const { ProjectWindow } = require("../main-process/projectWindow.js");
require("../main-process/main.js");

const app = stub.app;

function openFile(filePath) {
    const event = stub.makeEvent();
    app.emit("open-file", event, filePath);
    return event;
}

describe("opening a file", function() {

    before(function() {
        // Bring the app up the way Electron does.
        app.emit("will-finish-launching");
        app.emit("ready");

        // `ready` creates the initial empty window; ignore it.
        stub.resetWindowCount();
    });

    it("registers exactly one open-file listener", function() {
        // Regression guard: a second listener (previously registered inside
        // will-finish-launching) made every Finder double-click open twice.
        assert.equal(app.listenerCount("open-file"), 1);
    });

    it("opens one window when a file is opened from Finder", function() {
        stub.resetWindowCount();
        openFile("/tmp/splotch-test/one.ink");

        assert.equal(stub.windowCount(), 1);
    });

    it("prevents the default handling of open-file", function() {
        const event = openFile("/tmp/splotch-test/prevented.ink");

        assert.equal(event.defaultPrevented, true);
    });

    it("focuses the existing window instead of opening a file twice", function() {
        const filePath = "/tmp/splotch-test/twice.ink";
        openFile(filePath);
        stub.resetWindowCount();

        const existingWin = ProjectWindow.withMainkInkPath(filePath);
        openFile(filePath);

        assert.equal(stub.windowCount(), 0);
        assert.equal(existingWin.browserWindow.focusCount, 1);
        assert.ok(existingWin.browserWindow.webContents.channels().includes("open-main-ink"));
    });

    it("treats differently spelled paths as the same file", function() {
        openFile("/tmp/splotch-test/nested/normalised.ink");
        stub.resetWindowCount();

        openFile("/tmp/splotch-test/nested/./normalised.ink");
        openFile("/tmp/splotch-test/nested/../nested/normalised.ink");

        assert.equal(stub.windowCount(), 0);
    });

    it("focuses the existing window when File > Open picks an open file", function() {
        const filePath = "/tmp/splotch-test/menu-open.ink";
        const firstWin = ProjectWindow.open(filePath);
        stub.resetWindowCount();

        stub.setOpenDialogResult([filePath]);
        const secondWin = ProjectWindow.open();

        assert.equal(stub.windowCount(), 0);
        assert.equal(secondWin, firstWin);
    });

    it("does not reopen a project that was saved under a new name", function() {
        const savedPath = "/tmp/splotch-test/saved-as.ink";
        const win = ProjectWindow.createEmpty();
        stub.resetWindowCount();

        // What the renderer sends after a save, unresolved.
        stub.electron.ipcMain.emit(
            "main-file-saved",
            { sender: win.browserWindow.webContents },
            "/tmp/splotch-test/nested/../saved-as.ink"
        );
        openFile(savedPath);

        assert.equal(stub.windowCount(), 0);
        assert.equal(win.browserWindow.focusCount, 1);
    });

    it("still opens a window for a file that is not already open", function() {
        stub.resetWindowCount();

        stub.setOpenDialogResult([path.join("/tmp/splotch-test", "fresh.ink")]);
        ProjectWindow.open();

        assert.equal(stub.windowCount(), 1);
    });
});
