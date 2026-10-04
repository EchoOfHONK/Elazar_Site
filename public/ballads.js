let content = null;
let activePlaylist = 0;
let activeTrack = 0;
let detailOpen = false;

const $ = (selector) => document.querySelector(selector);
const THEME_KEY = "ayrohant-theme";
const THEMES = new Set(["ember", "arcane", "mono"]);

function escapeAttribute(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
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

function renderSiteMeta(sectionTitle) {
  const siteTitle = content?.site?.title || "AYROHANT";
  document.querySelectorAll(".brand").forEach((node) => {
    node.textContent = siteTitle;
  });
  document.title = `${sectionTitle} | ${siteTitle}`;
}

function playlists() {
  return content.ballads || [];
}

function playlist() {
  return playlists()[activePlaylist] || { tracks: [] };
}

function track() {
  return playlist().tracks?.[activeTrack] || null;
}

function setBalladBackdrop(item) {
  const bg = item?.background || item?.cover || "";
  document.body.style.setProperty("--ballad-bg", bg ? `url("${bg.replaceAll('"', "%22")}")` : "none");
  document.body.style.setProperty("--ballad-accent", item?.accent || "var(--gold)");
}

function renderFeature() {
  const item = playlist();
  const node = $("[data-ballad-feature]");
  if (!node) return;
  setBalladBackdrop(item);
  node.style.setProperty("--ballad-card-bg", item.background ? `url("${item.background.replaceAll('"', "%22")}")` : "none");
  node.innerHTML = `
    <img class="ballad-cover" src="${escapeAttribute(item.cover || "/assets/ballads/red-gates-cover.png")}" alt="${escapeAttribute(item.title)}">
    <div class="ballad-copy">
      <p class="eyebrow">${item.kind === "solo" ? "Соло-трек" : "Плейлист"}</p>
      <h1>${item.title || "Баллада"}</h1>
      <p class="ballad-artist">${item.artist || ""}</p>
      <p>${item.description || ""}</p>
      <div class="hero-actions">
        <button class="button primary" type="button" data-open-playlist>Слушать</button>
      </div>
    </div>
  `;
  node.querySelector("[data-open-playlist]")?.addEventListener("click", openDetail);
}

function renderDetailHead() {
  const item = playlist();
  const node = $("[data-ballad-detail-head]");
  if (!node) return;
  node.innerHTML = `
    <img src="${escapeAttribute(item.cover || "")}" alt="${escapeAttribute(item.title)}">
    <div>
      <p class="eyebrow">${item.kind === "solo" ? "Соло-трек" : "Плейлист"}</p>
      <h2>${item.title || "Баллада"}</h2>
      <p>${item.artist || ""}</p>
    </div>
  `;
}

function filteredTracks() {
  const query = ($("[data-track-search]")?.value || "").trim().toLowerCase();
  const list = playlist().tracks || [];
  if (!query) return list.map((item, index) => ({ item, index }));
  return list
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => `${item.title} ${item.artist}`.toLowerCase().includes(query));
}

function renderTracks() {
  const root = $("[data-track-list]");
  if (!root) return;
  root.innerHTML = "";

  filteredTracks().forEach(({ item, index }) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `track-row${index === activeTrack ? " active" : ""}`;
    row.dataset.trackRow = "";
    row.innerHTML = `
      <img src="${escapeAttribute(item.cover || playlist().cover || "")}" alt="">
      <span>
        <strong>${item.title || "Трек"}</strong>
        <small>${item.artist || playlist().artist || ""}</small>
      </span>
      <em>${item.duration || "0:00"}</em>
    `;
    row.addEventListener("click", () => selectTrack(index, true));
    root.appendChild(row);
  });
}

function openDetail() {
  detailOpen = true;
  $("[data-ballad-detail]").hidden = false;
  activeTrack = Math.min(activeTrack, Math.max((playlist().tracks || []).length - 1, 0));
  renderDetailHead();
  renderTracks();
  selectTrack(activeTrack, false);
  $("[data-ballad-detail]").scrollIntoView({ behavior: "smooth", block: "start" });
}

function movePlaylist(delta) {
  const count = playlists().length;
  if (!count) return;
  activePlaylist = (activePlaylist + delta + count) % count;
  activeTrack = 0;
  renderFeature();
  if (detailOpen) openDetail();
}

function formatTime(value) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function selectTrack(index, autoplay) {
  const tracks = playlist().tracks || [];
  if (!tracks.length) return;
  activeTrack = Math.max(0, Math.min(index, tracks.length - 1));
  const item = track();
  const audio = $("[data-audio]");
  const drawerWasOpen = !$("[data-lyrics-drawer]")?.hidden;
  $("[data-audio-dock]").hidden = false;
  $("[data-dock-cover]").src = item.cover || playlist().cover || "";
  $("[data-dock-title]").textContent = item.title || "Трек";
  $("[data-dock-artist]").textContent = item.artist || playlist().artist || "";
  $("[data-duration]").textContent = item.duration || "0:00";
  $("[data-current-time]").textContent = "0:00";
  $("[data-progress]").value = 0;
  if (item.audio) {
    if (audio.src !== new URL(item.audio, location.href).href) audio.src = item.audio;
    if (autoplay) audio.play().catch(() => {});
  } else {
    audio.removeAttribute("src");
    audio.load();
  }
  renderTracks();
  if (drawerWasOpen) openDrawer(item.title || "Трек", item.text);
}

function moveTrack(delta) {
  const tracks = playlist().tracks || [];
  if (!tracks.length) return;
  selectTrack((activeTrack + delta + tracks.length) % tracks.length, true);
}

function togglePlay() {
  const item = track();
  const audio = $("[data-audio]");
  if (!item?.audio) {
    openDrawer(item?.title || "Трек", item?.text || "Для этого трека ещё не загружен аудиофайл.");
    return;
  }
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

function openDrawer(title, text) {
  const drawer = $("[data-lyrics-drawer]");
  $("[data-drawer-content]").innerHTML = `<p class="eyebrow">Текст</p><h2>${title || "Трек"}</h2><p>${String(text || "Текст пока не добавлен.").replaceAll("\n", "<br>")}</p>`;
  drawer.hidden = false;
}

function initPlayer() {
  const audio = $("[data-audio]");
  $("[data-play-toggle]").addEventListener("click", togglePlay);
  $("[data-track-prev]").addEventListener("click", () => moveTrack(-1));
  $("[data-track-next]").addEventListener("click", () => moveTrack(1));
  $("[data-open-track-text]").addEventListener("click", () => {
    const item = track();
    openDrawer(item?.title || "Трек", item?.text);
  });
  audio.addEventListener("play", () => { $("[data-play-toggle]").textContent = "❚❚"; });
  audio.addEventListener("pause", () => { $("[data-play-toggle]").textContent = "▶"; });
  audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    $("[data-current-time]").textContent = formatTime(audio.currentTime);
    $("[data-duration]").textContent = formatTime(audio.duration);
    $("[data-progress]").value = Math.round((audio.currentTime / audio.duration) * 100);
  });
  $("[data-progress]").addEventListener("input", (event) => {
    if (!audio.duration) return;
    audio.currentTime = (Number(event.target.value) / 100) * audio.duration;
  });
}

async function init() {
  initTheme();
  const response = await fetch("/api/content");
  content = await response.json();
  renderSiteMeta("Баллады");
  renderFeature();
  initPlayer();
  $("[data-ballad-prev]").addEventListener("click", () => movePlaylist(-1));
  $("[data-ballad-next]").addEventListener("click", () => movePlaylist(1));
  $("[data-track-search]").addEventListener("input", renderTracks);
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-drawer]")) $("[data-lyrics-drawer]").hidden = true;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") $("[data-lyrics-drawer]").hidden = true;
  });
}

init().catch((error) => {
  document.body.innerHTML = `<main class="section"><h1>Ошибка загрузки</h1><p>${error.message}</p></main>`;
});
