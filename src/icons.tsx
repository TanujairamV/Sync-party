import React from "react";
import {
    X,
    Users,
    Copy,
    Check,
    QrCode,
    LogOut,
    Music2,
    TriangleAlert,
    UserX,
    ListMusic,
    SkipBack,
    SkipForward,
    Play,
    Pause,
    Settings,
    Link,
    GripVertical
} from "lucide-react";

export const I = {
    close: <X size={18} />,
    people: <Users size={15} />,
    copy: <Copy size={14} />,
    check: <Check size={14} />,
    qr: <QrCode size={14} />,
    leave: <LogOut size={14} />,
    jam: <Music2 size={20} />,
    warn: <TriangleAlert size={14} />,
    kick: <UserX size={14} />,
    queue: <ListMusic size={15} />,
    prev: <SkipBack size={20} />,
    next: <SkipForward size={20} />,
    play: <Play size={28} fill="currentColor" />,
    pause: <Pause size={28} fill="currentColor" />,
    settings: <Settings size={14} />,
    x: <X size={12} />,
    link: <Link size={14} />,
    playItem: <Play size={12} fill="currentColor" />,
    drag: <GripVertical size={14} style={{ opacity: 0.25 }} />
};