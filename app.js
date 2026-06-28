/**
 * Eden's Birthday — Luxury Cinematic Experience
 * Scenes: Reserved Delivery → Verification → The Reveal (Envelope → Bouquet → Cake) → Celebration
 */
'use strict';

/* ────────────────────────────────────────────────────────────
   CDN Constants
──────────────────────────────────────────────────────────── */
const CDN = {
  gsap:  'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
  three: 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js',
  lenis: 'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js'
};

/* ────────────────────────────────────────────────────────────
   State
──────────────────────────────────────────────────────────── */
const state = {
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  isTouchDevice: false,
  threeReady:    false,
  transitioning: false,
  muted:         false,
  audioStarted:  false,
  candleBlown:   false
};

/* ────────────────────────────────────────────────────────────
   Utilities
──────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const lerp = (a, b, t) => a + (b - a) * t;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(s);
  });
}

/* ────────────────────────────────────────────────────────────
   DOM References
──────────────────────────────────────────────────────────── */
const dom = {
  // Scene 1
  s1:              $('s1'),
  s1Eyebrow:       $('s1Eyebrow'),
  s1Heading:       $('s1Heading'),
  s1Sub:           $('s1Sub'),
  caseWrap:        $('caseWrap'),
  caseCanvas:      $('caseCanvas'),
  nameplate:       $('nameplate'),
  verifyBtn:       $('verifyBtn'),
  // Scene 2
  s2:              $('s2'),
  authCanvas:      $('authCanvas'),
  authStatus:      $('authStatus'),
  authFill:        $('authFill'),
  // Scene 3
  s3:              $('s3'),
  stepEnvelope:    $('stepEnvelope'),
  envelope:        $('envelope'),
  envFlap:         $('envFlap'),
  envSeal:         $('envSeal'),
  letterBox:       $('letterBox'),
  closeLetter:     $('closeLetter'),
  stepBouquet:     $('stepBouquet'),
  bouquetStage:    $('bouquetStage'),
  bouquetRotator:  $('bouquetRotator'),
  bouquetCaption:  $('bouquetCaption'),
  bouquetContinue: $('bouquetContinue'),
  stepCake:        $('stepCake'),
  candle:          $('candle'),
  flameWrap:       $('flameWrap'),
  flame:           $('flame'),
  cakeCenter:      $('cakeCenter'),
  // Scene 4
  s4:              $('s4'),
  celebCanvas:     $('celebCanvas'),
  celebContent:    $('celebContent'),
  celebHeading:    $('celebHeading'),
  // Mute
  muteBtn:         $('muteBtn'),
  icoOn:           $('icoOn'),
  icoOff:          $('icoOff')
};

let gsap; // assigned after CDN load

/* ════════════════════════════════════════════════════════════
   AUDIO MODULE
   Layers: ambient drone pads + orchestral swell + auth tone
════════════════════════════════════════════════════════════ */
const Audio = (() => {
  let ctx, master, ambGain, orchGain;
  let ambStarted = false, orchStarted = false;

  function makeReverb(duration, decay) {
    const len = ctx.sampleRate * duration;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  function init() {
    try {
      const AudioCtx = window.AudioContext || (window.webkitAudioContext || null);
      if (!AudioCtx) return;
      ctx      = new AudioCtx();
      master   = ctx.createGain(); master.gain.value = 1;   master.connect(ctx.destination);
      ambGain  = ctx.createGain(); ambGain.gain.value = 0;  ambGain.connect(master);
      orchGain = ctx.createGain(); orchGain.gain.value = 0; orchGain.connect(master);
    } catch (e) { console.warn('Web Audio API unavailable:', e.message); }
  }

  function startAmbient() {
    if (!ctx || ambStarted) return;
    if (ctx.state === 'suspended') ctx.resume();
    ambStarted = true;

    const rev  = makeReverb(5, 3.5);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 380; filt.Q.value = 0.2;
    const pad  = ctx.createGain(); pad.gain.value = 0.5;

    [[55, 0.038], [82.5, 0.022]].forEach(([freq, vol]) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq; g.gain.value = vol;
      osc.connect(g); g.connect(filt); osc.start();
      setInterval(() => {
        osc.frequency.setTargetAtTime(freq + (Math.random() * 2 - 1), ctx.currentTime, 8);
      }, 9000);
    });

    filt.connect(rev); rev.connect(pad); pad.connect(ambGain);
    ambGain.gain.setTargetAtTime(0.28, ctx.currentTime, 3);
  }

  function toOrchestral() {
    if (!ctx || orchStarted) return;
    orchStarted = true;

    const rev  = makeReverb(5, 2.2);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 550;
    const g = ctx.createGain(); g.gain.value = 0.32;

    // C3 chord: C3 E3 G3 C4
    [130.81, 164.81, 196.0, 261.63].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const og  = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      og.gain.value = 0.036 / (i + 1);
      osc.connect(og); og.connect(filt); osc.start();
    });

    filt.connect(rev); rev.connect(g); g.connect(orchGain);
    // Crossfade: ambient down, orchestral up
    ambGain.gain.setTargetAtTime(0.06, ctx.currentTime, 2);
    orchGain.gain.setTargetAtTime(0.36, ctx.currentTime, 3);
  }

  function playAuthTone() {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = 880;
    env.gain.setValueAtTime(0, ctx.currentTime);
    env.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.04);
    env.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    osc.connect(env); env.connect(master);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  }

  function mute(val) {
    if (!master) return;
    master.gain.setTargetAtTime(val ? 0 : 1, ctx.currentTime, 0.1);
  }

  return { init, startAmbient, toOrchestral, playAuthTone, mute };
})();

/* ════════════════════════════════════════════════════════════
   THREE.JS — PRESENTATION CASE (Scene 1)
════════════════════════════════════════════════════════════ */
let THREE_mod = null;
let threeRenderer, threeScene, threeCamera;
let caseGroup;
let mouseTargetX = 0, mouseTargetY = 0;
let mouseCurrentX = 0, mouseCurrentY = 0;

async function initCase() {
  try {
    THREE_mod = await import(CDN.three);
    buildCase(THREE_mod);
    state.threeReady = true;
  } catch (e) {
    console.warn('Three.js failed to load, using CSS fallback:', e.message);
    if (dom.caseCanvas) dom.caseCanvas.style.opacity = '0.3';
  }
}

function buildCase(T) {
  const wrap = dom.caseWrap;
  const W    = wrap.offsetWidth  || 380;
  const H    = wrap.offsetHeight || 280;

  /* ── Renderer ── */
  threeRenderer = new T.WebGLRenderer({
    canvas:          dom.caseCanvas,
    antialias:       true,
    alpha:           false,
    powerPreference: 'high-performance'
  });
  threeRenderer.setSize(W, H);
  threeRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  threeRenderer.shadowMap.enabled   = true;
  threeRenderer.shadowMap.type      = T.PCFSoftShadowMap;
  threeRenderer.toneMapping         = T.ACESFilmicToneMapping;
  threeRenderer.toneMappingExposure = 1.15;
  threeRenderer.setClearColor(0x0d0c0a, 1);

  /* ── Scene & Camera ── */
  threeScene = new T.Scene();
  threeScene.background = new T.Color(0x0d0c0a);

  threeCamera = new T.PerspectiveCamera(42, W / H, 0.1, 60);
  threeCamera.position.set(0, 1.1, 5.8);
  threeCamera.lookAt(0, 0, 0);

  /* ── Lights ── */
  threeScene.add(new T.AmbientLight(0x3a2e1e, 1.6));

  const keyLight = new T.DirectionalLight(0xfff5e0, 2.8);
  keyLight.position.set(3, 5, 3);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far  = 20;
  threeScene.add(keyLight);

  const fillLight = new T.DirectionalLight(0xc9a86a, 0.8);
  fillLight.position.set(-4, 1, -2);
  threeScene.add(fillLight);

  const rimLight = new T.DirectionalLight(0xffeedd, 0.55);
  rimLight.position.set(0, -2, -5);
  threeScene.add(rimLight);

  /* ── Materials ── */
  const matteMat = new T.MeshStandardMaterial({
    color: 0x1c1c22, roughness: 0.88, metalness: 0.12
  });
  const goldMat = new T.MeshStandardMaterial({
    color: 0xc9a86a, roughness: 0.26, metalness: 0.68
  });

  /* ── Case Group ── */
  caseGroup = new T.Group();
  threeScene.add(caseGroup);

  // Body: BoxGeometry(3.2, 0.6, 2.2)
  const bodyMesh = new T.Mesh(new T.BoxGeometry(3.2, 0.6, 2.2), matteMat);
  bodyMesh.position.y = 0;
  bodyMesh.castShadow = bodyMesh.receiveShadow = true;
  caseGroup.add(bodyMesh);

  // Lid: BoxGeometry(3.24, 0.08, 2.24) sitting on top
  const lidMesh = new T.Mesh(new T.BoxGeometry(3.24, 0.08, 2.24), matteMat);
  lidMesh.position.y = 0.34;
  lidMesh.castShadow = true;
  caseGroup.add(lidMesh);

  // 8 Gold trim strips along edges
  const trimConfigs = [
    { size: [3.28, 0.05, 0.05], pos: [ 0,  0.32,  1.12] },
    { size: [3.28, 0.05, 0.05], pos: [ 0,  0.32, -1.12] },
    { size: [0.05, 0.05, 2.28], pos: [-1.63, 0.32,  0]  },
    { size: [0.05, 0.05, 2.28], pos: [ 1.63, 0.32,  0]  },
    { size: [3.28, 0.05, 0.05], pos: [ 0, -0.32,  1.12] },
    { size: [3.28, 0.05, 0.05], pos: [ 0, -0.32, -1.12] },
    { size: [0.05, 0.05, 2.28], pos: [-1.63, -0.32, 0]  },
    { size: [0.05, 0.05, 2.28], pos: [ 1.63, -0.32, 0]  }
  ];
  trimConfigs.forEach(({ size, pos }) => {
    const trim = new T.Mesh(new T.BoxGeometry(...size), goldMat);
    trim.position.set(...pos);
    caseGroup.add(trim);
  });

  /* ── Shadow plane ── */
  const shadowPlane = new T.Mesh(
    new T.PlaneGeometry(14, 14),
    new T.ShadowMaterial({ opacity: 0.28 })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.32;
  shadowPlane.receiveShadow = true;
  threeScene.add(shadowPlane);

  /* ── Gentle float via GSAP (called after GSAP loads) ── */
  window.__startCaseFloat = function startFloat() {
    if (!gsap || state.reducedMotion) return;
    gsap.to(caseGroup.position, {
      y:        0.12,
      duration: 3.2,
      ease:     'sine.inOut',
      yoyo:     true,
      repeat:   -1
    });
  };

  /* ── Resize ── */
  window.addEventListener('resize', () => {
    const nw = wrap.offsetWidth, nh = wrap.offsetHeight;
    threeCamera.aspect = nw / nh;
    threeCamera.updateProjectionMatrix();
    threeRenderer.setSize(nw, nh);
  });

  /* ── Start render loop ── */
  renderLoop();
}

function renderLoop() {
  requestAnimationFrame(renderLoop);
  if (!threeRenderer || !caseGroup) return;
  if (!state.isTouchDevice) {
    mouseCurrentX = lerp(mouseCurrentX, mouseTargetX, 0.06);
    mouseCurrentY = lerp(mouseCurrentY, mouseTargetY, 0.06);
    caseGroup.rotation.x = mouseCurrentY;
    caseGroup.rotation.y = mouseCurrentX + 0.15;
  }
  threeRenderer.render(threeScene, threeCamera);
}

/* ════════════════════════════════════════════════════════════
   AUTH CANVAS — Scene 2
   Concentric pulsing rings + radial fingerprint lines + scan line
════════════════════════════════════════════════════════════ */
function drawAuth(canvas) {
  const ctx     = canvas.getContext('2d');
  const W       = canvas.width  || 240;
  const H       = canvas.height || 240;
  const cx      = W / 2;
  const cy      = H / 2;
  const outerR  = W * 0.44;
  const innerR  = W * 0.28;
  const lineCount = 28;

  let scanY   = cy - innerR;
  let rafId   = null;
  let running = false;
  let tick    = 0;

  function draw() {
    ctx.clearRect(0, 0, W, H);
    tick++;

    /* Concentric pulsing rings */
    [outerR, outerR * 0.78, outerR * 0.56].forEach((r, i) => {
      const pulse = 0.3 + 0.25 * Math.sin(tick * 0.035 + i * 1.2);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(201,168,106,${pulse})`;
      ctx.lineWidth   = 0.8;
      ctx.stroke();
    });

    /* Radial fingerprint lines inside inner circle */
    for (let i = 0; i < lineCount; i++) {
      const angle   = (i / lineCount) * Math.PI * 2;
      const wobble  = Math.sin(tick * 0.04 + i * 0.7) * 0.04;
      const opacity = 0.18 + wobble;
      const x0 = cx + Math.cos(angle) * innerR * 0.35;
      const y0 = cy + Math.sin(angle) * innerR * 0.35;
      const x1 = cx + Math.cos(angle) * innerR * 0.92;
      const y1 = cy + Math.sin(angle) * innerR * 0.92;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = `rgba(201,168,106,${opacity})`;
      ctx.lineWidth   = 0.7;
      ctx.stroke();
    }

    /* Scan line top-to-bottom inside inner circle */
    scanY += 1.8;
    if (scanY > cy + innerR) scanY = cy - innerR;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.clip();

    const grad = ctx.createLinearGradient(0, scanY - 12, 0, scanY + 4);
    grad.addColorStop(0,   'rgba(201,168,106,0)');
    grad.addColorStop(0.6, 'rgba(201,168,106,0.55)');
    grad.addColorStop(1,   'rgba(201,168,106,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - innerR, scanY - 12, innerR * 2, 16);
    ctx.restore();

    /* Center dot */
    const dotPulse = 0.5 + 0.4 * Math.sin(tick * 0.07);
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(201,168,106,${dotPulse})`;
    ctx.fill();

    if (running) rafId = requestAnimationFrame(draw);
  }

  return {
    start() { running = true; draw(); },
    stop()  { running = false; if (rafId) cancelAnimationFrame(rafId); }
  };
}

/* ════════════════════════════════════════════════════════════
   SCENE 1 — Arrival Animation
════════════════════════════════════════════════════════════ */
function animateArrival() {
  const d = state.reducedMotion ? 0.01 : 1;
  const tl = gsap.timeline({ delay: 0.2 });

  tl.to(dom.s1Eyebrow, {
    opacity: 1, duration: d * 1.1, ease: 'power2.out'
  }, 0);

  tl.fromTo(dom.s1Heading,
    { y: 14, opacity: 0 },
    { y: 0, opacity: 1, duration: d * 1.3, ease: 'power2.out' },
    `+=${0.22 * d}`
  );

  tl.fromTo(dom.s1Sub,
    { y: 8, opacity: 0 },
    { y: 0, opacity: 1, duration: d * 1.1, ease: 'power2.out' },
    `+=${0.18 * d}`
  );

  tl.fromTo(dom.caseWrap,
    { opacity: 0, y: state.reducedMotion ? 0 : 20 },
    { opacity: 1, y: 0, duration: d * 1.4, ease: 'power1.out' },
    `+=${0.1 * d}`
  );

  tl.to(dom.nameplate, {
    opacity: 1, duration: d * 1.0, ease: 'power2.out'
  }, `-=${0.4 * d}`);

  tl.to(dom.verifyBtn, {
    opacity: 1, duration: d * 0.9, ease: 'power2.out'
  }, `+=${0.18 * d}`);

  tl.call(() => {
    if (typeof window.__startCaseFloat === 'function') window.__startCaseFloat();
  });
}

/* ════════════════════════════════════════════════════════════
   SCENE 2 — Verification
════════════════════════════════════════════════════════════ */
let authController = null;

function startVerification() {
  if (state.transitioning) return;
  state.transitioning = true;

  // Start audio on first user interaction
  if (!state.audioStarted) {
    try { Audio.startAmbient(); state.audioStarted = true; } catch(e) {}
  }

  const d = state.reducedMotion ? 0.01 : 1;

  gsap.to(dom.s1, {
    opacity: 0,
    duration: d * 0.7,
    ease: 'power2.in',
    onComplete: () => {
      dom.s1.style.pointerEvents = 'none';
      showAuthScene();
    }
  });
}

function showAuthScene() {
  const d = state.reducedMotion ? 0.01 : 1;

  dom.s2.classList.add('on');
  dom.s2.setAttribute('aria-hidden', 'false');

  authController = drawAuth(dom.authCanvas);
  authController.start();

  // Progress bar 0 → 100% over 2.5s
  gsap.to(dom.authFill, {
    width: '100%',
    duration: 2.5,
    ease: 'none'
  });

  // Status text sequence
  const statusSteps = [
    { text: 'Scanning…',          delay: 0   },
    { text: 'Verifying…',         delay: 1.1 },
    { text: 'Identity Confirmed', delay: 2.4 }
  ];

  statusSteps.forEach(({ text, delay }) => {
    gsap.delayedCall(delay * d, () => {
      gsap.to(dom.authStatus, {
        opacity: 0, duration: 0.25,
        onComplete: () => {
          dom.authStatus.textContent = text;
          gsap.to(dom.authStatus, { opacity: 1, duration: 0.25 });
        }
      });
    });
  });

  // Auth tone at 2.8s
  gsap.delayedCall(2.8 * d, () => {
    try { Audio.playAuthTone(); } catch(e) {}
  });

  // Transition to Scene 3 at 3.6s
  gsap.delayedCall(3.6 * d, () => {
    if (authController) authController.stop();
    gsap.to(dom.s2, {
      opacity: 0, duration: d * 0.8, ease: 'power2.in',
      onComplete: () => {
        dom.s2.classList.remove('on');
        dom.s2.setAttribute('aria-hidden', 'true');
        showEnvelope();
      }
    });
  });
}

/* ════════════════════════════════════════════════════════════
   SCENE 3 — Step A: Envelope
════════════════════════════════════════════════════════════ */
function showEnvelope() {
  const d = state.reducedMotion ? 0.01 : 1;

  dom.s3.classList.add('on');
  dom.s3.setAttribute('aria-hidden', 'false');
  dom.stepEnvelope.classList.remove('hidden');

  gsap.fromTo(dom.envHolder,
    { y: state.reducedMotion ? 0 : 60, opacity: 0 },
    {
      y: 0, opacity: 1,
      duration: d * 1.8,
      ease: 'power1.out',
      delay: 0.2,
      onComplete: () => { state.transitioning = false; }
    }
  );
}

function openEnvelope() {
  if (state.transitioning) return;
  state.transitioning = true;

  const d   = state.reducedMotion ? 0.01 : 1;
  const env = dom.envelope;

  // Step 1: Envelope lifts slightly
  gsap.to(env, {
    scale: 1.04,
    y: -12,
    duration: d * 0.5,
    ease: 'power2.out',
    onComplete: () => {
      // Step 2: Add .opening class to trigger CSS flap rotation
      env.classList.add('opening');

      // Step 3: Envelope settles back down
      gsap.to(env, {
        scale: 1,
        y: 0,
        duration: d * 0.7,
        ease: 'power1.inOut',
        delay: d * 0.2
      });

      // Step 4: Show letter after flap animation completes (~1050ms)
      setTimeout(() => {
        showLetter();
      }, state.reducedMotion ? 50 : 1050);
    }
  });
}

function showLetter() {
  const letterBox = dom.letterBox;
  letterBox.classList.remove('hidden');
  letterBox.setAttribute('aria-hidden', 'false');

  const d = state.reducedMotion ? 0.01 : 1;
  gsap.fromTo(letterBox,
    { opacity: 0, scale: 0.97 },
    {
      opacity: 1, scale: 1,
      duration: d * 0.8,
      ease: 'power2.out',
      onComplete: () => {
        state.transitioning = false;
        if (dom.closeLetter) dom.closeLetter.focus();
      }
    }
  );
}

function closeLetterAndShowBouquet() {
  if (state.transitioning) return;
  state.transitioning = true;

  const d = state.reducedMotion ? 0.01 : 1;
  gsap.to(dom.letterBox, {
    opacity: 0, scale: 0.96,
    duration: d * 0.6,
    ease: 'power2.in',
    onComplete: () => {
      dom.letterBox.classList.add('hidden');
      dom.stepEnvelope.classList.add('hidden');
      showBouquet();
    }
  });
}

/* ════════════════════════════════════════════════════════════
   SCENE 3 — Step B: Bouquet
════════════════════════════════════════════════════════════ */
function showBouquet() {
  const d = state.reducedMotion ? 0.01 : 1;

  dom.stepBouquet.classList.remove('hidden');

  const tl = gsap.timeline({
    onComplete: () => { state.transitioning = false; }
  });

  // Bouquet rises from y:80→0, scale:0.88→1, opacity:0→1 over 2.2s
  tl.fromTo(dom.bouquetStage,
    { y: state.reducedMotion ? 0 : 80, scale: 0.88, opacity: 0 },
    { y: 0, scale: 1, opacity: 1, duration: d * 2.2, ease: 'power2.out' },
    0
  );

  // Caption fades in
  tl.fromTo(dom.bouquetCaption,
    { opacity: 0, y: 10 },
    { opacity: 1, y: 0, duration: d * 1.0, ease: 'power2.out' },
    `-=${d * 0.8}`
  );

  // Continue button fades in
  tl.to(dom.bouquetContinue, {
    opacity: 1, duration: d * 0.7, ease: 'power2.out'
  }, `-=${d * 0.4}`);

  // Continuous float and rotation animations
  if (!state.reducedMotion) {
    gsap.to(dom.bouquetRotator, {
      rotateY:  3,
      duration: 4,
      ease:     'sine.inOut',
      yoyo:     true,
      repeat:   -1,
      delay:    0.5
    });
    gsap.to(dom.bouquetStage, {
      y:        -12,
      duration: 3.8,
      ease:     'sine.inOut',
      yoyo:     true,
      repeat:   -1,
      delay:    0.6
    });
  }
}

/* ════════════════════════════════════════════════════════════
   SCENE 3 — Step C: Cake
════════════════════════════════════════════════════════════ */
function showCake() {
  if (state.transitioning) return;
  state.transitioning = true;

  const d = state.reducedMotion ? 0.01 : 1;

  gsap.to(dom.stepBouquet, {
    opacity: 0,
    duration: d * 0.6,
    ease: 'power2.in',
    onComplete: () => {
      dom.stepBouquet.classList.add('hidden');
      dom.stepCake.classList.remove('hidden');
      animateCakeEntrance();
    }
  });
}

function animateCakeEntrance() {
  const d = state.reducedMotion ? 0.01 : 1;

  // Start bokeh background first
  initBokehCanvas();

  const tl = gsap.timeline({
    onComplete: () => {
      state.transitioning = false;
      const hint = $('candleHint');
      if (hint) hint.classList.add('visible');
    }
  });

  // Header fades in
  tl.fromTo($('cakeHeader'),
    { opacity: 0, y: state.reducedMotion ? 0 : 14 },
    { opacity: 1, y: 0, duration: d * 1.0, ease: 'power2.out' },
    0
  );

  // Cake rises from below
  tl.fromTo(dom.cakeCenter,
    { y: state.reducedMotion ? 0 : 60, opacity: 0 },
    { y: 0, opacity: 1, duration: d * 2.0, ease: 'power1.out' },
    d * 0.3
  );
}

/* ── Bokeh Canvas — warm out-of-focus light circles ── */
function initBokehCanvas() {
  const canvas = $('bokehCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = canvas.parentElement.offsetWidth  || 800;
  canvas.height = canvas.parentElement.offsetHeight || 480;

  // 18 warm bokeh circles — amber/gold, very soft
  const dots = Array.from({ length: 18 }, () => ({
    x:     Math.random() * canvas.width,
    y:     Math.random() * canvas.height,
    r:     20 + Math.random() * 55,
    alpha: 0.04 + Math.random() * 0.10,
    vx:    (Math.random() - 0.5) * 0.15,
    vy:    (Math.random() - 0.5) * 0.08,
    h:     Math.random() > 0.5 ? '201,150,80' : '180,120,50'
  }));

  function drawBokeh() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dots.forEach(dot => {
      const g = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, dot.r);
      g.addColorStop(0, `rgba(${dot.h},${dot.alpha})`);
      g.addColorStop(1, `rgba(${dot.h},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
      ctx.fill();

      dot.x += dot.vx;
      dot.y += dot.vy;
      if (dot.x < -dot.r) dot.x = canvas.width + dot.r;
      if (dot.x > canvas.width + dot.r) dot.x = -dot.r;
      if (dot.y < -dot.r) dot.y = canvas.height + dot.r;
      if (dot.y > canvas.height + dot.r) dot.y = -dot.r;
    });
    requestAnimationFrame(drawBokeh);
  }
  drawBokeh();
}

/* ── Blow Candle ── */
function blowCandle() {
  if (state.candleBlown || state.transitioning) return;
  state.candleBlown   = true;
  state.transitioning = true;

  const d = state.reducedMotion ? 0.01 : 1;

  // 1. Rapid pre-flicker before going out
  if (!state.reducedMotion && dom.flame) {
    gsap.to(dom.flame, {
      scaleX: 1.4, scaleY: 0.6, duration: 0.08,
      yoyo: true, repeat: 5, ease: 'power1.inOut',
      onComplete: () => extinguish()
    });
  } else {
    extinguish();
  }

  function extinguish() {
    // 2. Flame shrinks and disappears
    gsap.to(dom.flameWrap, {
      scaleY: 0, scaleX: 0.2, opacity: 0,
      duration: d * 0.3, ease: 'power2.in',
      onComplete: () => {
        dom.candle.classList.add('blown');

        // 3. Ambient glow dims
        gsap.to('.cake-ambient', {
          opacity: 0, duration: d * 1.2, ease: 'power1.in'
        });

        // 4. Dark vignette — room moment of darkness
        const overlay = document.createElement('div');
        overlay.style.cssText =
          'position:fixed;inset:0;background:radial-gradient(ellipse at center,#0a0800 0%,#000 100%);opacity:0;z-index:9998;pointer-events:none;';
        document.body.appendChild(overlay);

        gsap.to(overlay, {
          opacity: 0.88,
          duration: d * 0.5,
          ease: 'power2.in',
          delay: d * 0.1,
          onComplete: () => {
            gsap.to(overlay, {
              opacity: 0,
              duration: d * 0.8,
              ease: 'power1.out',
              delay: d * 0.15,
              onComplete: () => {
                document.body.removeChild(overlay);
                // 5. Transition to Celebration
                gsap.to(dom.stepCake, {
                  opacity: 0, duration: d * 0.6, ease: 'power2.in',
                  onComplete: () => {
                    dom.stepCake.classList.add('hidden');
                    dom.s3.classList.remove('on');
                    dom.s3.setAttribute('aria-hidden', 'true');
                    showCelebration();
                  }
                });
              }
            });
          }
        });
      }
    });
  }
}

/* ════════════════════════════════════════════════════════════
   SCENE 4 — Celebration
════════════════════════════════════════════════════════════ */
function showCelebration() {
  const d = state.reducedMotion ? 0.01 : 1;

  dom.s4.classList.add('on');
  dom.s4.setAttribute('aria-hidden', 'false');

  // Switch to orchestral audio
  try { Audio.toOrchestral(); } catch(e) {}

  // Start celebration canvas
  initCelebCanvas();

  // Stagger content children in
  const items = dom.celebContent.children;
  const tl = gsap.timeline({ delay: 0.3 });

  Array.from(items).forEach((el, i) => {
    tl.fromTo(el,
      { opacity: 0, y: state.reducedMotion ? 0 : 22 },
      { opacity: 1, y: 0, duration: d * 1.1, ease: 'power2.out' },
      i === 0 ? 0 : `-=${d * 0.55}`
    );
  });

  // Subtle scale-in
  if (!state.reducedMotion) {
    gsap.fromTo(dom.celebContent,
      { scale: 1.06 },
      { scale: 1, duration: 3.5, ease: 'power1.out' }
    );
  }

  state.transitioning = false;
}

/* ════════════════════════════════════════════════════════════
   CELEBRATION CANVAS
   25 soft gold particles + periodic expanding ring bursts
   Stroke-only rings, no sparks, no confetti
════════════════════════════════════════════════════════════ */
function initCelebCanvas() {
  const canvas = dom.celebCanvas;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  /* 25 soft floating gold particles */
  const particles = Array.from({ length: 25 }, () => ({
    x:     Math.random() * canvas.width,
    y:     canvas.height + Math.random() * 80,
    r:     Math.random() * 2.2 + 0.5,
    vx:    (Math.random() - 0.5) * 0.45,
    vy:    -(Math.random() * 0.75 + 0.22),
    alpha: Math.random() * 0.25 + 0.15,
    hue:   Math.random() > 0.55 ? '201,168,106' : '228,205,150'
  }));

  /* Ring burst system */
  const rings = [];
  let frameTick = 0;

  function spawnRing() {
    rings.push({
      x:     canvas.width  * 0.15 + Math.random() * canvas.width  * 0.7,
      y:     canvas.height * 0.05 + Math.random() * canvas.height * 0.42,
      r:     0,
      maxR:  55 + Math.random() * 85,
      alpha: 0.55,
      lw:    1 + Math.random() * 0.8,
      color: Math.random() > 0.5 ? '201,168,106' : '218,195,138'
    });
  }

  // Pre-schedule initial bursts
  setTimeout(spawnRing, 700);
  setTimeout(spawnRing, 1500);
  setTimeout(spawnRing, 2600);

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frameTick++;

    /* Draw particles */
    particles.forEach(p => {
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
      grad.addColorStop(0, `rgba(${p.hue},${p.alpha})`);
      grad.addColorStop(1, `rgba(${p.hue},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
      ctx.fill();

      // Drift with gentle sine wobble
      p.x += p.vx + Math.sin(frameTick * 0.0007 + p.r * 3.7) * 0.08;
      p.y += p.vy;
      p.alpha -= 0.00025;

      // Reset when off-screen or faded
      if (p.y < -20 || p.alpha < 0.04) {
        p.y     = canvas.height + 10;
        p.x     = Math.random() * canvas.width;
        p.alpha = Math.random() * 0.25 + 0.15;
      }
    });

    /* Draw and update rings — stroke only, no fill */
    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i];
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${ring.color},${ring.alpha})`;
      ctx.lineWidth   = ring.lw;
      ctx.stroke();

      ring.r     += 0.85;
      ring.alpha -= 0.0055;
      if (ring.alpha <= 0 || ring.r >= ring.maxR) rings.splice(i, 1);
    }

    // Periodic new ring every ~4.2s
    if (frameTick % 252 === 0) spawnRing();

    requestAnimationFrame(draw);
  }

  draw();

  /* Resize handler */
  window.addEventListener('resize', () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    particles.forEach(p => {
      if (p.x > canvas.width) p.x = Math.random() * canvas.width;
    });
  });
}

/* ════════════════════════════════════════════════════════════
   EVENT BINDING
════════════════════════════════════════════════════════════ */
function bindEvents() {

  /* Scene 1: Verify button */
  dom.verifyBtn.addEventListener('click', startVerification);
  dom.verifyBtn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startVerification(); }
  });

  /* Scene 3 Step A: Open envelope */
  dom.envelope.addEventListener('click', openEnvelope);
  dom.envelope.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEnvelope(); }
  });

  /* Scene 3 Step A: Close letter → show bouquet */
  dom.closeLetter.addEventListener('click', closeLetterAndShowBouquet);
  dom.closeLetter.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeLetterAndShowBouquet(); }
  });

  /* Scene 3 Step B: Bouquet continue → show cake */
  dom.bouquetContinue.addEventListener('click', showCake);
  dom.bouquetContinue.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showCake(); }
  });

  /* Scene 3 Step C: Candle click → blow out */
  dom.candle.addEventListener('click', blowCandle);
  dom.candle.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); blowCandle(); }
  });

  /* Mouse parallax for Three.js case (±8 degrees) */
  document.addEventListener('mousemove', e => {
    if (state.isTouchDevice) return;
    const nx = (e.clientX / window.innerWidth)  - 0.5;
    const ny = (e.clientY / window.innerHeight) - 0.5;
    mouseTargetX =  nx * 2 * (8 * Math.PI / 180);
    mouseTargetY = -ny * 2 * (8 * Math.PI / 180);
  });

  /* Cursor parallax for bouquet rotator */
  document.addEventListener('mousemove', e => {
    if (!dom.bouquetRotator) return;
    if (dom.stepBouquet.classList.contains('hidden')) return;
    if (state.isTouchDevice) return;
    const nx = (e.clientX / window.innerWidth  - 0.5) * 10;
    const ny = (e.clientY / window.innerHeight - 0.5) * 8;
    dom.bouquetRotator.style.transform = `rotateY(${nx}deg) rotateX(${-ny}deg)`;
  });

  /* Touch device detection */
  window.addEventListener('touchstart', () => {
    state.isTouchDevice = true;
    // Touch auto-rotate for case
    if (caseGroup && gsap && !state.reducedMotion) {
      gsap.to(caseGroup.rotation, {
        y:        '+=' + (Math.PI * 2),
        duration: 16,
        ease:     'none',
        repeat:   -1
      });
    }
  }, { once: true });

  /* Mute toggle */
  dom.muteBtn.addEventListener('click', () => {
    state.muted = !state.muted;
    dom.icoOn.style.display  = state.muted ? 'none'  : 'block';
    dom.icoOff.style.display = state.muted ? 'block' : 'none';
    dom.muteBtn.setAttribute('aria-label', state.muted ? 'Unmute sound' : 'Mute sound');
    try { Audio.mute(state.muted); } catch(e) {}
  });

  /* Pause GSAP on tab-blur */
  document.addEventListener('visibilitychange', () => {
    if (!gsap) return;
    if (document.hidden) gsap.globalTimeline.pause();
    else                 gsap.globalTimeline.resume();
  });
}

/* ════════════════════════════════════════════════════════════
   LENIS SMOOTH SCROLL
════════════════════════════════════════════════════════════ */
async function initLenis() {
  try {
    await loadScript(CDN.lenis);
    if (!window.Lenis) return;
    const lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
  } catch(e) { console.warn('Lenis unavailable:', e.message); }
}

/* ════════════════════════════════════════════════════════════
   BOOT
════════════════════════════════════════════════════════════ */
async function boot() {
  // 1. Load GSAP
  try {
    await loadScript(CDN.gsap);
    gsap = window.gsap;
    if (!gsap) throw new Error('GSAP not found on window');
  } catch(e) {
    console.error('GSAP failed to load:', e.message);
    document.body.classList.add('ready');
    return;
  }

  // 2. Initialise audio context
  try { Audio.init(); } catch(e) {}

  // 3. Load Three.js and start 3D case (non-blocking)
  let arrivalFired = false;

  function fireArrival() {
    if (arrivalFired) return;
    arrivalFired = true;
    animateArrival();
  }

  initCase().then(() => {
    fireArrival();
  }).catch(() => {
    fireArrival();
  });

  // Fallback: run arrival if Three.js takes too long
  const fallbackTimer = setTimeout(fireArrival, 4200);

  // Clear fallback when Three.js resolves
  const origInitCase = initCase;
  Promise.resolve().then(() => {
    clearTimeout(fallbackTimer);
  });

  // 4. Bind all events
  bindEvents();

  // 5. Smooth scroll
  initLenis();

  // 6. Mark body ready (triggers CSS fade-in)
  document.body.classList.add('ready');
}

/* ── Entry point ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
