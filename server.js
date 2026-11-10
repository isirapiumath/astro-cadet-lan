import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Retrieve local IPv4 address for LAN play
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Room state storage
const rooms = new Map();

const ISS_MODULES = [
  { id: 'solar_a', name: 'Solar Array Alpha', x: 200, y: 140, type: 'power', health: 100, emergency: null },
  { id: 'solar_b', name: 'Solar Array Beta', x: 600, y: 140, type: 'power', health: 100, emergency: null },
  { id: 'destiny', name: 'Destiny US Lab', x: 400, y: 260, type: 'science', health: 100, emergency: null },
  { id: 'harmony', name: 'Harmony Node 2', x: 400, y: 350, type: 'life_support', health: 100, emergency: null },
  { id: 'quest', name: 'Quest Airlock', x: 320, y: 350, type: 'airlock', health: 100, emergency: null },
  { id: 'kibo', name: 'Kibo Japanese Lab', x: 490, y: 350, type: 'science', health: 100, emergency: null },
  { id: 'antenna', name: 'High-Gain Antenna', x: 400, y: 460, type: 'comm', health: 100, emergency: null },
  { id: 'radiator', name: 'Thermal Radiator', x: 260, y: 260, type: 'thermal', health: 100, emergency: null }
];

const EMERGENCY_TEMPLATES = [
  {
    title: 'MICROMETEOROID BREACH',
    module: 'destiny',
    description: 'Hull micro-fracture detected in US Lab! Internal pressure dropping.',
    houstonSolution: 'Houston Diagnostic Code: DECOUPLE RELAY 4-GAMMA & FLUSH PURGE VALVE.',
    sequence: ['VALVE_A', 'CIRCUIT_3', 'PULSE'],
    severity: 'CRITICAL',
    timeLimit: 45
  },
  {
    title: 'SOLAR ARRAY INVERTER FAULT',
    module: 'solar_a',
    description: 'Photovoltaic rotary joint jammed. Power grid load surging!',
    houstonSolution: 'Houston Manual: OVERRIDE ROTARY MOTOR & REALIGN GIMBAL B.',
    sequence: ['MOTOR_RESET', 'GIMBAL_B', 'SYNC'],
    severity: 'WARNING',
    timeLimit: 50
  },
  {
    title: 'AMMONIA COOLANT LEAK',
    module: 'radiator',
    description: 'Loop B external radiator pressure loss. Station overheating imminent!',
    houstonSolution: 'Houston Manual: SEAL SHUTOFF VALVE 2 & BYPASS COOLANT LOOP.',
    sequence: ['VALVE_B', 'BYPASS_LOOP', 'PRESSURE_CHECK'],
    severity: 'CRITICAL',
    timeLimit: 40
  },
  {
    title: 'COMMUNICATION DISH DRIFT',
    module: 'antenna',
    description: 'S-band telemetry lost with TDRS satellite. Relink required.',
    houstonSolution: 'Houston Manual: CALIBRATE AZIMUTH TO 248° & BOOST TRANSPONDER.',
    sequence: ['AZIMUTH', 'TRANSPONDER', 'FREQ_LOCK'],
    severity: 'WARNING',
    timeLimit: 55
  }
];

function createInitialGameState() {
  return {
    stationHealth: 100,
    oxygenLevel: 100,
    powerGrid: 100,
    score: 0,
    activeEmergency: null,
    emergencyTimer: null,
    modules: JSON.parse(JSON.stringify(ISS_MODULES)),
    astronautPos: { x: 320, y: 350, vx: 0, vy: 0 },
    houstonPings: [],
    missionTime: 0,
    status: 'TRAINING_ACTIVE'
  };
}

io.on('connection', (socket) => {
  let userRoom = null;
  let userRole = null;

  socket.on('join_room', ({ roomId, role }) => {
    userRoom = (roomId || 'ARTEMIS').toUpperCase();
    userRole = role; // 'astronaut' | 'houston' | 'solo'
    socket.join(userRoom);

    if (!rooms.has(userRoom)) {
      rooms.set(userRoom, {
        state: createInitialGameState(),
        players: {},
        interval: null
      });
      startRoomLoop(userRoom);
    }

    const roomData = rooms.get(userRoom);
    roomData.players[socket.id] = { role, id: socket.id };

    // Send welcome and current state
    socket.emit('init_state', {
      state: roomData.state,
      assignedRole: role,
      room: userRoom,
      playerCount: Object.keys(roomData.players).length
    });

    // Notify room of roster
    io.to(userRoom).emit('roster_update', {
      players: Object.values(roomData.players)
    });

    console.log(`[LAN] Socket ${socket.id} joined ${userRoom} as ${role}`);
  });

  // Astronaut updates position and motion
  socket.on('astronaut_move', (pos) => {
    if (!userRoom || !rooms.has(userRoom)) return;
    const roomData = rooms.get(userRoom);
    roomData.state.astronautPos = pos;
    // Broadcast astronaut coordinates to Houston
    socket.to(userRoom).emit('astronaut_telemetry', pos);
  });

  // Houston actions (ping radar, vent O2, reroute power)
  socket.on('houston_action', (action) => {
    if (!userRoom || !rooms.has(userRoom)) return;
    const roomData = rooms.get(userRoom);

    if (action.type === 'EMERGENCY_O2_BOOST') {
      roomData.state.oxygenLevel = Math.min(100, roomData.state.oxygenLevel + 25);
      io.to(userRoom).emit('audio_cue', 'o2_refill');
    } else if (action.type === 'POWER_REROUTE') {
      roomData.state.powerGrid = Math.min(100, roomData.state.powerGrid + 20);
      io.to(userRoom).emit('audio_cue', 'power_online');
    } else if (action.type === 'RADAR_PING') {
      io.to(userRoom).emit('radar_ping', action.pos);
    }

    io.to(userRoom).emit('state_update', roomData.state);
  });

  // Astronaut repair action step
  socket.on('repair_step', ({ stepId }) => {
    if (!userRoom || !rooms.has(userRoom)) return;
    const roomData = rooms.get(userRoom);
    const emergency = roomData.state.activeEmergency;

    if (emergency) {
      if (emergency.sequence[0] === stepId) {
        emergency.sequence.shift();
        io.to(userRoom).emit('audio_cue', 'repair_click');

        if (emergency.sequence.length === 0) {
          // Emergency resolved!
          roomData.state.score += 500;
          roomData.state.stationHealth = Math.min(100, roomData.state.stationHealth + 10);
          io.to(userRoom).emit('emergency_resolved', {
            title: emergency.title,
            score: roomData.state.score
          });
          roomData.state.activeEmergency = null;
        }
        io.to(userRoom).emit('state_update', roomData.state);
      } else {
        // Wrong button pressed
        io.to(userRoom).emit('audio_cue', 'error_buzzer');
      }
    }
  });

  // Text / Radio chat between crew
  socket.on('radio_comm', (msg) => {
    if (!userRoom) return;
    io.to(userRoom).emit('radio_comm', {
      sender: (userRole === 'astronaut' || userRole === 'solo') ? 'Astronaut (EVA)' : 'Houston (CAPCOM)',
      text: msg,
      timestamp: new Date().toLocaleTimeString()
    });
  });

  socket.on('disconnect', () => {
    if (userRoom && rooms.has(userRoom)) {
      const roomData = rooms.get(userRoom);
      delete roomData.players[socket.id];
      io.to(userRoom).emit('roster_update', {
        players: Object.values(roomData.players)
      });
      if (Object.keys(roomData.players).length === 0) {
        clearInterval(roomData.interval);
        rooms.delete(userRoom);
      }
    }
  });
});

function startRoomLoop(roomId) {
  const roomData = rooms.get(roomId);

  roomData.interval = setInterval(() => {
    const s = roomData.state;
    s.missionTime += 1;

    // Normal life support depletion in zero-g
    s.oxygenLevel = Math.max(0, s.oxygenLevel - 0.25);

    // If an emergency is active, drain health faster
    if (s.activeEmergency) {
      s.stationHealth = Math.max(0, s.stationHealth - 0.4);
      s.activeEmergency.timeLeft = Math.max(0, s.activeEmergency.timeLeft - 1);

      if (s.activeEmergency.timeLeft <= 0) {
        // Emergency timed out
        s.stationHealth = Math.max(0, s.stationHealth - 15);
        s.activeEmergency = null;
        io.to(roomId).emit('audio_cue', 'failure_alarm');
      }
    } else {
      // Chance of random NASA emergency occurring
      if (Math.random() < 0.20 && s.missionTime > 3) {
        const template = EMERGENCY_TEMPLATES[Math.floor(Math.random() * EMERGENCY_TEMPLATES.length)];
        s.activeEmergency = {
          ...template,
          timeLeft: template.timeLimit,
          sequence: [...template.sequence]
        };
        io.to(roomId).emit('audio_cue', 'klaxon_alarm');
        io.to(roomId).emit('emergency_alert', s.activeEmergency);
      }
    }

    if (s.stationHealth <= 0 || s.oxygenLevel <= 0) {
      s.status = 'MISSION_ABORTED';
    }

    io.to(roomId).emit('state_tick', {
      oxygenLevel: s.oxygenLevel,
      stationHealth: s.stationHealth,
      powerGrid: s.powerGrid,
      missionTime: s.missionTime,
      activeEmergency: s.activeEmergency,
      status: s.status,
      score: s.score
    });
  }, 1000);
}

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log('\n======================================================');
  console.log('🚀 ASTROCADET: LAN MISSION CONTROL & SPACEWALK 🚀');
  console.log('======================================================');
  console.log(`Local Access:   http://localhost:${PORT}`);
  console.log(`LAN WiFi URL:   http://${localIp}:${PORT}`);
  console.log('------------------------------------------------------');
  console.log('Open the LAN WiFi URL on a second laptop or mobile phone');
  console.log('to test real-time 2-player cooperative gameplay!');
  console.log('======================================================\n');
});
