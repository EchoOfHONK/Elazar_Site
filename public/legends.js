let content = null;
let activeLegend = 0;
let activeEpisode = 0;

const $ = (selector) => document.querySelector(selector);
const THEME_KEY = "ayrohant-theme";
const THEMES = new Set(["ember", "arcane", "mono"]);

function esc(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function applyTheme(theme) {
  const next = THEMES.has(theme) ? theme : "ember";
  document.documentElement.dataset.theme = next;
  document.body.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
  document.querySelectorAll("[data-theme-choice]").forEach((button) => button.classList.toggle("active", button.dataset.themeChoice === next));
}

function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || "ember");
  document.querySelectorAll("[data-theme-choice]").forEach((button) => button.addEventListener("click", () => applyTheme(button.dataset.themeChoice)));
}

function legends() {
  return content?.legends || [];
}

function currentLegend() {
  return legends()[activeLegend] || { episodes: [] };
}

function currentEpisode() {
  return currentLegend().episodes?.[activeEpisode] || null;
}

function formatTime(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return "0:00";
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
}

function renderLegendList() {
  const root = $("[data-legend-list]");
  if (!root) return;
  root.innerHTML = legends().map((item, index) => `
    <button class="legend-card${index === activeLegend ? " active" : ""}" type="button" data-legend-index="${index}">
      ${item.cover ? `<img src="${esc(item.cover)}" alt="">` : "<span class=\"legend-card-placeholder\">С</span>"}
      <span><strong>${esc(item.title || "Сказание")}</strong><small>${(item.episodes || []).length} эпиз.</small></span>
    </button>
  `).join("") || "<p class=\"legend-empty\">Сказаний пока нет. Добавьте первое в админке.</p>";
  root.querySelectorAll("[data-legend-index]").forEach((button) => button.addEventListener("click", () => {
    activeLegend = Number(button.dataset.legendIndex);
    activeEpisode = 0;
    render();
  }));
}

function renderPlayer() {
  const root = $("[data-legend-player]");
  const legend = currentLegend();
  const episode = currentEpisode();
  if (!root) return;
  if (!episode) {
    root.innerHTML = `<div class="legend-empty"><h2>${esc(legend.title || "Сказание")}</h2><p>В этой истории пока нет эпизодов.</p></div>`;
    return;
  }
  const qualities = Array.isArray(episode.qualities) ? episode.qualities.filter((item) => item?.url) : [];
  const selectedSource = episode.video || qualities[0]?.url || "";
  const chapters = Array.isArray(episode.chapters) ? episode.chapters : [];
  root.innerHTML = `
    <div class="legend-player-head"><div><p class="eyebrow">${esc(legend.title || "Сказание")}</p><h2>${esc(episode.title || "Эпизод")}</h2><p>${esc(episode.description || legend.description || "")}</p></div></div>
    <div class="video-frame" data-video-frame>
      ${selectedSource ? `<video playsinline preload="metadata" data-legend-video src="${esc(selectedSource)}"></video>` : `<div class="video-empty"><span>Видео ещё не загружено</span><small>Добавьте mp4 или webm в админке.</small></div>`}
      <div class="video-controls" data-video-controls ${selectedSource ? "" : "hidden"}>
        <button type="button" data-video-play aria-label="Воспроизвести">Play</button>
        <button type="button" data-video-mute aria-label="Звук">Sound</button>
        <span data-video-time>0:00 / 0:00</span>
        <div class="video-timeline"><input type="range" min="0" max="100" value="0" data-video-progress>${chapters.map((chapter) => `<button type="button" class="chapter-marker" style="left:${Number(chapter.start || 0) / Math.max(Number(episode.duration || 1), 1) * 100}%" data-chapter-start="${Number(chapter.start || 0)}" aria-label="${esc(chapter.title || "Глава")}"></button>`).join("")}</div>
        <select aria-label="Качество видео" data-video-quality>${qualities.length ? qualities.map((quality) => `<option value="${esc(quality.url)}" ${quality.url === selectedSource ? "selected" : ""}>${esc(quality.label || "Источник")}</option>`).join("") : "<option>Авто</option>"}</select>
        <select aria-label="Скорость воспроизведения" data-video-speed><option value="0.75">0.75x</option><option value="1" selected>1x</option><option value="1.25">1.25x</option><option value="1.5">1.5x</option><option value="2">2x</option></select>
        <button type="button" data-video-wide aria-label="Широкий экран">Wide</button>
        <button type="button" data-video-fullscreen aria-label="Полный экран">Full</button>
      </div>
    </div>
    <div class="legend-episode-grid">
      <section><h3>Эпизоды</h3><div class="episode-list">${(legend.episodes || []).map((item, index) => `<button class="episode-row${index === activeEpisode ? " active" : ""}" type="button" data-episode-index="${index}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${esc(item.title || "Эпизод")}</strong></button>`).join("")}</div></section>
      <section><h3>Главы</h3><div class="chapter-list">${chapters.length ? chapters.map((chapter) => `<button type="button" data-chapter-start="${Number(chapter.start || 0)}"><span>${formatTime(chapter.start)}</span><strong>${esc(chapter.title || "Глава")}</strong></button>`).join("") : "<p>Главы ещё не размечены.</p>"}</div></section>
    </div>
  `;
  bindPlayer();
}

function bindPlayer() {
  const video = $("[data-legend-video]");
  const frame = $("[data-video-frame]");
  rootButtons("[data-episode-index]", (button) => {
    activeEpisode = Number(button.dataset.episodeIndex);
    render();
  });
  if (!video) return;
  const play = $("[data-video-play]");
  const mute = $("[data-video-mute]");
  const progress = $("[data-video-progress]");
  const time = $("[data-video-time]");
  const update = () => {
    time.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    progress.value = video.duration ? String((video.currentTime / video.duration) * 100) : "0";
  };
  const toggle = () => video.paused ? video.play().catch(() => {}) : video.pause();
  play.addEventListener("click", toggle);
  video.addEventListener("click", toggle);
  video.addEventListener("play", () => { play.textContent = "Pause"; });
  video.addEventListener("pause", () => { play.textContent = "Play"; });
  video.addEventListener("timeupdate", update);
  video.addEventListener("loadedmetadata", update);
  mute.addEventListener("click", () => { video.muted = !video.muted; mute.textContent = video.muted ? "Muted" : "Sound"; });
  progress.addEventListener("input", () => { if (video.duration) video.currentTime = video.duration * Number(progress.value) / 100; });
  $("[data-video-speed]").addEventListener("change", (event) => { video.playbackRate = Number(event.target.value); });
  $("[data-video-quality]").addEventListener("change", (event) => {
    const at = video.currentTime;
    const wasPlaying = !video.paused;
    video.src = event.target.value;
    video.addEventListener("loadedmetadata", () => { video.currentTime = at; if (wasPlaying) video.play().catch(() => {}); }, { once: true });
  });
  $("[data-video-wide]").addEventListener("click", () => frame.classList.toggle("wide"));
  $("[data-video-fullscreen]").addEventListener("click", () => frame.requestFullscreen?.());
  rootButtons("[data-chapter-start]", (button) => { video.currentTime = Number(button.dataset.chapterStart || 0); video.play().catch(() => {}); });
  document.onkeydown = (event) => {
    if (event.code === "Space" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) { event.preventDefault(); toggle(); }
  };
}

function rootButtons(selector, callback) {
  document.querySelectorAll(selector).forEach((button) => button.addEventListener("click", () => callback(button)));
}

function render() {
  renderLegendList();
  renderPlayer();
}

async function init() {
  initTheme();
  const response = await fetch("/api/content");
  content = await response.json();
  document.querySelectorAll("[data-site-title]").forEach((node) => { node.textContent = content.site?.title || "AYROHANT"; });
  document.title = `Сказания | ${content.site?.title || "AYROHANT"}`;
  render();
}

init().catch((error) => { document.body.innerHTML = `<main class="section"><h1>Ошибка загрузки</h1><p>${esc(error.message)}</p></main>`; });
