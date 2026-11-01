import { setupPaver } from './paver.js?v=orange1';

export function setupProjectVisuals({ reducedMotion }) {
  setupPaver({ reducedMotion });

  const figure = document.querySelector('#mercury-reconstruction');
  const map = document.querySelector('#mercury-map');
  const label = document.querySelector('#mercury-stage');
  const motion = document.querySelector('#mercury-motion');
  const stages = [...document.querySelectorAll('[data-mercury-degree]')];
  let current = 0;
  let paused = reducedMotion.matches;
  let visible = false;
  let timer;
  // These are saved degree stages, not invented intermediate training frames.
  for (const degree of [50, 100]) { const image = new Image(); image.src = `assets/mercury-degree-${degree}.webp`; }
  function show(index) {
    current = index;
    const degree = stages[index].dataset.mercuryDegree;
    map.src = `assets/mercury-degree-${degree}.webp`;
    map.alt = `Mercury’s ${index ? 'reconstructed ' : ''}gravity field at spherical harmonic degree ${degree}`;
    label.textContent = `${index ? 'Reconstructed' : 'Input'} · degree ${degree}`;
    stages.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  }
  function sync() {
    clearInterval(timer);
    motion.textContent = paused ? 'Play' : 'Pause';
    motion.setAttribute('aria-pressed', String(paused));
    if (!paused && visible && !document.hidden) timer = setInterval(() => show((current + 1) % stages.length), 1500);
  }
  stages.forEach((button, index) => button.onclick = () => { paused = true; show(index); sync(); });
  motion.onclick = () => { paused = !paused; sync(); };
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: .1 }).observe(figure);
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', () => { paused = reducedMotion.matches; sync(); });
  sync();
}
