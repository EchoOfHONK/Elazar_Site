let content = null;
let activeLocationId = null;
let mapPins = new Map();
if (new URLSearchParams(location.search).has('embed')) document.body.classList.add('map-embedded');

const $ = (selector) => document.querySelector(selector);
const THEME_KEY = "ayrohant-theme";
const THEMES = new Set(["ember", "arcane", "mono"]);

function applyTheme(theme) {
  const nextTheme = THEMES.has(theme) ? theme : "ember";
  document.documentElement.dataset.theme = nextTheme;
  document.body.dataset.theme = nextTheme;
  localStorage.setItem(THEME_KEY, nextTheme);
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.classList.toggle("active", button.dataset.themeChoice === nextTheme);
  });
}

function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || "ember");
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.addEventListener("click", () => applyTheme(button.dataset.themeChoice));
  });
}

function renderSiteMeta(sectionTitle) {
  const siteTitle = content?.site?.title || "AYROHANT";
  document.querySelectorAll(".brand").forEach((node) => {
    node.textContent = siteTitle;
  });
  document.title = `${sectionTitle} | ${siteTitle}`;
}

function escapeAttribute(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function renderAvatarButton(entity) {
  const fallback = (entity.name || "?").slice(0, 1);
  const src = entity.image ? ` data-lightbox-src="${escapeAttribute(entity.image)}"` : "";
  const inner = entity.image
    ? `<img class="location-image" loading="lazy" src="${escapeAttribute(entity.image)}" alt="${escapeAttribute(entity.name)}">`
    : `<div class="location-rune">${escapeAttribute(fallback)}</div>`;
  return `<button class="avatar-button" type="button"${src} data-lightbox-title="${escapeAttribute(entity.name)}" data-lightbox-fallback="${escapeAttribute(fallback)}">${inner}</button>`;
}

function renderInfo() {
  const info = $("[data-map-info]");
  if (!info) return;

  const active = content.locations.find((location) => location.id === activeLocationId) || content.locations[0];
  activeLocationId = active?.id || null;

  if (!active) {
    info.innerHTML = "<p>Локации пока не добавлены.</p>";
    return;
  }

  info.innerHTML = `
    ${renderAvatarButton(active)}
    <p class="eyebrow">${active.type || "Локация"}</p>
    <h3>${active.name}</h3>
    <p>${active.description}</p>
    <a class="button ghost small" href="/wiki.html#locations/${encodeURIComponent(active.id)}" target="_top">Читать о месте</a>
  `;
}

function setActiveLocation(id) {
  activeLocationId = id;
  mapPins.forEach((pin, pinId) => {
    pin.classList.toggle("active", pinId === activeLocationId);
  });
  renderInfo();
}

function renderMap() {
  const map = $("[data-map]");
  if (!map) return;
  const mapImage = content.map?.image || '/assets/test-world-map.png';
  const probe = new Image();
  probe.onload = () => { map.dataset.aspect = probe.naturalWidth / probe.naturalHeight; map.dispatchEvent(new Event('map-image-ready')); };
  probe.src = mapImage;
  map.classList.toggle("has-map-image", Boolean(mapImage));
  if (mapImage) {
    map.style.setProperty("--map-bg-image", `url("${mapImage.replaceAll('"', "%22")}")`);
  } else {
    map.style.removeProperty("--map-bg-image");
  }

  const active = content.locations.find((location) => location.id === activeLocationId) || content.locations[0];
  activeLocationId = active?.id || null;
  map.innerHTML = "";
  mapPins = new Map();

  content.locations.forEach((location) => {
    const pin = document.createElement("button");
    pin.className = `map-pin${activeLocationId === location.id ? " active" : ""}`;
    pin.type = "button";
    pin.style.left = `${location.x}%`;
    pin.style.top = `${location.y}%`;
    pin.title = location.name;
    pin.innerHTML = "<span></span>";
    const label = document.createElement('small');
    label.className = 'map-pin-label';
    label.textContent = location.name;
    pin.append(label);
    pin.setAttribute('aria-label', location.name);
    pin.addEventListener("click", () => setActiveLocation(location.id));
    mapPins.set(location.id, pin);
    map.appendChild(pin);
  });

  renderInfo();
}

function initZoom() {
  const map = $("[data-map]");
  const zoom = $("[data-map-zoom]");
  if (!map || !zoom) return;

  const viewport = map.parentElement;
  const output = document.createElement('output');
  output.setAttribute('aria-live','polite');
  zoom.after(output);
  let previousWidth = 0, previousHeight = 0, previousTop = 0;
  const applyZoom = () => {
    const cx = previousWidth ? (viewport.scrollLeft + viewport.clientWidth / 2 - Math.max(0,(viewport.clientWidth-previousWidth)/2)) / previousWidth : .5;
    const cy = previousHeight ? (viewport.scrollTop + viewport.clientHeight / 2 - previousTop) / previousHeight : .5;
    const aspect = Number(map.dataset.aspect) || 1.5;
    const width = Math.min(viewport.clientWidth, viewport.clientHeight * aspect) * Number(zoom.value) / 100;
    const height = width / aspect;
    const top = Math.max(0,(viewport.clientHeight-height)/2);
    map.style.width = width + 'px';
    map.style.height = height + 'px';
    map.style.minHeight = '0';
    map.style.marginTop = top + 'px';
    viewport.scrollLeft = cx * width - viewport.clientWidth / 2;
    viewport.scrollTop = cy * height + top - viewport.clientHeight / 2;
    previousWidth = width; previousHeight = height; previousTop = top;
    output.textContent = zoom.value + '%';
  };

  let frame = 0;
  zoom.addEventListener("input", () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(applyZoom);
  });
  applyZoom();
  map.addEventListener('map-image-ready',applyZoom);
  viewport.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('button')) return;
    const x = event.clientX, y = event.clientY, left = viewport.scrollLeft, top = viewport.scrollTop;
    viewport.setPointerCapture(event.pointerId);
    const move = e => { viewport.scrollLeft = left + x - e.clientX; viewport.scrollTop = top + y - e.clientY; };
    const stop = () => { viewport.removeEventListener('pointermove',move); viewport.removeEventListener('pointerup',stop); viewport.removeEventListener('pointercancel',stop); };
    viewport.addEventListener('pointermove',move);
    viewport.addEventListener('pointerup',stop);
    viewport.addEventListener('pointercancel',stop);
  });
  new ResizeObserver(applyZoom).observe(map.parentElement);
}

function initExpand() {
  const shell = $('[data-map-shell]');
  const button = $('[data-map-expand]');
  shell.appendChild(document.querySelector('.zoom-control'));
  const sync = () => {
    const expanded = document.fullscreenElement === shell || shell.classList.contains('map-expanded');
    button.setAttribute('aria-label', expanded ? 'Свернуть карту' : 'Развернуть карту');
    button.title = button.getAttribute('aria-label');
    button.innerHTML = `<i data-lucide="${expanded ? 'minimize' : 'maximize'}"></i>`;
    window.lucide?.createIcons();
  };
  button.addEventListener('click', async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (shell.classList.contains('map-expanded')) shell.classList.remove('map-expanded');
    else {
      try { await shell.requestFullscreen(); }
      catch {
        if (document.body.classList.contains('map-embedded')) { window.open('/map.html', '_blank', 'noopener'); return; }
        shell.classList.add('map-expanded');
      }
    }
    sync();
  });
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { shell.classList.remove('map-expanded'); sync(); }
  });
  window.addEventListener('storage', event => { if (event.key === THEME_KEY) applyTheme(event.newValue); });
}

function openLightbox(src, title, fallback) {
  const overlay = document.createElement("button");
  overlay.className = "image-lightbox";
  overlay.type = "button";
  const media = src
    ? `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(title)}">`
    : `<span class="lightbox-sigil">${escapeAttribute(fallback || "?")}</span>`;
  overlay.innerHTML = `
    <span class="lightbox-card">
      ${media}
      <span>${title || "Изображение"}</span>
    </span>
  `;
  overlay.addEventListener("click", () => overlay.remove());
  document.body.appendChild(overlay);
}

function initLightbox() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-lightbox-title]");
    if (!button) return;
    openLightbox(button.dataset.lightboxSrc, button.dataset.lightboxTitle, button.dataset.lightboxFallback);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") document.querySelector(".image-lightbox")?.remove();
  });
}

async function init() {
  initTheme();
  initLightbox();
  initZoom();
  initExpand();
  const response = await fetch("/api/content");
  content = await response.json();
  renderSiteMeta("Карта");
  renderMap();
}

init().catch((error) => {
  document.body.innerHTML = `<main class="section"><h1>Ошибка загрузки</h1><p>${error.message}</p></main>`;
});
