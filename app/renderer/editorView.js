const editor = ace.edit("editor");
const Range = ace.require("ace/range").Range;
const TokenIterator = ace.require("ace/token_iterator").TokenIterator;
const language_tools = ace.require("ace/ext/language_tools");
const ipcRenderer = require("electron").ipcRenderer;

const inkCompleter = require("./inkCompleter.js").inkCompleter;
const { LocalHighlightStore, fileKey } = require("./localHighlights.js");

var editorMarkers = [];
var editorAnnotations = [];
var performedLineMarkers = [];
var writingHighlightMarkers = [];
var currentInkFile = null;
var localHighlightStore = new LocalHighlightStore();
var showPerformedLines = false;

// Used when reloading files so that cursor doesn't jump back to the top
var savedCursorPos = null;
var savedScrollRow = null;

// Overriden by controller.js
var events = {
    change:         () => {},
    jumpToInclude:  () => {},
    jumpToSymbol:   () => {},
    changedLine:    () => {}
};

editor.setShowPrintMargin(false);
editor.setOptions({
    enableBasicAutocompletion: true, // defaults only, will be overriden by setAutoCompleteDisabled
    enableLiveAutocompletion: true,
});
editor.on("change", () => {
    refreshLocalDecorations();
    events.change();
});
editor.on("changeSelection", ()=>{
    events.changedLine(editor.getCursorPosition());
})

// Exclude language_tools.textCompleter but add the Ink completer
editor.completers = editor.completers.filter(
    (completer) => completer !== language_tools.textCompleter);
editor.completers.push(inkCompleter);

// Unbind windows CTRL-P: "Jump to matching bracket" since it collides with
// our "go to anything" command.
editor.commands.removeCommand("jumptomatching")

// Unbind CMD-ALT-S from Ace so we can use it for save js only
editor.commands.removeCommand("sortlines");

// Unfortunately standard jquery events don't work since 
// Ace turns pointer events off
editor.on("click", function(e){

    if( e.domEvent.altKey ) {
        tryClickCodeLink(e);
    } else {
        setImmediate(() => events.navigate());
    }
});

function removeMarkers(markers) {
    markers.forEach(marker => marker.session.removeMarker(marker.id));
    markers.length = 0;
}

function positionForOffset(session, offset) {
    return session.getDocument().indexToPosition(offset);
}

function addLineMarker(session, row, className) {
    const id = session.addMarker(
        new Range(row, 0, row, Infinity),
        className,
        "fullLine",
        false
    );
    performedLineMarkers.push({ session, id });
}

function addTextMarker(session, start, end, className) {
    const startPos = positionForOffset(session, start);
    const endPos = positionForOffset(session, end);
    const id = session.addMarker(
        new Range(startPos.row, startPos.column, endPos.row, endPos.column),
        className,
        "text",
        false
    );
    writingHighlightMarkers.push({ session, id });
}

function refreshLocalDecorations() {
    removeMarkers(performedLineMarkers);
    removeMarkers(writingHighlightMarkers);

    if (!currentInkFile || !editor.session) return;

    const session = editor.session;
    if (showPerformedLines) {
        const performedId = /#\s*id\s*:\s*[^\s\[\]\r\n]+/i;
        for (let row = 0; row < session.getLength(); row++) {
            if (performedId.test(session.getLine(row))) {
                addLineMarker(session, row, "splotch-performed-line");
            }
        }
    }

    const source = currentInkFile.getValue();
    const highlights = localHighlightStore.resolve(fileKey(currentInkFile), source);
    highlights.forEach(highlight => {
        addTextMarker(session, highlight.start, highlight.end, "splotch-writing-highlight");
    });
}

function selectedOffsets() {
    const range = editor.getSelectionRange();
    const document = editor.session.getDocument();
    return {
        start: document.positionToIndex(range.start),
        end: document.positionToIndex(range.end)
    };
}

function highlightSelection(context) {
    if (!currentInkFile) return;
    const offsets = context && context.selectionStart !== undefined
        ? { start: context.selectionStart, end: context.selectionEnd }
        : selectedOffsets();
    if (offsets.start === offsets.end) return;

    localHighlightStore.add(
        fileKey(currentInkFile),
        currentInkFile.getValue(),
        offsets.start,
        offsets.end
    );
    refreshLocalDecorations();
}

function removeHighlight(context) {
    if (!currentInkFile) return;
    const offsets = context && context.selectionStart !== undefined
        ? { start: context.selectionStart, end: context.selectionEnd }
        : selectedOffsets();
    const cursor = editor.getCursorPosition();
    const cursorOffset = editor.session.getDocument().positionToIndex(cursor);
    const end = offsets.start === offsets.end ? cursorOffset + 1 : offsets.end;
    const start = offsets.start === offsets.end ? cursorOffset : offsets.start;

    localHighlightStore.remove(
        fileKey(currentInkFile),
        currentInkFile.getValue(),
        start,
        end
    );
    refreshLocalDecorations();
}

function moveToHighlight(direction) {
    if (!currentInkFile) return;
    const source = currentInkFile.getValue();
    const highlights = localHighlightStore.resolve(fileKey(currentInkFile), source)
        .sort((a, b) => a.start - b.start);
    if (highlights.length === 0) return;

    const cursorOffset = editor.session.getDocument().positionToIndex(editor.getCursorPosition());
    let target;
    if (direction > 0) {
        target = highlights.find(highlight => highlight.start > cursorOffset) || highlights[0];
    } else {
        target = [...highlights].reverse().find(highlight => highlight.end < cursorOffset) || highlights[highlights.length - 1];
    }

    const start = positionForOffset(editor.session, target.start);
    const end = positionForOffset(editor.session, target.end);
    editor.selection.setSelectionRange(new Range(start.row, start.column, end.row, end.column));
    editor.scrollToLine(start.row, true, true, () => {});
    editor.focus();
}

function tokenAtPosition(pos) {
    const candidates = [pos.column, Math.max(0, pos.column - 1), pos.column + 1];
    for (const column of candidates) {
        const token = editor.session.getTokenAt(pos.row, column);
        if (token) return token;
    }
    return null;
}

function contextAtPoint(point) {
    const pos = editor.renderer.screenToTextCoordinates(point.x, point.y);
    const token = tokenAtPosition(pos);
    const selection = editor.getSelectionRange();
    const selectionOffsets = selectedOffsets();
    const flow = currentInkFile && currentInkFile.symbols.flowAtPos(pos);
    return {
        row: pos.row,
        column: pos.column,
        tokenType: token && token.type,
        tokenValue: token && token.value,
        hasSelection: !selection.isEmpty(),
        // Native menus can move focus and alter Ace's live selection. Keep
        // the range that existed when the context menu was opened.
        selectionStart: selectionOffsets.start,
        selectionEnd: selectionOffsets.end,
        knotRow: flow && flow.Knot ? flow.Knot.row : null
    };
}

window.addEventListener("splotch-contextmenu", event => {
    if (!currentInkFile || !event.detail.target ||
        !event.detail.target.closest || !event.detail.target.closest("#editor")) return;
    const context = contextAtPoint(event.detail);
    ipcRenderer.send("show-context-menu", {
        x: event.detail.x,
        y: event.detail.y,
        context
    });
});

ipcRenderer.on("context-menu-action", (event, action, context) => {
    switch (action) {
        case "highlight-selection":
            highlightSelection(context);
            break;
        case "remove-highlight":
            removeHighlight(context);
            break;
        case "next-highlight":
            moveToHighlight(1);
            break;
        case "previous-highlight":
            moveToHighlight(-1);
            break;
        case "go-to-knot":
            if (context && context.tokenValue) {
                events.goToKnot(context.tokenValue.trim(), {
                    row: context.row,
                    column: context.column
                });
            }
            break;
        case "test-knot":
            if (context && context.knotRow !== null) events.testKnot(context.knotRow);
            break;
    }
});

function tryClickCodeLink(event) {
    var editor = event.editor;
    var pos = editor.getCursorPosition();
    var searchToken = editor.session.getTokenAt(pos.row, pos.column);

    if( searchToken && searchToken.type == "include.filepath" ) {
        events.jumpToInclude(searchToken.value);
        return;
    }

    if( searchToken && searchToken.type == "divert.target" ) {
        event.preventDefault();
        var targetPath = searchToken.value;
        events.jumpToSymbol(targetPath, pos);
        return;
    }
}

// Unfortunately standard CSS for hover doesn't work in the editor
// since they turn pointer events off.
editor.on("mousemove", function (e) {

    var editor = e.editor;

    // Have to hold down modifier key to jump
    if( e.domEvent.altKey ) {

        var character = editor.renderer.screenToTextCoordinates(e.x, e.y);
        var token = editor.session.getTokenAt(character.row, character.column);
        if( !token )
            return;

        var tokenStartPos = editor.renderer.textToScreenCoordinates(character.row, token.start);
        var tokenEndPos = editor.renderer.textToScreenCoordinates(character.row, token.start + token.value.length);

        const lineHeight = 12;
        if( e.x >= tokenStartPos.pageX && e.x <= tokenEndPos.pageX && e.y >= tokenStartPos.pageY && e.y <= tokenEndPos.pageY+lineHeight) {
            if( token ) {
                if( token.type == "divert.target" || token.type == "include.filepath" ) {
                    editor.renderer.setCursorStyle("pointer");
                    return;
                }
            }
        }
    }
    
    editor.renderer.setCursorStyle("default");
});

function addError(error) {

    var editorErrorType = "error";
    var editorClass = "ace-error";
    if( error.type == "WARNING" ) {
        editorErrorType = "warning";
        editorClass = "ace-warning";
    }
    else if( error.type == "TODO" ) {
        editorErrorType = "information";
        editorClass = 'ace-todo';
    }

    editorAnnotations.push({
        row: error.lineNumber-1,
        column: 0,
        text: error.message,
        type: editorErrorType
    });
    editor.getSession().setAnnotations(editorAnnotations);

    var aceClass = "ace-error";
    var markerId = editor.session.addMarker(
        new Range(error.lineNumber-1, 0, error.lineNumber, 0),
        editorClass, 
        "line",
        false
    );
    editorMarkers.push(markerId);
}

function setErrors(errors) {
    clearErrors();
    errors.forEach(addError);
}

function clearErrors() {

    var editorSession = editor.getSession();
    editorSession.clearAnnotations();
    editorAnnotations = [];

    for(var i=0; i<editorMarkers.length; i++) {
        editorSession.removeMarker(editorMarkers[i]);
    }
    editorMarkers = [];
}

exports.EditorView = {
    clearErrors: clearErrors,
    setEvents: (e) => { events = e; },
    getValue: () => { return editor.getValue(); },
    setValue: (v) => { editor.setValue(v); },
    insert: (txt) => editor.insert(txt),
    gotoLine: (row, col) => { editor.gotoLine(row, col); editor.focus(); },
    addError: addError,
    setErrors: setErrors,
    setFiles: (inkFiles) => {
        inkCompleter.inkFiles = inkFiles;
    },
    showInkFile: (inkFile) => {
        clearErrors();
        removeMarkers(performedLineMarkers);
        removeMarkers(writingHighlightMarkers);
        currentInkFile = inkFile;
        editor.setSession(inkFile.getAceSession());
        refreshLocalDecorations();
        editor.focus();
    },
    focus: () => { editor.focus(); },
    saveCursorPos: () => { 
        savedCursorPos = editor.getCursorPosition(); 
        savedScrollRow = editor.getFirstVisibleRow(); 
    },
    restoreCursorPos: () => { 
        if( savedCursorPos ) {
            editor.moveCursorToPosition(savedCursorPos); 
            editor.scrollToRow(savedScrollRow);
        } 
    },
    getCurrentCursorPos: ()=>{
        return editor.getCursorPosition();
    },
    setPerformedLinesVisible: (visible) => {
        showPerformedLines = !!visible;
        refreshLocalDecorations();
    },
    isPerformedLinesVisible: () => showPerformedLines,
    highlightSelection: highlightSelection,
    removeHighlight: removeHighlight,
    nextHighlight: () => moveToHighlight(1),
    previousHighlight: () => moveToHighlight(-1),
    setAutoCompleteDisabled: (autoCompleteDisabled) => {
        editor.setOptions({
            enableBasicAutocompletion: !autoCompleteDisabled,
            enableLiveAutocompletion: !autoCompleteDisabled
        });
    },
};
