let content = null;
let activeVolume = 0;
let activeChapter = 0;
let activePage = 0;

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

function renderControls() {
  const volumeSelect = $("[data-volume-select]");
  const chapterSelect = $("[data-chapter-select]");
  if (!volumeSelect || !chapterSelect) return;
  volumeSelect.innerHTML = "";
  chapterSelect.innerHTML = "";

  content.volumes.forEach((volume, index) => volumeSelect.add(new Option(volume.title, String(index))));
  volumeSelect.value = String(activeVolume);

  const volume = content.volumes[activeVolume] || { chapters: [] };
  volume.chapters.forEach((chapter, index) => chapterSelect.add(new Option(chapter.title, String(index))));
  chapterSelect.value = String(activeChapter);
  chapterSelect.disabled = !volume.chapters.length;

  volumeSelect.onchange = () => {
    activeVolume = Number(volumeSelect.value);
    activeChapter = 0;
    activePage = 0;
    renderReader();
  };

  chapterSelect.onchange = () => {
    activeChapter = Number(chapterSelect.value);
    activePage = 0;
    renderReader();
  };
}

function getCurrentPages() {
  return content.volumes[activeVolume]?.chapters[activeChapter]?.pages || [];
}

function renderPageStrip() {
  const strip = $("[data-page-strip]");
  if (!strip) return;
  const pages = getCurrentPages();
  strip.innerHTML = "";

  pages.forEach((page, index) => {
    const button = document.createElement("button");
    button.className = `page-chip${index === activePage ? " active" : ""}`;
    button.type = "button";
    button.textContent = String(index + 1).padStart(2, "0");
    button.title = page.title;
    button.addEventListener("click", () => {
      activePage = index;
      renderReaderPage();
      renderPageStrip();
    });
    strip.appendChild(button);
  });
}

function renderReaderPage() {
  const volume = content.volumes[activeVolume];
  const chapter = volume?.chapters[activeChapter];
  const pages = getCurrentPages();
  const page = pages[activePage];
  const stage = $("[data-page-stage]");
  const count = $("[data-page-count]");
  const meta = $("[data-chapter-meta]");
  if (!stage || !count || !meta) return;

  meta.innerHTML = chapter
    ? `<strong>${chapter.title}</strong><span>${chapter.description || volume.description || ""}</span>`
    : "<strong>Глав пока нет</strong><span>Добавьте главы и страницы в админке.</span>";

  count.textContent = pages.length ? `${activePage + 1} / ${pages.length}` : "0 / 0";
  stage.innerHTML = "";

  if (!page) {
    stage.innerHTML = "<div class=\"empty-page\">В этой главе пока нет страниц.</div>";
    return;
  }

  if (page.image) {
    const figure = document.createElement("figure");
    figure.className = "manga-page";
    figure.innerHTML = `<img src="${page.image}" alt="${page.title}"><figcaption>${page.title}</figcaption>`;
    stage.appendChild(figure);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "manga-placeholder";
    placeholder.innerHTML = `
      <div>
        <div class="page-mark" aria-hidden="true"></div>
        <span>${page.title}</span>
        <p>${page.text || "Сцена ещё в раскадровке. Загрузите изображение страницы в админке."}</p>
      </div>
    `;
    stage.appendChild(placeholder);
  }
}

function renderReader() {
  renderControls();
  renderReaderPage();
  renderPageStrip();
}

function movePage(delta) {
  const pages = getCurrentPages();
  activePage = Math.min(Math.max(activePage + delta, 0), Math.max(pages.length - 1, 0));
  renderReaderPage();
  renderPageStrip();
}

async function init() {
  initTheme();
  const response = await fetch("/api/content");
  content = await response.json();
  renderSiteMeta("Читалка");
  renderReader();

  $("[data-page-prev]").addEventListener("click", () => movePage(-1));
  $("[data-page-next]").addEventListener("click", () => movePage(1));
  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") movePage(-1);
    if (event.key === "ArrowRight") movePage(1);
  });
}

init().catch((error) => {
  document.body.innerHTML = `<main class="section"><h1>Ошибка загрузки</h1><p>${error.message}</p></main>`;
});
