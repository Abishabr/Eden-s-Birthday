/**
 * Eden's Birthday — Upgraded Cinematic Experience
 * Luxury reveal sequence: Gift → Light → Envelope → Letter → Bouquet → Cake → Celebration
 */
'use strict';

const CDN = {
  threejs: 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js',
  gsap:    'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
  lenis:   'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js'
};

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  isTouchDevice: false,
  threeReady: false,
  transitioning: false,
  audioStarted: false,
  muted: false
};

// ── Utils ─────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const lerp = (a, b, t) => a + (b - a) * t;

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const dom = {
  scene1:        $('scene1'),
  scene2:        $('scene2'),
  scene3:        $('scene3'),
  scene4:        $('scene4'),
  scene5:        $('scene5'),
  scene6:        $('scene6'),
  reservedLabel: $('reservedLabel'),
  arrivalCopy:   $('arrivalCopy'),
  openGiftBtn:   $('openGiftBtn'),
  envelope:      $('envelope'),
  envelopeHint:  document.querySelector('.envelope-hint'),
  letterOverlay: $('letterOverlay'),
  continueBtn:   $('continueBtn'),
  // Scene 4
  bouquetContent:  $('bouquetContent'),
  bouquetEyebrow:  $('bouquetEyebrow'),
  bouquetStage:    $('bouquetStage'),
  bouquetRotator:  $('bouquetRotator'),
  bouquetText:     $('bouquetText'),
  bLine1:          $('bLine1'),
  bLine2:          $('bLine2'),
  toCakeBtn:       $('toCakeBtn'),
  // Scene 5
  cakeWrapper:     $('cakeWrapper'),
  sLine1:          $('sLine1'),
  sLine2:          $('sLine2'),
  sLine3:          $('sLine3'),
  // Scene 6
  celebHeading:    $('celebHeading'),
  celebSub:        $('celebSub'),
  celebrationCanvas: $('celebrationCanvas'),
  // Misc
  threeCanvas:   $('threeCanvas'),
  muteBtn:       $('muteToggle'),
  iconMuted:     $('iconMuted'),
  iconUnmuted:   $('iconUnmuted')
};

let gsap;

// ── Audio ─────────────────────────────────────────────────────────────────────
const Audio = (() => {
  let ctx, master, ambGain, orchGain;
  let ambNode = null, orchNode = null;

  function makeReverb(dur, decay) {
    const len = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    const c = ctx.createConvolver(); c.buffer = buf; return c;
  }

  function init() {
    try {
      ctx = new AudioContext();
      master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
      ambGain = ctx.createGain(); ambGain.gain.value = 0; ambGain.connect(master);
      orchGain = ctx.createGain(); orchGain.gain.value = 0; orchGain.connect(master);
    } catch(e) { console.warn('AudioContext unavailable'); }
  }

  function startAmbient() {
    if (!ctx || ambNode) return;
    if (ctx.state === 'suspended') ctx.resume();
    const rev = makeReverb(5, 3.5);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 380; filt.Q.value = 0.2;
    const pad = ctx.createGain(); pad.gain.value = 0.5;
    [[55, 0.038], [82.5, 0.022]].forEach(([f, v]) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; g.gain.value = v;
      o.connect(g); g.connect(filt); o.start();
      setInterval(() => o.frequency.setTargetAtTime(f + (Math.random()*2-1), ctx.currentTime, 8), 10000);
    });
    filt.connect(rev); rev.connect(pad); pad.connect(ambGain);
    ambGain.gain.setTargetAtTime(0.28, ctx.currentTime, 3);
    ambNode = true;
  }

  function toOrchestral() {
    if (!ctx || orchNode) return;
    const rev = makeReverb(5, 2.2);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 550;
    const g = ctx.createGain(); g.gain.value = 0.32;
    [130.81, 164.81, 196, 261.63].forEach((f, i) => {
      const o = ctx.createOscillator(); const og = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; og.gain.value = 0.038 / (i + 1);
      o.connect(og); og.connect(filt); o.start();
    });
    filt.connect(rev); rev.connect(g); g.connect(orchGain);
    ambGain.gain.setTargetAtTime(0.06, ctx.currentTime, 2);
    orchGain.gain.setTargetAtTime(0.36, ctx.currentTime, 3);
    orchNode = true;
  }

  function peak() {
    if (!ctx) return;
    orchGain.gain.setTargetAtTime(0.46, ctx.currentTime, 3);
  }

  function mute(val) {
    if (!master) return;
    master.gain.setTargetAtTime(val ? 0 : 1, ctx.currentTime, 0.1);
  }

  return { init, startAmbient, toOrchestral, peak, mute };
})();

// ── Three.js Gift Box ─────────────────────────────────────────────────────────
let THREE, renderer, threeScene, camera;
let giftGroup, boxLid, ribbonBow, ribbonH, ribbonV;
let goldLight, pointLt;
let targetRotX = 0, targetRotY = 0, curRotX = 0, curRotY = 0;
let floatTween;

async function initThreeJS() {
  try {
    THREE = await import(CDN.threejs);
    buildGiftScene();
    state.threeReady = true;
  } catch(e) {
    console.warn('Three.js unavailable — CSS fallback');
    dom.threeCanvas.style.display = 'none';
    $('fallbackBox').style.display = 'block';
  }
}

function buildGiftScene() {
  const wrap = $('canvasWrapper');
  const W = wrap.offsetWidth || 320;
  const H = wrap.offsetHeight || 320;

  renderer = new THREE.WebGLRenderer({ canvas: dom.threeCanvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setClearColor(0x0d0d10, 1);

  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(0x0d0d10);

  camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
  camera.position.set(0, 0.3, 4.5);

  // Lights
  threeScene.add(new THREE.AmbientLight(0x3a2e1e, 1.4));
  const key = new THREE.DirectionalLight(0xfff5e0, 2.4);
  key.position.set(3, 5, 3); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); threeScene.add(key);
  const fill = new THREE.DirectionalLight(0xc9a86a, 0.9);
  fill.position.set(-3, 1, -2); threeScene.add(fill);
  const rim = new THREE.DirectionalLight(0xffeebb, 0.65);
  rim.position.set(0, -2, -4); threeScene.add(rim);
  pointLt = new THREE.PointLight(0xc9a86a, 0, 3);
  pointLt.position.set(0, 0.5, 0); threeScene.add(pointLt);
  goldLight = new THREE.PointLight(0xffcc66, 0, 5);
  goldLight.position.set(0, 1.5, 0); threeScene.add(goldLight);

  const matte = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.85, metalness: 0.12 });
  const lid   = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.88, metalness: 0.1 });
  const gold  = new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.28, metalness: 0.65 });

  giftGroup = new THREE.Group();
  threeScene.add(giftGroup);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), matte);
  body.position.y = -0.15; body.castShadow = true; body.receiveShadow = true;
  giftGroup.add(body);

  boxLid = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.3, 1.68), lid);
  boxLid.position.y = 0.6; boxLid.castShadow = true; giftGroup.add(boxLid);

  ribbonH = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.14), gold);
  ribbonH.position.y = 0.75; giftGroup.add(ribbonH);
  ribbonV = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 1.7), gold);
  ribbonV.position.y = 0.75; giftGroup.add(ribbonV);

  ribbonBow = new THREE.Group(); ribbonBow.position.set(0, 0.82, 0);
  const torus = new THREE.TorusGeometry(0.2, 0.045, 12, 36);
  const b1 = new THREE.Mesh(torus, gold); b1.position.set(-0.18, 0.02, 0); b1.rotation.set(0.3, 0.2, -0.4);
  const b2 = new THREE.Mesh(torus, gold); b2.position.set(0.18, 0.02, 0); b2.rotation.set(0.3, -0.2, 0.4);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), gold);
  ribbonBow.add(b1, b2, knot); giftGroup.add(ribbonBow);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.ShadowMaterial({ opacity: 0.3 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.85; shadow.receiveShadow = true;
  threeScene.add(shadow);

  renderLoop();

  window.addEventListener('resize', () => {
    const nw = wrap.offsetWidth, nh = wrap.offsetHeight;
    camera.aspect = nw / nh; camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });
}

function renderLoop() {
  requestAnimationFrame(renderLoop);
  if (!renderer) return;
  if (!state.isTouchDevice) {
    curRotX = lerp(curRotX, targetRotX, 0.05);
    curRotY = lerp(curRotY, targetRotY, 0.05);
    if (giftGroup) { giftGroup.rotation.x = curRotX; giftGroup.rotation.y = curRotY + 0.16; }
  }
  renderer.render(threeScene, camera);
}

// ── Scene 1 Arrival animations ────────────────────────────────────────────────
function animateArrival() {
  const d = state.reducedMotion ? 0.1 : 1;
  gsap.to(dom.reservedLabel, { opacity: 1, duration: d * 1.2, ease: 'power2.out', delay: 0.3 });
  gsap.fromTo(dom.arrivalCopy, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: d * 1.4, ease: 'power2.out', delay: 0.7 });
  gsap.to(dom.openGiftBtn, { opacity: 1, duration: d, ease: 'power2.out', delay: 1.2 });

  if (state.threeReady && giftGroup && !state.reducedMotion) {
    floatTween = gsap.to(giftGroup.position, { y: 0.14, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }
}

// ── Scene 2 — Opening sequence ────────────────────────────────────────────────
function startOpening() {
  if (state.transitioning) return;
  state.transitioning = true;
  document.body.style.overflow = 'hidden';

  if (!state.audioStarted) {
    try { Audio.startAmbient(); state.audioStarted = true; } catch(e) {}
  }

  const d = state.reducedMotion ? 0.1 : 1;
  const tl = gsap.timeline({ onComplete: showScene3 });

  if (floatTween) floatTween.pause();

  // Fade out arrival UI
  tl.to([dom.reservedLabel, dom.arrivalCopy, dom.openGiftBtn], {
    opacity: 0, y: -10, duration: d * 0.5, ease: 'power2.in', stagger: 0.07
  });

  if (state.threeReady && camera && !state.reducedMotion) {
    // Zoom in
    tl.to(camera.position, { z: 2.2, y: 0.5, duration: d * 2, ease: 'power2.inOut' }, '-=0.2');

    // Untie bow
    if (ribbonBow) {
      tl.to(ribbonBow.scale, { x: 0, z: 0, duration: d * 0.8, ease: 'power2.inOut' }, '-=1.2');
      tl.to(ribbonBow.position, { y: ribbonBow.position.y - 0.12, duration: d * 0.5, ease: 'power2.in' }, '<');
    }
    if (ribbonH) tl.to(ribbonH.scale, { x: 0, duration: d * 0.4, ease: 'power1.in' }, '-=0.3');
    if (ribbonV) tl.to(ribbonV.scale, { z: 0, duration: d * 0.4, ease: 'power1.in' }, '<');

    // Lift lid
    if (boxLid) {
      tl.to(boxLid.position, { y: 2.8, duration: d * 1.8, ease: 'power1.inOut' }, '-=0.2');
      tl.to(boxLid.rotation, { x: -0.3, duration: d * 1.8, ease: 'power1.inOut' }, '<');
    }

    // Gold light escapes
    if (goldLight) tl.to(goldLight, { intensity: 3.5, duration: d * 1.2, ease: 'power2.out' }, '-=1.2');
    if (pointLt)   tl.to(pointLt,   { intensity: 1.5, duration: d * 0.8, ease: 'power2.out' }, '-=0.8');
  } else {
    tl.to({}, { duration: d * 2.5 });
  }

  tl.call(() => { try { Audio.toOrchestral(); } catch(e) {} }, [], '-=1');
}

// ── Scene 3 — Envelope ────────────────────────────────────────────────────────
function showScene3() {
  dom.scene3.classList.add('active');
  dom.scene3.setAttribute('aria-hidden', 'false');

  gsap.to(dom.scene1, {
    opacity: 0, duration: 0.8, ease: 'power2.inOut',
    onComplete: () => { dom.scene1.style.display = 'none'; }
  });

  gsap.fromTo($('envelopeWrapper'), { opacity: 0, y: 60 }, {
    opacity: 1, y: 0,
    duration: state.reducedMotion ? 0.1 : 1.8,
    ease: 'power1.out', delay: 0.4,
    onComplete: () => { state.transitioning = false; }
  });
}

function openEnvelope() {
  if (state.transitioning) return;
  dom.envelope.classList.add('opening');
  if (dom.envelopeHint) dom.envelopeHint.style.opacity = '0';
  setTimeout(showLetter, state.reducedMotion ? 100 : 920);
}

function showLetter() {
  dom.letterOverlay.classList.add('visible');
  dom.letterOverlay.setAttribute('aria-hidden', 'false');
  $('envelopeWrapper').style.opacity = '0';
  $('envelopeWrapper').style.pointerEvents = 'none';
  const first = dom.letterOverlay.querySelector('button,[tabindex]');
  if (first) first.focus();
}

// ── Scene 4 — Bouquet: Emotional Peak ────────────────────────────────────────
function showBouquet() {
  if (state.transitioning) return;
  state.transitioning = true;

  const d = state.reducedMotion ? 0.1 : 1;

  // Fold letter away
  gsap.to(dom.letterOverlay, {
    opacity: 0, scaleY: 0.92, duration: d, ease: 'power2.in',
    onComplete: () => {
      dom.scene3.classList.remove('active');
      dom.scene3.setAttribute('aria-hidden', 'true');
      runBouquetScene();
    }
  });
}

function runBouquetScene() {
  dom.scene4.classList.add('active');
  dom.scene4.setAttribute('aria-hidden', 'false');

  initScene4Particles();

  const d = state.reducedMotion ? 0.1 : 1;
  const tl = gsap.timeline({ onComplete: () => { state.transitioning = false; } });

  // Eyebrow
  tl.fromTo(dom.bouquetEyebrow, { opacity: 0, y: 10 }, {
    opacity: 1, y: 0, duration: d * 0.8, ease: 'power2.out'
  }, 0.2);

  // Bouquet rises from below with slow float-up
  tl.fromTo(dom.bouquetStage, { opacity: 0, y: state.reducedMotion ? 0 : 60, scale: 0.92 }, {
    opacity: 1, y: 0, scale: 1,
    duration: state.reducedMotion ? 0.1 : 2.2,
    ease: 'power2.out'
  }, 0.5);

  // Start gentle rotation + float on rotator
  if (!state.reducedMotion) {
    gsap.to(dom.bouquetRotator, {
      rotateY: 3, duration: 4, ease: 'sine.inOut',
      yoyo: true, repeat: -1
    });
    gsap.to(dom.bouquetStage, {
      y: -10, duration: 3.8, ease: 'sine.inOut',
      yoyo: true, repeat: -1, delay: 0.6
    });
  }

  // Caption lines stagger in
  tl.fromTo(dom.bLine1, { opacity: 0, y: 14 }, {
    opacity: 1, y: 0, duration: d * 0.9, ease: 'power2.out'
  }, '-=0.8');
  tl.fromTo(dom.bLine2, { opacity: 0, y: 14 }, {
    opacity: 1, y: 0, duration: d * 0.9, ease: 'power2.out'
  }, '-=0.6');
  tl.to(dom.toCakeBtn, { opacity: 1, duration: d * 0.7, ease: 'power2.out' }, '-=0.3');
}

// Scene 4 particles — very soft, minimal golden motes
function initScene4Particles() {
  const canvas = $('scene4Canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Only 8 soft particles — elegant, not noisy
  const pts = Array.from({ length: 8 }, () => ({
    x: Math.random() * canvas.width,
    y: canvas.height * 0.3 + Math.random() * canvas.height * 0.5,
    r: Math.random() * 2.5 + 1,
    vx: (Math.random() - 0.5) * 0.25,
    vy: -(Math.random() * 0.35 + 0.1),
    alpha: Math.random() * 0.25 + 0.08
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pts.forEach(p => {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      g.addColorStop(0, `rgba(201,168,106,${p.alpha})`);
      g.addColorStop(1, 'rgba(201,168,106,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2); ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.y < -30) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
    });
    requestAnimationFrame(draw);
  }
  draw();
}

// ── Scene 5 — Cake: Final Reveal ─────────────────────────────────────────────
function showCake() {
  if (state.transitioning) return;
  state.transitioning = true;

  const d = state.reducedMotion ? 0.1 : 1;

  gsap.to(dom.scene4, {
    opacity: 0, duration: d * 0.8, ease: 'power2.in',
    onComplete: () => {
      dom.scene4.classList.remove('active');
      dom.scene4.setAttribute('aria-hidden', 'true');
      runCakeScene();
    }
  });
}

function runCakeScene() {
  dom.scene5.classList.add('active');
  dom.scene5.setAttribute('aria-hidden', 'false');

  buildCake();
  initCakeParticles();

  const d = state.reducedMotion ? 0.1 : 1;
  const tl = gsap.timeline({
    onComplete: () => {
      state.transitioning = false;
      // Longer pause so cake scene is clearly distinct from celebration
      setTimeout(showCelebration, state.reducedMotion ? 400 : 3500);
    }
  });

  // Scene label
  tl.fromTo($('cakeSceneLabel'), { opacity: 0, y: 8 }, {
    opacity: 1, y: 0, duration: d * 0.7, ease: 'power2.out'
  }, 0.2);

  // Cake rises with warm glow
  tl.fromTo(dom.cakeWrapper, { opacity: 0, y: state.reducedMotion ? 0 : 55 }, {
    opacity: 1, y: 0, duration: state.reducedMotion ? 0.1 : 2.0, ease: 'power1.out'
  }, 0.5);

  // Text stagger — slower, more cinematic
  const delay = state.reducedMotion ? 0 : 0.55;
  tl.to(dom.sLine1, { opacity: 1, y: 0, duration: d * 0.8, ease: 'power2.out' }, '-=0.3');
  tl.to(dom.sLine2, { opacity: 1, y: 0, duration: d * 0.8, ease: 'power2.out' }, `+=${delay}`);
  tl.to(dom.sLine3, { opacity: 1, y: 0, duration: d * 0.8, ease: 'power2.out' }, `+=${delay}`);
}

function buildCake() {
  dom.cakeWrapper.innerHTML = `
    <div class="cake" aria-label="Birthday cake with three tiers and candles">
      <div class="cake-candle-group" aria-hidden="true">
        <div class="cake-candle"><div class="cake-flame"></div></div>
        <div class="cake-candle"><div class="cake-flame"></div></div>
        <div class="cake-candle"><div class="cake-flame"></div></div>
      </div>
      <div class="cake-tier cake-tier-3"></div>
      <div class="cake-tier cake-tier-2"></div>
      <div class="cake-tier cake-tier-1">
        <div class="cake-dots">
          <div class="cake-dot"></div><div class="cake-dot"></div>
          <div class="cake-dot"></div><div class="cake-dot"></div><div class="cake-dot"></div>
        </div>
      </div>
      <div class="cake-plate" aria-hidden="true"></div>
      <div class="cake-glow" aria-hidden="true"></div>
    </div>`;
}

// Soft ambient particles for cake scene — warm gold drift only, no fireworks
function initCakeParticles() {
  const canvas = $('cakeCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pts = Array.from({ length: 14 }, () => ({
    x: Math.random() * canvas.width,
    y: canvas.height + Math.random() * 60,
    r: Math.random() * 2 + 0.6,
    vx: (Math.random() - 0.5) * 0.4,
    vy: -(Math.random() * 0.6 + 0.2),
    alpha: Math.random() * 0.3 + 0.1
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pts.forEach(p => {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3.5);
      g.addColorStop(0, `rgba(201,168,106,${p.alpha})`);
      g.addColorStop(1, 'rgba(201,168,106,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.5, 0, Math.PI * 2); ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.y < -20) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
    });
    requestAnimationFrame(draw);
  }
  draw();
}

function showCelebration() {
  // Fade Scene 5 out completely first — creates a clear visual break
  gsap.to(dom.scene5, {
    opacity: 0, duration: state.reducedMotion ? 0.1 : 1.2, ease: 'power2.in',
    onComplete: () => {
      dom.scene5.classList.remove('active');
      dom.scene5.setAttribute('aria-hidden', 'true');
      runCelebrationScene();
    }
  });
}

function runCelebrationScene() {
  dom.scene6.classList.add('active');
  dom.scene6.setAttribute('aria-hidden', 'false');

  try { Audio.peak(); } catch(e) {}
  initCelebrationCanvas();

  const d = state.reducedMotion ? 0.1 : 1;
  const tl = gsap.timeline();

  // Brief hold on black, then reveal
  tl.fromTo('.celeb-eyebrow', { opacity: 0, y: 8 }, {
    opacity: 1, y: 0, duration: d * 0.8, ease: 'power2.out', delay: 0.5
  });

  tl.fromTo(dom.celebHeading, {
    opacity: 0, y: state.reducedMotion ? 0 : 36
  }, {
    opacity: 1, y: 0,
    duration: state.reducedMotion ? 0.1 : 2.2,
    ease: 'power2.out'
  }, '-=0.3');

  tl.fromTo('.celeb-divider', { opacity: 0, scaleX: 0 }, {
    opacity: 1, scaleX: 1, duration: d * 0.9, ease: 'power2.out'
  }, '-=0.9');

  tl.fromTo(dom.celebSub, { opacity: 0 }, {
    opacity: 1, duration: d * 0.8, ease: 'power2.out'
  }, '-=0.5');

  if (!state.reducedMotion) {
    tl.fromTo($('celebrationContent'), { scale: 1.07 }, {
      scale: 1, duration: 3.5, ease: 'power1.out'
    }, '<-=2');
  }
}

// Celebration canvas — ONLY soft gold particles, NO fireworks / confetti
function initCelebrationCanvas() {
  const canvas = dom.celebrationCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // 30 soft particles — restrained, luxury
  const pts = Array.from({ length: 30 }, () => ({
    x: Math.random() * canvas.width,
    y: canvas.height + Math.random() * 80,
    r: Math.random() * 2.2 + 0.4,
    vx: (Math.random() - 0.5) * 0.55,
    vy: -(Math.random() * 0.9 + 0.3),
    alpha: Math.random() * 0.45 + 0.15,
    color: Math.random() > 0.5 ? '201,168,106' : '240,220,170'
  }));

  // 3 distant slow light-burst rings — luxury fireworks, not cartoon
  const bursts = [];
  let bTimer = 0;

  function mkBurst() {
    bursts.push({
      x: 0.15 * canvas.width + Math.random() * 0.7 * canvas.width,
      y: Math.random() * canvas.height * 0.45,
      r: 0, maxR: 60 + Math.random() * 80,
      alpha: 0.6,
      color: Math.random() > 0.5 ? '201,168,106' : '220,200,140'
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Particles
    pts.forEach(p => {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.8);
      g.addColorStop(0, `rgba(${p.color},${p.alpha})`);
      g.addColorStop(1, `rgba(${p.color},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.8, 0, Math.PI * 2); ctx.fill();
      p.x += p.vx + Math.sin(Date.now() * 0.0006 + p.r) * 0.1;
      p.y += p.vy; p.alpha -= 0.0003;
      if (p.y < -20 || p.alpha < 0.04) {
        p.y = canvas.height + 10; p.x = Math.random() * canvas.width;
        p.alpha = Math.random() * 0.45 + 0.15;
      }
    });

    // Luxury light rings (expand + fade — no sparks, no noise)
    bTimer++;
    if (bTimer % 140 === 0) mkBurst();

    bursts.forEach((b, i) => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${b.color},${b.alpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      b.r += 0.9; b.alpha -= 0.006;
      if (b.alpha <= 0) bursts.splice(i, 1);
    });

    requestAnimationFrame(draw);
  }

  setTimeout(mkBurst, 600);
  setTimeout(mkBurst, 1400);
  draw();

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
}

// ── Events ────────────────────────────────────────────────────────────────────
function bindEvents() {
  // Mouse parallax
  document.addEventListener('mousemove', e => {
    targetRotY = ((e.clientX / window.innerWidth) - 0.5) * 2 * 0.26;
    targetRotX = -((e.clientY / window.innerHeight) - 0.5) * 2 * 0.18;
  });

  // Touch — auto-rotate instead of parallax
  window.addEventListener('touchstart', () => {
    state.isTouchDevice = true;
    if (giftGroup && !state.reducedMotion) {
      gsap.to(giftGroup.rotation, { y: '+=6.28', duration: 14, ease: 'none', repeat: -1 });
    }
  }, { once: true });

  // Scene 1 → Opening
  dom.openGiftBtn.addEventListener('click', startOpening);
  dom.openGiftBtn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startOpening(); }
  });

  // Envelope
  dom.envelope.addEventListener('click', openEnvelope);
  dom.envelope.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEnvelope(); }
  });

  // Letter → Bouquet
  dom.continueBtn.addEventListener('click', showBouquet);
  dom.continueBtn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showBouquet(); }
  });

  // Bouquet → Cake
  dom.toCakeBtn.addEventListener('click', showCake);
  dom.toCakeBtn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showCake(); }
  });

  // Mute
  dom.muteBtn.addEventListener('click', () => {
    state.muted = !state.muted;
    dom.iconMuted.style.display = state.muted ? 'block' : 'none';
    dom.iconUnmuted.style.display = state.muted ? 'none' : 'block';
    dom.muteBtn.setAttribute('aria-label', state.muted ? 'Unmute sound' : 'Mute sound');
    try { Audio.mute(state.muted); } catch(e) {}
  });

  // Visibility
  document.addEventListener('visibilitychange', () => {
    if (!gsap) return;
    document.hidden ? gsap.globalTimeline.pause() : gsap.globalTimeline.resume();
  });
}

// ── Lenis smooth scroll ────────────────────────────────────────────────────────
async function initLenis() {
  try {
    await loadScript(CDN.lenis);
    if (!window.Lenis) return;
    const lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
  } catch(e) { console.warn('Lenis failed to load'); }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot() {
  await loadScript(CDN.gsap);
  gsap = window.gsap;
  if (!gsap) { console.error('GSAP failed to load'); return; }

  try { Audio.init(); } catch(e) {}

  // Three.js — non-blocking
  initThreeJS().then(() => {
    setTimeout(() => animateArrival(), 120);
  });

  // Fallback if Three.js is slow
  setTimeout(() => { if (!state.threeReady) animateArrival(); }, 4000);

  bindEvents();
  initLenis();

  document.body.classList.add('loaded');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
