const ioClient = require('socket.io-client');
const http = require('http');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const CollabSession = require('../src/models/CollabSession');

const BACKEND_URL = 'http://localhost:5000';
const API_BASE = `${BACKEND_URL}/api/v1`;

async function request(urlStr, method = 'GET', data = null, token = null) {
  const url = new URL(urlStr.startsWith('http') ? urlStr : `${API_BASE}${urlStr}`);
  const payload = data ? JSON.stringify(data) : null;
  const headers = {};
  if (payload) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(payload);
  } else if (method === 'DELETE' || method === 'POST' || method === 'PATCH') {
    headers['Content-Length'] = 0;
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: method,
    headers: headers,
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: body });
        }
      });
    });
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runLiveChatRealtimeTest() {
  console.log('========================================================================');
  console.log('REAL-TIME MULTI-USER LIVE CHAT & SOCKET BROADCAST TEST');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/devcollab';
  await mongoose.connect(mongoUri);

  let atharvaSocket = null;
  let emmaSocket = null;

  try {
    // 1. Authenticate Atharva (Human User / PM)
    console.log('--- 1. Authenticating Users ---');
    await request('/auth/login', 'POST', {
      email: 'atharvanandurkar2411@gmail.com',
      password: 'Password123',
    });
    const atharvaDoc = await User.findOne({ email: 'atharvanandurkar2411@gmail.com' }).select('+otp');
    const atharvaVerify = await request('/auth/verify-otp', 'POST', {
      email: 'atharvanandurkar2411@gmail.com',
      otp: atharvaDoc.otp,
    });
    const atharvaToken = atharvaVerify.body.data.accessToken;
    const atharvaUser = atharvaVerify.body.data.user;
    assert(atharvaToken, 'Atharva logged in and authenticated');

    // 2. Authenticate Emma Watson (UI/UX Teammate)
    const emmaLogin = await request('/auth/login', 'POST', {
      email: 'emma.designer@devcollab.com',
      password: 'DevCollab123!',
    });
    const emmaToken = emmaLogin.body.data.accessToken;
    const emmaUser = emmaLogin.body.data.user;
    assert(emmaToken, 'Emma Watson authenticated');

    // 3. Find project & collaborative session
    console.log('\n--- 2. Setting Up Collaborative Coding Session ---');
    let project = await Project.findOne({ name: 'DevCollab' });
    if (!project) {
      project = await Project.findOne();
    }
    assert(project, `Found project: ${project?.name} (${project?._id})`);

    const sessionsRes = await request(`/collab/project/${project._id}`, 'GET', null, atharvaToken);
    assert(sessionsRes.status === 200, 'Fetched collaborative sessions for project');
    const session = sessionsRes.body.data.sessions[0];
    const sessionId = session._id;
    assert(sessionId, `Using collaborative session: ${sessionId}`);

    // 4. Open Socket connections for both users
    console.log('\n--- 3. Establishing Real-Time WebSocket Connections ---');
    atharvaSocket = ioClient(BACKEND_URL, {
      auth: { token: atharvaToken },
      transports: ['websocket'],
    });

    emmaSocket = ioClient(BACKEND_URL, {
      auth: { token: emmaToken },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise((resolve) => atharvaSocket.on('connect', resolve)),
      new Promise((resolve) => emmaSocket.on('connect', resolve)),
    ]);
    assert(atharvaSocket.connected && emmaSocket.connected, 'Both Atharva and Emma connected via WebSocket');

    // 5. Join the collaborative session room
    console.log('\n--- 4. Joining Collaborative Session Rooms ---');
    const atharvaJoinedPromise = new Promise((resolve) => {
      atharvaSocket.on('collab:joined', resolve);
    });
    const emmaJoinedPromise = new Promise((resolve) => {
      emmaSocket.on('collab:joined', resolve);
    });

    atharvaSocket.emit('collab:join', { sessionId });
    emmaSocket.emit('collab:join', { sessionId });

    await Promise.all([atharvaJoinedPromise, emmaJoinedPromise]);
    assert(true, 'Both users successfully joined collab room');

    // 6. Emma sends a chat message over socket -> Atharva must receive it in real-time
    console.log('\n--- 5. Testing Real-Time Chat: Emma -> Atharva ---');
    const emmaTestMessage = `Hi Atharva, I'm refining the UI components! Timestamp: ${Date.now()}`;

    const atharvaReceivedPromise = new Promise((resolve) => {
      atharvaSocket.on('collab:chatMessage', (msg) => {
        if (msg.content === emmaTestMessage) {
          resolve(msg);
        }
      });
    });

    emmaSocket.emit('collab:chat', {
      sessionId,
      message: emmaTestMessage,
    });

    const msgReceivedByAtharva = await atharvaReceivedPromise;
    assert(
      msgReceivedByAtharva && msgReceivedByAtharva.content === emmaTestMessage,
      `Atharva received Emma's message in real time: "${msgReceivedByAtharva.content}"`
    );
    assert(
      msgReceivedByAtharva.name?.includes('Emma'),
      `Sender identified correctly as Emma Watson (Got: ${msgReceivedByAtharva.name})`
    );

    // 7. Atharva sends a reply over socket -> Emma must receive it in real-time
    console.log('\n--- 6. Testing Real-Time Chat: Atharva -> Emma ---');
    const atharvaReplyMessage = `Great work Emma! The pair-coding room is perfectly in sync! Timestamp: ${Date.now()}`;

    const emmaReceivedPromise = new Promise((resolve) => {
      emmaSocket.on('collab:chatMessage', (msg) => {
        if (msg.content === atharvaReplyMessage) {
          resolve(msg);
        }
      });
    });

    atharvaSocket.emit('collab:chat', {
      sessionId,
      message: atharvaReplyMessage,
    });

    const msgReceivedByEmma = await emmaReceivedPromise;
    assert(
      msgReceivedByEmma && msgReceivedByEmma.content === atharvaReplyMessage,
      `Emma received Atharva's reply in real time: "${msgReceivedByEmma.content}"`
    );
    assert(
      msgReceivedByEmma.name?.includes('Atharva'),
      `Sender identified correctly as Atharva Nandurkar (Got: ${msgReceivedByEmma.name})`
    );

    // 8. REST Fallback API: Emma sends message via REST endpoint -> Atharva receives via socket
    console.log('\n--- 7. Testing Dual-Channel / REST Fallback Live Broadcast ---');
    const restMessageText = `REST dual-channel sync check. Timestamp: ${Date.now()}`;

    const atharvaRestReceivePromise = new Promise((resolve) => {
      atharvaSocket.on('collab:chatMessage', (msg) => {
        if (msg.content === restMessageText) {
          resolve(msg);
        }
      });
    });

    const restRes = await request(`/collab/${sessionId}/messages`, 'POST', {
      content: restMessageText,
    }, emmaToken);
    assert(restRes.status === 201, 'Message saved via REST endpoint');

    const msgReceivedFromRest = await atharvaRestReceivePromise;
    assert(
      msgReceivedFromRest && msgReceivedFromRest.content === restMessageText,
      `Atharva received REST-posted message via live WebSocket broadcast: "${msgReceivedFromRest.content}"`
    );

    // 9. Verify In-Database Persistence
    console.log('\n--- 8. Verifying MongoDB Persistence ---');
    const updatedSession = await CollabSession.findById(sessionId);
    const dbMessages = updatedSession.messages || [];
    const hasEmmaMsg = dbMessages.some((m) => m.content === emmaTestMessage);
    const hasAtharvaMsg = dbMessages.some((m) => m.content === atharvaReplyMessage);
    const hasRestMsg = dbMessages.some((m) => m.content === restMessageText);

    assert(hasEmmaMsg, 'Emma\'s socket message saved in MongoDB CollabSession.messages');
    assert(hasAtharvaMsg, 'Atharva\'s socket message saved in MongoDB CollabSession.messages');
    assert(hasRestMsg, 'REST dual-sync message saved in MongoDB CollabSession.messages');

    // 10. Initial Session Sync on New Connection
    console.log('\n--- 9. Verifying History Hydration for Newly Joining Peer ---');
    const newSocket = ioClient(BACKEND_URL, {
      auth: { token: atharvaToken },
      transports: ['websocket'],
    });
    await new Promise((resolve) => newSocket.on('connect', resolve));

    const initHistoryPromise = new Promise((resolve) => {
      newSocket.on('collab:init', (payload) => {
        resolve(payload.messages || []);
      });
    });

    newSocket.emit('collab:join', { sessionId });
    const hydratedMessages = await initHistoryPromise;
    assert(
      Array.isArray(hydratedMessages) && hydratedMessages.length >= 3,
      `Newly connecting teammate receives full message history upon join (${hydratedMessages.length} messages hydrated)`
    );
    newSocket.disconnect();

  } catch (error) {
    console.error('Real-Time Live Chat Test encountered an error:', error);
    failed++;
  } finally {
    if (atharvaSocket) atharvaSocket.disconnect();
    if (emmaSocket) emmaSocket.disconnect();
    await mongoose.disconnect();
    console.log('\n========================================================================');
    console.log(`REAL-TIME CHAT TESTS COMPLETED: ${passed} PASSED | ${failed} FAILED`);
    console.log('========================================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runLiveChatRealtimeTest();

