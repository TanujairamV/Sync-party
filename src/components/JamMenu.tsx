import React, { useState, useEffect } from 'react';
import { useJam } from '../JamContext';
import QRCode from 'qrcode';

const COLORS = [
    'linear-gradient(135deg,#1db954,#1ed760)',
    'linear-gradient(135deg,#e84444,#ff6b6b)',
    'linear-gradient(135deg,#4a90d9,#6eb5ff)',
    'linear-gradient(135deg,#f5a623,#ffc857)',
    'linear-gradient(135deg,#b24592,#f15f79)',
    'linear-gradient(135deg,#00c9ff,#92fe9d)',
];

import { I } from "../icons";

const fmtTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};
const safeInitial = (name: string) => ((name || '?').trim()[0] || '?').toUpperCase();

const JamMenu: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const j = useJam();
    const [joinInput, setJoinInput] = useState('');
    const [qrUrl, setQrUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const [showQr, setShowQr] = useState(false);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

    useEffect(() => {
        if (j.jamId) {
            QRCode.toDataURL(j.jamId, { width: 200, margin: 1, color: { dark: '#000', light: '#fff' } }).then(setQrUrl);
        }
    }, [j.jamId]);

    const copy = (text: string, msg: string) => {
        try { (Spicetify as any).Platform.ClipboardAPI.copy(text); } catch { navigator.clipboard?.writeText(text); }
        Spicetify.showNotification(msg);
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!j.isHost && !j.guestControls) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        j.seekTo(pct * j.duration);
    };

    const pct = j.duration > 0 ? (j.progress / j.duration) * 100 : 0;
    const canEdit = j.isHost || j.guestControls;

    if (!j.connected) {
        return (
            <div className="jam-root">
                <div className="jam-header">
                    <div className="jam-header-left">
                        <div className="jam-logo-icon">{I.jam}</div>
                        <div>
                            <div className="jam-title">Social Jam</div>
                            <div className="jam-subtitle">Listen together</div>
                        </div>
                    </div>
                    <button className="jam-icon-btn" onClick={onClose}>{I.close}</button>
                </div>
                <div className="jam-body">
                    {j.updateAvailable && (
                        <div className="jam-error" style={{ background: 'rgba(29,185,84,0.1)', borderColor: '#1db954', color: '#1db954', cursor: 'pointer', marginBottom: '10px' }}
                            onClick={() => window.open('https://github.com/Kyzenkms/spicetify-jam', '_blank')}>
                            <span style={{ fontSize: '14px' }}>✨ Update Available! Click to view</span>
                        </div>
                    )}
                    <div className="jam-hero">
                        <div className="jam-hero-icon">{I.jam}</div>
                        <h2 className="jam-hero-title">Host a Listening Session</h2>
                        <p className="jam-hero-desc">Sync playback and share your queue with friends in real-time.</p>
                    </div>
                    <button className="jam-btn green full" onClick={j.startJam}>Start a new Jam</button>
                    <div className="jam-divider"><div className="jam-divider-line"/><span>or join one</span><div className="jam-divider-line"/></div>
                    <input className="jam-input" placeholder="Paste Jam ID or join link…" value={joinInput}
                        onChange={e => setJoinInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && j.joinJam(joinInput)} spellCheck={false}/>
                    <button className="jam-btn outline full" style={{marginTop:8}} onClick={() => j.joinJam(joinInput)}>Join Session</button>
                    {j.error && <div className="jam-error">{I.warn} {j.error}</div>}
                </div>
            </div>
        );
    }

    return (
        <div className="jam-root">
            <div className="jam-header">
                <div className="jam-header-left">
                    <div className="jam-logo-icon active">{I.jam}</div>
                    <div>
                        <div className="jam-title">Jam</div>
                        <div className="jam-subtitle">{j.isHost ? 'Hosting' : `With ${j.hostName}`}</div>
                    </div>
                </div>
                <div className="jam-header-right">
                    {!j.isHost && (
                        <span className={`jam-ping ${j.ping < 0 ? 'measuring' : j.ping > 150 ? 'bad' : 'good'}`}>
                            {j.ping < 0 ? '…' : `${j.ping}ms`}
                        </span>
                    )}
                    <button className="jam-icon-btn" onClick={onClose}>{I.close}</button>
                </div>
            </div>

            <div className="jam-body scrollable">
                {j.updateAvailable && (
                    <div className="jam-error" style={{ background: 'rgba(29,185,84,0.1)', borderColor: '#1db954', color: '#1db954', cursor: 'pointer' }}
                        onClick={() => window.open('https://github.com/Kyzenkms/spicetify-jam', '_blank')}>
                        <span style={{ fontSize: '14px' }}>✨ Update Available! Click to view</span>
                    </div>
                )}

                <div className="jam-live-badge">
                    <span className="jam-live-dot"/>
                    <span>Session Active</span>
                    <span className="jam-badge">{j.isHost ? 'HOST' : 'GUEST'}</span>
                </div>

                {j.nowPlaying && (
                    <div className="jam-np-card">
                        <div className="jam-np-art-wrap">
                            {j.nowPlaying.artUrl
                                ? <img className="jam-np-art" src={j.nowPlaying.artUrl} alt="" onError={e => { (e.target as HTMLImageElement).style.display='none'; }}/>
                                : <div className="jam-np-art placeholder"/>}
                        </div>
                        <div className="jam-np-meta">
                            <div className="jam-np-label">NOW PLAYING</div>
                            <div className="jam-np-title">{j.nowPlaying.title}</div>
                            <div className="jam-np-artist">{j.nowPlaying.artist}</div>
                        </div>
                        <div className="jam-progress-row">
                            <span className="jam-time">{fmtTime(j.progress)}</span>
                            <div className="jam-progress-rail"
                                onClick={handleSeek}
                                style={{ cursor: canEdit ? 'pointer' : 'default' }}>
                                <div className="jam-progress-fill" style={{ width: `${pct}%` }}/>
                                <div className="jam-progress-dot" style={{ left: `${pct}%` }}/>
                            </div>
                            <span className="jam-time">{fmtTime(j.duration)}</span>
                        </div>
                        {canEdit && (
                            <div className="jam-controls">
                                <button className="jam-ctrl-btn" onClick={j.prev}>{I.prev}</button>
                                <button className="jam-ctrl-btn main" onClick={j.isPlaying ? j.pause : j.play}>
                                    {j.isPlaying ? I.pause : I.play}
                                </button>
                                <button className="jam-ctrl-btn" onClick={j.next}>{I.next}</button>
                            </div>
                        )}
                    </div>
                )}

                {j.isHost && (
                    <div className="jam-section-card">
                        <div className="jam-section-title">{I.settings} SESSION SETTINGS</div>
                        <div className="jam-setting-row">
                            <span>Guest Playback Controls</span>
                            <button className={`jam-toggle ${j.guestControls ? 'on' : ''}`} onClick={j.toggleGuestControls}>
                                <div className="jam-toggle-knob"/>
                            </button>
                        </div>
                    </div>
                )}

                {j.isHost && (
                    <div className="jam-section-card">
                        <div className="jam-section-title">INVITE</div>
                        <div className="jam-id-row">
                            <span className="jam-id-code">{j.jamId}</span>
                            <button
                                className={`jam-icon-btn ${copied ? 'green' : ''}`}
                                onClick={() => { copy(j.jamId, 'Copied!'); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                            >{copied ? I.check : I.copy}</button>
                        </div>
                        <div className="jam-share-row">
                            <button className="jam-btn outline flex-1"
                                onClick={() => copy(`${window.location.origin}${window.location.pathname}#jam=${j.jamId}`, 'Link copied!')}>
                                {I.link} Copy Link
                            </button>
                            <button className="jam-btn outline flex-1" onClick={() => setShowQr(v => !v)}>
                                {I.qr} {showQr ? 'Hide QR' : 'QR Code'}
                            </button>
                        </div>
                        {showQr && qrUrl && (
                            <div className="jam-qr-box">
                                <img src={qrUrl} alt="QR"/>
                                <div className="jam-qr-label">Scan to join</div>
                            </div>
                        )}
                    </div>
                )}

                {j.queue.length > 0 && (
                    <div className="jam-section-card">
                        <div className="jam-section-title">{I.queue} UP NEXT · {j.queue.length}</div>
                        {j.queue.map((t, i) => (
                            <div
                                key={`${t.uri}-${i}`}
                                className={`jam-q-row${dragIdx === i ? ' drag-src' : ''}${dragOverIdx === i && dragIdx !== i ? ' drag-over' : ''}`}
                                draggable={canEdit}
                                onDragStart={() => setDragIdx(i)}
                                onDragOver={e => { e.preventDefault(); setDragOverIdx(i); }}
                                onDrop={() => { if (dragIdx !== null && dragIdx !== i) j.moveInQueue(dragIdx, i); setDragIdx(null); setDragOverIdx(null); }}
                                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                            >
                                {canEdit && <div className="jam-drag-grip">{I.drag}</div>}
                                <div className="jam-q-num">{i + 1}</div>
                                <div className="jam-q-thumb">
                                    {t.artUrl
                                        ? <img src={t.artUrl} alt="" onError={e => { (e.target as HTMLImageElement).style.display='none'; }}/>
                                        : <div className="jam-q-thumb-ph"/>}
                                </div>
                                <div className="jam-q-meta">
                                    <div className="jam-q-title">{t.title}</div>
                                    <div className="jam-q-artist">{t.artist}</div>
                                </div>
                                {canEdit && (
                                    <div className="jam-q-btns">
                                        <button className="jam-q-btn green" title="Play now" onClick={() => j.jumpToTrack(t.uri!)}>{I.playItem}</button>
                                        <button className="jam-q-btn red" title="Remove" onClick={() => j.removeFromQueue(t.uri!, t.uid)}>{I.x}</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="jam-section-card">
                    <div className="jam-section-title">{I.people} LISTENERS · {j.members.length}</div>
                    {j.members.map((m, i) => (
                        <div key={m.id + i} className="jam-member-row">
                            <div className="jam-avatar" style={{ background: COLORS[i % COLORS.length] }}>
                                {m.image
                                    ? <img src={m.image} alt="" onError={e => { (e.target as HTMLImageElement).style.display='none'; }}/>
                                    : safeInitial(m.name)}
                            </div>
                            <div className="jam-member-info">
                                <div className="jam-member-name">{m.name || 'Listener'}</div>
                                <div className="jam-member-role">{m.isHost ? '● Host' : '○ Listener'}</div>
                            </div>
                            {j.isHost && !m.isHost && (
                                <button className="jam-icon-btn small red" onClick={() => j.kickMember(m.id)}>{I.kick}</button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="jam-footer">
                {!j.isHost && (
                    <button className="jam-btn outline full" style={{marginBottom:8}} onClick={j.requestSync}>
                        Sync to Host
                    </button>
                )}
                <button className="jam-btn red full" onClick={j.leaveJam}>
                    {I.leave} {j.isHost ? 'End Jam' : 'Leave Jam'}
                </button>
            </div>
        </div>
    );
};

export default JamMenu;
