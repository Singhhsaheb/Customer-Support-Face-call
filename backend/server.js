const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./database');
const { startMediasoupWorker, createRouter, createWebRtcTransport } = require('./mediasoup');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Mediasoup state
// Map sessionId -> { router, peers: Map(peerId -> { transports, producers, consumers }) }
const rooms = new Map();

// API Routes
app.get('/api/agents', (req, res) => {
  res.json(db.getAgents());
});

app.post('/api/sessions', (req, res) => {
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId required' });
  const sessionId = db.createSession(agentId);
  res.json({ sessionId });
});

app.get('/api/sessions/:id', (req, res) => {
  const session = db.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.json(session);
});

app.post('/api/sessions/:id/end', (req, res) => {
  const sessionId = req.params.id;
  db.endSession(sessionId);
  io.to(sessionId).emit('session_ended');
  res.json({ success: true });
});

app.get('/api/admin/metrics', (req, res) => {
  res.json(db.getAdminMetrics());
});

// Socket.io for Chat and Signaling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  let currentSessionId = null;
  let currentUserRole = null;
  let currentUserId = null;

  socket.on('join_session', async ({ sessionId, name, role }, callback) => {
    const session = db.getSession(sessionId);
    if (!session || session.status === 'ENDED') {
      return callback({ error: 'Session invalid or ended' });
    }

    currentSessionId = sessionId;
    currentUserRole = role;
    
    // Create participant in DB
    currentUserId = db.createUser(name, role);
    db.addParticipant(sessionId, currentUserId);
    
    socket.join(sessionId);

    // Initialize Mediasoup room if not exists
    if (!rooms.has(sessionId)) {
      const router = await createRouter(sessionId);
      rooms.set(sessionId, {
        router,
        peers: new Map()
      });
    }

    const room = rooms.get(sessionId);
    room.peers.set(socket.id, {
      userId: currentUserId,
      name,
      role,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    });

    // Notify others
    socket.to(sessionId).emit('participant_joined', { id: currentUserId, name, role });

    // Send chat history
    const messages = db.getMessages(sessionId);
    
    callback({ 
      success: true, 
      userId: currentUserId, 
      messages,
      rtpCapabilities: room.router.rtpCapabilities
    });
  });

  socket.on('send_message', ({ content, type }) => {
    if (!currentSessionId) return;
    const msgId = db.saveMessage(currentSessionId, currentUserId, content, type);
    io.to(currentSessionId).emit('new_message', {
      id: msgId,
      session_id: currentSessionId,
      sender_id: currentUserId,
      content,
      type,
      timestamp: new Date().toISOString()
    });
  });

  // --- WebRTC Signaling (Mediasoup) ---
  socket.on('createWebRtcTransport', async (_, callback) => {
    if (!currentSessionId) return;
    try {
      const room = rooms.get(currentSessionId);
      const transport = await createWebRtcTransport(room.router);
      
      room.peers.get(socket.id).transports.set(transport.id, transport);

      callback({
        params: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        }
      });
    } catch (err) {
      console.error(err);
      callback({ error: err.message });
    }
  });

  socket.on('transport-connect', async ({ transportId, dtlsParameters }) => {
    if (!currentSessionId) return;
    const room = rooms.get(currentSessionId);
    const transport = room.peers.get(socket.id).transports.get(transportId);
    await transport.connect({ dtlsParameters });
  });

  socket.on('transport-produce', async ({ transportId, kind, rtpParameters, appData }, callback) => {
    if (!currentSessionId) return;
    const room = rooms.get(currentSessionId);
    const transport = room.peers.get(socket.id).transports.get(transportId);
    
    const producer = await transport.produce({ kind, rtpParameters, appData });
    room.peers.get(socket.id).producers.set(producer.id, producer);

    // Notify other clients about the new producer
    socket.to(currentSessionId).emit('new_producer', {
      producerId: producer.id,
      socketId: socket.id,
      userId: currentUserId,
      kind: producer.kind
    });

    producer.on('transportclose', () => {
      producer.close();
    });

    callback({ id: producer.id });
  });

  socket.on('consume', async ({ producerId, rtpCapabilities }, callback) => {
    if (!currentSessionId) return;
    try {
      const room = rooms.get(currentSessionId);
      const router = room.router;

      if (!router.canConsume({ producerId, rtpCapabilities })) {
        return callback({ error: 'cannot consume' });
      }

      // Find the consumer transport (assuming 1 consume transport per peer for simplicity, let's just get the first one that is recv)
      // Usually client creates a transport explicitly for consuming. We'll find it by looking for transports
      // Actually, we should ask the client which transport to use, but to keep it simple, we'll let client pass consumerTransportId
      // Let's modify client to pass it. Wait, the `consume` event doesn't have transportId.
      // Let's assume the client passes `transportId`.
    } catch (err) {
      console.error(err);
      callback({ error: err.message });
    }
  });

  // Updated consume with transportId
  socket.on('consume', async ({ transportId, producerId, rtpCapabilities }, callback) => {
    if (!currentSessionId) return;
    try {
      const room = rooms.get(currentSessionId);
      const router = room.router;

      if (!router.canConsume({ producerId, rtpCapabilities })) {
        return callback({ error: 'cannot consume' });
      }

      const transport = room.peers.get(socket.id).transports.get(transportId);
      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true,
      });

      room.peers.get(socket.id).consumers.set(consumer.id, consumer);

      consumer.on('transportclose', () => consumer.close());
      consumer.on('producerclose', () => {
        socket.emit('consumer_closed', { consumerId: consumer.id });
        consumer.close();
      });

      callback({
        params: {
          id: consumer.id,
          producerId: consumer.producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        }
      });
    } catch (err) {
      console.error(err);
      callback({ error: err.message });
    }
  });

  socket.on('resume_consumer', async ({ consumerId }) => {
    if (!currentSessionId) return;
    const room = rooms.get(currentSessionId);
    const consumer = room.peers.get(socket.id).consumers.get(consumerId);
    await consumer.resume();
  });

  // Fetch existing producers in the room
  socket.on('getProducers', (callback) => {
    if (!currentSessionId) return;
    const room = rooms.get(currentSessionId);
    const producersList = [];
    room.peers.forEach((peer, peerSocketId) => {
      if (peerSocketId !== socket.id) {
        peer.producers.forEach(producer => {
          producersList.push({
            producerId: producer.id,
            socketId: peerSocketId,
            userId: peer.userId,
            kind: producer.kind
          });
        });
      }
    });
    callback(producersList);
  });

  socket.on('toggle_customer_recording', ({ allow }) => {
    if (!currentSessionId || currentUserRole !== 'AGENT') return;
    io.to(currentSessionId).emit('recording_permission_updated', { allow });
  });

  socket.on('disconnect', () => {
    if (currentSessionId) {
      db.removeParticipant(currentSessionId, currentUserId);
      io.to(currentSessionId).emit('participant_left', { id: currentUserId });
      
      const room = rooms.get(currentSessionId);
      if (room && room.peers.has(socket.id)) {
        // Clean up transports
        const peer = room.peers.get(socket.id);
        peer.transports.forEach(t => t.close());
        room.peers.delete(socket.id);
      }
    }
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
startMediasoupWorker().then(() => {
  server.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start mediasoup:', err);
});
