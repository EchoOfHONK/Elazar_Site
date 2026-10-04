let content = null;
let adminLogin = "";
let adminToken = "";
let activeSection = "site";
let activeLocationIndex = 0;
let normalizedHomeFor = null;

const $ = (selector) => document.querySelector(selector);
const THEME_KEY = "ayrohant-theme";
const THEMES = new Set(["ember", "arcane", "mono"]);

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
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

function encodeToken(value) {
  const bytes = new TextEncoder().encode(value || "");
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function adminHeaders(extra = {}) {
  return {
    ...extra,
    "X-Admin-Login-B64": encodeToken(adminLogin),
    "X-Admin-Token-B64": encodeToken(adminToken),
  };
}

function setStatus(message, mode = "") {
  const node = $("[data-admin-status]");
  node.textContent = message;
  node.className = `admin-status ${mode}`;
}

function field(label, object, key, type = "text", help = "", afterChange = null) {
  const wrapper = document.createElement("label");
  if (type === "textarea") wrapper.classList.add("textarea-field");
  wrapper.innerHTML = `<span>${label}</span>`;

  const input = type === "textarea" ? document.createElement("textarea") : document.createElement("input");
  if (type !== "textarea") input.type = type;
  input.value = object[key] ?? "";
  input.addEventListener("input", () => {
    object[key] = type === "number" ? Number(input.value) : input.value;
    if (typeof afterChange === "function") afterChange(object[key]);
  });
  wrapper.appendChild(input);

  if (help) {
    const hint = document.createElement("small");
    hint.className = "field-help";
    hint.textContent = help;
    wrapper.appendChild(hint);
  }
  return wrapper;
}

function addFields(root, object, fields) {
  fields.forEach((item) => {
    const [, target, key] = item;
    if (Array.isArray(target?.tracks) && (key === "tags" || key === "text")) return;
    if (Array.isArray(target?.tracks) && key === "cover" && typeof item[5] !== "function") {
      const nextItem = item.slice();
      while (nextItem.length < 5) nextItem.push(undefined);
      nextItem[5] = (url) => syncPlaylistTrackCovers(target, url);
      root.appendChild(field(...nextItem));
      return;
    }
    root.appendChild(field(...item));
  });
}

function selectField(label, object, key, options, help = "") {
  const wrapper = document.createElement("label");
  const caption = document.createElement("span");
  caption.textContent = label;
  const select = document.createElement("select");
  options.forEach((option) => {
    const [value, text] = Array.isArray(option) ? option : [option, option];
    const node = document.createElement("option");
    node.value = value;
    node.textContent = text;
    select.appendChild(node);
  });
  select.value = object[key];
  select.addEventListener("change", () => {
    object[key] = select.value;
    markDirty();
  });
  wrapper.append(caption, select);
  if (help) {
    const hint = document.createElement("small");
    hint.className = "field-help";
    hint.textContent = help;
    wrapper.appendChild(hint);
  }
  return wrapper;
}

function checkboxField(label, object, key) {
  const wrapper = document.createElement("label");
  wrapper.className = "home-checkbox-field";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = object[key] !== false;
  input.addEventListener("change", () => {
    object[key] = input.checked;
    markDirty();
  });
  const caption = document.createElement("span");
  caption.textContent = label;
  wrapper.append(input, caption);
  return wrapper;
}

function percentageField(label, object, key, help = "") {
  const wrapper = field(label, object, key, "number", help);
  const input = wrapper.querySelector("input");
  input.min = "0";
  input.max = "100";
  input.step = "1";
  input.addEventListener("input", () => {
    const value = Math.max(0, Math.min(100, Number(input.value) || 0));
    object[key] = value;
    if (input.value !== "") input.value = String(value);
  });
  return wrapper;
}

function homeSettingsGroup(root, title, open = false) {
  const details = document.createElement("details");
  details.className = "home-settings-group";
  details.dataset.homeGroup = title;
  details.open = open;
  const summary = document.createElement("summary");
  summary.textContent = title;
  const fields = document.createElement("div");
  fields.className = "form-grid";
  details.append(summary, fields);
  root.appendChild(details);
  return fields;
}

function button(label, onClick, className = "button ghost") {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.textContent = label;
  node.addEventListener("click", onClick);
  return node;
}

function actions(...buttons) {
  const row = document.createElement("div");
  row.className = "admin-actions";
  buttons.forEach((node) => row.appendChild(node));
  return row;
}

function header(title, meta = "") {
  const node = document.createElement("div");
  node.className = "edit-card-header";
  node.innerHTML = `<strong>${title}</strong><span>${meta}</span>`;
  return node;
}

function card(title, meta = "") {
  const node = document.createElement("div");
  node.className = "edit-card";
  node.appendChild(header(title, meta));
  return node;
}

function moveItem(list, index, delta) {
  const next = index + delta;
  if (next < 0 || next >= list.length) return;
  const [item] = list.splice(index, 1);
  list.splice(next, 0, item);
  renderAll();
}

async function uploadImage(file) {
  if (!file) return "";
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/upload", {
    method: "POST",
    headers: adminHeaders(),
    body: form,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Не удалось загрузить изображение");
  return result.url;
}

function uploadField(label, object, key, accept = "image/png,image/jpeg,image/webp,image/gif") {
  const wrapper = document.createElement("label");
  wrapper.className = "upload-field";
  wrapper.innerHTML = `<span>${label}</span>`;

  if (object[key] && accept.includes("image") && !/\.(mp4|webm)(?:[?#]|$)/i.test(object[key])) {
    const img = document.createElement("img");
    img.className = "admin-image-preview";
    img.src = object[key];
    img.alt = label;
    wrapper.appendChild(img);
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.addEventListener("change", async () => {
    try {
      setStatus("Загружаю изображение...");
      const pickedFile = input.files[0];
      if (!pickedFile) return;
      const cropOptions = getUploadCropOptions(label, object, key, accept);
      const preparedFile = pickedFile.type.startsWith("image/") && cropOptions.crop !== false
        ? await openImageCropper(pickedFile, cropOptions)
        : pickedFile;
      object[key] = await uploadImage(preparedFile);
      if (typeof cropOptions.afterUpload === "function") cropOptions.afterUpload(object[key]);
      setStatus("Изображение загружено. Не забудьте сохранить изменения.", "ok");
      renderAll();
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
  wrapper.appendChild(input);
  return wrapper;
}

function loadCropImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось открыть изображение."));
    };
    img.src = url;
  });
}

async function openImageCropper(file, options = {}) {
  const { img, url } = await loadCropImage(file);
  const aspect = options.cropAspect || 1;
  const outputWidth = options.cropWidth || 1000;
  const outputHeight = options.cropHeight || Math.round(outputWidth / aspect);

  return new Promise((resolve, reject) => {
    let offsetX = 0;
    let offsetY = 0;
    let zoom = 1;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startOffsetX = 0;
    let startOffsetY = 0;

    const modal = document.createElement("div");
    modal.className = "crop-modal";
    modal.innerHTML = `
      <div class="crop-dialog" role="dialog" aria-modal="true">
        <div class="crop-head">
          <div>
            <p class="eyebrow">Кадрирование</p>
            <h2>${options.cropTitle || "Выберите область"}</h2>
          </div>
          <button class="drawer-close" type="button" data-crop-cancel aria-label="Закрыть">×</button>
        </div>
        <div class="crop-stage" style="aspect-ratio: ${aspect}">
          <img alt="">
          <div class="crop-frame" aria-hidden="true"></div>
        </div>
        <label class="crop-zoom">
          <span>Масштаб</span>
          <input type="range" min="1" max="3" value="1" step="0.01">
        </label>
        <div class="admin-actions">
          <button class="button primary" type="button" data-crop-apply>Применить</button>
          <button class="button ghost" type="button" data-crop-cancel>Отмена</button>
        </div>
      </div>
    `;

    const stage = modal.querySelector(".crop-stage");
    const preview = modal.querySelector(".crop-stage img");
    const zoomInput = modal.querySelector(".crop-zoom input");
    preview.src = url;

    const clampOffsets = () => {
      const rect = stage.getBoundingClientRect();
      const baseScale = Math.max(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
      const displayWidth = img.naturalWidth * baseScale * zoom;
      const displayHeight = img.naturalHeight * baseScale * zoom;
      const maxX = Math.max(0, (displayWidth - rect.width) / 2);
      const maxY = Math.max(0, (displayHeight - rect.height) / 2);
      offsetX = Math.max(-maxX, Math.min(maxX, offsetX));
      offsetY = Math.max(-maxY, Math.min(maxY, offsetY));
    };

    const render = () => {
      const rect = stage.getBoundingClientRect();
      const baseScale = Math.max(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
      preview.style.width = `${img.naturalWidth * baseScale}px`;
      preview.style.height = `${img.naturalHeight * baseScale}px`;
      clampOffsets();
      preview.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) scale(${zoom})`;
    };

    const close = () => {
      URL.revokeObjectURL(url);
      modal.remove();
    };

    stage.addEventListener("pointerdown", (event) => {
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      startOffsetX = offsetX;
      startOffsetY = offsetY;
      stage.setPointerCapture(event.pointerId);
    });

    stage.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      offsetX = startOffsetX + event.clientX - startX;
      offsetY = startOffsetY + event.clientY - startY;
      render();
    });

    stage.addEventListener("pointerup", () => {
      dragging = false;
    });

    zoomInput.addEventListener("input", () => {
      zoom = Number(zoomInput.value);
      render();
    });

    modal.querySelectorAll("[data-crop-cancel]").forEach((node) => {
      node.addEventListener("click", () => {
        close();
        reject(new Error("__crop_cancelled__"));
      });
    });

    modal.querySelector("[data-crop-apply]").addEventListener("click", () => {
      const rect = stage.getBoundingClientRect();
      const baseScale = Math.max(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
      const scale = baseScale * zoom;
      const displayWidth = img.naturalWidth * scale;
      const displayHeight = img.naturalHeight * scale;
      const imageLeft = rect.width / 2 + offsetX - displayWidth / 2;
      const imageTop = rect.height / 2 + offsetY - displayHeight / 2;
      const sourceX = Math.max(0, -imageLeft / scale);
      const sourceY = Math.max(0, -imageTop / scale);
      const sourceWidth = Math.min(img.naturalWidth - sourceX, rect.width / scale);
      const sourceHeight = Math.min(img.naturalHeight - sourceY, rect.height / scale);
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      context.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
      canvas.toBlob((blob) => {
        close();
        if (!blob) {
          reject(new Error("Не удалось подготовить изображение."));
          return;
        }
        resolve(new File([blob], `${(file.name || "image").replace(/\.[^.]+$/, "")}-crop.png`, { type: "image/png" }));
      }, "image/png", 0.92);
    });

    document.body.appendChild(modal);
    requestAnimationFrame(render);
  });
}

function uploadCroppedField(label, object, key, options = {}) {
  const wrapper = document.createElement("label");
  wrapper.className = "upload-field";
  wrapper.innerHTML = `<span>${label}</span>`;

  if (object[key]) {
    const img = document.createElement("img");
    img.className = "admin-image-preview";
    img.src = object[key];
    img.alt = label;
    wrapper.appendChild(img);
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = options.accept || "image/png,image/jpeg,image/webp,image/gif";
  input.addEventListener("change", async () => {
    try {
      const file = input.files[0];
      if (!file) return;
      const cropped = await openImageCropper(file, options);
      setStatus("Загружаю изображение...");
      object[key] = await uploadImage(cropped);
      if (typeof options.afterUpload === "function") options.afterUpload(object[key]);
      setStatus("Изображение загружено. Не забудьте сохранить изменения.", "ok");
      renderAll();
    } catch (error) {
      if (error.message === "__crop_cancelled__") return;
      setStatus(error.message, "error");
    }
  });
  wrapper.appendChild(input);
  return wrapper;
}

function syncPlaylistTrackCovers(playlist, cover) {
  if (!playlist?.tracks) return;
  playlist.tracks.forEach((track) => {
    track.cover = cover || "";
  });
}

function getUploadCropOptions(label, object, key, accept) {
  if (object === content?.home?.hero?.images || object === content?.home?.appearance || Object.values(content?.home?.cards || {}).includes(object)) return { crop: false };
  if (key === 'heroImage') return { cropAspect: 16 / 9, cropWidth: 2400, cropHeight: 1350, cropTitle: 'Фон главной страницы' };
  if (String(accept || "").includes("audio/") || String(accept || "").includes("video/")) return { crop: false };

  const normalized = String(label || "").toLowerCase();
  const options = {
    cropAspect: 1,
    cropWidth: 1000,
    cropHeight: 1000,
    cropTitle: "Изображение",
  };

  if (key === "background" || normalized.includes("фон плейлиста")) {
    options.cropAspect = 12 / 7;
    options.cropWidth = 2400;
    options.cropHeight = 1400;
    options.cropTitle = "Фон плейлиста";
  } else if (object === content?.map || normalized.includes("фон карты")) {
    options.cropAspect = 3 / 2;
    options.cropWidth = 2400;
    options.cropHeight = 1600;
    options.cropTitle = "Фон карты";
  } else if (normalized.includes("аватар")) {
    options.cropAspect = 3 / 4;
    options.cropWidth = 900;
    options.cropHeight = 1200;
    options.cropTitle = "Аватарка персонажа";
  } else if (normalized.includes("страниц")) {
    options.cropAspect = 3 / 4;
    options.cropWidth = 1200;
    options.cropHeight = 1600;
    options.cropTitle = "Страница манги";
  } else if (normalized.includes("локац")) {
    options.cropAspect = 1;
    options.cropTitle = "Изображение локации";
  } else if (key === "cover") {
    options.cropAspect = 1;
    options.cropTitle = "Обложка";
  }

  if (key === "cover" && Array.isArray(object?.tracks)) {
    options.afterUpload = (url) => syncPlaylistTrackCovers(object, url);
  }

  return options;
}

function updateCounts() {
  const counts = {
    news: content.news.length,
    volumes: content.volumes.length,
    ballads: content.ballads.length,
    legends: content.legends.length,
    characters: content.characters.length,
    locations: content.locations.length,
    socials: content.socials.length,
  };
  Object.entries(counts).forEach(([key, value]) => {
    const node = document.querySelector(`[data-count="${key}"]`);
    if (node) node.textContent = value;
  });
}

function showSection(id) {
  activeSection = id || "site";
  document.querySelectorAll(".admin-panel").forEach((panel) => {
    panel.hidden = panel.id !== activeSection;
  });
  document.querySelectorAll("[data-admin-nav]").forEach((link) => {
    link.classList.toggle("active", link.dataset.adminNav === activeSection);
  });
}

function ensureContentShape() {
  if (!content.map) content.map = { image: "" };
  if (!content.ballads) content.ballads = [];
  if (!content.legends) content.legends = [];
  if (normalizedHomeFor !== content) {
    content.home = window.HomeSettings.normalize(content.home);
    normalizedHomeFor = content;
  }
}

function renderHome() {
  const root = $("[data-home-fields]");
  if (!root) return;
  const openGroups = new Set(Array.from(root.querySelectorAll(".home-settings-group[open]")).map((node) => node.dataset.homeGroup));
  const firstRender = !root.children.length;
  root.replaceChildren();
  const home = content.home;
  const group = (title, initial = false) => homeSettingsGroup(root, title, openGroups.has(title) || (firstRender && initial));
  const iconLabels = {
    sparkles: "Искры", compass: "Компас", map: "Карта", "scroll-text": "Свиток", headphones: "Наушники", music: "Нота", "disc-3": "Диск", clapperboard: "Хлопушка", film: "Киноплёнка", "book-open": "Открытая книга", library: "Книги", radio: "Эфир", globe: "Мир", feather: "Перо", castle: "Замок", swords: "Мечи", star: "Звезда"
  };
  const iconOptions = window.HomeSettings.icons.map((icon) => [icon, iconLabels[icon] || icon]);

  const intro = group("Приветствие", true);
  addFields(intro, home, [
    ["Надпись над заголовком", home, "introEyebrow"],
    ["Заголовок главной", home, "introTitle"],
  ]);

  const hero = group("Большая карточка мира", true);
  addFields(hero, home.hero, [
    ["Подпись карточки мира", home.hero, "kicker"],
    ["Заголовок карточки мира", content.site, "heroTitle", "textarea", "Пустое поле: «Мир в рисунках и историях». Переносы строк сохраняются."],
    ["Описание карточки мира", content.site, "heroText", "textarea"],
    ["Текст кнопки мира", home.hero, "actionText"],
    ["Ссылка кнопки мира", home.hero, "actionUrl", "text", "Например, /wiki.html или https://example.com."],
    ["Надпись на печати", home.hero, "stamp"],
    ["Подпись под печатью", home.hero, "stampCaption"],
  ]);
  hero.appendChild(selectField("Значок карточки мира", home.hero, "icon", iconOptions));
  hero.appendChild(percentageField("Положение фона по горизонтали, %", home.hero, "positionX", "0 — слева, 50 — по центру, 100 — справа. Изображение сохраняет пропорции."));
  hero.appendChild(percentageField("Положение фона по вертикали, %", home.hero, "positionY", "0 — сверху, 50 — по центру, 100 — снизу."));

  const themeImages = group("Фоны карточки мира по темам");
  const themes = { ember: "Огненная", arcane: "Сине-фиолетовая", mono: "Чёрно-белая" };
  Object.entries(themes).forEach(([key, label]) => {
    themeImages.appendChild(field(`Изображение: ${label} тема`, home.hero.images, key, "text", "Ссылка на изображение. Загруженный файл сохраняет исходные пропорции."));
    themeImages.appendChild(uploadField(`Загрузить фон: ${label} тема`, home.hero.images, key));
  });
  addFields(themeImages, content.site, [
    ["Единый фон для всех тем", content.site, "heroImage", "text", "Необязательно. Если заполнить, он заменит три тематических фона. Очистите поле, чтобы снова переключать изображения вместе с темой."],
  ]);
  themeImages.appendChild(uploadField("Загрузить единый фон карточки мира", content.site, "heroImage"));

  Object.entries(window.HomeSettings.cardNames).forEach(([key, name]) => {
    const settings = home.cards[key];
    const fields = group(`Карточка «${name}»`);
    addFields(fields, settings, [
      [`Подпись: ${name}`, settings, "label"],
      [`Название: ${name}`, settings, "title"],
      [`Описание: ${name}`, settings, "description", "textarea", key === "chronicles" ? "Пустое поле показывает заголовок последней новости на доске." : ""],
      [`Ссылка: ${name}`, settings, "url", "text", key === "chronicles" || key === "sources" ? "#chronicles открывает доску объявлений, #sources — соцсети и эфир. Можно указать другую страницу или полный адрес." : "Адрес страницы или полный адрес сайта."],
      [`Подпись внизу: ${name}`, settings, "meta", "text", "Пустое поле включает автоматический счётчик. Свой текст заменяет счётчик."],
      [`Изображение: ${name}`, settings, "image", "text", key === "ballads" ? "Пустое поле берёт обложку первого плейлиста для этикетки диска." : key === "legends" ? "Пустое поле берёт обложку первого сказания." : "Необязательно. Пустое поле сохраняет стандартное оформление карточки."],
    ]);
    fields.appendChild(selectField(`Значок: ${name}`, settings, "icon", iconOptions));
    fields.appendChild(checkboxField(`Показывать счётчик: ${name}`, settings, "showCount"));
    fields.appendChild(uploadField(`Загрузить изображение: ${name}`, settings, "image"));
  });

  const shortcuts = group("Социальные ссылки и портреты");
  const socialIds = (content.socials || []).map((item) => item.id).filter(Boolean).join(", ");
  const characterIds = (content.characters || []).map((item) => item.id).filter(Boolean).join(", ");
  addFields(shortcuts, home, [
    ["Соцсети на карточке мастерской", home, "socialIds", "text", `ID через запятую, в нужном порядке. Ссылки и названия меняются в разделе «Соцсети». Доступные ID: ${socialIds || "добавьте ссылки в разделе «Соцсети»"}.`],
    ["Портреты на карточке энциклопедии", home, "portraitIds", "text", `ID через запятую. Пустое поле — первые три персонажа. Доступные ID: ${characterIds || "добавьте персонажей в их разделе"}.`],
  ]);

  const panels = group("Окна хроник и мастерской");
  addFields(panels, home.panels, [
    ["Подпись над заголовком окна", home.panels, "eyebrow"],
    ["Заголовок окна хроник", home.panels, "chroniclesTitle"],
    ["Заголовок окна мастерской", home.panels, "sourcesTitle"],
    ["Текст ссылки на Twitch", home.panels, "streamLinkText"],
  ]);

  const appearance = group("Спокойный фон страницы");
  appearance.appendChild(selectField("Фактура страницы", home.appearance, "backgroundStyle", [["atlas", "Линии старого атласа"], ["grain", "Мелкая бумажная фактура"], ["plain", "Без фактуры"]], "Оттенок фона подстраивается под выбранную тему."));
  appearance.appendChild(percentageField("Заметность фона, %", home.appearance, "backgroundStrength", "0 скрывает оформление; для спокойного фона оставьте небольшое значение."));
  appearance.appendChild(field("Изображение заднего фона", home.appearance, "backgroundImage", "text", "Необязательно. Показывается приглушённо за карточками, с исходными пропорциями."));
  appearance.appendChild(uploadField("Загрузить задний фон страницы", home.appearance, "backgroundImage"));
}

function renderSite() {
  const root = $("[data-site-fields]");
  const twitch = $("[data-twitch-fields]");
  root.innerHTML = "";
  twitch.innerHTML = "";
  addFields(root, content.site, [
    ["Название сайта", content.site, "title", "text", "Логотип и вкладка браузера."],
    ["Название раздела", content.site, "subtitle", "text", "Подзаголовок на главной."],
    ["Короткое описание", content.site, "tagline", "textarea"],
    ["Заголовок первого экрана", content.site, "heroTitle"],
    ["Текст первого экрана", content.site, "heroText", "textarea"],
    ["Свой фон главной (URL)", content.site, "heroImage", "text", "Рекомендуется 2400 × 1350 px. Пустое поле включает фон выбранной темы. Свой фон применяется ко всем трём темам без цветовых фильтров."],
    ["Подвал", content.site, "footer"],
  ]);
  root.appendChild(uploadField('Загрузить свой фон главной страницы', content.site, 'heroImage'));
  addFields(twitch, content.twitch, [
    ["Twitch-канал", content.twitch, "channel", "text", "Только ник без twitch.tv/."],
    ["Заголовок блока", content.twitch, "title"],
    ["Описание", content.twitch, "note", "textarea"],
  ]);
}

function renderMapSettings() {
  ensureContentShape();
  const root = $("[data-map-fields]");
  if (!root) return;
  root.innerHTML = "";
  addFields(root, content.map, [
    ["URL фона карты", content.map, "image", "text", "Рекомендуемый размер: 2400 x 1600 px или больше, формат 3:2."],
  ]);
  root.appendChild(uploadField("Загрузить фон карты", content.map, "image"));
}

function renderSimpleList(type, fields, titleGetter, factory) {
  const root = $(`[data-editor='${type}']`);
  root.innerHTML = "";
  content[type].forEach((item, index) => {
    const node = card(titleGetter(item, index), `#${index + 1}`);
    addFields(node, item, fields(item));
    node.appendChild(actions(
      button("Выше", () => moveItem(content[type], index, -1)),
      button("Ниже", () => moveItem(content[type], index, 1)),
      button("Удалить", () => {
        content[type].splice(index, 1);
        renderAll();
      }, "button danger")
    ));
    root.appendChild(node);
  });
  return factory;
}

function renderNews() {
  renderSimpleList("news", (item) => [
    ["ID", item, "id", "text", "Латиница без пробелов."],
    ["Заголовок", item, "title"],
    ["Текст", item, "text", "textarea"],
    ["Текст кнопки", item, "button"],
    ["Ссылка", item, "url", "text", "/reader.html, /wiki.html или якорь #map."],
  ], (item) => item.title || "Новость");
  $("[data-editor='news']").querySelectorAll(".edit-card").forEach((node, index) => {
    const item = content.news[index];
    node.insertBefore(field("Тип медиа", item, "mediaType", "text", "image или video."), node.lastChild);
    node.insertBefore(field("URL картинки или видео", item, "mediaUrl", "text"), node.lastChild);
    node.insertBefore(uploadField("Загрузить картинку или видео", item, "mediaUrl", "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,.mp4,.webm"), node.lastChild);
  });
}

function chapterEditorForEpisode(episode, chapter, index) {
  const node = card(chapter.title || "Глава", `глава ${index + 1}`);
  node.classList.add("nested-editor");
  addFields(node, chapter, [
    ["Название главы", chapter, "title"],
    ["Начало, секунды", chapter, "start", "number", "Например 90 для 1:30."],
  ]);
  node.appendChild(actions(
    button("Выше", () => moveItem(episode.chapters, index, -1)),
    button("Ниже", () => moveItem(episode.chapters, index, 1)),
    button("Удалить главу", () => { episode.chapters.splice(index, 1); renderAll(); }, "button danger")
  ));
  return node;
}

function episodeEditor(legend, episode, index) {
  const node = card(episode.title || "Эпизод", `эпизод ${index + 1}`);
  node.classList.add("nested-editor");
  episode.qualities ||= [];
  episode.chapters ||= [];
  addFields(node, episode, [
    ["ID эпизода", episode, "id"],
    ["Название", episode, "title"],
    ["Описание", episode, "description", "textarea"],
    ["Основной URL видео", episode, "video", "text", "mp4 или webm. Если указан, используется первым."],
    ["Длительность, секунды", episode, "duration", "number", "Нужна для меток глав до загрузки видео."],
  ]);
  node.appendChild(uploadField("Загрузить основное видео", episode, "video", "video/mp4,video/webm,.mp4,.webm"));
  const qualityTitle = document.createElement("div");
  qualityTitle.className = "mini-title";
  qualityTitle.innerHTML = "<strong>Качество видео</strong>";
  node.appendChild(qualityTitle);
  episode.qualities.forEach((quality, qualityIndex) => {
    const qualityNode = card(quality.label || "Вариант", "качество");
    qualityNode.classList.add("nested-editor");
    addFields(qualityNode, quality, [["Название", quality, "label", "text", "Например 720p."], ["URL видео", quality, "url"]]);
    qualityNode.appendChild(uploadField("Загрузить файл качества", quality, "url", "video/mp4,video/webm,.mp4,.webm"));
    qualityNode.appendChild(actions(button("Удалить качество", () => { episode.qualities.splice(qualityIndex, 1); renderAll(); }, "button danger")));
    node.appendChild(qualityNode);
  });
  node.appendChild(actions(
    button("Добавить качество", () => { episode.qualities.push({ label: "720p", url: "" }); renderAll(); }),
    button("Добавить главу", () => { episode.chapters.push({ title: "Новая глава", start: 0 }); renderAll(); }),
    button("Эпизод выше", () => moveItem(legend.episodes, index, -1)),
    button("Эпизод ниже", () => moveItem(legend.episodes, index, 1)),
    button("Удалить эпизод", () => { legend.episodes.splice(index, 1); renderAll(); }, "button danger")
  ));
  episode.chapters.forEach((chapter, chapterIndex) => node.appendChild(chapterEditorForEpisode(episode, chapter, chapterIndex)));
  return node;
}

function renderLegends() {
  const root = $("[data-editor='legends']");
  if (!root) return;
  root.innerHTML = "";
  content.legends.forEach((legend, index) => {
    legend.episodes ||= [];
    const node = card(legend.title || "Сказание", `${legend.episodes.length} эпиз.`);
    node.classList.add("volume-editor");
    addFields(node, legend, [
      ["ID сказания", legend, "id"], ["Название", legend, "title"], ["Описание", legend, "description", "textarea"], ["URL обложки", legend, "cover"],
    ]);
    node.appendChild(uploadField("Загрузить обложку сказания", legend, "cover"));
    node.appendChild(actions(
      button("Добавить эпизод", () => { legend.episodes.push({ id: uid("episode"), title: "Новый эпизод", description: "", video: "", duration: 0, qualities: [], chapters: [] }); renderAll(); }),
      button("Сказание выше", () => moveItem(content.legends, index, -1)),
      button("Сказание ниже", () => moveItem(content.legends, index, 1)),
      button("Удалить сказание", () => { content.legends.splice(index, 1); renderAll(); }, "button danger")
    ));
    legend.episodes.forEach((episode, episodeIndex) => node.appendChild(episodeEditor(legend, episode, episodeIndex)));
    root.appendChild(node);
  });
}

function pageEditor(chapter, page, index) {
  const node = card(page.title || "Страница", `страница ${index + 1}`);
  addFields(node, page, [
    ["ID", page, "id", "text", "Например page-001."],
    ["Название", page, "title"],
    ["URL картинки", page, "image", "text", "Можно загрузить файл ниже."],
    ["Текст, если картинки ещё нет", page, "text", "textarea"],
  ]);
  node.appendChild(uploadField("Загрузить картинку страницы", page, "image"));
  node.appendChild(actions(
    button("Выше", () => moveItem(chapter.pages, index, -1)),
    button("Ниже", () => moveItem(chapter.pages, index, 1)),
    button("Удалить страницу", () => {
      chapter.pages.splice(index, 1);
      renderAll();
    }, "button danger")
  ));
  return node;
}

function chapterEditor(volume, chapter, index) {
  const node = card(chapter.title || "Глава", `глава ${index + 1}`);
  node.classList.add("nested-editor");
  addFields(node, chapter, [
    ["ID главы", chapter, "id"],
    ["Название главы", chapter, "title"],
    ["Описание", chapter, "description", "textarea"],
  ]);
  node.appendChild(actions(
    button("Добавить страницу", () => {
      chapter.pages.push({ id: uid("page"), title: "Новая страница", image: "", text: "" });
      renderAll();
    }),
    button("Главу выше", () => moveItem(volume.chapters, index, -1)),
    button("Главу ниже", () => moveItem(volume.chapters, index, 1)),
    button("Удалить главу", () => {
      volume.chapters.splice(index, 1);
      renderAll();
    }, "button danger")
  ));
  chapter.pages.forEach((page, pageIndex) => node.appendChild(pageEditor(chapter, page, pageIndex)));
  return node;
}

function renderVolumes() {
  const root = $("[data-editor='volumes']");
  root.innerHTML = "";
  content.volumes.forEach((volume, index) => {
    const node = card(volume.title || "Том", `${volume.chapters.length} глав`);
    node.classList.add("volume-editor");
    addFields(node, volume, [
      ["ID тома", volume, "id"],
      ["Название тома", volume, "title"],
      ["Описание", volume, "description", "textarea"],
      ["URL обложки", volume, "cover"],
    ]);
    node.appendChild(uploadField("Загрузить обложку", volume, "cover"));
    node.appendChild(actions(
      button("Добавить главу", () => {
        volume.chapters.push({ id: uid("chapter"), title: "Новая глава", description: "", pages: [] });
        renderAll();
      }),
      button("Том выше", () => moveItem(content.volumes, index, -1)),
      button("Том ниже", () => moveItem(content.volumes, index, 1)),
      button("Удалить том", () => {
        content.volumes.splice(index, 1);
        renderAll();
      }, "button danger")
    ));
    volume.chapters.forEach((chapter, chapterIndex) => node.appendChild(chapterEditor(volume, chapter, chapterIndex)));
    root.appendChild(node);
  });
}

function trackEditor(playlist, track, index) {
  const node = card(track.title || "Трек", `трек ${index + 1}`);
  node.classList.add("nested-editor");
  addFields(node, track, [
    ["ID трека", track, "id"],
    ["Название", track, "title"],
    ["Автор", track, "artist"],
    ["Длительность", track, "duration", "text", "Например 03:12."],
    ["URL аудио", track, "audio", "text", "Можно загрузить mp3/wav/ogg/m4a ниже."],
    ["URL обложки трека", track, "cover"],
    ["Текст / лирика / заметка", track, "text", "textarea"],
  ]);
  node.appendChild(uploadField("Загрузить аудио", track, "audio", "audio/mpeg,audio/wav,audio/ogg,audio/mp4,.mp3,.wav,.ogg,.m4a"));
  node.appendChild(uploadField("Загрузить обложку трека", track, "cover"));
  node.appendChild(actions(
    button("Выше", () => moveItem(playlist.tracks, index, -1)),
    button("Ниже", () => moveItem(playlist.tracks, index, 1)),
    button("Удалить трек", () => {
      playlist.tracks.splice(index, 1);
      renderAll();
    }, "button danger")
  ));
  return node;
}

function renderBallads() {
  ensureContentShape();
  const root = $("[data-editor='ballads']");
  if (!root) return;
  root.innerHTML = "";
  content.ballads.forEach((playlist, index) => {
    if (!playlist.tracks) playlist.tracks = [];
    const node = card(playlist.title || "Плейлист", `${playlist.tracks.length} треков`);
    node.classList.add("volume-editor");
    addFields(node, playlist, [
      ["ID плейлиста", playlist, "id"],
      ["Название", playlist, "title"],
      ["Автор / проект", playlist, "artist"],
      ["Тип", playlist, "kind", "text", "playlist или solo."],
      ["Теги", playlist, "tags", "text", "Через запятую: марш, хор, эмбиент."],
      ["Акцентный цвет", playlist, "accent", "text", "Например #e1a640."],
      ["Описание", playlist, "description", "textarea"],
      ["URL обложки", playlist, "cover"],
      ["URL фона", playlist, "background"],
      ["Текст сайдмодала", playlist, "text", "textarea"],
    ]);
    node.appendChild(uploadField("Загрузить обложку", playlist, "cover"));
    node.appendChild(uploadField("Загрузить фон плейлиста", playlist, "background"));
    node.appendChild(actions(
      button("Добавить трек", () => {
        playlist.tracks.push({ id: uid("track"), title: "Новый трек", artist: playlist.artist || "", duration: "0:00", audio: "", cover: playlist.cover || "", text: "" });
        renderAll();
      }),
      button("Плейлист выше", () => moveItem(content.ballads, index, -1)),
      button("Плейлист ниже", () => moveItem(content.ballads, index, 1)),
      button("Удалить плейлист", () => {
        content.ballads.splice(index, 1);
        renderAll();
      }, "button danger")
    ));
    playlist.tracks.forEach((track, trackIndex) => node.appendChild(trackEditor(playlist, track, trackIndex)));
    root.appendChild(node);
  });
}

function renderCharacters() {
  renderSimpleList("characters", (item) => [
    ["ID", item, "id"],
    ["Имя", item, "name"],
    ["Роль", item, "role"],
    ["Фракция", item, "faction"],
    ["Краткое описание", item, "description", "textarea"],
    ["Полная статья", item, "details", "textarea"],
    ["URL аватарки", item, "image"],
  ], (item) => item.name || "Персонаж");
  $("[data-editor='characters']").querySelectorAll(".edit-card").forEach((node, index) => {
    node.insertBefore(uploadField("Загрузить аватарку", content.characters[index], "image"), node.lastChild);
  });
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function updateLocationFromPointer(event, index, board) {
  const rect = board.getBoundingClientRect();
  const location = content.locations[index];
  location.x = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
  location.y = clampPercent(((event.clientY - rect.top) / rect.height) * 100);
}

function setActivePin(index) {
  activeLocationIndex = index;
  document.querySelectorAll("[data-admin-pin]").forEach((pin) => {
    pin.classList.toggle("active", Number(pin.dataset.adminPin) === activeLocationIndex);
  });
  document.querySelectorAll("[data-admin-pin-item]").forEach((item) => {
    item.classList.toggle("active", Number(item.dataset.adminPinItem) === activeLocationIndex);
  });
}

function renderAdminMap() {
  const board = $("[data-admin-map]");
  const list = $("[data-admin-pin-list]");
  if (!board || !list) return;
  ensureContentShape();
  board.innerHTML = "";
  list.innerHTML = "";
  const mapImage = content.map.image || '/assets/test-world-map.png';
  board.classList.toggle("has-map-image", Boolean(mapImage));
  if (mapImage) {
    board.style.setProperty("--map-bg-image", `url("${mapImage.replaceAll('"', "%22")}")`);
  } else {
    board.style.removeProperty("--map-bg-image");
  }
  board.onclick = (event) => {
    if (event.target.closest('button')) return;
    const rect = board.getBoundingClientRect();
    const location = {
      id: uid("location"),
      name: "Новая локация",
      type: "",
      description: "",
      image: "",
      x: clampPercent(((event.clientX - rect.left) / rect.width) * 100),
      y: clampPercent(((event.clientY - rect.top) / rect.height) * 100),
    };
    content.locations.push(location);
    activeLocationIndex = content.locations.length - 1;
    renderAll();
    openPinEditor(activeLocationIndex);
    setStatus("Новый пин добавлен. Заполните карточку и сохраните изменения.", "ok");
  };

  if (!content.locations.length) {
    list.innerHTML = "<p>Локаций пока нет.</p>";
    return;
  }

  activeLocationIndex = Math.min(activeLocationIndex, content.locations.length - 1);

  content.locations.forEach((location, index) => {
    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = `admin-map-pin${index === activeLocationIndex ? " active" : ""}`;
    pin.dataset.adminPin = String(index);
    pin.style.left = `${location.x}%`;
    pin.style.top = `${location.y}%`;
    pin.title = location.name;
    pin.innerHTML = "<span></span>";
    pin.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      setActivePin(index);

      const move = (moveEvent) => {
        updateLocationFromPointer(moveEvent, index, board);
        pin.style.left = `${location.x}%`;
        pin.style.top = `${location.y}%`;
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        renderAll();
        setStatus("Пин обновлён. Не забудьте сохранить изменения.", "ok");
      };

      move(event);
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });
    board.appendChild(pin);

    const item = document.createElement("button");
    item.type = "button";
    item.className = `admin-pin-item${index === activeLocationIndex ? " active" : ""}`;
    item.dataset.adminPinItem = String(index);
    item.innerHTML = `<strong>${location.name || "Локация"}</strong><span>X ${location.x}% / Y ${location.y}%</span>`;
    item.addEventListener("click", () => { setActivePin(index); openPinEditor(index); });
    list.appendChild(item);
  });
}

function openPinEditor(index) {
  const root = document.querySelector('[data-editor="locations"]');
  const search = root.previousElementSibling;
  search.value = ''; search.dispatchEvent(new Event('input'));
  const record = root.children[index]?.querySelector('.record-fields');
  if (record) { record.open = true; record.scrollIntoView({block:'center',behavior:'smooth'}); }
}

function renderLocations() {
  renderSimpleList("locations", (item) => [
    ["ID", item, "id"],
    ["Название", item, "name"],
    ["Тип", item, "type"],
    ["Краткое описание", item, "description", "textarea"],
    ["Полная статья", item, "details", "textarea"],
    ["URL изображения", item, "image"],
    ["X на карте, %", item, "x", "number"],
    ["Y на карте, %", item, "y", "number"],
  ], (item) => item.name || "Локация");
  $("[data-editor='locations']").querySelectorAll(".edit-card").forEach((node, index) => {
    node.insertBefore(uploadField("Загрузить изображение локации", content.locations[index], "image"), node.lastChild);
  });
  renderAdminMap();
}

function renderSocials() {
  renderSimpleList("socials", (item) => [
    ["ID", item, "id"],
    ["Название", item, "label"],
    ["Ссылка", item, "url"],
    ["Тип", item, "kind"],
  ], (item) => item.label || "Ссылка");
}

let dirty = false;
function markDirty() {
  dirty = true;
  $('[data-save-state]').textContent = 'Есть несохранённые изменения';
}

function simplifyEditors(openKeys) {
  document.querySelectorAll('[data-editor]').forEach(root => {
    if (!root.previousElementSibling?.classList.contains('editor-search')) {
      const search = document.createElement('input');
      search.type = 'search';
      search.className = 'editor-search';
      search.placeholder = 'Найти запись…';
      search.setAttribute('aria-label','Поиск записей в разделе');
      search.addEventListener('input', () => {
        Array.from(root.children).forEach(card => { card.hidden = !card.querySelector('.edit-card-header')?.textContent.toLowerCase().includes(search.value.toLowerCase()); });
      });
      root.before(search);
    }
    root.querySelectorAll('.edit-card').forEach((card,index) => {
      const header = card.querySelector(':scope > .edit-card-header');
      if (!header) return;
      const key = `${root.dataset.editor}:${index}`;
      const details = document.createElement('details');
      details.className = 'record-fields';
      details.dataset.recordKey = key;
      details.open = openKeys.has(key);
      const summary = document.createElement('summary');
      summary.append(header);
      details.append(summary);
      while(card.firstChild) details.append(card.firstChild);
      card.append(details);
    });
    root.previousElementSibling.dispatchEvent(new Event('input'));
  });
  document.querySelectorAll('.admin-grid .form-grid, .record-fields').forEach(grid => {
    const advanced = document.createElement('details');
    advanced.className = 'advanced-fields';
    const summary = document.createElement('summary');
    summary.textContent = 'Дополнительно';
    advanced.append(summary);
    Array.from(grid.children).forEach(label => {
      if (label.tagName === 'LABEL' && /^(ID|URL)/.test(label.textContent.trim())) advanced.append(label);
    });
    if (advanced.children.length > 1) grid.append(advanced);
  });
  document.querySelectorAll('.asset-guide').forEach(guide => {
    if (guide.closest('details')) return;
    const details = document.createElement('details');
    details.className = 'asset-help';
    const summary = document.createElement('summary');
    summary.textContent = 'Размеры и форматы файлов';
    guide.before(details);
    details.append(summary, guide);
  });
}

function renderAll() {
  const openKeys = new Set(Array.from(document.querySelectorAll('.record-fields[open]')).map(node => node.dataset.recordKey));
  if (document.body.classList.contains('admin-unlocked')) markDirty();
  ensureContentShape();
  renderSite();
  renderHome();
  renderNews();
  renderVolumes();
  renderBallads();
  renderLegends();
  renderCharacters();
  renderMapSettings();
  renderLocations();
  renderSocials();
  updateCounts();
  simplifyEditors(openKeys);
  showSection(activeSection);
}

async function loadContent() {
  const response = await fetch("/api/admin/content", {
    headers: adminHeaders(),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Неверный пароль админки");
  content = result;
  renderSiteMeta("Админка");
  renderAll();
}

async function saveContent(event) {
  event.preventDefault();
  const saveButton = $('.admin-commandbar button[type="submit"]');
  saveButton.disabled = true;
  try {
  const response = await fetch("/api/content", {
    method: "PUT",
    headers: adminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(content),
  });
  const result = await response.json();
  if (!response.ok) {
    setStatus(result.error || "Не удалось сохранить. Проверьте пароль.", "error");
    return;
  }
  setStatus(`Сохранено: ${new Date(result.updatedAt).toLocaleString("ru-RU")}`, "ok");
  dirty = false;
  $('[data-save-state]').textContent = 'Все изменения сохранены';
  } catch (error) { setStatus('Не удалось сохранить: ' + error.message, 'error'); }
  finally { saveButton.disabled = false; }
}

function addItem(type) {
  const factories = {
    news: () => ({ id: uid("news"), title: "Новая запись", text: "", button: "Открыть", url: "#", mediaType: "image", mediaUrl: "" }),
    volumes: () => ({ id: uid("volume"), title: "Новый том", description: "", cover: "", chapters: [] }),
    ballads: () => ({ id: uid("ballad"), title: "Новый плейлист", artist: "", kind: "playlist", description: "", cover: "", background: "", accent: "#d2a139", text: "", tags: "", tracks: [] }),
    legends: () => ({ id: uid("legend"), title: "Новое сказание", description: "", cover: "", episodes: [] }),
    characters: () => ({ id: uid("character"), name: "Новый персонаж", role: "", faction: "", description: "", image: "" }),
    locations: () => ({ id: uid("location"), name: "Новая локация", type: "", description: "", image: "", x: 50, y: 50 }),
    socials: () => ({ id: uid("social"), label: "Новая ссылка", url: "https://", kind: "" }),
  };
  content[type].push(factories[type]());
  if (type === "locations") activeLocationIndex = content.locations.length - 1;
  renderAll();
  const root = document.querySelector(`[data-editor="${type}"]`);
  const search = root.previousElementSibling;
  search.value = '';
  search.dispatchEvent(new Event('input'));
  const added = root.lastElementChild?.querySelector('.record-fields');
  if (added) { added.open = true; added.scrollIntoView({block:'center'}); }
}

async function init() {
  initTheme();
  $("[data-admin-form]").hidden = true;

  $("[data-login-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    adminLogin = $("[data-admin-login]").value.trim();
    adminToken = $("[data-admin-token]").value;
    if (!adminLogin || !adminToken) {
      setStatus("Введите логин и пароль.", "error");
      return;
    }
    try {
      await loadContent();
      $("[data-admin-form]").hidden = false;
      document.body.classList.add('admin-unlocked');
      $('[data-admin-token]').value = '';
      setStatus("Доступ открыт. Выберите раздел слева.", "ok");
    } catch (error) {
      adminLogin = "";
      adminToken = "";
      $("[data-admin-form]").hidden = true;
      setStatus(error.message, "error");
    }
  });

  $("[data-admin-form]").addEventListener("submit", saveContent);
  $('[data-admin-form]').addEventListener('input', event => { if (!event.target.matches('.editor-search')) markDirty(); });
  $('[data-admin-form]').addEventListener('click', event => {
    if (event.target.closest('.button.danger') && !confirm('Удалить запись? Изменение вступит в силу после сохранения.')) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  $('[data-admin-logout]').addEventListener('click', () => {
    if (dirty && !confirm('Выйти без сохранения изменений?')) return;
    dirty = false; location.reload();
  });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  document.querySelectorAll("[data-add]").forEach((node) => {
    node.addEventListener("click", () => addItem(node.dataset.add));
  });
  document.querySelectorAll("[data-admin-nav]").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.preventDefault();
      showSection(node.dataset.adminNav);
    });
  });
}

init().catch((error) => setStatus(error.message, "error"));
