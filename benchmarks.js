// Replay measured requests in their recorded order. Values are never synthesized.
export async function setupBenchmarks({ reducedMotion }) {
  const region = document.querySelector('.chart-pair');
  const motion = document.querySelector('#chart-motion');
  const ns = 'http://www.w3.org/2000/svg';
  const windowSize = 80;
  const requestsPerSecond = 40;
  const descriptions = {
    'shared-prefill': 'Compute the history once, reuse it across beams.',
    'batched-constraints': 'Apply recommendation constraints to the beams in a batch.',
    'gpu-constraints': 'Move constraint lookup onto the GPU.',
    'compiled-forward': 'Compile the model. Median improves slightly; p95 gets worse.',
    'native-gqa': 'Two KV heads, without expanding them to twelve.'
  };
  const charts = [];
  let phase = windowSize - 1;
  let paused = reducedMotion.matches;
  let visible = false;
  let frame = 0;
  let previous = 0;
  let lastPaint = 0;

  const median = values => {
    const ordered = values.slice().sort((a, b) => a - b);
    const middle = ordered.length / 2;
    return (ordered[middle - 1] + ordered[middle]) / 2;
  };
  const modulo = (n, length) => ((n % length) + length) % length;
  const node = (tag, attrs, text) => {
    const element = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    if (text !== undefined) element.textContent = text;
    return element;
  };

  function rebuild(chart) {
    const { figure, svg, data } = chart;
    const before = median(data.requests.map(row => row[0]));
    const after = median(data.requests.map(row => row[1]));
    figure.querySelector('h3').textContent = data.label;
    figure.querySelector('.median-before').textContent = Math.round(before);
    figure.querySelector('.median-after').textContent = Math.round(after);
    figure.querySelector('.chart-description').textContent = descriptions[data.id];
    figure.querySelector('.key-before').textContent = data.beforeName;
    figure.querySelector('.key-after').textContent = data.afterName;
    svg.setAttribute('aria-label', `${data.label}: median ${before.toFixed(3)} to ${after.toFixed(3)} milliseconds. Replaying 500 recorded paired requests.`);
    const width = Math.max(280, Math.round(svg.clientWidth));
    const height = width < 400 ? 240 : 280;
    const values = data.requests.flat();
    const quantum = data.id === 'shared-prefill' ? 400 : 20;
    const low = data.id === 'shared-prefill' ? 0 : Math.floor(Math.min(...values) / quantum) * quantum;
    const high = Math.ceil(Math.max(...values) / quantum) * quantum;
    chart.geometry = { width, height, left: 48, right: width - 12, top: 22, bottom: height - 33, low, high };
    const { left, right, top, bottom } = chart.geometry;
    chart.y = value => bottom - (value - low) / (high - low) * (bottom - top);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.replaceChildren();
    const defs = node('defs', {});
    const clip = node('clipPath', { id: `${svg.id}-clip` });
    clip.append(node('rect', { x: left, y: top - 4, width: right - left + 4, height: bottom - top + 8 }));
    defs.append(clip);
    svg.append(defs);
    for (let i = 0; i < 4; i++) {
      const value = low + (high - low) * i / 3;
      const y = chart.y(value);
      svg.append(node('line', { x1: left, x2: right, y1: y, y2: y, class: 'grid-line' }));
      svg.append(node('text', { x: left - 10, y: y + 4, 'text-anchor': 'end' }, Math.round(value)));
    }
    svg.append(node('text', { x: 0, y: 10 }, 'ms'));
    chart.firstTick = node('text', { x: left, y: height - 5 }, '1');
    chart.lastTick = node('text', { x: right, y: height - 5, 'text-anchor': 'end' }, '80');
    svg.append(chart.firstTick, node('text', { x: (left + right) / 2, y: height - 5, 'text-anchor': 'middle' }, 'request'), chart.lastTick);
    const traces = node('g', { 'clip-path': `url(#${svg.id}-clip)` });
    chart.paths = ['before', 'after'].map(kind => node('path', { class: `trace trace-${kind}` }));
    chart.heads = ['before', 'after'].map(kind => node('rect', { width: 6, height: 6, class: `head-${kind}` }));
    traces.append(...chart.paths, ...chart.heads);
    svg.append(traces);
    render(chart);
  }

  function render(chart) {
    const { svg, data, geometry: g } = chart;
    if (!g) return;
    const end = Math.floor(phase);
    const start = end - windowSize + 1;
    const fraction = phase - end;
    const dx = (g.right - g.left) / (windowSize - 1);
    const paths = ['', ''];
    // Include one sample beyond the left clip so the trace scrolls continuously.
    for (let offset = -1; offset < windowSize; offset++) {
      const index = modulo(start + offset, data.requests.length);
      const x = g.left + (offset - fraction) * dx;
      const command = offset === -1 || index === 0 ? 'M' : 'L';
      for (let series = 0; series < 2; series++) {
        paths[series] += `${command}${x.toFixed(2)},${chart.y(data.requests[index][series]).toFixed(2)} `;
      }
    }
    chart.paths.forEach((path, i) => path.setAttribute('d', paths[i]));
    const index = modulo(end, data.requests.length);
    const row = data.requests[index];
    chart.heads.forEach((head, i) => {
      head.setAttribute('x', g.right - fraction * dx - 3);
      head.setAttribute('y', chart.y(row[i]) - 3);
    });
    chart.firstTick.textContent = modulo(start, data.requests.length) + 1;
    chart.lastTick.textContent = index + 1;
    chart.readout.textContent = `#${index + 1} / 500 · ${row[0].toFixed(1)} → ${row[1].toFixed(1)} ms`;
    svg.dataset.requestIndex = index;
  }

  const canAnimate = () => charts.length && visible && !paused && !document.hidden;
  function animate(time) {
    frame = 0;
    if (!canAnimate()) return;
    if (previous) phase = (phase + Math.min((time - previous) / 1000, 0.1) * requestsPerSecond) % 500;
    previous = time;
    if (time - lastPaint >= 1000 / 30) {
      charts.forEach(render);
      lastPaint = time;
    }
    frame = requestAnimationFrame(animate);
  }
  function sync() {
    motion.textContent = paused ? 'Play charts' : 'Pause charts';
    motion.setAttribute('aria-pressed', String(paused));
    region.dataset.playing = String(Boolean(canAnimate()));
    if (canAnimate()) {
      if (!frame) { previous = 0; frame = requestAnimationFrame(animate); }
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
    }
  }
  motion.addEventListener('click', () => { paused = !paused; sync(); });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: 0.05 }).observe(region);
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', () => { paused = reducedMotion.matches; sync(); });

  try {
    const response = await fetch('assets/benchmarks.json');
    if (!response.ok) throw new Error('Benchmark data unavailable');
    const data = await response.json();
    if (data.some(d => d.requests.length !== 500 || d.requests.some(row => row.length !== 2 || row.some(v => !Number.isFinite(v))))) throw new Error('Invalid measurements');
    for (const [selector, id] of [['#prefill-chart', 'shared-prefill'], ['#gqa-chart', 'native-gqa']]) {
      const figure = document.querySelector(selector);
      const svg = figure.querySelector('svg');
      const chart = { figure, svg, data: data.find(d => d.id === id), readout: figure.querySelector('output') };
      charts.push(chart);
      rebuild(chart);
      new ResizeObserver(() => {
        if (Math.round(svg.clientWidth) !== chart.geometry.width) rebuild(chart);
      }).observe(svg);
      svg.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        paused = true;
        sync();
        phase = event.key === 'Home' ? 0 : event.key === 'End' ? 499 : modulo(Math.floor(phase) + (event.key === 'ArrowRight' ? 1 : -1), 500);
        charts.forEach(render);
      });
    }
    const experiments = document.querySelector('.experiments');
    for (const comparison of data.filter(d => d.id !== 'native-gqa')) {
      const button = document.createElement('button');
      button.className = 'experiment';
      button.textContent = comparison.label;
      button.dataset.comparison = comparison.id;
      button.setAttribute('aria-pressed', String(comparison.id === 'shared-prefill'));
      button.addEventListener('click', () => {
        charts[0].data = comparison;
        rebuild(charts[0]);
        experiments.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      });
      experiments.append(button);
    }
    sync();
  } catch {
    document.querySelectorAll('.chart-readout').forEach(output => { output.textContent = 'Measurements unavailable. See the source data below.'; });
    motion.hidden = true;
  }
}
