import { useState, useEffect } from 'react';
import { Activity, Users, Clock } from 'lucide-react';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState({ activeSessions: 0, totalSessions: 0, sessions: [] });

  useEffect(() => {
    fetch('http://localhost:3001/api/admin/metrics')
      .then(res => res.json())
      .then(data => setMetrics(data));
  }, []);

  const endSession = async (id) => {
    await fetch(`http://localhost:3001/api/sessions/${id}/end`, { method: 'POST' });
    setMetrics(prev => ({
      ...prev,
      activeSessions: prev.activeSessions - 1,
      sessions: prev.sessions.map(s => s.id === id ? { ...s, status: 'ENDED' } : s)
    }));
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '32px', fontWeight: '600' }}>Operations Dashboard</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--primary)', borderRadius: '16px' }}>
            <Activity size={32} />
          </div>
          <div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Active Sessions</div>
            <div style={{ fontSize: '32px', fontWeight: '700' }}>{metrics.activeSessions}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '16px' }}>
            <Users size={32} />
          </div>
          <div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Total Sessions</div>
            <div style={{ fontSize: '32px', fontWeight: '700' }}>{metrics.totalSessions}</div>
          </div>
        </div>

      </div>

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-glass)', fontWeight: '600' }}>
          Recent Sessions
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
              <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: '500' }}>Session ID</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: '500' }}>Status</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: '500' }}>Created At</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: '500' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {metrics.sessions.map(session => (
              <tr key={session.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <td style={{ padding: '16px 20px', fontFamily: 'monospace' }}>{session.id.split('-')[0]}...</td>
                <td style={{ padding: '16px 20px' }}>
                  <span style={{ 
                    padding: '4px 10px', 
                    borderRadius: '20px', 
                    fontSize: '12px',
                    fontWeight: '600',
                    background: session.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                    color: session.status === 'ACTIVE' ? 'var(--success)' : 'var(--text-muted)'
                  }}>
                    {session.status}
                  </span>
                </td>
                <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} />
                    {new Date(session.created_at).toLocaleString()}
                  </div>
                </td>
                <td style={{ padding: '16px 20px' }}>
                  {session.status === 'ACTIVE' && (
                    <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => endSession(session.id)}>
                      End
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {metrics.sessions.length === 0 && (
              <tr>
                <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No sessions found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
