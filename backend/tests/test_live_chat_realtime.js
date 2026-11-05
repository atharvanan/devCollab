const ioClient = require('socket.io-client');
const http = require('http');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const CollabSession = require('../src/models/CollabSession');
const { generateAccessToken } = require('../src/utils/jwt');

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

  let user1Socket = null;
  let user2Socket = null;

  try {
    // 1. Authenticate Two Real Test Engineers
    console.log('--- 1. Authenticating Users ---');
    async function getOrCreateUser(name, email, role = 'user') {
      let u = await User.findOne({ email });
      if (!u) {
        u = await User.create({ name, email, password: 'Password123!', role, isVerified: true });
      } else {
        u.isVerified = true;
        await u.save();
      }
      return { user: u.toPublicJSON(), token: generateAccessToken(u._id) };
    }

    const account1 = await getOrCreateUser('Lead Engineer', 'lead.engineer@example.com', 'admin');
    const user1Token = account1.token;
    const user1 = account1.user;
    assert(user1Token, 'Lead Engineer authenticated');

    const account2 = await getOrCreateUser('Staff Developer', 'staff.dev@example.com', 'user');
    const user2Token = account2.token;
    const user2 = account2.user;
    assert(user2Token, 'Staff Developer authenticated');

    // 2. Set Up Project & Collaborative Session
    console.log('\n--- 2. Setting Up Collaborative Coding Session ---');
    let project = await Project.findOne();
    if (!project) {
      project = await Project.create({
        name: 'Live Chat Studio Test',
        description: 'Test project for live socket chat',
        owner: user1._id,
        members: [
          { user: user1._id, role: 'project_manager' },
          { user: user2._id, role: 'frontend_developer' },
        ],
      });
    } else {
      // Ensure both users are members
      const hasU1 = project.members.some((m) => m.user && (m.user._id || m.user).toString() === user1._id.toString());
      const hasU2 = project.members.some((m) => m.user && (m.user._id || m.user).toString() === user2._id.toString());
      if (!hasU1) project.members.push({ user: user1._id, role: 'project_manager' });
      if (!hasU2) project.members.push({ user: user2._id, role: 'frontend_developer' });
      await project.save();
    }
    assert(project, `Active project ready: ${project.name} (${project._id})`);

    let session = await CollabSession.findOne({ project: project._id });
    if (!session) {
      session = await CollabSession.create({
        project: project._id,
        createdBy: user1._id,
        title: 'Live Chat Test Session',
        language: 'javascript',
        code: '// Live chat session\n',
      });
    }
    const sessionId = session._id.toString();
    assert(sessionId, `Using collaborative session: ${sessionId}`);

    // 3. Open Socket connections for both users
    console.log('\n--- 3. Establishing Real-Time WebSocket Connections ---');
    user1Socket = ioClient(BACKEND_URL, {
      auth: { token: user1Token },
      transports: ['websocket'],
    });

    user2Socket = ioClient(BACKEND_URL, {
      auth: { token: user2Token },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise((resolve) => user1Socket.on('connect', resolve)),
      new Promise((resolve) => user2Socket.on('connect', resolve)),
    ]);
    assert(user1Socket.connected && user2Socket.connected, 'Both users connected via WebSocket');

    // 4. Join the collaborative session room
    console.log('\n--- 4. Joining Collaborative Session Rooms ---');
    const u1JoinedPromise = new Promise((resolve) => {
      user1Socket.on('collab:joined', resolve);
    });
    const u2JoinedPromise = new Promise((resolve) => {
      user2Socket.on('collab:joined', resolve);
    });

    user1Socket.emit('collab:join', { sessionId });
    user2Socket.emit('collab:join', { sessionId });

    await Promise.all([u1JoinedPromise, u2JoinedPromise]);
    assert(true, 'Both users successfully joined collab room');

    // 5. User 2 sends a chat message over socket -> User 1 must receive it in real-time
    console.log('\n--- 5. Testing Real-Time Chat: User 2 -> User 1 ---');
    const u2TestMessage = `Hi Lead, I have pushed the frontend changes! Timestamp: ${Date.now()}`;

    const u1ReceivedPromise = new Promise((resolve) => {
      user1Socket.on('collab:chatMessage', (msg) => {
        if (msg.content === u2TestMessage) {
          resolve(msg);
        }
      });
    });

    user2Socket.emit('collab:chat', {
      sessionId,
      message: u2TestMessage,
    });

    const msgReceivedByU1 = await u1ReceivedPromise;
    assert(
      msgReceivedByU1 && msgReceivedByU1.content === u2TestMessage,
      `User 1 received User 2's message in real time: "${msgReceivedByU1.content}"`
    );
    assert(
      msgReceivedByU1.name?.includes('Staff Developer'),
      `Sender identified correctly as Staff Developer (Got: ${msgReceivedByU1.name})`
    );

    // 6. User 1 sends a reply over socket -> User 2 must receive it in real-time
    console.log('\n--- 6. Testing Real-Time Chat: User 1 -> User 2 ---');
    const u1ReplyMessage = `Great work! All real-time systems are operational! Timestamp: ${Date.now()}`;

    const u2ReceivedPromise = new Promise((resolve) => {
      user2Socket.on('collab:chatMessage', (msg) => {
        if (msg.content === u1ReplyMessage) {
          resolve(msg);
        }
      });
    });

    user1Socket.emit('collab:chat', {
      sessionId,
      message: u1ReplyMessage,
    });

    const msgReceivedByU2 = await u2ReceivedPromise;
    assert(
      msgReceivedByU2 && msgReceivedByU2.content === u1ReplyMessage,
      `User 2 received User 1's reply in real time: "${msgReceivedByU2.content}"`
    );
    assert(
      msgReceivedByU2.name?.includes('Lead Engineer'),
      `Sender identified correctly as Lead Engineer (Got: ${msgReceivedByU2.name})`
    );

    // 7. Verify DB persistence of chat history
    console.log('\n--- 7. Verifying DB Persistence & HTTP Retrieval ---');
    const sessionDoc = await CollabSession.findById(sessionId);
    assert(sessionDoc.messages && sessionDoc.messages.length >= 2, 'Chat messages persisted into MongoDB CollabSession.messages array');

    const lastTwo = sessionDoc.messages.slice(-2);
    assert(
      lastTwo[0].content === u2TestMessage && lastTwo[1].content === u1ReplyMessage,
      'Messages in MongoDB match exactly in sequential chronological order'
    );

    const httpFetch = await request(`/collab/${sessionId}`, 'GET', null, user1Token);
    assert(httpFetch.status === 200, 'HTTP GET /collab/:id returns 200 OK');
    const fetchedMessages = httpFetch.body.data.session.messages;
    assert(
      fetchedMessages.some((m) => m.content === u2TestMessage) &&
      fetchedMessages.some((m) => m.content === u1ReplyMessage),
      'HTTP response includes all live chat messages for client reloads'
    );

    // 8. Test live typing indicator broadcast
    console.log('\n--- 8. Testing Real-Time Typing Indicators ---');
    const typingPromise = new Promise((resolve) => {
      user1Socket.on('collab:userTyping', (data) => {
        resolve(data);
      });
    });

    user2Socket.emit('collab:typing', { sessionId, isTyping: true });
    const typingData = await typingPromise;
    const typingName = typingData?.user?.name || typingData?.name;
    assert(typingName && typingName.includes('Staff Developer'), `Typing indicator received from: ${typingName}`);

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    if (user1Socket) user1Socket.disconnect();
    if (user2Socket) user2Socket.disconnect();
    await mongoose.disconnect();
  }

  console.log('\n========================================================================');
  console.log(`REAL-TIME CHAT TEST RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveChatRealtimeTest();
