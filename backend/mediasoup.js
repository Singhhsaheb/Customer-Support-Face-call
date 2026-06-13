const mediasoup = require('mediasoup');

let worker;
const routers = new Map(); // sessionId -> router

async function startMediasoupWorker() {
  worker = await mediasoup.createWorker({
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  });

  worker.on('died', () => {
    console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
    setTimeout(() => process.exit(1), 2000);
  });

  console.log('Mediasoup worker started');
  return worker;
}

const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000
    }
  }
];

async function createRouter(sessionId) {
  if (routers.has(sessionId)) {
    return routers.get(sessionId);
  }
  const router = await worker.createRouter({ mediaCodecs });
  routers.set(sessionId, router);
  return router;
}

async function createWebRtcTransport(router) {
  const transport = await router.createWebRtcTransport({
    listenIps: [
      {
        ip: '0.0.0.0',
        announcedIp: '127.0.0.1' // Works for local testing. In prod, use public IP.
      }
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });

  transport.on('dtlsstatechange', dtlsState => {
    if (dtlsState === 'closed') {
      transport.close();
    }
  });

  transport.on('routerclose', () => {
    transport.close();
  });

  return transport;
}

module.exports = {
  startMediasoupWorker,
  createRouter,
  createWebRtcTransport,
  routers
};
