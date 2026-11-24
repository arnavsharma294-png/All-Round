(function () {
  'use strict';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const hero = document.querySelector('.hero');
  const experience = document.querySelector('#experience');
  const pin = document.querySelector('.experience-pin');
  const heroInstrument = document.querySelector('.hero-instrument');
  const privacyOrbit = document.querySelector('.privacy-orbit');
  const models = {
    hero: window.makeSculpture(document.querySelector('#hero-scene')),
    story: window.makeSculpture(document.querySelector('#story-scene'))
  };
  const chapterButtons = Array.from(experience.querySelectorAll('[data-step]'));
  const chapters = Array.from(experience.querySelectorAll('[data-chapter]'));
  const progressBar = document.querySelector('#story-progress');
  const chapterNumber = document.querySelector('#story-current');
  const channel = document.querySelector('#story-channel');
  const forms = [
    { title: 'Daily signals', accent: '#d8f187', tint: [.70, .89, .34], rotation: [.39, -.29, -.21], zoom: .88 },
    { title: 'Sleep and movement', accent: '#a8e5e1', tint: [.37, .77, .74], rotation: [.22, -.52, -.27], zoom: 1.03 },
    { title: 'Private by design', accent: '#efc388', tint: [.91, .60, .31], rotation: [.55, .26, .22], zoom: .89 }
  ];
  const clamp = value => Math.min(1, Math.max(0, value));
  const mix = (a, b, ratio) => a + (b - a) * ratio;
  let active = -1;
  let displayed = 0;
  let lastTime = 0;
  let frame = 0;
  let geometryDirty = true;
  let heroTop = 0;
  let heroHeight = 0;
  let storyTop = 0;
  let storyHeight = 0;
  let travel = 0;
  let orbitTop = 0;
  let orbitHeight = 0;
  let heroEntranceStart;
  let pointerX = 0;
  let pointerY = 0;
  let tiltX = 0;
  let tiltY = 0;

  function setChapter(index) {
    if (index === active) return;
    active = index;
    chapterButtons.forEach((button, number) => {
      if (number === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    chapters.forEach((chapter, number) => { chapter.hidden = number !== index; });
    chapterNumber.textContent = String(index + 1).padStart(2, '0');
    channel.textContent = forms[index].title;
    experience.style.setProperty('--chapter-color', forms[index].accent);
    experience.dataset.chapter = String(index + 1);
  }

  function measure() {
    const y = scrollY;
    heroTop = hero.getBoundingClientRect().top + y;
    heroHeight = hero.offsetHeight;
    storyTop = experience.getBoundingClientRect().top + y;
    storyHeight = experience.offsetHeight;
    travel = Math.max(1, storyHeight - pin.offsetHeight);
    orbitTop = privacyOrbit.getBoundingClientRect().top + y;
    orbitHeight = privacyOrbit.offsetHeight;
  }

  function renderStory(pose, tilt) {
    const from = Math.min(1, Math.floor(pose));
    const blend = pose - from;
    const start = forms[from];
    const finish = forms[from + 1];
    const color = start.tint.map((value, i) => mix(value, finish.tint[i], blend));
    const rotation = start.rotation.map((value, i) => mix(value, finish.rotation[i], blend));
    rotation[1] += tilt;
    models.story?.render({ form: pose, color, rotation, zoom: mix(start.zoom, finish.zoom, blend) });
  }

  function tick(now) {
    frame = 0;
    if (geometryDirty) {
      measure();
      geometryDirty = false;
    }
    const y = scrollY;
    const viewHeight = innerHeight;
    const delta = lastTime ? Math.min(33, now - lastTime) : 16;
    lastTime = now;
    const p = reduce.matches ? Math.max(0, active) / 2 : clamp((y - storyTop) / travel);
    progressBar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    if (!reduce.matches) setChapter(Math.min(2, Math.floor(p * 3)));
    const target = p * 2;
    displayed = reduce.matches ? target : mix(displayed, target, 1 - Math.exp(-delta / 120));

    let heroMoving = false;
    if (models.hero && y < heroTop + heroHeight && y + viewHeight > heroTop) {
      const arrival = heroEntranceStart ??= now;
      const entrance = reduce.matches ? 0 : (1 - clamp((now - arrival) / 920)) ** 3;
      const turn = reduce.matches ? 0 : clamp(y / heroHeight);
      const smoothing = 1 - Math.exp(-delta / 90);
      tiltX = reduce.matches ? 0 : mix(tiltX, pointerX, smoothing);
      tiltY = reduce.matches ? 0 : mix(tiltY, pointerY, smoothing);
      const shouldFollow = !reduce.matches && Math.hypot(tiltX - pointerX, tiltY - pointerY) > .002;
      heroMoving = entrance > 0 || shouldFollow;
      models.hero.render({
        form: turn * .48,
        rotation: [
          .37 + .43 * turn + .32 * tiltY,
          -.46 + turn * 2.06 + .44 * tiltX - .68 * entrance,
          -.34 + turn * .46 + .15 * entrance
        ],
        color: forms[0].tint,
        zoom: 1.06 - turn * .09 - .08 * entrance
      });
    }
    if (reduce.matches) {
      privacyOrbit.style.removeProperty('--orbit-x');
      privacyOrbit.style.removeProperty('--orbit-y');
    } else if (y < orbitTop + orbitHeight && y + viewHeight > orbitTop) {
      const phase = clamp((y + viewHeight - orbitTop) / (viewHeight + orbitHeight));
      privacyOrbit.style.setProperty('--orbit-x', (18 + phase * 122) + 'deg');
      privacyOrbit.style.setProperty('--orbit-y', (-92 + phase * 275) + 'deg');
    }
    const storyVisible = y < storyTop + storyHeight && y + viewHeight > storyTop;
    if (storyVisible) renderStory(displayed, reduce.matches ? 0 : p * 1.8);
    if (heroMoving || (storyVisible && Math.abs(displayed - target) > .002)) queueFrame();
  }

  function queueFrame() {
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function resize() {
    geometryDirty = true;
    queueFrame();
  }

  chapterButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      if (reduce.matches) {
        setChapter(index);
        queueFrame();
      } else {
        measure();
        window.scrollTo({ top: storyTop + travel * ((index + .38) / 3), behavior: 'smooth' });
      }
    });
  });

  heroInstrument.addEventListener('pointermove', event => {
    if (reduce.matches || event.pointerType !== 'mouse') return;
    const bounds = heroInstrument.getBoundingClientRect();
    pointerX = (event.clientX - bounds.left) / bounds.width * 2 - 1;
    pointerY = (event.clientY - bounds.top) / bounds.height * 2 - 1;
    queueFrame();
  });
  heroInstrument.addEventListener('pointerleave', () => {
    pointerX = 0;
    pointerY = 0;
    queueFrame();
  });

  setChapter(0);
  addEventListener('scroll', queueFrame, { passive: true });
  addEventListener('resize', resize);
  addEventListener('pageshow', resize);
  reduce.addEventListener('change', resize);
  document.fonts.ready.then(resize);
  new ResizeObserver(resize).observe(document.body);
  queueFrame();

  const metrics = {
    sleep: { values: [6.2, 7.4, 8.3, 6.6, 7.7, 7.1, 6.8], low: 5, high: 9, unit: 'hours', average: 'hours average', axis: ['9 h', '7 h', '5 h'], format: val => val.toFixed(1) },
    movement: { values: [6010, 8140, 9050, 7150, 8730, 7492, 6949], low: 4000, high: 10000, unit: 'steps', average: 'steps average', axis: ['10k', '7k', '4k'], format: val => Math.round(val).toLocaleString('en-US') },
    habits: { values: [1, 2, 3, 2, 3, 4, 2], low: 0, high: 4, unit: 'habits logged', average: 'habits per day', axis: ['4', '2', '0'], format: val => Number.isInteger(val) ? String(val) : val.toFixed(1) }
  };
  const days = ['Wed 18', 'Thu 19', 'Fri 20', 'Sat 21', 'Sun 22', 'Mon 23', 'Tue 24'];
  const canvas = document.querySelector('#trend-chart');
  const ctx = canvas.getContext('2d');
  const metricButtons = Array.from(document.querySelectorAll('[data-metric]'));
  const graphDays = document.querySelector('.graph-days');
  const axisLabels = Array.from(document.querySelectorAll('.graph-scale span'));
  let metricKey = 'sleep';
  let chosenDay = 6;
  let plotted = chartLevels();
  let chartFrame = 0;

  function chartLevels() {
    const { values, low, high } = metrics[metricKey];
    return values.map(value => (value - low) / (high - low));
  }

  function animateChart(previous) {
    if (chartFrame) cancelAnimationFrame(chartFrame);
    chartFrame = 0;
    const destination = chartLevels();
    if (reduce.matches || !ctx) {
      plotted = destination;
      drawChart();
      return;
    }

    let start;
    function animate(now) {
      start ??= now;
      const progress = clamp((now - start) / 420);
      const eased = 1 - (1 - progress) ** 3;
      plotted = destination.map((level, i) => mix(previous[i], level, eased));
      drawChart();
      chartFrame = progress < 1 ? requestAnimationFrame(animate) : 0;
    }
    chartFrame = requestAnimationFrame(animate);
  }

  function drawChart() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!ctx || !w || !h) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const width = Math.round(w * dpr);
    const height = Math.round(h * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const edge = 8;
    const bottom = h - edge;
    const points = plotted.map((level, i) => [
      w * (i + .5) / plotted.length,
      bottom - level * (bottom - edge)
    ]);
    ctx.strokeStyle = '#d5dfcd';
    ctx.lineWidth = 1;
    for (const y of [edge, h / 2, bottom]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    function line() {
      ctx.beginPath();
      ctx.moveTo(...points[0]);
      for (let i = 1; i < points.length; i += 1) {
        const [x, y] = points[i];
        const [priorX, priorY] = points[i - 1];
        const middle = (x + priorX) / 2;
        ctx.bezierCurveTo(middle, priorY, middle, y, x, y);
      }
    }

    line();
    ctx.lineTo(points.at(-1)[0], bottom);
    ctx.lineTo(points[0][0], bottom);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, bottom);
    gradient.addColorStop(0, '#a4c67a90');
    gradient.addColorStop(1, '#a4c67a15');
    ctx.fillStyle = gradient;
    ctx.fill();

    const [pickedX, pickedY] = points[chosenDay];
    ctx.strokeStyle = '#749361';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(pickedX, edge);
    ctx.lineTo(pickedX, bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    line();
    ctx.strokeStyle = '#416542';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    points.forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.arc(x, y, i === chosenDay ? 5 : 2.75, 0, Math.PI * 2);
      ctx.fillStyle = i === chosenDay ? '#2d4c32' : '#f9faef';
      ctx.fill();
      ctx.strokeStyle = '#416542';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.arc(pickedX, pickedY, 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#5f865d80';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const dayButtons = days.map((day, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = day.split(' ')[1];
    button.setAttribute('aria-label', day + ' November');
    button.addEventListener('click', () => {
      chosenDay = i;
      updateChart();
    });
    graphDays.append(button);
    return button;
  });

  function updateChart() {
    const metric = metrics[metricKey];
    const average = metric.values.reduce((sum, value) => sum + value, 0) / metric.values.length;
    metricButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.metric === metricKey)));
    dayButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === chosenDay)));
    axisLabels.forEach((label, i) => { label.textContent = metric.axis[i]; });
    document.querySelector('#metric-average').textContent = metric.format(average);
    document.querySelector('#metric-unit').textContent = metric.average;
    document.querySelector('#metric-detail').textContent = days[chosenDay] + ' Nov · ' + metric.format(metric.values[chosenDay]) + ' ' + metric.unit;
    drawChart();
  }

  metricButtons.forEach(button => button.addEventListener('click', () => {
    if (metricKey === button.dataset.metric) return;
    metricKey = button.dataset.metric;
    updateChart();
    animateChart(plotted);
  }));
  new ResizeObserver(drawChart).observe(canvas);
  updateChart();

  if ('IntersectionObserver' in window) {
    const reveal = new IntersectionObserver((entries, observer) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        observer.unobserve(target);
        if (reduce.matches) return;
        if (target === canvas) animateChart(plotted.map(() => .08));
        else target.classList.add('motion-reveal');
      });
    }, { threshold: .24 });
    reveal.observe(canvas);
    document.querySelectorAll('[data-reveal]').forEach(note => reveal.observe(note));
  }
  reduce.addEventListener('change', () => {
    if (reduce.matches && chartFrame) animateChart(plotted);
  });

  const nudgeButton = document.querySelector('#nudge-button');
  const nudgeStatus = document.querySelector('#nudge-status');
  const nudgeKey = 'know-thyself-demo-walk';
  let saved = false;
  try {
    saved = localStorage.getItem(nudgeKey) === 'yes';
  } catch {}

  function updateNudge() {
    nudgeButton.textContent = saved ? 'Remove saved nudge' : 'Save this nudge';
    nudgeButton.setAttribute('aria-pressed', String(saved));
  }

  nudgeButton.addEventListener('click', () => {
    saved = !saved;
    try {
      if (saved) localStorage.setItem(nudgeKey, 'yes');
      else localStorage.removeItem(nudgeKey);
    } catch {}
    updateNudge();
    nudgeStatus.textContent = saved ? 'Walk saved to this journal.' : 'Walk removed from this journal.';
  });
  updateNudge();

  if (location.protocol === 'file:') document.querySelector('#download-demo').hidden = true;
}());
