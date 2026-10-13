(() => {
  const section = document.getElementById('casa-inteligente');
  let loaded = false;
  function loadHouse() {
    if (loaded) return;
    loaded = true;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'house3d.js?v=real25';
    script.addEventListener('error', () => {
      document.querySelector('.house-loading p').textContent = 'A visualização não carregou. Recarregue a página para tentar novamente.';
    });
    document.body.append(script);
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { loadHouse(); observer.disconnect(); }
    }, {rootMargin:'300px'});
    observer.observe(section);
  } else loadHouse();
})();
