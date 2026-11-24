// Recorded evaluation v2 means and bootstrap intervals.
const models = [{"name": "GPT-6 Luna", "cost": 0.0063, "score": 27.5784, "lo": 24.2783, "hi": 30.9692}, {"name": "GPT-6.1 Terra", "cost": 0.0504, "score": 65.0925, "lo": 60.9069, "hi": 68.9864}, {"name": "Claude Haiku 5.5", "cost": 0.0583, "score": 69.0668, "lo": 63.553, "hi": 72.7718}, {"name": "GPT-6.1 Sol", "cost": 0.4238, "score": 90.6899, "lo": 88.6148, "hi": 92.5535}, {"name": "Claude Sonnet 5.5", "cost": 0.585, "score": 85.3866, "lo": 82.8296, "hi": 87.9106}, {"name": "Claude Opus 5.5", "cost": 1.1564, "score": 90.439, "lo": 89.143, "hi": 91.6825}, {"name": "GPT-6 Astra", "cost": 1.5272, "score": 92.1903, "lo": 90.7708, "hi": 93.4763}, {"name": "GPT-6.2 Astra", "cost": 1.5924, "score": 95.864, "lo": 94.9884, "hi": 96.6567}, {"name": "Claude Fable 5.2", "cost": 6.7722, "score": 95.8541, "lo": 94.8714, "hi": 96.8305}];
export function setupWildChart() {
  const canvas = document.querySelector('#wild-cost-chart');
  const detail = document.querySelector('#wild-chart-detail');
  const context = canvas.getContext('2d');
  let points = [];
  let selected = -1;
  function draw() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const scale = window.devicePixelRatio || 1;
    canvas.width = width * scale;
    canvas.height = height * scale;
    context.scale(scale, scale);
    const style = getComputedStyle(canvas);
    const ink = style.getPropertyValue('--ink').trim();
    const accent = style.getPropertyValue('--accent').trim();
    const line = style.getPropertyValue('--line').trim();
    const left = 34, right = width - 18, top = 20, bottom = height - 30;
    const x = cost => left + (Math.log10(cost) + 2.4) / 3.4 * (right - left);
    const y = score => bottom - score / 100 * (bottom - top);
    context.font = '12px Departure, monospace';
    context.lineWidth = 1;
    for (const tick of [0, 50, 100]) {
      context.strokeStyle = line;
      context.globalAlpha = .3;
      context.beginPath(); context.moveTo(left, y(tick)); context.lineTo(right, y(tick)); context.stroke();
      context.globalAlpha = 1;
      context.fillStyle = ink;
      context.textAlign = 'right';
      context.fillText(String(tick), left - 8, y(tick) + 4);
    }
    for (const tick of [.01, .1, 1, 10]) {
      context.textAlign = tick === 10 ? 'right' : 'center';
      context.fillText('$' + tick, x(tick), height - 8);
    }
    // The search baseline uses the same score scale.
    context.strokeStyle = line;
    context.setLineDash([3, 5]);
    context.beginPath(); context.moveTo(left, y(46.7)); context.lineTo(right, y(46.7)); context.stroke();
    context.setLineDash([]);
    context.fillStyle = accent;
    context.textAlign = 'right';
    context.fillText('search 46.7', right, y(46.7) - 5);
    points = models.map(model => ({x:x(model.cost), y:y(model.score)}));
    models.forEach((model, index) => {
      const point = points[index];
      context.strokeStyle = accent;
      context.globalAlpha = .5;
      context.beginPath(); context.moveTo(point.x,y(model.lo)); context.lineTo(point.x,y(model.hi)); context.stroke();
      context.globalAlpha = 1;
      context.fillStyle = index === selected ? ink : accent;
      context.beginPath(); context.arc(point.x,point.y,index === selected ? 5 : 3.5,0,Math.PI*2); context.fill();
    });
    const labels = [
      [0,'Luna',8,-5], [1,'Terra',-8,17], [2,'Haiku',8,-8],
      [7,'Astra 6.2*',-7,-12], [8,'Fable',-7,17]
    ];
    for (const [index,label,dx,dy] of labels) {
      context.fillStyle = ink;
      context.textAlign = dx < 0 ? 'right' : 'left';
      context.fillText(label,points[index].x+dx,points[index].y+dy);
    }
  }
  function inspect(event) {
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left, py = event.clientY - rect.top;
    let distance = 24;
    selected = -1;
    points.forEach((point,index) => {
      const candidate = Math.hypot(point.x-px,point.y-py);
      if (candidate < distance) { selected=index; distance=candidate; }
    });
    detail.textContent = selected < 0 ? 'Score / 100 · log cost · *assumed price' : models[selected].name.replace('Claude ','') + ' · ' + models[selected].score.toFixed(1) + ' · $' + models[selected].cost.toFixed(2) + '/task';
    draw();
  }
  canvas.addEventListener('pointermove',inspect);
  canvas.addEventListener('pointerdown',inspect);
  new ResizeObserver(draw).observe(canvas);
  document.fonts.ready.then(draw);
}
