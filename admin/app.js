const API = "";
let state = { config: {}, images: [], archived: [], categories: [] };
let sortables = [];
let suppressClick = false;
let currentEditId = null;

function toast(msg, isError) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.style.borderColor = isError ? "var(--danger)" : "var(--border)";
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2400);
}

async function api(path, options) {
  const res = await fetch(API + path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function loadState() {
  state = await api("/api/state");
  render();
  renderHomePanel();
  renderAboutPanel();
}

// ---------- rendering ----------

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cardHtml(img) {
  return `
    <div class="card${img.needsTitleReview ? " needs-review" : ""}" data-id="${img.id}">
      <img src="/assets/thumbs/${img.id}.jpg" alt="" loading="lazy">
      <div class="card-title">${esc(img.title)}</div>
    </div>`;
}

function columnHtml(cat, images, index, total) {
  return `
    <div class="column" data-category="${esc(cat.key)}">
      <div class="column-head">
        <input class="column-title" value="${esc(cat.label)}" data-key="${esc(cat.key)}" title="Rename gallery">
        <span class="column-count">${images.length}</span>
        <div class="column-move">
          <button data-move="left" data-key="${esc(cat.key)}" ${index === 0 ? "disabled" : ""} title="Move left">&larr;</button>
          <button data-move="right" data-key="${esc(cat.key)}" ${index === total - 1 ? "disabled" : ""} title="Move right">&rarr;</button>
        </div>
        <button class="column-delete" data-delete-cat="${esc(cat.key)}" title="Delete empty gallery">&times;</button>
      </div>
      <div class="card-list" data-category="${esc(cat.key)}">
        ${images.map(cardHtml).join("")}
      </div>
    </div>`;
}

function archivedColumnHtml() {
  return `
    <div class="column archived-column" data-archived="true">
      <div class="column-head">
        <span class="column-title" style="padding:2px 4px;">Archived (hidden)</span>
        <span class="column-count">${state.archived.length}</span>
      </div>
      <div class="card-list" data-archived="true">
        ${state.archived.map(cardHtml).join("")}
      </div>
    </div>`;
}

function render() {
  const board = document.getElementById("board");
  const byCategory = new Map(state.categories.map((c) => [c.key, []]));
  for (const img of state.images) {
    if (!byCategory.has(img.category)) byCategory.set(img.category, []);
    byCategory.get(img.category).push(img);
  }
  for (const list of byCategory.values()) list.sort((a, b) => a.sortIndex - b.sortIndex);

  const cols = state.categories
    .map((cat, i) => columnHtml(cat, byCategory.get(cat.key) || [], i, state.categories.length))
    .join("");
  board.innerHTML = cols + archivedColumnHtml();

  sortables.forEach((s) => s.destroy());
  sortables = [];
  board.querySelectorAll(".card-list").forEach((listEl) => {
    sortables.push(
      new Sortable(listEl, {
        group: "board",
        animation: 150,
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        onStart: () => (suppressClick = true),
        onEnd: handleDragEnd,
      })
    );
  });

  board.querySelectorAll(".card").forEach((cardEl) => {
    cardEl.addEventListener("click", () => {
      if (suppressClick) return;
      openEditor(cardEl.dataset.id);
    });
  });

  board.querySelectorAll(".column-title").forEach((input) => {
    input.addEventListener("change", () => renameCategory(input.dataset.key, input.value));
  });
  board.querySelectorAll("[data-move]").forEach((btn) => {
    btn.addEventListener("click", () => moveCategory(btn.dataset.key, btn.dataset.move));
  });
  board.querySelectorAll("[data-delete-cat]").forEach((btn) => {
    btn.addEventListener("click", () => deleteCategory(btn.dataset.deleteCat));
  });
}

// ---------- drag and drop ----------

async function handleDragEnd(evt) {
  setTimeout(() => (suppressClick = false), 50);
  const id = evt.item.dataset.id;
  const fromArchived = evt.from.dataset.archived === "true";
  const toArchived = evt.to.dataset.archived === "true";

  try {
    if (toArchived && !fromArchived) {
      await api(`/api/images/${id}`, { method: "DELETE" });
      toast("Moved to Archived");
    } else if (fromArchived && !toArchived) {
      const catKey = evt.to.dataset.category;
      const cat = state.categories.find((c) => c.key === catKey);
      await api(`/api/images/${id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: catKey, categoryLabel: cat?.label }),
      });
      toast(`Restored to ${cat?.label || catKey}`);
    } else if (!toArchived) {
      await persistBoardOrder();
      toast("Order updated");
    }
  } catch (err) {
    toast(err.message, true);
  }
  await loadState();
}

async function persistBoardOrder() {
  const order = [];
  document.querySelectorAll('.card-list[data-category]').forEach((listEl) => {
    const catKey = listEl.dataset.category;
    const cat = state.categories.find((c) => c.key === catKey);
    listEl.querySelectorAll(".card").forEach((cardEl) => {
      order.push({ id: cardEl.dataset.id, category: catKey, categoryLabel: cat?.label || catKey });
    });
  });
  await api("/api/images/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order }),
  });
}

// ---------- categories ----------

async function renameCategory(key, label) {
  if (!label.trim()) return;
  try {
    await api(`/api/categories/${encodeURIComponent(key)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim() }),
    });
    toast("Gallery renamed");
    await loadState();
  } catch (err) {
    toast(err.message, true);
  }
}

async function moveCategory(key, dir) {
  const keys = state.categories.map((c) => c.key);
  const i = keys.indexOf(key);
  const j = dir === "left" ? i - 1 : i + 1;
  if (j < 0 || j >= keys.length) return;
  [keys[i], keys[j]] = [keys[j], keys[i]];
  try {
    await api("/api/categories/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: keys }),
    });
    await loadState();
  } catch (err) {
    toast(err.message, true);
  }
}

async function deleteCategory(key) {
  if (!confirm("Delete this empty gallery?")) return;
  try {
    await api(`/api/categories/${encodeURIComponent(key)}`, { method: "DELETE" });
    await loadState();
  } catch (err) {
    toast(err.message, true);
  }
}

document.getElementById("new-gallery-btn").addEventListener("click", async () => {
  const label = prompt("Name for the new gallery:");
  if (!label || !label.trim()) return;
  try {
    await api("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim() }),
    });
    await loadState();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- editor drawer ----------

function openEditor(id) {
  const img = state.images.find((i) => i.id === id) || state.archived.find((i) => i.id === id);
  if (!img) return;
  currentEditId = id;
  document.getElementById("ed-thumb").src = `/assets/thumbs/${id}.jpg`;
  document.getElementById("ed-title").value = img.title || "";
  document.getElementById("ed-location").value = img.location || "";
  document.getElementById("ed-story").value = img.story || "";
  document.getElementById("ed-etsy").value = img.etsyUrl || "";
  const cam = img.camera || {};
  document.getElementById("ed-cam-model").value = cam.model || "";
  document.getElementById("ed-cam-lens").value = cam.lens || "";
  document.getElementById("ed-cam-focalLength").value = cam.focalLength || "";
  document.getElementById("ed-cam-aperture").value = cam.aperture || "";
  document.getElementById("ed-cam-shutter").value = cam.shutter || "";
  document.getElementById("ed-cam-iso").value = cam.iso || "";
  document.getElementById("ed-view").href = `http://localhost:8080/photo/${id}.html`;
  document.getElementById("editor").classList.add("open");
}

function closeEditor() {
  document.getElementById("editor").classList.remove("open");
  currentEditId = null;
}
document.getElementById("editor-close").addEventListener("click", closeEditor);

document.getElementById("ed-save").addEventListener("click", async () => {
  if (!currentEditId) return;
  const patch = {
    title: document.getElementById("ed-title").value.trim(),
    location: document.getElementById("ed-location").value.trim(),
    story: document.getElementById("ed-story").value,
    etsyUrl: document.getElementById("ed-etsy").value.trim(),
    camera: {
      model: document.getElementById("ed-cam-model").value.trim() || null,
      lens: document.getElementById("ed-cam-lens").value.trim() || null,
      focalLength: document.getElementById("ed-cam-focalLength").value.trim() || null,
      aperture: document.getElementById("ed-cam-aperture").value.trim() || null,
      shutter: document.getElementById("ed-cam-shutter").value.trim() || null,
      iso: document.getElementById("ed-cam-iso").value.trim() || null,
    },
  };
  try {
    await api(`/api/images/${currentEditId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    toast("Saved");
    closeEditor();
    await loadState();
  } catch (err) {
    toast(err.message, true);
  }
});

document.getElementById("ed-delete").addEventListener("click", async () => {
  if (!currentEditId) return;
  if (!confirm("Archive this photo? It will be hidden from the site but not deleted from disk.")) return;
  try {
    await api(`/api/images/${currentEditId}`, { method: "DELETE" });
    toast("Archived");
    closeEditor();
    await loadState();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- uploads ----------

async function uploadFiles(files, category) {
  const cat = state.categories.find((c) => c.key === category) || state.categories[0];
  let done = 0;
  for (const file of files) {
    if (!/\.(jpe?g)$/i.test(file.name)) {
      toast(`Skipped ${file.name} - only .jpg/.jpeg supported`, true);
      continue;
    }
    try {
      toast(`Uploading ${file.name}… (${++done}/${files.length})`);
      const qs = new URLSearchParams({
        filename: file.name,
        category: cat?.key || "landscapes",
        categoryLabel: cat?.label || "Landscapes",
      });
      await fetch(`/api/images/upload?${qs}`, { method: "POST", body: file });
    } catch (err) {
      toast(`Failed to upload ${file.name}: ${err.message}`, true);
    }
  }
  toast("Upload complete");
  await loadState();
}

document.getElementById("file-input").addEventListener("change", (e) => {
  if (e.target.files.length) uploadFiles(Array.from(e.target.files));
  e.target.value = "";
});

const overlay = document.getElementById("drop-overlay");
let dragCounter = 0;
window.addEventListener("dragenter", (e) => {
  if (!e.dataTransfer.types.includes("Files")) return;
  dragCounter++;
  overlay.classList.add("show");
});
window.addEventListener("dragleave", () => {
  dragCounter = Math.max(0, dragCounter - 1);
  if (dragCounter === 0) overlay.classList.remove("show");
});
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragCounter = 0;
  overlay.classList.remove("show");
  if (e.dataTransfer.files.length) {
    const column = e.target.closest(".column");
    const category = column && !column.classList.contains("archived-column")
      ? column.dataset.category
      : undefined;
    uploadFiles(Array.from(e.dataTransfer.files), category);
  }
});

// ---------- tabs ----------

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.hidden = panel.dataset.tabPanel !== tab;
    });
    document.getElementById("galleries-actions").style.display = tab === "galleries" ? "" : "none";
  });
});

// ---------- home page panel ----------

function updateHeroPreview() {
  const id = document.getElementById("hero-picker").dataset.selected;
  const img = document.getElementById("hero-preview-img");
  const focal = document.getElementById("hero-focal-slider").value;
  img.style.objectPosition = `${focal}% 50%`;
  if (id) img.src = `/assets/display/${id}.jpg`;
}

function renderHomePanel() {
  const logoImg = document.getElementById("logo-preview");
  const hasLogo = state.config.branding && state.config.branding.hasLogo;
  logoImg.src = hasLogo ? `/assets/logo.png?t=${Date.now()}` : "";
  logoImg.style.visibility = hasLogo ? "visible" : "hidden";

  const picker = document.getElementById("hero-picker");
  const homeCfg = state.config.home || {};
  const currentId = homeCfg.heroImageId || (state.images[0] && state.images[0].id) || "";
  picker.dataset.selected = currentId;

  picker.innerHTML = state.images
    .map(
      (img) =>
        `<div class="hero-pick${img.id === currentId ? " selected" : ""}" data-id="${img.id}" title="${esc(img.title)}">
          <img src="/assets/thumbs/${img.id}.jpg" alt="">
        </div>`
    )
    .join("");

  picker.querySelectorAll(".hero-pick").forEach((el) => {
    el.addEventListener("click", () => {
      picker.querySelectorAll(".hero-pick").forEach((e) => e.classList.remove("selected"));
      el.classList.add("selected");
      picker.dataset.selected = el.dataset.id;
      updateHeroPreview();
    });
  });

  document.getElementById("hero-focal-slider").value = homeCfg.heroFocalX ?? 50;
  document.getElementById("home-hero-title").value = homeCfg.heroTitle || "";
  document.getElementById("home-tagline").value = state.config.tagline || "";
  updateHeroPreview();
}

document.getElementById("hero-focal-slider").addEventListener("input", updateHeroPreview);

document.getElementById("home-save").addEventListener("click", async () => {
  const heroImageId = document.getElementById("hero-picker").dataset.selected || "";
  const heroFocalX = Number(document.getElementById("hero-focal-slider").value);
  const heroTitle = document.getElementById("home-hero-title").value.trim();
  const tagline = document.getElementById("home-tagline").value.trim();
  try {
    await api("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ home: { heroImageId, heroFocalX, heroTitle }, tagline }),
    });
    toast("Home page saved");
    await loadState();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- about page panel ----------

function renderAboutPanel() {
  const about = state.config.about || {};
  const photoEl = document.getElementById("about-photo-preview");
  photoEl.src = about.photo ? `/assets/${about.photo}` : "";
  photoEl.style.visibility = about.photo ? "visible" : "hidden";
  document.getElementById("about-body-input").value = about.body || "";
  document.getElementById("about-email-input").value = state.config.contactEmail || "";
}

document.getElementById("about-photo-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    toast("Uploading photo…");
    const qs = new URLSearchParams({ filename: file.name });
    await fetch(`/api/about-photo/upload?${qs}`, { method: "POST", body: file });
    toast("Photo updated");
    await loadState();
  } catch (err) {
    toast(err.message, true);
  }
});

document.getElementById("about-save").addEventListener("click", async () => {
  const body = document.getElementById("about-body-input").value;
  const contactEmail = document.getElementById("about-email-input").value.trim();
  try {
    await api("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ about: { body }, contactEmail }),
    });
    toast("About page saved");
    await loadState();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- logo ----------

document.getElementById("logo-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    toast("Uploading logo…");
    const qs = new URLSearchParams({ filename: file.name });
    await fetch(`/api/logo/upload?${qs}`, { method: "POST", body: file });
    toast("Logo updated");
    await loadState();
  } catch (err) {
    toast(err.message, true);
  }
});

document.getElementById("logo-remove").addEventListener("click", async () => {
  try {
    await api("/api/logo", { method: "DELETE" });
    toast("Logo removed - back to text-only");
    await loadState();
  } catch (err) {
    toast(err.message, true);
  }
});

loadState().catch((err) => toast(err.message, true));
