"use strict";

// Local writing annotations are deliberately kept separate from InkFile and
// the compiler. The only persisted data is the selected text plus a small
// amount of context that lets us re-anchor it after ordinary source edits.

const STORAGE_KEY = "splotch.localHighlights.v1";
const CONTEXT_LENGTH = 48;

function storageOrNull(storage) {
    if (storage) return storage;
    if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage;
    }
    return null;
}

function readAll(storage) {
    const source = storageOrNull(storage);
    if (!source) return {};

    try {
        const value = JSON.parse(source.getItem(STORAGE_KEY) || "{}");
        return value && typeof value === "object" ? value : {};
    } catch (error) {
        console.warn("Could not read local writing highlights", error);
        return {};
    }
}

function writeAll(all, storage) {
    const source = storageOrNull(storage);
    if (!source) return;
    source.setItem(STORAGE_KEY, JSON.stringify(all));
}

function makeAnchor(text, start, end) {
    const beforeStart = Math.max(0, start - CONTEXT_LENGTH);
    const afterEnd = Math.min(text.length, end + CONTEXT_LENGTH);
    return {
        text: text.slice(start, end),
        before: text.slice(beforeStart, start),
        after: text.slice(end, afterEnd),
        offset: start
    };
}

function commonSuffixLength(left, right) {
    let count = 0;
    while (count < left.length && count < right.length &&
        left[left.length - 1 - count] === right[right.length - 1 - count]) {
        count++;
    }
    return count;
}

function commonPrefixLength(left, right) {
    let count = 0;
    while (count < left.length && count < right.length && left[count] === right[count]) {
        count++;
    }
    return count;
}

function findOccurrences(source, needle) {
    const occurrences = [];
    if (!needle) return occurrences;

    let from = 0;
    while (from <= source.length - needle.length) {
        const index = source.indexOf(needle, from);
        if (index === -1) break;
        occurrences.push(index);
        from = index + Math.max(needle.length, 1);
    }
    return occurrences;
}

function resolveAnchor(source, anchor) {
    if (!anchor || !anchor.text) return null;

    const candidates = findOccurrences(source, anchor.text);
    if (candidates.length === 0) return null;

    let best = null;
    candidates.forEach(start => {
        const end = start + anchor.text.length;
        const before = source.slice(Math.max(0, start - CONTEXT_LENGTH), start);
        const after = source.slice(end, Math.min(source.length, end + CONTEXT_LENGTH));
        const score =
            commonSuffixLength(anchor.before || "", before) +
            commonPrefixLength(anchor.after || "", after) -
            Math.min(Math.abs((anchor.offset || 0) - start) / 1000, 5);

        if (!best || score > best.score) {
            best = { start, end, score };
        }
    });
    return best;
}

function fileKey(inkFile) {
    return inkFile.absolutePath() || `untitled:${inkFile.id}`;
}

function LocalHighlightStore(storage) {
    this.storage = storage;
}

LocalHighlightStore.prototype.get = function(key) {
    const all = readAll(this.storage);
    return Array.isArray(all[key]) ? all[key] : [];
};

LocalHighlightStore.prototype.save = function(key, highlights) {
    const all = readAll(this.storage);
    all[key] = highlights;
    writeAll(all, this.storage);
};

LocalHighlightStore.prototype.add = function(key, source, start, end) {
    if (start === end) return this.get(key);

    const current = this.get(key);
    const anchor = makeAnchor(source, start, end);
    const duplicate = current.some(item => item.text === anchor.text &&
        Math.abs((item.offset || 0) - start) < Math.max(anchor.text.length, 1));
    if (!duplicate) current.push(anchor);
    this.save(key, current);
    return current;
};

LocalHighlightStore.prototype.remove = function(key, source, start, end) {
    const current = this.get(key);
    const next = current.filter(anchor => {
        const resolved = resolveAnchor(source, anchor);
        if (!resolved) return false;
        return resolved.end <= start || resolved.start >= end;
    });
    this.save(key, next);
    return next;
};

LocalHighlightStore.prototype.resolve = function(key, source) {
    return this.get(key).map(anchor => {
        const resolved = resolveAnchor(source, anchor);
        return resolved ? { anchor, start: resolved.start, end: resolved.end } : null;
    }).filter(Boolean);
};

LocalHighlightStore.prototype.clear = function(key) {
    const all = readAll(this.storage);
    delete all[key];
    writeAll(all, this.storage);
};

module.exports = {
    CONTEXT_LENGTH,
    LocalHighlightStore,
    fileKey,
    makeAnchor,
    resolveAnchor
};
