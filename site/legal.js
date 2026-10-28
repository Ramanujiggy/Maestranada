// EN/PT toggle for the legal pages. Same choice as the main page: ?lang=, then the
// visitor's last pick, then the browser language.
(function () {
  const PT_TITLE = document.documentElement.dataset.titlePt;
  const EN_TITLE = document.title;

  function setLang(lang) {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
    document.title = lang === 'pt' && PT_TITLE ? PT_TITLE : EN_TITLE;
    document.querySelectorAll('[data-only]').forEach((el) => (el.hidden = el.dataset.only !== lang));
    document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  }

  function startLang() {
    const asked = new URLSearchParams(location.search).get('lang');
    if (asked === 'pt' || asked === 'en') return asked;
    try {
      const saved = localStorage.getItem('prancheta.lang');
      if (saved === 'pt' || saved === 'en') return saved;
    } catch {}
    return (navigator.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'en';
  }

  document.querySelectorAll('.lang button').forEach((b) =>
    b.addEventListener('click', () => {
      setLang(b.dataset.lang);
      try { localStorage.setItem('prancheta.lang', b.dataset.lang); } catch {}
    }),
  );
  setLang(startLang());
})();
