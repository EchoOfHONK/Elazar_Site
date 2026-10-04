let content = null;

const $ = (selector) => document.querySelector(selector);
const THEME_KEY = "ayrohant-theme";
const THEMES = new Set(["ember", "arcane", "mono"]);

function setText(selector, value) {
  const node = $(selector);
  if (node) node.textContent = value || "";
}

function createElement(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

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

function escapeAttribute(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
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

function renderAvatarButton(entity, kind) {
  const fallback = (entity.name || kind || "?").slice(0, 1);
  const title = escapeAttribute(entity.name);
  const src = entity.image ? ` data-lightbox-src="${escapeAttribute(entity.image)}"` : "";
  const inner = entity.image
    ? `<img src="${escapeAttribute(entity.image)}" alt="${title}">`
    : `<div class="${kind === "location" ? "location-rune" : "sigil"}">${escapeAttribute(fallback)}</div>`;
  return `<button class="avatar-button" type="button"${src} data-lightbox-title="${title}" data-lightbox-fallback="${escapeAttribute(fallback)}">${inner}</button>`;
}

function renderSiteInfo() {
  const heroImage = content.site.heroImage || '/assets/cinema-hero.png';
  document.querySelector('.hero-media')?.style.setProperty('--hero-image', `url(${JSON.stringify(heroImage)})`);
  document.title = `${content.site.title} | ${content.site.subtitle}`;
  setText("[data-site-title]", content.site.title);
  setText("[data-site-subtitle]", content.site.subtitle);
  setText("[data-site-subtitle-copy]", content.site.subtitle);
  setText("[data-site-tagline]", content.site.tagline);
  setText("[data-site-hero-title]", content.site.heroTitle);
  setText("[data-site-hero-text]", String(content.site.heroText || '').replace(/Манга,\s*/gi, ''));
  setText("[data-footer]", content.site.footer);
}

function renderNews() {
  const grid = $("[data-news]");
  if (!grid) return;
  grid.innerHTML = "";

  content.news.filter(item => !/reader|манг/i.test(`${item.url} ${item.title} ${item.text}`)).forEach((item) => {
    const card = createElement("article", "content-card");
    const media = item.mediaUrl
      ? item.mediaType === "video"
        ? `<video class="news-media" controls preload="metadata" src="${escapeAttribute(item.mediaUrl)}"></video>`
        : `<button class="news-media image" type="button" data-lightbox-title="${escapeAttribute(item.title)}" data-lightbox-src="${escapeAttribute(item.mediaUrl)}"><img src="${escapeAttribute(item.mediaUrl)}" alt="${escapeAttribute(item.title)}"></button>`
      : "";
    card.innerHTML = `
      ${media}
      <h3>${item.title}</h3>
      <p>${item.text}</p>
      <a class="button primary small" href="${item.url || "#"}">${item.button || "Открыть"}</a>
    `;
    grid.appendChild(card);
  });
}

function renderMap(selectedId) {
  const map = $("[data-map]");
  const info = $("[data-map-info]");
  if (!map || !info) return;
  map.innerHTML = "";

  const active = content.locations.find((location) => location.id === selectedId) || content.locations[0];
  content.locations.forEach((location) => {
    const pin = document.createElement("button");
    pin.className = `map-pin${active?.id === location.id ? " active" : ""}`;
    pin.type = "button";
    pin.style.left = `${location.x}%`;
    pin.style.top = `${location.y}%`;
    pin.title = location.name;
    pin.innerHTML = "<span></span>";
    pin.addEventListener("click", () => renderMap(location.id));
    map.appendChild(pin);
  });

  if (active) {
    const image = active.image ? renderAvatarButton(active, "location") : "";
    info.innerHTML = `
      ${image}
      <p class="eyebrow">${active.type}</p>
      <h3>${active.name}</h3>
      <p>${active.description}</p>
      <a class="button ghost small" href="/wiki.html">Открыть вики</a>
    `;
  }
}

function renderCharacters() {
  const grid = $("[data-characters]");
  if (!grid) return;
  grid.innerHTML = "";

  content.characters.slice(0, 3).forEach((character) => {
    const card = createElement("article", "character-card");
    const portrait = renderAvatarButton(character, "character");
    card.innerHTML = `
      ${portrait}
      <div>
        <p class="eyebrow">${character.role} / ${character.faction}</p>
        <h3>${character.name}</h3>
        <p>${character.description}</p>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderSocials() {
  const list = $("[data-socials]");
  if (!list) return;
  list.innerHTML = "";

  content.socials.forEach((social) => {
    const link = document.createElement("a");
    link.className = "source-link";
    link.href = social.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.innerHTML = `<strong>${social.label}</strong><span>${social.kind}</span>`;
    list.appendChild(link);
  });
}

function renderTwitch() {
  const channel = content.twitch.channel || "twitch";
  const host = location.hostname || "localhost";
  const frame = $("[data-twitch-frame]");
  const link = $("[data-twitch-link]");
  if (!frame || !link) return;

  setText("[data-twitch-title]", content.twitch.title);
  setText("[data-twitch-note]", content.twitch.note);
  frame.src = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(host)}`;
  link.href = `https://www.twitch.tv/${encodeURIComponent(channel)}`;
}

async function init() {
  initTheme();
  initLightbox();
  const response = await fetch("/api/content");
  content = await response.json();

  renderSiteInfo();
  renderNews();
  renderMap();
  renderCharacters();
  renderSocials();
  renderTwitch();

}

init().catch((error) => {
  document.body.innerHTML = `<main class="section"><h1>Ошибка загрузки</h1><p>${error.message}</p></main>`;
});
