/**
 * Radio Monitor - 广播监控中心
 * 负责收集来自各个 Agent 的状态，并分发给订阅的 UI 界面
 */

import { ShowTimeline } from './types/radio_types';

export type AgentType = 'DIRECTOR' | 'WRITER' | 'TTS' | 'MIXER';

export interface AgentStatus {
    agent: AgentType;
    status: 'IDLE' | 'BUSY' | 'ERROR' | 'READY';
    message?: string;
}

export interface ScriptEvent {
    speaker: string;
    text: string;
    blockId: string;
}

export interface LogEvent {
    agent: AgentType;
    level: 'info' | 'warn' | 'error' | 'trace';
    message: string;
    details?: Record<string, unknown>;
    timestamp: number;
}

// Event type mapping for type safety
type MonitorEventMap = {
    status: AgentStatus;
    script: ScriptEvent;
    timeline: ShowTimeline;
    log: LogEvent;
};

type MonitorEventType = keyof MonitorEventMap;
type MonitorCallback<T extends MonitorEventType> = (data: MonitorEventMap[T]) => void;

class RadioMonitor {
    private listeners: Map<string, Set<MonitorCallback<MonitorEventType>>> = new Map();

    /**
     * 订阅事件
     */
    on<T extends MonitorEventType>(event: T, callback: MonitorCallback<T>): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)?.add(callback as MonitorCallback<MonitorEventType>);
        return () => this.off(event, callback);
    }

    /**
     * 取消订阅
     */
    off<T extends MonitorEventType>(event: T, callback: MonitorCallback<T>): void {
        this.listeners.get(event)?.delete(callback as MonitorCallback<MonitorEventType>);
    }

    /**
     * 更新 Agent 状态
     */
    updateStatus(agent: AgentType, status: AgentStatus['status'], message?: string): void {
        const data: AgentStatus = { agent, status, message };
        this.emit('status', data);
    }

    /**
     * 发出台词事件
     */
    emitScript(speaker: string, text: string, blockId: string): void {
        const data: ScriptEvent = { speaker, text, blockId };
        this.emit('script', data);
    }

    /**
     * 发出时间线更新事件
     */
    emitTimeline(timeline: ShowTimeline): void {
        this.emit('timeline', timeline);
    }

    /**
     * 发出系统日志
     */
    log(agent: AgentType, message: string, level: LogEvent['level'] = 'info', details?: Record<string, unknown>): void {
        const data: LogEvent = {
            agent,
            message,
            level,
            details,
            timestamp: Date.now()
        };
        this.emit('log', data);
    }

    private emit<T extends MonitorEventType>(event: T, data: MonitorEventMap[T]): void {
        this.listeners.get(event)?.forEach(callback => callback(data));
    }
}

export const radioMonitor = new RadioMonitor();

