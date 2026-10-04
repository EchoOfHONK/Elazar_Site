(() => {
  const THEME_KEY = "ayrohant-theme";
  const THEMES = new Set(["ember", "arcane", "mono"]);
  const PANELS = new Set(["chronicles", "sources"]);
  const dialog = document.querySelector("[data-home-panel]");
  const panelTitle = document.querySelector("[data-home-panel-title]");
  const panelContent = document.querySelector("[data-home-panel-content]");
  const settings = window.HomeSettings;
  const defaultHome = settings?.defaults || { hero: { images: {} }, cards: {}, panels: {}, appearance: {} };
  let home = settings?.normalize({}) || defaultHome;
  let content = null;
  let loadError = false;
  let activePanel = null;
  let returnFocus = null;

  const list = (value) => Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
  const text = (value) => String(value ?? "");
  const csvIds = (value) => [...new Set(text(value).split(",").map((id) => id.trim()).filter(Boolean))];

  function safeUrl(value, fallback = "", image = false) {
    const source = text(value).trim();
    if (!source) return fallback;
    try {
      const url = new URL(source, location.href);
      const protocols = image ? ["http:", "https:"] : ["http:", "https:", "mailto:"];
      if (!protocols.includes(url.protocol)) return fallback;
      if (image && /\.(?:html?|js|css|json|mp[34]|wav|ogg|m4a|webm|pdf|zip)$/i.test(url.pathname)) return fallback;
      return url.href;
    } catch {
      return fallback;
    }
  }

  function setImageProperty(node, property, value, className) {
    if (!node) return;
    const url = safeUrl(value, "", true);
    const cssImage = url ? `url(${JSON.stringify(url)})` : "";
    if (cssImage) node.style.setProperty(property, cssImage);
    else node.style.removeProperty(property);
    if (className) node.classList.toggle(className, !!cssImage);
    if (!url) return;
    const image = new Image();
    image.onerror = () => {
      if (node.style.getPropertyValue(property) !== cssImage) return;
      node.style.removeProperty(property);
      if (className) node.classList.remove(className);
    };
    image.src = url;
  }

  function replaceIcon(node, value, fallback) {
    if (!node) return;
    const name = settings?.icons.includes(value) ? value : fallback;
    const placeholder = element("i");
    for (const attribute of node.attributes) {
      if (attribute.name.startsWith("data-home-")) placeholder.setAttribute(attribute.name, attribute.value);
    }
    placeholder.className = text(node.getAttribute("class")).split(/\s+/).filter((name) => name && !name.startsWith("lucide")).join(" ");
    placeholder.dataset.lucide = name || "sparkles";
    placeholder.setAttribute("aria-hidden", "true");
    node.replaceWith(placeholder);
  }

  function refreshIcons() {
    window.lucide?.createIcons();
  }

  function renderHeroImage() {
    const media = document.querySelector(".hero-media");
    if (!media) return;
    const theme = document.body.dataset.theme || "ember";
    const hero = home.hero || {};
    setImageProperty(media, "--theme-hero-image", safeUrl(hero.images?.[theme], safeUrl(defaultHome.hero.images?.[theme], "", true), true));
    setImageProperty(media, "--custom-hero-image", content?.site?.heroImage);
    const position = (value) => Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Number(value) : 50));
    media.style.backgroundPosition = `${position(hero.positionX)}% ${position(hero.positionY)}%`;
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = String(value || "");
    });
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text || "");
    return node;
  }

  function countLabel(count, forms) {
    const lastTwo = count % 100;
    const last = count % 10;
    const form = lastTwo >= 11 && lastTwo <= 14 ? 2 : last === 1 ? 0 : last >= 2 && last <= 4 ? 1 : 2;
    return `${count} ${forms[form]}`;
  }

  function applyTheme(theme) {
    const nextTheme = THEMES.has(theme) ? theme : "ember";
    document.documentElement.dataset.theme = nextTheme;
    document.body.dataset.theme = nextTheme;
    try { localStorage.setItem(THEME_KEY, nextTheme); } catch {}
    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
      const active = button.dataset.themeChoice === nextTheme;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderHeroImage();
  }

  function initTheme() {
    let savedTheme = "ember";
    try { savedTheme = localStorage.getItem(THEME_KEY) || savedTheme; } catch {}
    applyTheme(savedTheme);
    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
      button.addEventListener("click", () => applyTheme(button.dataset.themeChoice));
    });
  }

  function visibleNews() {
    return list(content?.news).filter((item) => !/reader|манг/i.test(`${item.url || ""} ${item.title || ""} ${item.text || ""}`));
  }

  function setCover(selector, src, alt, fallback = "") {
    const image = document.querySelector(selector);
    const url = safeUrl(src, safeUrl(fallback, "", true), true);
    if (!image || !url) return;
    image.src = url;
    image.alt = alt || "";
    image.onerror = () => {
      image.onerror = null;
      const fallbackUrl = safeUrl(fallback, "", true);
      if (fallbackUrl && fallbackUrl !== url) image.src = fallbackUrl;
      else image.hidden = true;
    };
    image.hidden = false;
  }

  function cardPanelName(url) {
    try {
      const parsed = new URL(url, location.href);
      const name = parsed.hash.slice(1);
      return parsed.origin === location.origin && ["/", "/index.html"].includes(parsed.pathname) && PANELS.has(name) ? name : "";
    } catch {
      return "";
    }
  }

  function renderCards(counts, news, ballads, legends) {
    document.querySelectorAll("[data-home-card]").forEach((card) => {
      const key = card.dataset.homeCard;
      const config = home.cards?.[key];
      if (!config) return;
      const defaults = defaultHome.cards[key] || {};
      const setCardText = (selector, value) => card.querySelectorAll(selector).forEach((node) => { node.textContent = text(value); });
      setCardText("[data-home-label]", config.label);
      setCardText("[data-home-title]", config.title);
      const description = key === "chronicles" && !text(config.description).trim() ? news[0]?.title || "Новые истории появятся здесь" : config.description;
      setCardText("[data-home-description]", description);
      card.querySelectorAll("[data-home-icon]").forEach((node) => replaceIcon(node, config.icon, defaults.icon));
      const meta = card.querySelector(".home-card-meta");
      if (meta) {
        meta.textContent = text(config.meta).trim() || counts[key] || "";
        meta.hidden = config.showCount === false;
      }
      const link = card.matches("a") ? card : card.querySelector("[data-home-card-link]");
      if (link) {
        const url = safeUrl(config.url, safeUrl(defaults.url, "#top"));
        link.href = url;
        card.removeAttribute("data-open-home-panel");
        link.removeAttribute("data-open-home-panel");
        if (cardPanelName(url)) link.setAttribute("aria-haspopup", "dialog");
        else link.removeAttribute("aria-haspopup");
        if (link.matches(".home-sources-open")) link.setAttribute("aria-label", text(config.title).trim() || settings?.cardNames.sources || "Соцсети и источники");
      }
      if (key === "ballads") {
        setCover("[data-home-ballad-art]", config.image || ballads[0]?.cover, config.title, ballads[0]?.cover);
      } else if (key === "legends") {
        setCover("[data-home-legend-art]", config.image || legends[0]?.cover, config.title, legends[0]?.cover);
      } else {
        setImageProperty(card, "--card-custom-image", config.image, "has-custom-image");
      }
    });
  }

  function socialBrand(social) {
    const id = text(social.id).toLowerCase();
    const label = text(social.label).toLowerCase();
    const kind = id === "vk" || label === "vk" ? "vk" : id === "telegram" || label.includes("telegram") ? "telegram" : id === "youtube" || label.includes("youtube") ? "youtube" : "";
    if (!kind) return element("span", "", text(social.label || social.id).slice(0, 2).toUpperCase());
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("fill-rule", "evenodd");
    const path = document.createElementNS(namespace, "path");
    if (kind === "vk") {
      path.setAttribute("d", "M12.99 19.546C4.787 19.546.11 13.922-.084 4.563h4.109c.135 6.87 3.161 9.78 5.558 10.38V4.563h3.868v5.924c2.367-.255 4.853-2.95 5.692-5.924h3.867c-.644 3.665-3.34 6.36-5.257 7.468 1.918.899 4.988 3.25 6.157 7.515h-4.258c-.914-2.846-3.191-5.049-6.202-5.349v5.349h-.46Z");
    } else if (kind === "telegram") {
      path.setAttribute("d", "M21.4 3.4 2.7 10.6c-1.3.5-1.3 1.2-.2 1.5l4.8 1.5 1.9 5.8c.3.8.6.9 1.1.4l2.7-2.6 5.1 3.8c.9.6 1.6.3 1.8-.8l3.2-15.2c.3-1.4-.6-2.1-1.7-1.6ZM8.1 13.3l10.8-6.8c.5-.3.9-.1.5.3l-8.9 8-.3 3.4-2.1-4.9Z");
    } else {
      path.setAttribute("d", "M23.4 6.2a3 3 0 0 0-2.1-2.1C19.4 3.6 12 3.6 12 3.6s-7.4 0-9.3.5A3 3 0 0 0 .6 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .6 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.3.5 9.3.5s7.4 0 9.3-.5a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.6-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z");
    }
    svg.appendChild(path);
    return svg;
  }

  function renderSocialSymbols() {
    const root = document.querySelector(".home-social-symbols");
    if (!root) return;
    root.replaceChildren();
    root.removeAttribute("aria-hidden");
    const socials = list(content.socials);
    csvIds(home.socialIds).forEach((id) => {
      const social = socials.find((item) => item.id === id);
      const url = social && safeUrl(social.url);
      if (!url) return;
      const link = createLink("", url, "home-social-symbol", true);
      link.setAttribute("aria-label", text(social.label || social.id));
      link.title = text(social.label || social.id);
      link.appendChild(socialBrand(social));
      root.appendChild(link);
    });
  }

  function renderNotices(news) {
    const board = document.querySelector("[data-home-notice-board]");
    if (board) board.hidden = !news.length;
    for (let index = 1; index <= 2; index += 1) {
      const item = news[index - 1];
      setText(`[data-home-notice-title${index}]`, item?.title || "");
      setText(`[data-home-notice-number${index}]`, item ? String(index).padStart(2, "0") : "");
      const notice = document.querySelector(`[data-home-notice="${index}"]`);
      if (notice) notice.hidden = !item;
      document.querySelectorAll(`[data-home-notice-title${index}], [data-home-notice-number${index}]`).forEach((node) => { node.hidden = !item; });
    }
  }

  function renderOverview() {
    const site = content.site || {};
    const siteTitle = site.title || "Скетчбук Элазара";
    document.title = [siteTitle, site.subtitle].filter(Boolean).join(" | ");
    setText("[data-site-title]", siteTitle);
    setText("[data-home-heading]", String(site.heroTitle || "").trim() || "Мир в рисунках\nи историях");
    setText("[data-site-hero-text]", site.heroText || "");
    setText("[data-footer]", site.footer || "");
    setText("[data-home-intro-eyebrow]", home.introEyebrow);
    setText("[data-home-intro-title]", home.introTitle);
    setText("[data-home-kicker]", home.hero.kicker);
    setText("[data-home-action-text]", home.hero.actionText);
    setText("[data-home-stamp]", home.hero.stamp);
    setText("[data-home-stamp-caption]", home.hero.stampCaption);
    replaceIcon(document.querySelector("[data-home-hero-icon]"), home.hero.icon, defaultHome.hero.icon);
    const action = document.querySelector(".home-welcome-link");
    if (action) action.href = safeUrl(home.hero.actionUrl, safeUrl(defaultHome.hero.actionUrl, "/wiki.html"));
    renderHeroImage();
    const appearance = home.appearance || {};
    document.body.dataset.homeBackground = appearance.backgroundStyle || "atlas";
    document.body.style.setProperty("--home-background-strength", String((Number(appearance.backgroundStrength) || 0) / 100));
    setImageProperty(document.body, "--home-background-image", appearance.backgroundImage);

    const news = visibleNews();
    const ballads = list(content.ballads);
    const legends = list(content.legends);
    const locations = list(content.locations);
    const characters = list(content.characters);
    const tracks = ballads.reduce((count, item) => count + list(item.tracks).length, 0);
    const episodes = legends.reduce((count, item) => count + list(item.episodes).length, 0);
    renderCards({
      chronicles: countLabel(news.length, ["запись", "записи", "записей"]),
      ballads: `${countLabel(ballads.length, ["плейлист", "плейлиста", "плейлистов"])} · ${countLabel(tracks, ["трек", "трека", "треков"])}`,
      legends: `${countLabel(legends.length, ["сказание", "сказания", "сказаний"])} · ${countLabel(episodes, ["эпизод", "эпизода", "эпизодов"])}`,
      map: countLabel(locations.length, ["локация", "локации", "локаций"]),
      wiki: `${countLabel(characters.length, ["персонаж", "персонажа", "персонажей"])} · ${countLabel(locations.length, ["локация", "локации", "локаций"])}`,
      sources: countLabel(list(content.socials).length, ["площадка", "площадки", "площадок"])
    }, news, ballads, legends);
    renderSocialSymbols();
    renderNotices(news);

    const portraits = document.querySelector("[data-home-portraits]");
    if (portraits) {
      portraits.replaceChildren();
      const ids = csvIds(home.portraitIds);
      const selected = ids.length ? ids.map((id) => characters.find((item) => item.id === id)).filter(Boolean) : characters;
      selected.filter((character) => safeUrl(character.image, "", true)).slice(0, 3).forEach((character) => {
        const image = element("img", "home-portrait");
        image.src = safeUrl(character.image, "", true);
        image.alt = character.name || "Персонаж";
        image.decoding = "async";
        image.onerror = () => { image.hidden = true; };
        portraits.appendChild(image);
      });
    }
    refreshIcons();
  }

  function createLink(text, url, className, external = false) {
    const link = element("a", className, text);
    link.href = safeUrl(url, "#top");
    if (external) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    return link;
  }

  function renderChronicles() {
    const news = visibleNews();
    if (!news.length) {
      panelContent.appendChild(element("p", "", "Новых записей пока нет."));
      return;
    }
    news.forEach((item) => {
      const story = element("article", "home-story");
      const mediaUrl = safeUrl(item.mediaUrl, "", item.mediaType !== "video");
      if (mediaUrl && /^https?:/.test(mediaUrl)) {
        const media = element(item.mediaType === "video" ? "video" : "img", "home-story-media");
        media.src = mediaUrl;
        if (item.mediaType === "video") {
          media.controls = true;
          media.preload = "metadata";
          media.playsInline = true;
        } else {
          media.alt = item.title || "Иллюстрация записи";
          media.loading = "lazy";
          media.decoding = "async";
          media.onerror = () => { media.hidden = true; };
        }
        story.appendChild(media);
      }
      const copy = element("div", "home-story-copy");
      copy.appendChild(element("h3", "", item.title));
      copy.appendChild(element("p", "", item.text));
      const url = safeUrl(item.url);
      if (url) copy.appendChild(createLink(item.button || "Открыть", url, "home-story-link"));
      story.appendChild(copy);
      panelContent.appendChild(story);
    });
  }

  function renderSources() {
    const socials = element("div", "home-social-list");
    list(content.socials).forEach((social) => {
      const url = safeUrl(social.url);
      if (!url) return;
      const link = createLink("", url, "home-social-link", true);
      link.appendChild(element("strong", "", social.label));
      if (social.kind) link.appendChild(element("span", "", social.kind));
      socials.appendChild(link);
    });
    panelContent.appendChild(socials);

    const twitch = content.twitch || {};
    const channel = String(twitch.channel || "twitch").trim() || "twitch";
    const stream = element("section", "home-stream");
    stream.appendChild(element("h3", "", twitch.title || "Прямой эфир"));
    if (twitch.note) stream.appendChild(element("p", "", twitch.note));
    const frame = element("iframe");
    frame.title = twitch.title || "Twitch player";
    frame.allowFullscreen = true;
    frame.allow = "fullscreen";
    frame.src = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(location.hostname || "localhost")}&autoplay=false`;
    stream.appendChild(frame);
    stream.appendChild(createLink(home.panels.streamLinkText, `https://www.twitch.tv/${encodeURIComponent(channel)}`, "home-story-link", true));
    panelContent.appendChild(stream);
  }

  function stopPanelMedia() {
    if (!panelContent) return;
    panelContent.querySelectorAll("video, audio").forEach((media) => media.pause());
    panelContent.querySelectorAll("iframe").forEach((frame) => {
      frame.src = "about:blank";
      frame.remove();
    });
  }

  function renderPanel(name) {
    if (!panelTitle || !panelContent) return;
    stopPanelMedia();
    panelContent.replaceChildren();
    panelContent.scrollTop = 0;
    dialog.dataset.panel = name;
    setText("[data-home-panel-eyebrow], .home-panel-header .home-eyebrow", home.panels.eyebrow);
    panelTitle.textContent = text(name === "chronicles" ? home.panels.chroniclesTitle : home.panels.sourcesTitle);
    if (!content) {
      panelContent.appendChild(element("p", "", loadError ? "Не удалось загрузить содержимое. Обновите страницу, чтобы попробовать снова." : "Загрузка…"));
      return;
    }
    if (name === "chronicles") renderChronicles();
    else renderSources();
  }

  function openPanel(name) {
    if (!dialog || !PANELS.has(name)) return;
    const switchingPanel = dialog.open && activePanel !== name;
    if (activePanel !== name || !dialog.open) renderPanel(name);
    activePanel = name;
    if (!dialog.open) {
      returnFocus = document.activeElement;
      dialog.showModal();
    } else if (switchingPanel) {
      dialog.querySelector("[data-close-home-panel]")?.focus({ preventScroll: true });
    }
  }

  function closePanel() {
    if (dialog?.open) dialog.close();
  }

  function navigatePanel(name, opener) {
    const wasOpen = dialog?.open;
    openPanel(name);
    if (!wasOpen && opener) returnFocus = opener;
    if (location.hash !== `#${name}`) history.pushState(null, "", `${location.pathname}${location.search}#${name}`);
  }

  function handleHash() {
    const name = location.hash.slice(1);
    if (PANELS.has(name)) openPanel(name);
    else closePanel();
  }

  function initPanels() {
    if (!dialog) return;
    document.querySelectorAll("[data-close-home-panel]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        closePanel();
      });
    });
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closePanel();
    });
    dialog.addEventListener("close", () => {
      if (dialog.open) return;
      stopPanelMedia();
      activePanel = null;
      if (PANELS.has(location.hash.slice(1))) history.replaceState(null, "", `${location.pathname}${location.search}`);
      if (returnFocus?.isConnected && typeof returnFocus.focus === "function") returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    });
    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const trigger = event.target.closest("[data-open-home-panel]");
      if (trigger && PANELS.has(trigger.dataset.openHomePanel)) {
        event.preventDefault();
        navigatePanel(trigger.dataset.openHomePanel, trigger);
        return;
      }
      const link = event.target.closest("a[href]");
      if (!link || (link.target && link.target !== "_self")) return;
      let url;
      try { url = new URL(link.href, location.href); } catch { return; }
      if (url.origin !== location.origin || !["/", "/index.html"].includes(url.pathname)) return;
      const name = url.hash.slice(1);
      if (PANELS.has(name)) {
        event.preventDefault();
        navigatePanel(name, link);
      } else if (name === "top") {
        event.preventDefault();
        closePanel();
        if (location.hash !== "#top") location.hash = "top";
      }
    });
    window.addEventListener("hashchange", handleHash);
    window.addEventListener("popstate", handleHash);
    handleHash();
  }

  async function loadContent() {
    try {
      const response = await fetch("/api/content");
      if (!response.ok) throw new Error("Content request failed");
      const data = await response.json();
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid content");
      content = data;
      home = settings?.normalize(data.home) || defaultHome;
      renderOverview();
      if (dialog?.open && activePanel) renderPanel(activePanel);
    } catch {
      loadError = true;
      const error = document.querySelector("[data-home-error]");
      if (error) {
        error.hidden = false;
        error.textContent = "Не удалось загрузить обновления. Ссылки разделов доступны.";
      }
      if (dialog?.open && activePanel) renderPanel(activePanel);
    }
  }

  initTheme();
  initPanels();
  const iconScript = [...document.scripts].find((script) => /\/assets\/lucide\.min\.js(?:\?|$)/.test(script.src));
  iconScript?.addEventListener("load", refreshIcons, { once: true });
  loadContent();
})();
