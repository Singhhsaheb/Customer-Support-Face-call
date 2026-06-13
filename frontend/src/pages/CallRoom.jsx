import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { WebRTCManager } from '../lib/webrtc';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Send, MessageSquare, Monitor, StopCircle, UserCheck } from 'lucide-react';

export default function CallRoom() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role');
  const name = searchParams.get('name');
  const navigate = useNavigate();

  const [socket, setSocket] = useState(null);
  const [webrtc, setWebrtc] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [customerCanRecord, setCustomerCanRecord] = useState(false);

  const localVideoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    const initCall = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        newSocket.emit('join_session', { sessionId, name, role }, async (response) => {
          if (response.error) {
            alert(response.error);
            navigate('/');
            return;
          }
          
          setMessages(response.messages || []);

          const manager = new WebRTCManager(newSocket, response.rtpCapabilities);
          setWebrtc(manager);

          manager.onStreamUpdate = (peerSocketId, rStream, userId) => {
            setRemoteStreams(prev => ({ ...prev, [peerSocketId]: { stream: rStream, userId } }));
          };

          await manager.init();
          await manager.publishLocalStream(stream);

          // Get existing producers
          newSocket.emit('getProducers', (producers) => {
            producers.forEach(p => manager.consume(p.producerId, p.socketId, p.userId, p.kind));
          });
        });

      } catch (err) {
        console.error('Failed to get media or join:', err);
        alert('Could not access camera/microphone');
      }
    };

    initCall();

    newSocket.on('new_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    newSocket.on('new_producer', ({ producerId, socketId, userId, kind }) => {
      if (webrtc) webrtc.consume(producerId, socketId, userId, kind);
    });

    newSocket.on('session_ended', () => {
      alert('Session was ended by the agent.');
      navigate('/');
    });

    newSocket.on('participant_left', ({ id }) => {
      // Remove streams associated with this user
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        for (const [sId, data] of Object.entries(newStreams)) {
          if (data.userId === id) delete newStreams[sId];
        }
        return newStreams;
      });
    });

    newSocket.on('recording_permission_updated', ({ allow }) => {
      setCustomerCanRecord(allow);
      if (role !== 'AGENT' && !allow && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    });

    return () => {
      newSocket.disconnect();
      if (localStream) localStream.getTracks().forEach(t => t.stop());
    };
  }, [sessionId, name, role]);

  // Effect to handle new consumers dynamically (we pass webrtc to the event listener)
  useEffect(() => {
    if (!socket || !webrtc) return;
    
    const onNewProducer = ({ producerId, socketId, userId, kind }) => {
      webrtc.consume(producerId, socketId, userId, kind);
    };

    socket.on('new_producer', onNewProducer);
    return () => socket.off('new_producer', onNewProducer);
  }, [socket, webrtc]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks()[0].enabled = isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks()[0].enabled = isVideoOff;
      setIsVideoOff(!isVideoOff);
    }
  };

  const endCall = () => {
    if (role === 'AGENT') {
      fetch(`http://localhost:3001/api/sessions/${sessionId}/end`, { method: 'POST' });
    }
    navigate('/');
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;
    socket.emit('send_message', { content: chatInput, type: 'TEXT' });
    setChatInput('');
  };

  const toggleCustomerRecording = () => {
    const newAllow = !customerCanRecord;
    setCustomerCanRecord(newAllow);
    socket.emit('toggle_customer_recording', { allow: newAllow });
  };

  const startRecording = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      
      const mediaRecorder = new MediaRecorder(displayStream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style = 'display: none';
        a.href = url;
        a.download = `atomquest-session-${sessionId}.webm`;
        a.click();
        window.URL.revokeObjectURL(url);
        setIsRecording(false);
        
        displayStream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      displayStream.getVideoTracks()[0].onended = () => {
        mediaRecorder.stop();
      };
    } catch (err) {
      console.error('Error starting screen recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-dark)' }}>
      
      {/* Video Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', position: 'relative' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px' }}>Support Session</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Joined as: {name} ({role})</p>
          </div>
          <button className="btn btn-glass" onClick={() => setShowChat(!showChat)}>
            <MessageSquare size={18} />
            {showChat ? 'Hide Chat' : 'Show Chat'}
          </button>
        </div>

        {/* Video Grid */}
        <div style={{ flex: 1, display: 'flex', gap: '20px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Local Video */}
          <div className="glass-panel" style={{ width: '400px', height: '300px', overflow: 'hidden', position: 'relative' }}>
            <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '8px', fontSize: '13px' }}>
              You
            </div>
          </div>

          {/* Remote Videos */}
          {Object.entries(remoteStreams).map(([socketId, data]) => (
            <RemoteVideo key={socketId} stream={data.stream} />
          ))}
          
          {Object.keys(remoteStreams).length === 0 && (
            <div className="glass-panel" style={{ width: '400px', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Waiting for others to join...
            </div>
          )}

        </div>

        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '20px' }}>
          <button className={`btn btn-icon ${isMuted ? 'btn-danger' : 'btn-glass'}`} onClick={toggleMute} title="Toggle Mic">
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          <button className={`btn btn-icon ${isVideoOff ? 'btn-danger' : 'btn-glass'}`} onClick={toggleVideo} title="Toggle Video">
            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>

          {(role === 'AGENT' || customerCanRecord) && (
            <button className={`btn btn-icon ${isRecording ? 'btn-danger' : 'btn-glass'}`} onClick={isRecording ? stopRecording : startRecording} title={isRecording ? 'Stop Recording' : 'Start Recording'}>
              {isRecording ? <StopCircle size={24} /> : <Monitor size={24} />}
            </button>
          )}

          {role === 'AGENT' && (
             <button className={`btn btn-icon ${customerCanRecord ? 'btn-primary' : 'btn-glass'}`} onClick={toggleCustomerRecording} title="Allow Customer Recording">
                <UserCheck size={24} />
             </button>
          )}

          <button className="btn btn-icon btn-danger" onClick={endCall} title="End Call">
            <PhoneOff size={24} />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      {showChat && (
        <div className="glass-panel animate-fade-in" style={{ width: '350px', borderRight: 'none', borderTop: 'none', borderBottom: 'none', borderRadius: '0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-glass)', fontWeight: '500' }}>
            Session Chat
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((msg, i) => {
              // Assume my messages don't have sender_name yet if just received optimistically, 
              // but we rely on server broadcast.
              const isMe = msg.sender_name === name; // A bit hacky, normally use ID
              return (
                <div key={i} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                  {!isMe && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{msg.sender_name}</div>}
                  <div style={{ 
                    background: isMe ? 'var(--primary)' : 'rgba(255,255,255,0.1)', 
                    color: isMe ? '#000' : 'var(--text-main)',
                    padding: '10px 14px', 
                    borderRadius: '16px',
                    borderBottomRightRadius: isMe ? '4px' : '16px',
                    borderBottomLeftRadius: isMe ? '16px' : '4px',
                    fontSize: '14px'
                  }}>
                    {msg.content}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} style={{ padding: '20px', borderTop: '1px solid var(--border-glass)', display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              className="input-glass" 
              placeholder="Type a message..." 
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              style={{ padding: '10px 16px' }}
            />
            <button type="submit" className="btn btn-primary btn-icon" disabled={!chatInput.trim()}>
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

    </div>
  );
}

// Helper component for remote video
function RemoteVideo({ stream }) {
  const ref = useRef(null);
  
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="glass-panel" style={{ width: '400px', height: '300px', overflow: 'hidden', position: 'relative' }}>
      <video ref={ref} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '8px', fontSize: '13px' }}>
        Remote User
      </div>
    </div>
  );
}
