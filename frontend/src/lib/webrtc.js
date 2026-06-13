import { Device } from 'mediasoup-client';

export class WebRTCManager {
  constructor(socket, rtpCapabilities) {
    this.socket = socket;
    this.rtpCapabilities = rtpCapabilities;
    this.device = null;
    this.sendTransport = null;
    this.recvTransport = null;
    this.videoProducer = null;
    this.audioProducer = null;
    this.consumers = new Map();
    this.onStreamUpdate = null;
    
    // Remote streams mapping: peerSocketId -> MediaStream
    this.remoteStreams = new Map();
  }

  async init() {
    this.device = new Device();
    await this.device.load({ routerRtpCapabilities: this.rtpCapabilities });

    // Create Send Transport
    const sendTransportData = await new Promise((resolve, reject) => {
      this.socket.emit('createWebRtcTransport', {}, (res) => {
        if (res.error) reject(res.error);
        else resolve(res.params);
      });
    });

    this.sendTransport = this.device.createSendTransport(sendTransportData);

    this.sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.socket.emit('transport-connect', {
        transportId: this.sendTransport.id,
        dtlsParameters
      });
      callback();
    });

    this.sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
      this.socket.emit('transport-produce', {
        transportId: this.sendTransport.id,
        kind,
        rtpParameters,
        appData
      }, (res) => {
        if (res.error) errback(res.error);
        else callback({ id: res.id });
      });
    });

    // Create Receive Transport
    const recvTransportData = await new Promise((resolve, reject) => {
      this.socket.emit('createWebRtcTransport', {}, (res) => {
        if (res.error) reject(res.error);
        else resolve(res.params);
      });
    });

    this.recvTransport = this.device.createRecvTransport(recvTransportData);

    this.recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.socket.emit('transport-connect', {
        transportId: this.recvTransport.id,
        dtlsParameters
      });
      callback();
    });
  }

  async publishLocalStream(stream) {
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    if (videoTrack) {
      this.videoProducer = await this.sendTransport.produce({ track: videoTrack });
    }
    if (audioTrack) {
      this.audioProducer = await this.sendTransport.produce({ track: audioTrack });
    }
  }

  async consume(producerId, socketId, userId, kind) {
    const consumeData = await new Promise((resolve, reject) => {
      this.socket.emit('consume', {
        transportId: this.recvTransport.id,
        producerId,
        rtpCapabilities: this.device.rtpCapabilities
      }, (res) => {
        if (res.error) reject(res.error);
        else resolve(res.params);
      });
    });

    const consumer = await this.recvTransport.consume({
      id: consumeData.id,
      producerId: consumeData.producerId,
      kind: consumeData.kind,
      rtpParameters: consumeData.rtpParameters,
    });

    this.consumers.set(consumer.id, consumer);

    // Resume consumer on server
    this.socket.emit('resume_consumer', { consumerId: consumer.id });

    // Manage Remote Stream
    if (!this.remoteStreams.has(socketId)) {
      this.remoteStreams.set(socketId, new MediaStream());
    }
    const stream = this.remoteStreams.get(socketId);
    stream.addTrack(consumer.track);

    if (this.onStreamUpdate) {
      this.onStreamUpdate(socketId, stream, userId);
    }
  }
}
