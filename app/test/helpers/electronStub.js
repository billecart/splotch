// Minimal fake of the bits of `electron` that splotch's main process touches,
// installed via a Module._load hook so that the REAL main.js / projectWindow.js
// can be required under plain `node --test`.
//
// This matters for the open-file tests: the bug being guarded against is
// duplicate listener registration at module scope, which only a test that
// loads the actual modules can catch.

const EventEmitter = require("events");
const Module = require("module");
const fs = require("fs");
const os = require("os");
const path = require("path");

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "splotch-test-"));

// --- fake windows -------------------------------------------------------

let createdWindows = [];

function FakeWebContents() {
    const webContents = new EventEmitter();
    webContents.sent = [];
    webContents.send = (channel, ...args) => webContents.sent.push({ channel, args });
    webContents.channels = () => webContents.sent.map(m => m.channel);
    webContents.setZoomFactor = () => {};
    webContents.openDevTools = () => {};
    webContents.isDestroyed = () => false;
    return webContents;
}

class FakeBrowserWindow extends EventEmitter {
    constructor(options) {
        super();
        this.options = options;
        this.webContents = FakeWebContents();
        this.focusCount = 0;
        this.destroyed = false;
        createdWindows.push(this);
    }
    loadURL() {}
    setSheetOffset() {}
    setRepresentedFilename(p) { this.representedFilename = p; }
    setTitle(t) { this.title = t; }
    focus() { this.focusCount++; }
    show() {}
    close() {}
    destroy() { this.destroyed = true; }
    send(...args) { this.webContents.send(...args); }
    isDestroyed() { return this.destroyed; }
}
FakeBrowserWindow.getFocusedWindow = () => createdWindows[createdWindows.length - 1] || null;
FakeBrowserWindow.getAllWindows = () => createdWindows.slice();
FakeBrowserWindow.fromWebContents = wc =>
    createdWindows.find(w => w.webContents === wc) || null;

// --- fake app -----------------------------------------------------------

const app = new EventEmitter();
app.getPath = () => userDataDir;
app.getLocale = () => "en";
app.getName = () => "splotch";
app.getVersion = () => "0.0.0-test";
app.quit = () => {};
app.exit = () => {};
app.isReady = () => true;
app.whenReady = () => Promise.resolve();
app.setName = () => {};
app.dock = { setMenu: () => {} };

// --- fake menu / dialog / ipc ------------------------------------------

const fakeMenu = { items: [], popup: () => {}, append: () => {} };
const Menu = {
    buildFromTemplate: () => fakeMenu,
    setApplicationMenu: m => { Menu._applicationMenu = m; },
    getApplicationMenu: () => Menu._applicationMenu || fakeMenu
};
Menu._applicationMenu = fakeMenu;

let openDialogResult = null;
const dialog = {
    showOpenDialogSync: () => openDialogResult,
    showSaveDialogSync: () => null,
    showMessageBox: () => Promise.resolve({ response: 0 }),
    showMessageBoxSync: () => 0,
    showErrorBox: () => {}
};

const ipcMain = new EventEmitter();
ipcMain.handle = () => {};
ipcMain.removeHandler = () => {};

const fakeElectron = {
    app,
    BrowserWindow: FakeBrowserWindow,
    ipcMain,
    dialog,
    Menu,
    MenuItem: function MenuItem(o) { Object.assign(this, o); },
    shell: { openExternal: () => {}, showItemInFolder: () => {} },
    nativeTheme: new EventEmitter()
};

// --- install the hook ---------------------------------------------------

const originalLoad = Module._load;
Module._load = function(request, ...rest) {
    if (request === "electron") return fakeElectron;
    return originalLoad.call(this, request, ...rest);
};

// --- test helpers -------------------------------------------------------

module.exports = {
    electron: fakeElectron,
    app,
    userDataDir,
    windowCount: () => createdWindows.length,
    windows: () => createdWindows.slice(),
    lastWindow: () => createdWindows[createdWindows.length - 1] || null,
    resetWindowCount: () => { createdWindows = []; },
    setOpenDialogResult: paths => { openDialogResult = paths; },

    // An `open-file` event object that records preventDefault(), the way
    // Electron's does.
    makeEvent: () => {
        const event = { defaultPrevented: false };
        event.preventDefault = () => { event.defaultPrevented = true; };
        return event;
    }
};
