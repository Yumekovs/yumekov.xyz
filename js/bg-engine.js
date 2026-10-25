window.BgEngine = (function() {
  let canvas, ctx, videoEl, imgEl, dimmerEl;
  let width = 0, height = 0, mode = 'particles', speed = 1.0, accent = '#8b5cf6';
  let particles = [], matrixDrops = [], mouse = { x: -1000, y: -1000 }, tick = 0;

  function init() {
    canvas = document.getElementById('bg-canvas');
    ctx = canvas.getContext('2d');
    videoEl = document.getElementById('bg-video-layer');
    imgEl = document.getElementById('bg-image-layer');
    dimmerEl = document.getElementById('bg-dimmer');
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
    requestAnimationFrame(loop);
  }

  function resize() {
    if (!canvas) return;
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    particles = [];
    const count = Math.min(90, Math.floor((width * height) / 16000));
    for (let i = 0; i < count; i++) {
      particles.push({ x: Math.random() * width, y: Math.random() * height, vx: (Math.random() - 0.5) * 0.7, vy: (Math.random() - 0.5) * 0.7, r: Math.random() * 2 + 1 });
    }
    matrixDrops = Array(Math.floor(width / 20)).fill(1);
  }

  function applyTheme(theme) {
    if (!theme) return;
    mode = theme.bgMode || 'particles';
    speed = parseFloat(theme.particleSpeed) || 1.0;
    accent = theme.accent || '#8b5cf6';
    const dim = theme.wallpaperDim !== undefined ? theme.wallpaperDim : 0.65;
    document.documentElement.style.setProperty('--accent', accent);
    document.documentElement.style.setProperty('--glass-blur', (theme.glassBlur || 18) + 'px');
    if (dimmerEl) dimmerEl.style.background = `radial-gradient(circle at 50% 0%, rgba(139, 92, 246, 0.14), rgba(6, 4, 10, ${dim}) 80%)`;
    const customUrl = (theme.customWallpaperUrl || '').trim();
    if (mode === 'wallpaper' && customUrl) {
      if (/\\.(mp4|webm|ogg)(\\?.*)?$/i.test(customUrl)) {
        videoEl.src = customUrl; videoEl.style.display = 'block'; videoEl.play().catch(()=>{});
        imgEl.style.display = 'none';
      } else {
        imgEl.src = customUrl; imgEl.style.display = 'block';
        videoEl.style.display = 'none'; videoEl.pause();
      }
    } else {
      if (videoEl) { videoEl.style.display = 'none'; videoEl.pause(); }
      if (imgEl) imgEl.style.display = 'none';
    }
  }

  function loop() {
    requestAnimationFrame(loop);
    if (!ctx) return;
    tick += 0.015 * speed;
    if (mode === 'minimal' || mode === 'wallpaper') { ctx.clearRect(0, 0, width, height); return; }
    if (mode === 'particles') {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        p.x += p.vx * speed; p.y += p.vy * speed;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill();
      }
    }
  }
  return { init, applyTheme };
})();
