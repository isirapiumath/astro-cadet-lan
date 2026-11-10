// AstroCadet LAN Game Engine - Precision Flight Controls & Helmet Visor Comms
let socket = null;
let currentRole = null;
let currentRoom = 'ARTEMIS';
let cadetCallsign = 'Cadet-1';
let audioEnabled = true;
let gameState = null;

// NASA Educational Facts
const NASA_FACTS = [
  "NASA's SAFER (Simplified Aid for EVA Rescue) jetpack has built-in automatic attitude hold to stop astronauts from tumbling!",
  "In microgravity, astronauts exercise 2 hours daily on the T2 Treadmill and ARED resistance machine to prevent bone loss.",
  "The International Space Station orbits Earth every 90 minutes at approximately 17,500 mph (28,000 km/h)!",
  "During an EVA spacewalk, astronauts wear the EMU (Extravehicular Mobility Unit) which provides 100% oxygen and thermal protection.",
  "Astronauts drink recycled water on the ISS — including purified sweat and condensation!",
  "NASA's Artemis program plans to land the first woman and first person of color on the Moon's South Pole.",
  "Space food includes tortillas instead of bread because bread crumbs can float into instrument panels and eyes in zero-g!"
];

// Web Audio API Synthesizer (Authentic NASA Sound FX)
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playHaptic(duration = 40) {
  if (navigator.vibrate) {
    try { navigator.vibrate(duration); } catch (_) {}
  }
}

function speakRadioTransmission(text) {
  if (!audioEnabled || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel(); // Stop prior speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch (_) {}
}

function playAudioCue(type) {
  if (!audioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (type === 'quindar' || type === 'radio_beep') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(2524, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  } else if (type === 'thruster') {
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    playHaptic(20);
  } else if (type === 'klaxon_alarm') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.setValueAtTime(600, now + 0.15);
    osc.frequency.setValueAtTime(800, now + 0.3);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
    playHaptic([100, 50, 100]);
  } else if (type === 'repair_click') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
    playHaptic(50);
  } else if (type === 'o2_refill') {
    // Air rush hiss & chime
    const bufferSize = ctx.sampleRate * 0.4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    playHaptic([60, 40, 60]);
  } else if (type === 'power_online') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
    playHaptic(40);
  } else if (type === 'error_buzzer') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(140, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
    playHaptic([80, 40, 80]);
  }
}

function toggleAudio() {
  audioEnabled = !audioEnabled;
  document.getElementById('btn-audio').textContent = audioEnabled ? '🔊' : '🔇';
}

// ================= GAME INITIALIZATION & JOIN =================
function joinGame(role) {
  cadetCallsign = document.getElementById('cadet-callsign').value.trim() || 'Cadet-1';
  currentRoom = document.getElementById('room-code').value.trim().toUpperCase() || 'ARTEMIS';
  currentRole = role;

  getAudioContext();
  playAudioCue('quindar');

  document.getElementById('lobby-screen').classList.remove('active');
  document.getElementById('hud-room').textContent = currentRoom;

  if (role === 'astronaut' || role === 'solo') {
    document.getElementById('astronaut-viewport').classList.remove('hidden');
    document.getElementById('houston-viewport').classList.add('hidden');
    initSpacewalkCanvas();
  } else {
    document.getElementById('astronaut-viewport').classList.add('hidden');
    document.getElementById('houston-viewport').classList.remove('hidden');
  }

  initSocket();

  setInterval(() => {
    const fact = NASA_FACTS[Math.floor(Math.random() * NASA_FACTS.length)];
    const el = document.getElementById('nasa-fact');
    if (el) el.textContent = fact;
  }, 18000);
}

// ================= SOCKET.IO HANDLERS =================
function initSocket() {
  socket = io();

  socket.emit('join_room', {
    roomId: currentRoom,
    role: currentRole
  });

  socket.on('init_state', ({ state, assignedRole }) => {
    gameState = state;
    updateHUD(state);
    if (currentRole === 'houston') {
      renderHoustonSchematic();
    }
  });

  socket.on('state_tick', (tickData) => {
    if (!gameState) return;
    Object.assign(gameState, tickData);
    updateHUD(gameState);

    const mins = String(Math.floor(tickData.missionTime / 60)).padStart(2, '0');
    const secs = String(tickData.missionTime % 60).padStart(2, '0');
    document.getElementById('hud-timer').textContent = `${mins}:${secs}`;

    if (currentRole === 'houston') {
      updateHoustonEmergency(tickData.activeEmergency);
    }

    if (currentRole === 'solo' && tickData.activeEmergency) {
      handleSoloAIMissionControl(tickData.activeEmergency);
    }
  });

  socket.on('state_update', (newState) => {
    gameState = newState;
    updateHUD(newState);
    if (currentRole === 'houston') {
      updateHoustonEmergency(newState.activeEmergency);
      renderHoustonSchematic();
    }
  });

  socket.on('emergency_alert', (emergency) => {
    playAudioCue('klaxon_alarm');
    showAlertBanner(`🚨 ALERT: ${emergency.title}`);
  });

  socket.on('emergency_resolved', ({ title, score }) => {
    playAudioCue('repair_click');
    showAlertBanner(`🎉 SUCCESS: ${title} repaired! +500 PTS`);
    closeRepairModal();
  });

  socket.on('audio_cue', (cue) => {
    playAudioCue(cue);
  });

  socket.on('astronaut_telemetry', (pos) => {
    if (gameState) gameState.astronautPos = pos;
    if (currentRole === 'houston') {
      updateHoustonAstronautTracker(pos);
    }
  });

  socket.on('radio_comm', (msg) => {
    playAudioCue('radio_beep');
    addRadioMessage(msg);
  });
}

function updateHUD(s) {
  if (!s) return;
  const hullBar = document.getElementById('bar-hull');
  const hullText = document.getElementById('text-hull');
  const hVal = Math.round(s.stationHealth);
  hullBar.style.width = `${hVal}%`;
  hullText.textContent = `${hVal}%`;
  hullBar.className = `fill ${hVal < 30 ? 'fill-red' : (hVal < 60 ? 'fill-yellow' : 'fill-green')}`;

  const o2Bar = document.getElementById('bar-o2');
  const o2Text = document.getElementById('text-o2');
  const o2Val = Math.round(s.oxygenLevel);
  o2Bar.style.width = `${o2Val}%`;
  o2Text.textContent = `${o2Val}%`;
  o2Bar.className = `fill ${o2Val < 25 ? 'fill-red' : 'fill-blue'}`;

  const pBar = document.getElementById('bar-power');
  const pText = document.getElementById('text-power');
  if (pBar && pText) {
    const pVal = Math.round(s.powerGrid);
    pBar.style.width = `${pVal}%`;
    pText.textContent = `${pVal}%`;
  }

  document.getElementById('hud-score').textContent = `${s.score} PTS`;
}

function showAlertBanner(msg) {
  const banner = document.getElementById('alert-banner');
  const text = document.getElementById('alert-text');
  text.textContent = msg;
  banner.classList.remove('hidden');
  setTimeout(() => banner.classList.add('hidden'), 4500);
}

// ================= ASTRONAUT SPACEWALK CANVAS SIMULATION =================
let canvas, ctx;
let keys = {};
let touchDirs = { up: false, down: false, left: false, right: false };
let pointerTarget = null;
let astronaut = {
  x: 320,
  y: 350,
  vx: 0,
  vy: 0,
  radius: 14
};
let stars = [];
let targetModule = null;

function initSpacewalkCanvas() {
  canvas = document.getElementById('spacewalk-canvas');
  ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  stars = [];
  for (let i = 0; i < 120; i++) {
    stars.push({
      x: Math.random() * 2000,
      y: Math.random() * 2000,
      size: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.8 + 0.2
    });
  }

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    pointerTarget = null;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.target !== canvas) return;
    const rect = canvas.getBoundingClientRect();
    pointerTarget = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    playAudioCue('thruster');
  });

  canvas.addEventListener('pointermove', (e) => {
    if (pointerTarget && e.buttons > 0) {
      const rect = canvas.getBoundingClientRect();
      pointerTarget = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  });

  setupTouchDpad();
  requestAnimationFrame(gameLoop);
}

function setupTouchDpad() {
  const touchButtons = document.querySelectorAll('.touch-btn');

  touchButtons.forEach(btn => {
    const dir = btn.getAttribute('data-dir');
    
    const start = (e) => {
      e.preventDefault();
      pointerTarget = null;
      touchDirs[dir] = true;
      btn.classList.add('active');
      playAudioCue('thruster');
    };
    
    const end = (e) => {
      e.preventDefault();
      touchDirs[dir] = false;
      btn.classList.remove('active');
    };

    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
    btn.addEventListener('touchcancel', end, { passive: false });
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
  });
}

function gameLoop() {
  updateAstronautPhysics();
  renderCanvas();
  requestAnimationFrame(gameLoop);
}

function updateAstronautPhysics() {
  const thrusterPower = 0.45;
  const maxSpeed = 4.2;
  let activeThrust = false;

  if (keys['KeyW'] || keys['ArrowUp'] || touchDirs.up) {
    astronaut.vy -= thrusterPower;
    activeThrust = true;
  }
  if (keys['KeyS'] || keys['ArrowDown'] || touchDirs.down) {
    astronaut.vy += thrusterPower;
    activeThrust = true;
  }
  if (keys['KeyA'] || keys['ArrowLeft'] || touchDirs.left) {
    astronaut.vx -= thrusterPower;
    activeThrust = true;
  }
  if (keys['KeyD'] || keys['ArrowRight'] || touchDirs.right) {
    astronaut.vx += thrusterPower;
    activeThrust = true;
  }

  if (pointerTarget && !activeThrust) {
    const dx = pointerTarget.x - astronaut.x;
    const dy = pointerTarget.y - astronaut.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 15) {
      const angle = Math.atan2(dy, dx);
      astronaut.vx += Math.cos(angle) * (thrusterPower * 0.85);
      astronaut.vy += Math.sin(angle) * (thrusterPower * 0.85);
      activeThrust = true;
      if (Math.random() < 0.15) playAudioCue('thruster');
    } else {
      pointerTarget = null;
    }
  }

  // RCS Auto-Braking
  if (!activeThrust) {
    astronaut.vx *= 0.88;
    astronaut.vy *= 0.88;

    if (Math.abs(astronaut.vx) < 0.05) astronaut.vx = 0;
    if (Math.abs(astronaut.vy) < 0.05) astronaut.vy = 0;
  } else {
    astronaut.vx *= 0.96;
    astronaut.vy *= 0.96;
  }

  const currentSpeed = Math.hypot(astronaut.vx, astronaut.vy);
  if (currentSpeed > maxSpeed) {
    astronaut.vx = (astronaut.vx / currentSpeed) * maxSpeed;
    astronaut.vy = (astronaut.vy / currentSpeed) * maxSpeed;
  }

  // Proximity & Docking Magnet Assist
  const repairBtn = document.getElementById('btn-touch-repair');
  targetModule = null;

  if (gameState && gameState.activeEmergency) {
    const modules = gameState.modules || [];
    const activeMod = modules.find(m => m.id === gameState.activeEmergency.module);
    if (activeMod) {
      const mx = (canvas.width / 2) + (activeMod.x - 400);
      const my = (canvas.height / 2) + (activeMod.y - 300);
      const dist = Math.hypot(astronaut.x - mx, astronaut.y - my);

      if (dist < 90) {
        targetModule = activeMod;
        repairBtn?.classList.add('ready-pulse');

        astronaut.vx += (mx - astronaut.x) * 0.04;
        astronaut.vy += (my - astronaut.y) * 0.04;

        if (keys['Space']) {
          openRepairModal(activeMod, gameState.activeEmergency);
        }
      } else {
        repairBtn?.classList.remove('ready-pulse');
      }
    }
  } else {
    repairBtn?.classList.remove('ready-pulse');
  }

  astronaut.x += astronaut.vx;
  astronaut.y += astronaut.vy;

  astronaut.x = Math.max(30, Math.min(canvas.width - 30, astronaut.x));
  astronaut.y = Math.max(30, Math.min(canvas.height - 30, astronaut.y));

  if (socket && (Math.abs(astronaut.vx) > 0.05 || Math.abs(astronaut.vy) > 0.05)) {
    socket.emit('astronaut_move', { x: Math.round(astronaut.x), y: Math.round(astronaut.y) });
  }
}

function renderCanvas() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const s of stars) {
    ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
    ctx.beginPath();
    ctx.arc(s.x % canvas.width, s.y % canvas.height, s.size, 0, Math.PI * 2);
    ctx.fill();
  }

  const earthY = canvas.height + (canvas.height * 0.6);
  const earthRadius = canvas.width * 0.85;
  const earthGrad = ctx.createRadialGradient(
    canvas.width / 2, earthY, earthRadius * 0.7,
    canvas.width / 2, earthY, earthRadius
  );
  earthGrad.addColorStop(0, '#001a4d');
  earthGrad.addColorStop(0.7, '#0055bb');
  earthGrad.addColorStop(1, '#00e1ff');

  ctx.beginPath();
  ctx.arc(canvas.width / 2, earthY, earthRadius, Math.PI, 0, false);
  ctx.fillStyle = earthGrad;
  ctx.fill();

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  drawISSModel(cx, cy);

  const questX = cx + (320 - 400);
  const questY = cy + (350 - 300);

  ctx.beginPath();
  ctx.moveTo(questX, questY);
  ctx.quadraticCurveTo(
    (questX + astronaut.x) / 2 + 15,
    (questY + astronaut.y) / 2 + 25,
    astronaut.x,
    astronaut.y
  );
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  if (pointerTarget) {
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pointerTarget.x, pointerTarget.y, 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(pointerTarget.x, pointerTarget.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawAstronaut(astronaut.x, astronaut.y, astronaut.vx, astronaut.vy);

  if (targetModule) {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 12px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('TARGET DOCKED - TAP [REPAIR]', astronaut.x, astronaut.y - 30);
  }
}

function drawISSModel(cx, cy) {
  ctx.fillStyle = '#445577';
  ctx.fillRect(cx - 240, cy - 170, 480, 14);

  drawSolarArray(cx - 220, cy - 160);
  drawSolarArray(cx + 140, cy - 160);

  drawModule(cx + (400 - 400), cy + (260 - 300), 50, 70, 'Destiny', 'destiny');
  drawModule(cx + (400 - 400), cy + (350 - 300), 50, 50, 'Harmony', 'harmony');
  drawModule(cx + (320 - 400), cy + (350 - 300), 45, 45, 'Quest', 'quest');
  drawModule(cx + (490 - 400), cy + (350 - 300), 65, 45, 'Kibo', 'kibo');
  drawModule(cx + (260 - 400), cy + (260 - 300), 55, 28, 'Radiator', 'radiator');
  drawModule(cx + (400 - 400), cy + (440 - 300), 30, 30, '📡 Ant', 'antenna');
}

function drawSolarArray(x, y) {
  ctx.fillStyle = '#0f294a';
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 1.5;

  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x + i * 20, y - 50, 16, 100);
    ctx.strokeRect(x + i * 20, y - 50, 16, 100);
  }
}

function drawModule(x, y, w, h, label, moduleId) {
  const isEmergency = gameState?.activeEmergency?.module === moduleId;

  ctx.fillStyle = isEmergency ? 'rgba(255, 51, 68, 0.45)' : '#263b5e';
  ctx.strokeStyle = isEmergency ? '#ff3344' : '#5f84b5';
  ctx.lineWidth = isEmergency ? 2.5 : 1;

  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);

  if (isEmergency) {
    const pulse = (Math.sin(Date.now() / 150) + 1) / 2;
    ctx.fillStyle = `rgba(255, 51, 68, ${pulse})`;
    ctx.beginPath();
    ctx.arc(x, y - h / 2 - 10, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
    ctx.beginPath();
    ctx.arc(x, y, 45 + pulse * 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#e6f1ff';
  ctx.font = '9px Orbitron';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + 3);
}

function drawAstronaut(x, y, vx, vy) {
  ctx.save();
  ctx.translate(x, y);

  // Smooth rotation towards velocity or flight target
  let angle = 0;
  if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) {
    angle = Math.atan2(vy, vx);
  } else if (pointerTarget) {
    angle = Math.atan2(pointerTarget.y - y, pointerTarget.x - x);
  }
  ctx.rotate(angle);

  // Gentle zero-g floating bob
  const bob = Math.sin(Date.now() / 350) * 1.5;

  // 1. RCS Thruster Jets (Realistic gas puffs from backpack nozzles)
  const isThrusting = Math.abs(vx) > 0.2 || Math.abs(vy) > 0.2;
  if (isThrusting) {
    const puffLength = 12 + Math.random() * 8;
    const jetGrad = ctx.createLinearGradient(-18, 0, -18 - puffLength, 0);
    jetGrad.addColorStop(0, 'rgba(0, 240, 255, 0.9)');
    jetGrad.addColorStop(0.5, 'rgba(0, 150, 255, 0.5)');
    jetGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    // Dual thruster exhausts
    [-10, 10].forEach(offsetY => {
      ctx.fillStyle = jetGrad;
      ctx.beginPath();
      ctx.moveTo(-16, offsetY - 3);
      ctx.lineTo(-16 - puffLength, offsetY);
      ctx.lineTo(-16, offsetY + 3);
      ctx.closePath();
      ctx.fill();
    });
  }

  // 2. PLSS Backpack (Primary Life Support System / MMU)
  ctx.fillStyle = '#4a5768';
  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-18, -14 + bob * 0.3, 12, 28, 4);
  ctx.fill();
  ctx.stroke();

  // Oxygen tank cylinders on backpack
  ctx.fillStyle = '#718096';
  ctx.fillRect(-16, -11 + bob * 0.3, 8, 5);
  ctx.fillRect(-16, 6 + bob * 0.3, 8, 5);

  // 3. Astronaut Legs & Boots (Zero-G floating drift)
  const legSway = Math.sin(Date.now() / 400) * 2;
  // Left Leg
  ctx.fillStyle = '#e2e8f0';
  ctx.strokeStyle = '#a0aec0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(-14, -8 + legSway, 8, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Left Boot (Blue NASA thermal sole)
  ctx.fillStyle = '#0b3d91';
  ctx.fillRect(-22, -10 + legSway, 4, 5);

  // Right Leg
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.ellipse(-14, 8 - legSway, 8, 4, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Right Boot
  ctx.fillStyle = '#0b3d91';
  ctx.fillRect(-22, 5 - legSway, 4, 5);

  // 4. White EMU Spacesuit Torso (Hard Upper Torso)
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(-2, 0 + bob * 0.5, 12, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // NASA Commander Red Stripe on right shoulder
  ctx.fillStyle = '#fc3d21';
  ctx.fillRect(-6, -13 + bob * 0.5, 4, 3);

  // Chest Display & Control Module (DCM)
  ctx.fillStyle = '#2b6cb0';
  ctx.fillRect(-4, -4 + bob * 0.5, 6, 8);
  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(-2, -2 + bob * 0.5, 2, 2); // Status LED

  // 5. Articulated Spacesuit Arms & EVA Gloves
  // Arm 1 (Top)
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.ellipse(4, -11 + bob * 0.7, 7, 3.5, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Glove 1 (Thermal grip pads)
  ctx.fillStyle = '#4a5568';
  ctx.beginPath();
  ctx.arc(10, -13 + bob * 0.7, 3, 0, Math.PI * 2);
  ctx.fill();

  // Arm 2 (Bottom)
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.ellipse(4, 11 + bob * 0.7, 7, 3.5, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Glove 2
  ctx.fillStyle = '#4a5568';
  ctx.beginPath();
  ctx.arc(10, 13 + bob * 0.7, 3, 0, Math.PI * 2);
  ctx.fill();

  // 6. Helmet Bubble with Gold Sun Visor
  // White Helmet Base
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(8, 0 + bob * 0.5, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Gold Mirrored Sun Visor with Cosmic Reflection
  const visorGrad = ctx.createLinearGradient(6, -6, 16, 6);
  visorGrad.addColorStop(0, '#ffd700');
  visorGrad.addColorStop(0.5, '#f6ad55');
  visorGrad.addColorStop(1, '#975a16');

  ctx.fillStyle = visorGrad;
  ctx.beginPath();
  ctx.ellipse(10, 0 + bob * 0.5, 6, 7, 0, -Math.PI / 2, Math.PI / 2);
  ctx.fill();

  // Visor Glare / Specular Highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.beginPath();
  ctx.arc(12, -2 + bob * 0.5, 2, 0, Math.PI * 2);
  ctx.fill();

  // 7. Helmet Mounted Headlamp Light Beam
  const beamGrad = ctx.createRadialGradient(14, 0, 2, 45, 0, 40);
  beamGrad.addColorStop(0, 'rgba(255, 255, 220, 0.45)');
  beamGrad.addColorStop(0.6, 'rgba(0, 240, 255, 0.15)');
  beamGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');

  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.moveTo(14, -3 + bob * 0.5);
  ctx.lineTo(55, -20);
  ctx.lineTo(55, 20);
  ctx.lineTo(14, 3 + bob * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ================= REPAIR INTERACTION MODAL =================
const POSSIBLE_REPAIR_ACTIONS = [
  { id: 'VALVE_A', label: 'PURGE VALVE A' },
  { id: 'VALVE_B', label: 'SHUTOFF VALVE B' },
  { id: 'CIRCUIT_3', label: 'RELAY 4-GAMMA' },
  { id: 'MOTOR_RESET', label: 'OVERRIDE MOTOR' },
  { id: 'GIMBAL_B', label: 'REALIGN GIMBAL B' },
  { id: 'BYPASS_LOOP', label: 'BYPASS COOLANT LOOP' },
  { id: 'PRESSURE_CHECK', label: 'PRESSURE CHECK' },
  { id: 'AZIMUTH', label: 'CALIBRATE AZIMUTH' },
  { id: 'TRANSPONDER', label: 'BOOST TRANSPONDER' },
  { id: 'FREQ_LOCK', label: 'LOCK FREQUENCY' },
  { id: 'PULSE', label: 'AUX POWER PULSE' },
  { id: 'SYNC', label: 'TELEMETRY SYNC' }
];

function openRepairModal(moduleData, emergency) {
  const modal = document.getElementById('repair-dock-modal');
  document.getElementById('repair-module-title').textContent = emergency.title;
  modal.classList.remove('hidden');

  const btnContainer = document.getElementById('repair-action-buttons');
  btnContainer.innerHTML = '';

  const needed = emergency.sequence;
  const fillers = POSSIBLE_REPAIR_ACTIONS.filter(a => !needed.includes(a.id));
  const options = [...POSSIBLE_REPAIR_ACTIONS.filter(a => needed.includes(a.id)), ...fillers.slice(0, 2)];
  options.sort(() => Math.random() - 0.5);

  options.forEach(act => {
    const btn = document.createElement('button');
    btn.className = 'repair-btn';
    btn.textContent = act.label;
    btn.onclick = () => submitRepairStep(act.id);
    btnContainer.appendChild(btn);
  });

  document.getElementById('repair-feedback-msg').textContent =
    `Sequence remaining: ${emergency.sequence.length} step(s)`;
}

function submitRepairStep(stepId) {
  if (socket) {
    socket.emit('repair_step', { stepId });
  }
}

function closeRepairModal() {
  document.getElementById('repair-dock-modal').classList.add('hidden');
}

function checkRepairInteraction() {
  if (targetModule && gameState?.activeEmergency) {
    openRepairModal(targetModule, gameState.activeEmergency);
  } else {
    showAlertBanner('Fly closer to the flashing target module to dock & repair.');
  }
}

// ================= MOBILE TAB SWITCHER FOR HOUSTON =================
function switchHoustonTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.houston-dashboard .dash-panel').forEach(panel => {
    panel.classList.toggle('active-mobile-tab', panel.id === tabId);
  });
}

// ================= MISSION CONTROL (HOUSTON) DASHBOARD =================
function renderHoustonSchematic() {
  const container = document.getElementById('station-map');
  if (!container || !gameState) return;

  container.innerHTML = `
    <div style="text-align: center; font-family: Orbitron; padding: 1.2rem; width: 100%;">
      <h3 style="color: #00f0ff; margin-bottom: 0.8rem; font-size: 0.9rem;">ORBITAL SENSORS: LIVE</h3>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.6rem; max-width: 320px; margin: 0 auto;">
        ${(gameState.modules || []).map(m => `
          <div style="background: ${m.id === gameState.activeEmergency?.module ? '#ff334444' : '#122544'}; border: 1px solid ${m.id === gameState.activeEmergency?.module ? '#ff3344' : '#00f0ff'}; padding: 0.5rem; border-radius: 6px;">
            <div style="font-size: 0.65rem; color: #889bb5;">${m.type.toUpperCase()}</div>
            <strong style="font-size: 0.75rem;">${m.name}</strong>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function updateHoustonEmergency(emergency) {
  const alertCard = document.getElementById('emergency-alert-card');
  const severityTag = document.getElementById('emergency-severity-tag');

  if (emergency) {
    severityTag.className = 'status-pill status-critical';
    severityTag.textContent = `${emergency.severity}: ${emergency.timeLeft}s`;

    alertCard.className = 'emergency-box active-alarm';
    alertCard.innerHTML = `
      <h3 style="color: #ff3344; font-family: Orbitron; margin-bottom: 0.3rem; font-size: 0.95rem;">⚠️ ${emergency.title}</h3>
      <p style="color: #e6f1ff; font-size: 0.85rem; margin-bottom: 0.6rem;">${emergency.description}</p>
      <div style="background: #000; border: 1px solid #ffd700; padding: 0.7rem; border-radius: 4px;">
        <strong style="color: #ffd700; font-size: 0.75rem; font-family: Orbitron; display: block; margin-bottom: 0.3rem;">
          📋 FLIGHT MANUAL OVERRIDE (CALL OUT OVER RADIO):
        </strong>
        <p style="color: #00f0ff; font-weight: bold; font-family: Orbitron; font-size: 0.85rem;">${emergency.houstonSolution}</p>
        <ul class="manual-step-list">
          ${emergency.sequence.map((step, idx) => `
            <li>STEP ${idx + 1}: EXECUTE [${step}]</li>
          `).join('')}
        </ul>
      </div>
    `;
  } else {
    severityTag.className = 'status-pill status-nominal';
    severityTag.textContent = 'SYSTEMS NOMINAL';
    alertCard.className = 'emergency-box empty';
    alertCard.innerHTML = `
      <div class="no-emergency">
        <div class="pulse-icon" style="font-size: 1.8rem; color: #39ff14;">✓</div>
        <h4>ALL SYSTEMS OPERATIONAL</h4>
        <p style="color: #889bb5; font-size: 0.8rem;">Telemetry nominal. Maintain surveillance.</p>
      </div>
    `;
  }
}

function updateHoustonAstronautTracker(pos) {
  const el = document.getElementById('eva-status-text');
  if (el) {
    el.textContent = `Astronaut EVA at Station Coordinates: X:${pos.x} Y:${pos.y}`;
  }
}

function sendHoustonAction(type) {
  if (socket) {
    socket.emit('houston_action', { type, pos: gameState?.astronautPos });
    playAudioCue('quindar');
  }
}

// 1-Click: Houston transmits the exact repair manual code to the Astronaut's Helmet HUD
function transmitDirectiveToAstronaut() {
  if (!gameState || !gameState.activeEmergency) {
    showAlertBanner('No active emergency to transmit directive for.');
    return;
  }
  const em = gameState.activeEmergency;
  const directiveText = `DIRECTIVE: ${em.houstonSolution} Sequence: [${em.sequence.join(' ➔ ')}]`;
  if (socket) {
    socket.emit('radio_comm', directiveText);
  }
}

// ================= RADIO COMM CHAT & HELMET VISOR =================
function sendRadioMessage(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('chat-input');
  const text = input?.value.trim();
  if (!text || !socket) return;

  socket.emit('radio_comm', text);
  input.value = '';
}

function sendQuickReply(text) {
  if (socket) {
    socket.emit('radio_comm', text);
    playAudioCue('quindar');
  }
}

function addRadioMessage({ sender, text, timestamp }) {
  // 1. Update Houston's COMMS panel
  const houstonChat = document.getElementById('chat-history');
  if (houstonChat) {
    const isO2Request = text.toLowerCase().includes('oxygen') || text.toLowerCase().includes('o₂');
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${isO2Request ? 'urgent-msg' : ''}`;
    
    let html = `<span class="time">[${timestamp}]</span> <strong>${sender}:</strong> ${text}`;
    if (isO2Request && currentRole === 'houston') {
      html += `
        <div style="margin-top: 6px;">
          <button class="cmd-btn btn-blue" style="width: 100%; min-height: 38px; padding: 6px 10px;" onclick="quickVentOxygen(this)">
            💨 VENT +25% OXYGEN TO ASTRONAUT NOW
          </button>
        </div>
      `;
      playAudioCue('klaxon_alarm');
      showAlertBanner('⚠️ ASTRONAUT OXYGEN LOW - VENT REQUIRED!');
    }
    msgDiv.innerHTML = html;
    houstonChat.appendChild(msgDiv);
    houstonChat.scrollTop = houstonChat.scrollHeight;
  }

  // 2. Update Astronaut's Helmet Visor HUD
  const visorFeed = document.getElementById('astronaut-radio-feed');
  if (visorFeed) {
    const isDirective = text.includes('DIRECTIVE') || text.includes('Houston:');
    const visorMsg = document.createElement('div');
    visorMsg.className = `visor-msg incoming ${isDirective ? 'highlight-directive' : ''}`;
    visorMsg.innerHTML = `<span class="sender">${sender}:</span> ${text}`;
    visorFeed.appendChild(visorMsg);
    visorFeed.scrollTop = visorFeed.scrollHeight;

    // Keep only last 4 messages in visor HUD to avoid cluttering view
    while (visorFeed.children.length > 4) {
      visorFeed.removeChild(visorFeed.firstChild);
    }
  }

  // 3. Audio / Speech Synthesis for Astronaut
  if (sender.includes('Houston') || sender.includes('CAPCOM')) {
    speakRadioTransmission(text);
  }
}

// Quick vent helper when Houston clicks the inline button in chat
function quickVentOxygen(buttonElement) {
  sendHoustonAction('EMERGENCY_O2_BOOST');
  if (buttonElement) {
    buttonElement.disabled = true;
    buttonElement.style.opacity = '0.6';
    buttonElement.textContent = '✓ O₂ VENT ACTIVATED';
  }
  showAlertBanner('💨 Emergency O₂ vented to Astronaut (+25%)');
}

// ================= SOLO AI FLIGHT DIRECTOR =================
let lastAITriggeredEmergency = null;
function handleSoloAIMissionControl(emergency) {
  if (lastAITriggeredEmergency === emergency.title) return;
  lastAITriggeredEmergency = emergency.title;

  setTimeout(() => {
    addRadioMessage({
      sender: 'AI CAPCOM (HOUSTON)',
      text: `Houston copies alarm on ${emergency.title}! Stand by for telemetry.`,
      timestamp: new Date().toLocaleTimeString()
    });
  }, 1000);

  setTimeout(() => {
    addRadioMessage({
      sender: 'AI CAPCOM (HOUSTON)',
      text: `Cadet: ${emergency.houstonSolution} Sequence: [${emergency.sequence.join(' ➔ ')}]`,
      timestamp: new Date().toLocaleTimeString()
    });
  }, 3500);
}
