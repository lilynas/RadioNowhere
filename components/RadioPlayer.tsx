"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, Radio, Disc3, MessageCircle, Send, Volume2, VolumeX, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { directorAgent } from '@/lib/agents/director_agent';
import { audioMixer } from '@/lib/audio_mixer';
import { TimelineBlock, TalkBlock, MusicBlock, ShowTimeline, PlayerState } from '@/lib/types/radio_types';

// ================== Types ==================

interface GenerationState {
    isGenerating: boolean;
    currentSegment: number;
    status: string;
}

interface MusicInfo {
    name: string;
    artist?: string;
    isPlaying: boolean;
}

// ================== Component ==================

export default function RadioPlayer() {
    // 播放状态 (音频输出)
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    // 生成状态 (AI 内容)
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationStatus, setGenerationStatus] = useState("待命");

    // 初始化状态
    const [isInitializing, setIsInitializing] = useState(false);
    const [initStep, setInitStep] = useState("");

    // UI 状态
    const [status, setStatus] = useState<string>("OFF AIR");
    const [transcript, setTranscript] = useState<string[]>([]);
    const [currentBlock, setCurrentBlock] = useState<TimelineBlock | null>(null);
    const [timeline, setTimeline] = useState<TimelineBlock[]>([]);
    const [currentBlockIndex, setCurrentBlockIndex] = useState(-1);
    const [showTimeline, setShowTimeline] = useState(false);

    // 音乐信息
    const [currentMusic, setCurrentMusic] = useState<MusicInfo | null>(null);

    // 用户投稿
    const [showMailbox, setShowMailbox] = useState(false);
    const [userMessage, setUserMessage] = useState("");
    const [pendingRequests, setPendingRequests] = useState<string[]>([]);

    const isPlayingRef = useRef(false);

    // ================== Director Event Handlers ==================

    const handleStateChange = useCallback((state: PlayerState) => {
        if (state.musicState.isPlaying) {
            setStatus("🎵 正在播放音乐");
        } else if (state.voiceState.isPlaying) {
            setStatus("🎙️ 主持人说话中");
        } else {
            setStatus("📻 节目进行中");
        }
    }, []);

    const handleBlockStart = useCallback((block: TimelineBlock, index?: number) => {
        setCurrentBlock(block);
        if (typeof index === 'number') {
            setCurrentBlockIndex(index);
        }

        let logEntry = "";
        switch (block.type) {
            case 'talk':
                const talkBlock = block as TalkBlock;
                // 显示所有台词的完整文本
                talkBlock.scripts.forEach(script => {
                    const speaker = script.speaker === 'host1' ? '阿静' : script.speaker === 'host2' ? '小北' : script.speaker;
                    setTranscript(prev => [...prev.slice(-15), `[${speaker}] ${script.text}`]);
                });
                return; // 已经处理完 transcript，不需要下面的通用逻辑
            case 'music':
                const musicBlock = block as MusicBlock;
                logEntry = `[🎵] ${musicBlock.search}`;
                setCurrentMusic({
                    name: musicBlock.search,
                    isPlaying: true
                });
                break;
            case 'music_control':
                logEntry = `[控制] ${block.action}`;
                if (block.action === 'fade_out' || block.action === 'stop') {
                    setCurrentMusic(null);
                }
                break;
        }

        if (logEntry) {
            setTranscript(prev => [...prev.slice(-10), logEntry]);
        }
    }, []);

    const handleBlockEnd = useCallback((block: TimelineBlock) => {
        // 块执行完毕
    }, []);

    const handleError = useCallback((error: Error) => {
        console.error("Director error:", error);
        setTranscript(prev => [...prev.slice(-10), `[⚠️ 错误] ${error.message?.slice(0, 30) || '未知错误'}`]);
    }, []);

    const handleTimelineReady = useCallback((newTimeline: ShowTimeline) => {
        setTimeline(newTimeline.blocks);
        setGenerationStatus(`已生成 ${newTimeline.blocks.length} 个节目块`);
    }, []);

    // ================== Control Functions ==================

    const startRadio = useCallback(async () => {
        setIsInitializing(true);
        setIsPlaying(true);
        setIsGenerating(true);
        isPlayingRef.current = true;
        setTranscript([]);
        setCurrentBlockIndex(-1);
        setTimeline([]);

        try {
            // 初始化步骤显示
            setInitStep("正在连接 AI...");
            await new Promise(r => setTimeout(r, 300));

            setInitStep("生成节目内容...");
            await new Promise(r => setTimeout(r, 200));

            setInitStep("准备语音合成...");

            await directorAgent.startShow({
                userRequest: pendingRequests.length > 0 ? pendingRequests[0] : undefined,
                onStateChange: handleStateChange,
                onBlockStart: handleBlockStart,
                onBlockEnd: handleBlockEnd,
                onError: handleError,
                onTimelineReady: handleTimelineReady
            });

            setInitStep("");
            setIsInitializing(false);
            setGenerationStatus("节目进行中");

        } catch (error) {
            console.error("Failed to start show:", error);
            setStatus("连接失败");
            setIsPlaying(false);
            setIsGenerating(false);
            setIsInitializing(false);
        }

        // 清除已处理的用户请求
        if (pendingRequests.length > 0) {
            setPendingRequests(prev => prev.slice(1));
        }
    }, [pendingRequests, handleStateChange, handleBlockStart, handleBlockEnd, handleError, handleTimelineReady]);

    const stopRadio = useCallback(() => {
        setIsPlaying(false);
        setIsGenerating(false);
        setIsPaused(false);
        isPlayingRef.current = false;
        directorAgent.stopShow();
        setStatus("OFF AIR");
        setCurrentBlock(null);
        setCurrentMusic(null);
        setGenerationStatus("待命");
        setIsInitializing(false);
    }, []);

    const togglePause = useCallback(() => {
        if (isPaused) {
            directorAgent.resumeShow();
            setIsPaused(false);
            setStatus("▶️ 继续播放");
        } else {
            directorAgent.pauseShow();
            setIsPaused(true);
            setStatus("⏸️ 已暂停");
        }
    }, [isPaused]);

    const toggleMute = useCallback(() => {
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        audioMixer.setMasterVolume(newMuted ? 0 : 0.8);
    }, [isMuted]);

    // 发送用户投稿
    const submitUserRequest = useCallback(() => {
        if (!userMessage.trim()) return;

        setPendingRequests(prev => [...prev, userMessage]);
        setTranscript(prev => [...prev.slice(-10), `[📮 来信] ${userMessage.slice(0, 30)}...`]);
        setUserMessage("");
        setShowMailbox(false);
    }, [userMessage]);

    // Cleanup
    useEffect(() => {
        return () => {
            directorAgent.stopShow();
        };
    }, []);

    // ================== Helper functions ==================

    const getBlockIcon = (type: string) => {
        switch (type) {
            case 'talk': return '🎙️';
            case 'music': return '🎵';
            case 'music_control': return '🎛️';
            case 'silence': return '⏸️';
            default: return '📦';
        }
    };

    const getBlockLabel = (block: TimelineBlock) => {
        switch (block.type) {
            case 'talk':
                return (block as TalkBlock).scripts[0]?.text.slice(0, 15) + '...' || '说话';
            case 'music':
                return (block as MusicBlock).search;
            case 'music_control':
                return block.action;
            default:
                return block.type;
        }
    };

    // ================== Render ==================

    return (
        <div className="w-full max-w-md mx-auto bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl relative">
            {/* Screen / Visualizer Area */}
            <div className="h-56 bg-black relative flex items-center justify-center overflow-hidden">
                {/* Background */}
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-30 filter blur-sm"
                    style={{
                        backgroundImage: `url('https://images.unsplash.com/photo-1478737270239-2f63b86236b9?q=80&w=2070&auto=format&fit=crop')`
                    }}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent" />

                <AnimatePresence mode='wait'>
                    {isInitializing ? (
                        // 初始化加载状态
                        <motion.div
                            key="init"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="z-10 text-center space-y-4"
                        >
                            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mx-auto" />
                            <div className="text-emerald-400 text-sm">{initStep}</div>
                            <div className="text-neutral-500 text-xs">首次加载可能需要较长时间</div>
                        </motion.div>
                    ) : isPlaying ? (
                        <motion.div
                            key="playing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="z-10 text-center space-y-3 px-4"
                        >
                            {/* Live indicator */}
                            <motion.div
                                className="text-2xl font-bold tracking-tighter text-emerald-500"
                                animate={{ opacity: [1, 0.5, 1] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                            >
                                深夜电波
                            </motion.div>

                            {/* Current music info */}
                            {currentMusic && (
                                <motion.div
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="flex items-center justify-center gap-2 text-neutral-200"
                                >
                                    <Disc3 className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
                                    <span className="text-sm">{currentMusic.name}</span>
                                </motion.div>
                            )}

                            {/* Current block info */}
                            {currentBlock && !currentMusic && (
                                <div className="text-neutral-400 text-xs">
                                    {currentBlock.type === 'talk' && '🎙️ 主持人正在说话...'}
                                </div>
                            )}

                            {/* Visualizer bars */}
                            <div className="flex items-center justify-center gap-1 h-6">
                                {[1, 2, 3, 4, 5, 6, 7].map(i => (
                                    <motion.div
                                        key={i}
                                        className="w-1 bg-emerald-500/50 rounded-full"
                                        animate={{ height: [6, 18, 6] }}
                                        transition={{
                                            repeat: Infinity,
                                            duration: 0.4 + Math.random() * 0.4,
                                            delay: i * 0.1
                                        }}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="offline"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="z-10 text-center"
                        >
                            <div className="text-neutral-600 font-mono text-sm mb-2">OFFLINE</div>
                            <div className="text-2xl font-bold text-neutral-400">深夜电波</div>
                            <div className="text-neutral-600 text-xs mt-1">点击下方按钮开始收听</div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Status Bar */}
            <div className="bg-neutral-950 px-4 py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-700'}`} />
                    <span className="text-neutral-400">{generationStatus}</span>
                </div>
                {pendingRequests.length > 0 && (
                    <div className="text-amber-500">📮 {pendingRequests.length} 封待处理</div>
                )}
            </div>

            {/* Info Panel */}
            <div className="p-4 space-y-3 bg-neutral-900">
                {/* Timeline Preview Toggle */}
                <button
                    onClick={() => setShowTimeline(!showTimeline)}
                    className="w-full flex items-center justify-between text-xs text-neutral-400 hover:text-neutral-300 transition-colors"
                >
                    <span>📋 节目时间线 ({timeline.length} 块)</span>
                    {showTimeline ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {/* Timeline Preview */}
                <AnimatePresence>
                    {showTimeline && timeline.length > 0 && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
                                {timeline.map((block, i) => (
                                    <div
                                        key={block.id}
                                        className={`shrink-0 px-2 py-1 rounded-lg text-xs ${i === currentBlockIndex
                                            ? 'bg-emerald-600 text-white'
                                            : i < currentBlockIndex
                                                ? 'bg-neutral-800 text-neutral-500'
                                                : 'bg-neutral-800 text-neutral-400'
                                            }`}
                                    >
                                        {getBlockIcon(block.type)} {getBlockLabel(block).slice(0, 8)}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Transcript */}
                <div className="space-y-1 h-24 overflow-y-auto font-mono text-xs text-neutral-500 scrollbar-hide border-t border-neutral-800 pt-2">
                    {transcript.length === 0 ? (
                        <div className="text-neutral-700 text-center py-4">
                            收听节目，动态将显示在这里...
                        </div>
                    ) : (
                        transcript.map((line, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="border-l-2 border-neutral-800 pl-2 py-0.5"
                            >
                                {line}
                            </motion.div>
                        ))
                    )}
                </div>

                {/* Controls */}
                <div className="pt-3 border-t border-neutral-800">
                    <div className="flex items-center gap-2">
                        {/* Main play/stop button */}
                        <button
                            onClick={isPlaying ? stopRadio : startRadio}
                            className={`flex-1 font-bold py-2.5 px-4 rounded-full flex items-center justify-center gap-2 transition-colors ${isPlaying
                                    ? 'bg-red-600 hover:bg-red-500 text-white'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                }`}
                        >
                            {isPlaying ? <Square size={16} /> : <Play size={16} />}
                            {isPlaying ? "停止" : "收听"}
                        </button>

                        {/* Pause/Resume button */}
                        <button
                            onClick={togglePause}
                            disabled={!isPlaying}
                            className={`p-2.5 rounded-full transition-colors ${isPaused
                                    ? 'bg-amber-500 text-white animate-pulse'
                                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {isPaused ? <Play size={16} /> : <Pause size={16} />}
                        </button>

                        {/* Mute button */}
                        <button
                            onClick={toggleMute}
                            disabled={!isPlaying}
                            className={`p-2.5 rounded-full transition-colors ${isMuted
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>

                        {/* Mailbox button */}
                        <button
                            onClick={() => setShowMailbox(!showMailbox)}
                            className={`p-2.5 rounded-full transition-colors ${showMailbox || pendingRequests.length > 0
                                ? 'bg-amber-600 text-white'
                                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                                }`}
                        >
                            <MessageCircle size={16} />
                        </button>
                    </div>
                </div>

                {/* Mailbox Input */}
                <AnimatePresence>
                    {showMailbox && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="pt-3 space-y-2">
                                <div className="text-xs text-neutral-400">📮 听众来信 (投稿将在合适时机播出)</div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={userMessage}
                                        onChange={(e) => setUserMessage(e.target.value)}
                                        placeholder="想让主持人聊什么话题？"
                                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                                        onKeyDown={(e) => e.key === 'Enter' && submitUserRequest()}
                                    />
                                    <button
                                        onClick={submitUserRequest}
                                        disabled={!userMessage.trim()}
                                        className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 disabled:cursor-not-allowed rounded-xl transition-colors"
                                    >
                                        <Send size={14} className="text-white" />
                                    </button>
                                </div>
                                {pendingRequests.length > 0 && (
                                    <div className="text-xs text-amber-500/80 space-y-1">
                                        {pendingRequests.map((req, i) => (
                                            <div key={i}>⏳ {req.slice(0, 25)}...</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
