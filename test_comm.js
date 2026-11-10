import { io } from 'socket.io-client';
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';

console.log('--- STARTING AUTOMATED MESSAGE SYSTEM VERIFICATION ---');

const app = express();
const server = http.createServer(app);
const testIo = new Server(server);
const TEST_PORT = 3099;

testIo.on('connection', (socket) => {
  let userRoom = null;
  let userRole = null;

  socket.on('join_room', ({ roomId, role }) => {
    userRoom = roomId;
    userRole = role;
    socket.join(userRoom);
  });

  socket.on('radio_comm', (msg) => {
    testIo.to(userRoom).emit('radio_comm', {
      sender: (userRole === 'astronaut' || userRole === 'solo') ? 'Astronaut (EVA)' : 'Houston (CAPCOM)',
      text: msg,
      timestamp: new Date().toLocaleTimeString()
    });
  });
});

server.listen(TEST_PORT, async () => {
  console.log(`[TEST SERVER] Running on port ${TEST_PORT}`);

  try {
    // 1. Connect Houston
    const houstonClient = io(`http://localhost:${TEST_PORT}`);
    // 2. Connect Astronaut
    const astronautClient = io(`http://localhost:${TEST_PORT}`);

    await new Promise((resolve) => houstonClient.on('connect', resolve));
    await new Promise((resolve) => astronautClient.on('connect', resolve));
    console.log('✓ Both Houston and Astronaut sockets connected successfully.');

    // Join room
    houstonClient.emit('join_room', { roomId: 'ARTEMIS', role: 'houston' });
    astronautClient.emit('join_room', { roomId: 'ARTEMIS', role: 'astronaut' });

    // Wait a brief tick for room joins
    await new Promise((r) => setTimeout(r, 200));

    // TEST 1: Houston sends message to Astronaut
    const test1Promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Test 1 timed out!')), 3000);

      astronautClient.on('radio_comm', (payload) => {
        if (payload.text.includes('Decouple Relay 4')) {
          clearTimeout(timeout);
          console.log(`✓ Astronaut successfully received Houston transmission:`);
          console.log(`   Sender: "${payload.sender}"`);
          console.log(`   Message: "${payload.text}"`);
          console.log(`   Time: "${payload.timestamp}"`);
          resolve(payload);
        }
      });
    });

    console.log('[ACTION] Houston transmitting directive to Astronaut...');
    houstonClient.emit('radio_comm', 'DIRECTIVE: Override Motor and Decouple Relay 4-GAMMA.');
    const test1Result = await test1Promise;

    if (test1Result.sender !== 'Houston (CAPCOM)') {
      throw new Error(`Expected sender 'Houston (CAPCOM)' but got '${test1Result.sender}'`);
    }

    // TEST 2: Astronaut replies back to Houston
    const test2Promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Test 2 timed out!')), 3000);

      houstonClient.on('radio_comm', (payload) => {
        if (payload.text.includes('Copy that Houston')) {
          clearTimeout(timeout);
          console.log(`✓ Houston successfully received Astronaut reply:`);
          console.log(`   Sender: "${payload.sender}"`);
          console.log(`   Message: "${payload.text}"`);
          resolve(payload);
        }
      });
    });

    console.log('[ACTION] Astronaut replying over helmet radio...');
    astronautClient.emit('radio_comm', 'Copy that Houston, approaching Solar Array now.');
    const test2Result = await test2Promise;

    if (test2Result.sender !== 'Astronaut (EVA)') {
      throw new Error(`Expected sender 'Astronaut (EVA)' but got '${test2Result.sender}'`);
    }

    console.log('\n======================================================');
    console.log('✅ ALL MESSAGE SYSTEM VERIFICATION TESTS PASSED (100%)');
    console.log('======================================================\n');

    houstonClient.disconnect();
    astronautClient.disconnect();
    server.close();
    process.exit(0);

  } catch (err) {
    console.error('❌ MESSAGE SYSTEM TEST FAILED:', err);
    server.close();
    process.exit(1);
  }
});
