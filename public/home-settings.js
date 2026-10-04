/* Shared defaults keep existing content files compatible with the editable home page. */
(() => {
  const defaults = {
    introEyebrow: "Добро пожаловать в мастерскую",
    introTitle: "Выбери свою историю",
    hero: {
      kicker: "Скетчбук Элазара", icon: "sparkles", actionText: "Исследовать мир", actionUrl: "/wiki.html",
      stamp: "ELAZAR", stampCaption: "WORLD ARCHIVE", positionX: 50, positionY: 50,
      images: { ember: "/assets/themes/fantasy-ember.png", arcane: "/assets/themes/fantasy-arcane.png", mono: "/assets/themes/fantasy-mono.png" }
    },
    cards: {
      map: { label: "Путеводитель", title: "Карта мира", description: "Места, хранящие свои тайны", url: "/map.html", icon: "compass", image: "", meta: "", showCount: true },
      chronicles: { label: "Доска объявлений", title: "Хроники", description: "", url: "#chronicles", icon: "scroll-text", image: "", meta: "", showCount: true },
      ballads: { label: "Музыка", title: "Баллады", description: "У каждого мира свой голос", url: "/ballads.html", icon: "headphones", image: "", meta: "", showCount: true },
      legends: { label: "Видеоархив", title: "Сказания", description: "Истории, оживающие на экране", url: "/legends.html", icon: "clapperboard", image: "", meta: "", showCount: true },
      wiki: { label: "Энциклопедия", title: "Некрономикон", description: "Лица и легенды этого мира", url: "/wiki.html", icon: "book-open", image: "", meta: "", showCount: true },
      sources: { label: "На связи", title: "Мастерская", description: "Соцсети и прямой эфир", url: "#sources", icon: "radio", image: "", meta: "", showCount: true }
    },
    socialIds: "vk,telegram,youtube",
    portraitIds: "",
    panels: { eyebrow: "Скетчбук Элазара", chroniclesTitle: "Доска объявлений", sourcesTitle: "Соцсети и источники", streamLinkText: "Открыть Twitch" },
    appearance: { backgroundStyle: "atlas", backgroundStrength: 30, backgroundImage: "" }
  };
  const cardNames = { map: "Карта мира", chronicles: "Хроники", ballads: "Баллады", legends: "Сказания", wiki: "Некрономикон", sources: "Мастерская" };
  const icons = ["sparkles", "compass", "map", "scroll-text", "headphones", "music", "disc-3", "clapperboard", "film", "book-open", "library", "radio", "globe", "feather", "castle", "swords", "star"];
  const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  function normalize(value) {
    const input = object(value);
    const hero = object(input.hero);
    const cards = object(input.cards);
    const result = { ...defaults, ...input,
      hero: { ...defaults.hero, ...hero, images: { ...defaults.hero.images, ...object(hero.images) } },
      cards: Object.fromEntries(Object.keys(defaults.cards).map((key) => [key, { ...defaults.cards[key], ...object(cards[key]) }])),
      panels: { ...defaults.panels, ...object(input.panels) },
      appearance: { ...defaults.appearance, ...object(input.appearance) }
    };
    result.appearance.backgroundStrength = Math.max(0, Math.min(100, Number(result.appearance.backgroundStrength) || 0));
    if (!["atlas", "grain", "plain"].includes(result.appearance.backgroundStyle)) result.appearance.backgroundStyle = "atlas";
    for (const key of ["positionX", "positionY"]) result.hero[key] = Math.max(0, Math.min(100, Number(result.hero[key]) || 0));
    return result;
  }
  window.HomeSettings = { defaults, cardNames, icons, normalize };
})();
