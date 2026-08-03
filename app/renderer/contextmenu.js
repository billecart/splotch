// Keep the native menu request in one place, but let the editor and outline
// contribute context before it crosses into the main process.
window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent("splotch-contextmenu", {
        detail: { x: e.x, y: e.y, target: e.target }
    }));
});
