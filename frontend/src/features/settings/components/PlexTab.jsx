import React, { useState, useEffect } from 'react';
import { Wifi, ShieldAlert, Check, Copy } from 'lucide-react';
import api from '../../../api';

const PlexTab = ({ user, setUser, setIsError, setMessage }) => {
  const [plexUser, setPlexUser] = useState(user?.plexUser || '');
  const [copied, setCopied] = useState(false);
  const [globalCopied, setGlobalCopied] = useState(false);

  useEffect(() => {
    if (user) {
      setPlexUser(user.plexUser || '');
    }
  }, [user]);

  const handleCopyWebhookUrl = () => {
    const url = `${window.location.protocol}//${window.location.host}/api/webhook/plex/${user.plexWebhookToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyGlobalWebhookUrl = () => {
    const url = `${window.location.protocol}//${window.location.host}/api/webhook/plex/global/${user.plexGlobalWebhookToken}`;
    navigator.clipboard.writeText(url);
    setGlobalCopied(true);
    setTimeout(() => setGlobalCopied(false), 2000);
  };

  const handlePlexSave = async (e) => {
    e.preventDefault();
    setIsError(false);
    setMessage('');
    try {
      const res = await api.put('/settings/profile', { plexUser });
      if (res.data.success) {
        setUser(res.data.user);
        setMessage('Plex connection details saved successfully!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setIsError(true);
      setMessage(err.response?.data?.error || 'Failed to save Plex details.');
    }
  };

  return (
    <div className="glass-panel">
      <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Wifi size={20} style={{ color: 'var(--accent)' }} />
        <span>Plex Scrobble & Webhook</span>
      </h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
        Link your TVTracker account to a Plex Media Server to record play/pause events and track watch histories in real-time.
      </p>

      {user?.role === 'admin' && (
        <div style={{ marginBottom: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '32px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '600', marginBottom: '16px', color: 'var(--text-main)' }}>
            Global Plex Webhook (Admin managed)
          </h3>
          
          {/* Plex Global connection status notification */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '16px 20px',
              borderRadius: '12px',
              border: user?.plexGlobalLastWebhookAt 
                ? '1px solid rgba(16, 185, 129, 0.25)' 
                : '1px solid rgba(245, 158, 11, 0.25)',
              background: user?.plexGlobalLastWebhookAt 
                ? 'rgba(16, 185, 129, 0.08)' 
                : 'rgba(245, 158, 11, 0.08)',
              marginBottom: '20px'
            }}
          >
            {/* Status Dot with pulse effect */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div 
                style={{ 
                  width: '10px', 
                  height: '10px', 
                  borderRadius: '50%', 
                  background: user?.plexGlobalLastWebhookAt ? 'var(--success)' : '#fbbf24' 
                }} 
              />
              <div 
                style={{ 
                  position: 'absolute',
                  width: '18px', 
                  height: '18px', 
                  borderRadius: '50%', 
                  background: user?.plexGlobalLastWebhookAt ? 'var(--success)' : '#fbbf24',
                  opacity: 0.35,
                  animation: 'pulse-border 2s infinite ease-in-out'
                }} 
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
              <div style={{ fontWeight: '600', fontSize: '0.9rem', color: user?.plexGlobalLastWebhookAt ? 'var(--success)' : '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Global Plex Webhook {user?.plexGlobalLastWebhookAt ? 'Active' : 'Inactive / Pending'}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                {user?.plexGlobalLastWebhookAt ? (
                  <>
                    Last successful global webhook event received on: <span style={{ color: 'var(--text-main)', fontWeight: '500' }}>{new Date(user.plexGlobalLastWebhookAt).toLocaleString()}</span>
                  </>
                ) : (
                  'No global webhook events received yet. TVTracker is waiting to receive its first scrobble playback status from your Plex server.'
                )}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px 20px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={16} style={{ color: '#fbbf24' }} />
              Global Webhook URL
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '12px' }}>
              Add this global webhook URL in your Plex server settings (Settings &gt; Webhooks &gt; Add Webhook). This global webhook handles events for <strong>all users</strong> on the system based on their linked Plex username.
            </p>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px' }}>
              <span style={{ flexGrow: 1, fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-main)', wordBreak: 'break-all' }}>
                {`${window.location.protocol}//${window.location.host}/api/webhook/plex/global/${user?.plexGlobalWebhookToken}`}
              </span>
              <button 
                onClick={handleCopyGlobalWebhookUrl}
                className="btn" 
                style={{ padding: '6px', background: 'var(--overlay-medium)', color: 'var(--text-main)', borderRadius: '6px' }}
                title="Copy global webhook URL"
              >
                {globalCopied ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
              </button>
            </div>
            {globalCopied && (
              <small style={{ color: 'var(--success)', marginTop: '4px', display: 'block' }}>
                Global Webhook URL copied to clipboard!
              </small>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--text-main)' }}>
          {user?.role === 'admin' ? 'Private Plex Webhook' : 'Plex Webhook Connection'}
        </h3>
        
        {/* Plex connection status notification */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px 20px',
            borderRadius: '12px',
            border: user?.plexLastWebhookAt 
              ? '1px solid rgba(16, 185, 129, 0.25)' 
              : '1px solid rgba(245, 158, 11, 0.25)',
            background: user?.plexLastWebhookAt 
              ? 'rgba(16, 185, 129, 0.08)' 
              : 'rgba(245, 158, 11, 0.08)',
          }}
        >
          {/* Status Dot with pulse effect */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div 
              style={{ 
                width: '10px', 
                height: '10px', 
                borderRadius: '50%', 
                background: user?.plexLastWebhookAt ? 'var(--success)' : '#fbbf24' 
              }} 
            />
            <div 
              style={{ 
                position: 'absolute',
                width: '18px', 
                height: '18px', 
                borderRadius: '50%', 
                background: user?.plexLastWebhookAt ? 'var(--success)' : '#fbbf24',
                opacity: 0.35,
                animation: 'pulse-border 2s infinite ease-in-out'
              }} 
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: user?.plexLastWebhookAt ? 'var(--success)' : '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Private Webhook Connection {user?.plexLastWebhookAt ? 'Active' : 'Inactive / Pending'}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              {user?.plexLastWebhookAt ? (
                <>
                  Last successful private webhook event received on: <span style={{ color: 'var(--text-main)', fontWeight: '500' }}>{new Date(user.plexLastWebhookAt).toLocaleString()}</span>
                </>
              ) : (
                'No private webhook events received yet. TVTracker is waiting to receive its first scrobble playback status from your Plex server.'
              )}
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px 20px' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldAlert size={16} style={{ color: '#fbbf24' }} />
            Your Private Webhook URL
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '12px' }}>
            Add this private webhook URL in your Plex server settings to route playing status exclusively to your profile.
          </p>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px' }}>
            <span style={{ flexGrow: 1, fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-main)', wordBreak: 'break-all' }}>
              {`${window.location.protocol}//${window.location.host}/api/webhook/plex/${user?.plexWebhookToken}`}
            </span>
            <button 
              onClick={handleCopyWebhookUrl}
              className="btn" 
              style={{ padding: '6px', background: 'var(--overlay-medium)', color: 'var(--text-main)', borderRadius: '6px' }}
              title="Copy private webhook URL"
            >
              {copied ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
            </button>
          </div>
          {copied && (
            <small style={{ color: 'var(--success)', marginTop: '4px', display: 'block' }}>
              Private Webhook URL copied to clipboard!
            </small>
          )}
        </div>

        <form onSubmit={handlePlexSave}>
          <div className="input-group">
            <label>Plex Username Filter</label>
            <input
              type="text"
              className="input-field"
              value={plexUser}
              onChange={e => setPlexUser(e.target.value)}
              placeholder="e.g. MyPlexAccountName"
            />
            <small style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
              Webhook requests will only update your collection if they are triggered from this Plex account username.
            </small>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
            Save Plex Connection
          </button>
        </form>
      </div>
    </div>
  );
};

export default PlexTab;
