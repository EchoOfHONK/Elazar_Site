(() => {
  // The reader is paused; its data and implementation remain available for reactivation.
  if (location.pathname === '/reader.html') { location.replace('/'); return; }
  document.querySelectorAll('a[href="/reader.html"], #reader').forEach(node => node.remove());
  const icons = document.createElement('script');
  icons.src = '/assets/lucide.min.js';
  icons.onload = () => {
    document.querySelectorAll('.icon-cog').forEach(node => { node.className = ''; node.dataset.lucide = 'settings'; });
    document.querySelectorAll('.portal-icon').forEach(node => {
      const href = node.closest('a')?.getAttribute('href') || '';
      node.className = 'portal-icon';
      node.dataset.lucide = href.includes('reader') ? 'book-open' : href.includes('ballads') ? 'audio-lines' : href.includes('legends') ? 'clapperboard' : 'map';
    });
    document.querySelectorAll('.theme-dot').forEach(node => { node.title = node.getAttribute('aria-label'); });
    window.lucide.createIcons();
    document.querySelectorAll('[data-ballad-prev], [data-ballad-next]').forEach(button => {
      button.innerHTML = `<i data-lucide="${button.hasAttribute('data-ballad-prev') ? 'chevron-left' : 'chevron-right'}"></i>`;
      button.title = button.getAttribute('aria-label');
    });
    window.lucide.createIcons();
  };
  document.head.appendChild(icons);
  const nav = document.querySelector("[data-nav]");
  const toggle = document.querySelector("[data-nav-toggle]");
  if (!nav || !toggle) return;

  const backdrop = document.createElement("button");
  backdrop.className = "nav-backdrop";
  backdrop.type = "button";
  backdrop.tabIndex = -1;
  backdrop.setAttribute("aria-label", "Закрыть меню");
  document.body.appendChild(backdrop);

  const close = () => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  };
  const open = () => {
    nav.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("nav-open");
  };

  toggle.addEventListener("click", () => (nav.classList.contains("open") ? close() : open()));
  backdrop.addEventListener("click", close);
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 920) close();
  });
})();
