let content = null;

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
    ? `<img loading="lazy" src="${escapeAttribute(entity.image)}" alt="${title}">`
    : `<div class="${kind === "location" ? "location-rune" : "sigil"}">${escapeAttribute(fallback)}</div>`;
  return `<button class="avatar-button" type="button"${src} data-lightbox-title="${title}" data-lightbox-fallback="${escapeAttribute(fallback)}">${inner}</button>`;
}

function renderCharactersLegacy() {
  const grid = $("[data-characters]");
  if (!grid) return;
  grid.innerHTML = "";

  content.characters.forEach((character) => {
    const card = document.createElement("article");
    card.className = "character-card wiki-card";
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

function renderLocationsLegacy() {
  const grid = $("[data-locations]");
  if (!grid) return;
  grid.innerHTML = "";

  content.locations.forEach((location) => {
    const card = document.createElement("article");
    card.className = "location-card";
    const image = renderAvatarButton(location, "location");
    card.innerHTML = `
      ${image}
      <div>
        <p class="eyebrow">${location.type || "Локация"} / X ${location.x ?? 0}% / Y ${location.y ?? 0}%</p>
        <h3>${location.name}</h3>
        <p>${location.description}</p>
      </div>
    `;
    grid.appendChild(card);
  });
}

function initTabs() {
  document.querySelectorAll("[data-wiki-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.wikiTab;
      document.querySelectorAll("[data-wiki-tab]").forEach((nextButton) => {
        nextButton.className = nextButton === button ? "button primary" : "button ghost";
      });
      document.querySelectorAll("[data-wiki-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.wikiPanel !== tab;
      });
    });
  });
}

async function init() {
  initTheme();
  initLightbox();
  initTabs();
  const response = await fetch("/api/content");
  content = await response.json();
  renderSiteMeta("Некрономикон");
  renderCharacters();
  renderLocations();
  window.addEventListener('hashchange', renderArticle);
  renderArticle();
}

function renderDirectory(kind) {
  const root = document.querySelector(kind === 'characters' ? '[data-characters]' : '[data-locations]');
  root.innerHTML = '';
  (content[kind] || []).forEach(item => {
    const card = document.createElement('a');
    card.className = 'wiki-entry';
    card.href = `#${kind}/${encodeURIComponent(item.id)}`;
    const image = item.image ? `<img src="${escapeAttribute(item.image)}" alt="" loading="lazy">` : '<span class="wiki-initial">' + escapeAttribute(item.name?.slice(0,1)) + '</span>';
    card.innerHTML = `${image}<div><small>${escapeAttribute(item.role || item.type || '')}</small><h3>${escapeAttribute(item.name)}</h3><p>${escapeAttribute(item.description)}</p><span class="wiki-read">Читать статью →</span></div>`;
    root.appendChild(card);
  });
}
function renderCharacters() { renderDirectory('characters'); }
function renderLocations() { renderDirectory('locations'); }
function renderArticle() {
  let article = document.querySelector('.wiki-article');
  if (!article) {
    article = document.createElement('article');
    article.className = 'wiki-article';
    document.querySelector('.wiki-main').appendChild(article);
  }
  const [kind, encoded] = location.hash.slice(1).split('/');
  let id = '';
  try { id = decodeURIComponent(encoded || ''); } catch {}
  const item = ['characters','locations'].includes(kind) ? content[kind].find(x => x.id === id) : null;
  article.hidden = !item;
  document.querySelectorAll('[data-wiki-panel]').forEach(panel => {
    panel.hidden = !!item || panel.dataset.wikiPanel !== (kind === 'locations' ? 'locations' : 'characters');
  });
  document.querySelectorAll('[data-wiki-tab]').forEach(button => {
    const selected = button.dataset.wikiTab === (kind === 'locations' ? 'locations' : 'characters');
    button.className = selected ? 'button primary' : 'button ghost';
    button.onclick = () => { location.hash = button.dataset.wikiTab; };
  });
  if (!item) { article.innerHTML = ''; return; }
  const paragraphs = (item.details || item.description || '').split(/\n\s*\n/).filter(Boolean);
  article.innerHTML = `<a class="wiki-back" href="#${kind}">← ${kind === 'characters' ? 'Все персонажи' : 'Все локации'}</a><div class="wiki-article-layout"><aside>${renderAvatarButton(item,kind === 'characters' ? 'character' : 'location')}<dl><dt>${kind === 'characters' ? 'Роль' : 'Тип'}</dt><dd>${escapeAttribute(item.role || item.type || 'Не указано')}</dd>${item.faction ? `<dt>Принадлежность</dt><dd>${escapeAttribute(item.faction)}</dd>` : ''}</dl></aside><div><p class="eyebrow">Некрономикон</p><h1 tabindex="-1">${escapeAttribute(item.name)}</h1><p class="wiki-lead">${escapeAttribute(item.description)}</p><h2>История</h2>${paragraphs.map(p=>`<p class="wiki-prose">${escapeAttribute(p)}</p>`).join('')}</div></div>`;
  article.querySelector('h1').focus({preventScroll:true});
  article.scrollIntoView({behavior:'instant',block:'start'});
}

init().catch((error) => {
  document.body.innerHTML = `<main class="section"><h1>Ошибка загрузки</h1><p>${error.message}</p></main>`;
});
