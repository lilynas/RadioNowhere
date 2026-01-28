import { TimelineBlock, PlayerState } from '@shared/types/radio-core';
import { AgentStatus, ScriptEvent, LogEvent } from '@shared/services/monitor-service';
import { ShowType } from '@features/content/lib/cast-system';

// P0-3 Fix: 扩展音乐元数据
export interface MusicMeta {
    trackName?: string;
    artist?: string;
    album?: string;
}

// Extended TimelineBlock with history marker and music metadata
export type ExtendedBlock = TimelineBlock & {
    isHistory?: boolean;
    showTitle?: string;
    musicMeta?: MusicMeta;  // P0-3: 缓存的音乐元数据
};

export interface RadioPlayerState {
    isPlaying: boolean;
    isConnected: boolean;
    isInitializing: boolean;
    isMuted: boolean;
    agentStatuses: Record<string, AgentStatus>;
    currentScript: ScriptEvent | null;
    timeline: ExtendedBlock[];
    currentBlockId: string | null;
    agentLogs: LogEvent[];
    showMailbox: boolean;
    userMessage: string;
    showTimeline: boolean;
    pendingMailCount: number;
    selectedStation: ShowType | 'random';
    showStationSelector: boolean;
}

export interface RadioPlayerActions {
    togglePlayback: () => Promise<void>;
    disconnect: () => void;
    jumpToBlock: (index: number) => void;
    submitUserRequest: (content?: string) => void;
    setShowMailbox: (show: boolean) => void;
    setShowTimeline: (show: boolean) => void;
    setUserMessage: (message: string) => void;
    setIsMuted: (muted: boolean) => void;
    clearHistory: () => void;
    setSelectedStation: (station: ShowType | 'random') => void;
    setShowStationSelector: (show: boolean) => void;
}
