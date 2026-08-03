const assert = require("assert");
const {
    LocalHighlightStore,
    isEphemeralKey,
    makeAnchor,
    resolveAnchor
} = require("../renderer/localHighlights.js");

function memoryStorage() {
    const values = {};
    return {
        getItem: key => values[key] || null,
        setItem: (key, value) => { values[key] = value; }
    };
}

describe("local writing highlights", function() {
    it("resolves a highlight after text is inserted before it", function() {
        const original = "alpha\nKeep this line\nomega";
        const start = original.indexOf("Keep");
        const anchor = makeAnchor(original, start, start + 14);
        const updated = "alpha\nA newly inserted line\nKeep this line\nomega";
        const resolved = resolveAnchor(updated, anchor);

        assert.deepEqual(resolved && [resolved.start, resolved.end], [28, 42]);
    });

    it("persists highlights per source key", function() {
        const store = new LocalHighlightStore(memoryStorage());
        const source = "one two three";
        store.add("a.ink", source, 4, 7);

        assert.equal(store.get("a.ink").length, 1);
        assert.equal(store.get("b.ink").length, 0);
        assert.deepEqual(store.resolve("a.ink", source)[0].start, 4);
    });

    it("keeps unsaved-document highlights only for the current app session", function() {
        const storage = memoryStorage();
        const firstStore = new LocalHighlightStore(storage);
        firstStore.add("untitled:0", "Once upon a time", 0, 4);

        const restartedStore = new LocalHighlightStore(storage);
        assert.equal(isEphemeralKey("untitled:0"), true);
        assert.equal(restartedStore.get("untitled:0").length, 0);
    });
});
