// Baseline deterrents against casual image theft: no right-click save,
// no dragging images out, no naive save/print/devtools shortcuts.
// NOTE: none of this can stop a determined user or an OS-level screenshot -
// that is true of any website. Real protection comes from serving only a
// resolution-capped, watermarked copy (see scripts/process-images.mjs) and
// never exposing full-resolution originals over the web.
(function () {
  function showToast(msg) {
    let toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  document.addEventListener("contextmenu", (e) => {
    if (e.target.closest("img, canvas, .gallery-item, .lb-stage, .hero")) {
      e.preventDefault();
      showToast("Images are protected — prints & downloads are available via the shop link.");
    }
  });

  document.addEventListener("dragstart", (e) => {
    if (e.target.closest("img, canvas")) e.preventDefault();
  });

  document.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    const blockCombo =
      (e.ctrlKey || e.metaKey) && ["s", "u", "p"].includes(key);
    const blockDevtools =
      key === "f12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "c", "j"].includes(key));
    if (blockCombo || blockDevtools) {
      e.preventDefault();
      showToast("This action is disabled on image pages.");
    }
  });

  window.__toast = showToast;
})();
