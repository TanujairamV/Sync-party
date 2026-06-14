import React, { useState } from 'react';
import { useJam } from '../JamContext';
import RoomCodeInput from './CodeInput';
import { fmtTime, safeInitial } from './ui';

const AVATAR_COLORS = [
    'linear-gradient(135deg,#1db954,#1ed760)',
    'linear-gradient(135deg,#e84444,#ff6b6b)',
    'linear-gradient(135deg,#4a90d9,#6eb5ff)',
    'linear-gradient(135deg,#f5a623,#ffc857)',
    'linear-gradient(135deg,#b24592,#f15f79)',
    'linear-gradient(135deg,#00c9ff,#92fe9d)',
];

import { I } from "../icons";

const JamMenu: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const j = useJam();
    const [roomCode, setRoomCode] = useState('');
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

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
    const renderDisconnected = () => (
            <div className="jam-root">
                <div className="jam-header">
                    <div className="jam-header-left">
                        <div className="jam-logo-icon">{I.jam}</div>
                        <div>
                            <div className="jam-title">Sync Party</div>
                            <div className="jam-subtitle">Listen together</div>
                        </div>
                    </div>
                    <button className="jam-icon-btn" onClick={onClose}>{I.close}</button>
                </div>
                <div className="jam-body">
                    <div className="jam-hero">
                        <div className="jam-hero-icon">{I.jam}</div>
                        <h2 className="jam-hero-title">Start a new Jam</h2>
                        <p className="jam-hero-desc">Sync playback and share your queue with friends in real-time.</p>
                    </div>
                    <button className="jam-btn green full" onClick={j.startJam}>Start a new Jam</button>
                    <div className="jam-divider"><div className="jam-divider-line"/><span>Enter Room Code</span><div className="jam-divider-line"/></div>
                    <RoomCodeInput
                        value={roomCode}
                        onChange={setRoomCode}
                        autoFocus
                        disabled={false}
                    />
                    <button
                        className="jam-btn outline full jam-join-btn"
                        onClick={() => j.joinJam(roomCode)}
                        disabled={!/^[A-Z0-9]{6}$/.test(roomCode)}
                    >
                        Join Session
                    </button>
                    {j.error && <div className="jam-error">{I.warn} {j.error}</div>}
                </div>
            </div>
    )

    const renderNowPlaying = () => j.nowPlaying ? (
        <div className="jam-np-card">
            <div className="jam-np-art-wrap">
                {j.nowPlaying.artUrl
                    ? <img className="jam-np-art" src={j.nowPlaying.artUrl} alt="" onError={e => { (e.target as HTMLImageElement).hidden = true; }}/>
                    : <div className="jam-np-art placeholder"/>}
            </div>
            <div className="jam-np-meta">
                <div className="jam-np-label">NOW PLAYING</div>
                <div className="jam-np-title">{j.nowPlaying.title}</div>
                <div className="jam-np-artist">{j.nowPlaying.artist}</div>
            </div>
            <div className="jam-progress-row">
                <span className="jam-time">{fmtTime(j.progress)}</span>
                <div className={`jam-progress-rail ${canEdit ? 'clickable' : 'readonly'}`}
                    onClick={handleSeek}>
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
    ) : null

    const renderSessionSettings = () => (
        <div className="jam-section-card">
            <div className="jam-section-title">{I.settings} SESSION SETTINGS</div>
            <div className="jam-setting-row">
                <span>Guest Playback Controls</span>
                <button 
                className={`jam-toggle ${j.guestControls ? 'on' : ''}`}
                onClick={j.toggleGuestControls}
                aria-label="Toggle guest playback controls"
                aria-pressed={j.guestControls}
                >
                    <div className="jam-toggle-knob"/>
                </button>
            </div>
        </div>
    )

    const renderRoomCode = () => (
        <div className="jam-section-card">
            <div className="jam-section-title">Room Code</div>
            <div className="jam-id-row">
                <span className="jam-id-code">{j.jamId}</span>
            </div>
            <div className="jam-share-row">
                <button className="jam-btn outline flex-1"
                    onClick={() => copy(j.jamId, 'Copied invite code!')}>
                    {I.copy} Copy Code
                </button>
            </div>
        </div>
    )

    const renderQueue = () => j.queue.length > 0 ? (
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
                            ? <img src={t.artUrl} alt="" onError={e => { (e.target as HTMLImageElement).hidden = true; }}/>
                            : <div className="jam-q-thumb-ph"/>}
                    </div>
                    <div className="jam-q-meta">
                        <div className="jam-q-title">{t.title}</div>
                        <div className="jam-q-artist">{t.artist}</div>
                    </div>
                    {canEdit && (
                        <div className="jam-q-btns">
                            <button className="jam-q-btn green" title="Play now" onClick={() => j.jumpToTrack(t.uri!)}>{I.playItem}</button>
                            <button className="jam-q-btn red" title="Remove" onClick={() => j.removeFromQueue(t.uri!, t.uid)}>{I.close}</button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    ) : null

    const renderMembers = () => (
        <div className="jam-section-card">
            <div className="jam-section-title">{I.people} LISTENERS · {j.members.length}</div>
            {j.members.map((m, i) => (
                <div key={m.id + i} className="jam-member-row">
                    <div className="jam-avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                        {m.image
                            ? <img src={m.image} alt="" onError={e => { (e.target as HTMLImageElement).hidden = true; }}/>
                            : safeInitial(m.name)}
                    </div>
                    <div className="jam-member-info">
                        <div className="jam-member-name">{m.name || 'Listener'}</div>
                        <div className="jam-member-role">{m.isHost ? '● Host' : '○ Listener'}</div>
                    </div>
                    {j.isHost && !m.isHost && (
                        <button 
                          className="jam-icon-btn small red"
                          onClick={() => j.kickMember(m.id)}>{I.kick}
                          aria-label={`Kick ${m.name}`}
                          </button>
                    )}
                </div>
            ))}
        </div>
    )

    const renderFooter = () => (
        <div className="jam-footer">
            {!j.isHost && (
                <button className="jam-btn outline full" onClick={j.requestSync}>
                    Sync to Host
                </button>
            )}
            <button className="jam-btn red full" onClick={j.leaveJam}>
                {I.leave} {j.isHost ? 'End Jam' : 'Leave Jam'}
            </button>
        </div>
    )

    if (!j.connected) return renderDisconnected()

    return (      
            <div className="jam-root">
                <div className="jam-header">
                    <div className="jam-header-left">
                        <div className="jam-logo-icon active">{I.jam}</div>
                        <div>
                            <div className="jam-title">Sync Party</div>
                            <div className="jam-subtitle">
                                {j.isHost
                                    ? 'Hosting'
                                    : j.hostName
                                        ? `With ${j.hostName}`
                                        : 'Connected'}
                                    </div>
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
                    <div className="jam-live-badge">
                        <span className="jam-live-dot"/>
                        <span>Session Active</span>
                        <span className="jam-badge">{j.isHost ? 'HOST' : 'GUEST'}</span>
                    </div>

                    {renderNowPlaying()}
                    {j.isHost && renderSessionSettings()}
                    {j.isHost && renderRoomCode()}
                    {renderQueue()}
                    {renderMembers()}
                </div>

                {renderFooter()}
            </div>
    );
};

export default JamMenu;