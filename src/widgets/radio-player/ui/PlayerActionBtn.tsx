"use client";

import React from 'react';

interface PlayerActionBtnProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
}

export default function PlayerActionBtn({
    icon,
    label,
    onClick,
    active = false,
    disabled = false
}: PlayerActionBtnProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex flex-col items-center gap-1 group transition-all ${disabled ? 'opacity-30 cursor-not-allowed' : ''
                } ${active ? 'text-emerald-500' : 'text-neutral-600 hover:text-neutral-400'}`}
        >
            <div className={`p-2 rounded-xl transition-all ${active ? 'bg-emerald-500/10' : 'group-hover:bg-white/5'
                }`}>
                {icon}
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest">{label}</span>
        </button>
    );
}

// Additional News Button Component
export function NewsActionBtn({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="absolute top-4 right-4 z-40 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded-full px-3 py-1 flex items-center gap-2 transition-all backdrop-blur-md group"
        >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider group-hover:tracking-widest transition-all">Live News</span>
        </button>
    );
}
