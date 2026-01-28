"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic2, Music, Radio, Sparkles } from 'lucide-react';
import { ScriptEvent } from '@shared/services/monitor-service';

interface SubtitleDisplayProps {
    currentLine: ScriptEvent | null;
    isExpanded: boolean;
    onExpandChange: (expanded: boolean) => void;
}

interface DisplayInfo {
    type: 'talk' | 'music' | 'system' | 'idle';
    speaker: string;
    displayName: string;
    subtitle?: string;
    // P1-1 Fix: 多人讲话支持
    multiSpeakerLines?: Array<{ speaker: string; displayName: string; text: string }>;
    isBatched?: boolean;
}

const SubtitleDisplay = React.memo(({ currentLine, isExpanded, onExpandChange }: SubtitleDisplayProps) => {
    const [displayInfo, setDisplayInfo] = useState<DisplayInfo>({
        type: 'idle',
        speaker: 'system',
        displayName: 'Radio Nowhere',
        subtitle: ''
    });

    // P0-1 Fix: 当 block 类型从 talk 切换到其他类型时，自动收起展开状态
    useEffect(() => {
        if (displayInfo.type !== 'talk' && isExpanded) {
            onExpandChange(false);
        }
    }, [displayInfo.type, isExpanded, onExpandChange]);

    useEffect(() => {
        if (!currentLine) {
            setDisplayInfo({
                type: 'idle',
                speaker: 'system',
                displayName: 'Radio Nowhere',
                subtitle: ''
            });
            return;
        }

        const speaker = currentLine.speaker;
        const text = currentLine.text;

        // Determine display info based on speaker
        const lowerText = text.toLowerCase();
        if (speaker === 'music' || speaker === 'dj' || lowerText.includes('music')) {
            // Music playing - 优先使用事件中的元数据
            if (currentLine.musicMeta) {
                const { trackName, artist, album, coverUrl } = currentLine.musicMeta;
                setDisplayInfo({
                    type: 'music',
                    speaker: speaker,
                    displayName: trackName,
                    subtitle: `${artist} · ${album}`
                });
                // 直接使用事件中的封面 URL
                if (coverUrl) {
                    setCoverUrl(coverUrl);
                    lastFetchedTrack.current = trackName;
                }
                return;
            }

            // 降级到原有逻辑
            const rawName = text.replace('Playing: ', '');
            // If the name is just "music" (common system message), show "Now Playing" instead
            const displayName = rawName.toLowerCase() === 'music' ? 'Now Playing' : rawName || 'Now Playing';

            setDisplayInfo({
                type: 'music',
                speaker: speaker,
                displayName: displayName,
                subtitle: '🎵 Music'
            });
        } else if (speaker === 'system' || speaker === 'announcer') {
            // System message
            setDisplayInfo({
                type: 'system',
                speaker: speaker,
                displayName: text.slice(0, 30) || 'System',
                subtitle: '📡 System'
            });
        } else {
            // Host talking
            const hostNames: Record<string, string> = {
                'host1': '阿静',
                'host2': '小北',
                'LUNA': 'LUNA',
                'luna': 'LUNA',
                'ARIA': 'Aria',
                'aria': 'Aria',
            };
            
            // P1-1 Fix: 支持多人讲话（批量 TTS 模式）
            if (currentLine.isBatched && currentLine.multiSpeaker && currentLine.multiSpeaker.length > 1) {
                // 多人对话模式
                const multiLines = currentLine.multiSpeaker.map(line => ({
                    speaker: line.speaker,
                    displayName: hostNames[line.speaker] || line.speaker,
                    text: line.text
                }));
                
                // 显示所有参与对话的主持人名称
                const speakerNames = [...new Set(multiLines.map(l => l.displayName))];
                const displayName = speakerNames.join(' & ');
                
                // 合并所有台词作为字幕
                const combinedSubtitle = multiLines
                    .map(l => `【${l.displayName}】${l.text}`)
                    .join('\n\n');
                
                setDisplayInfo({
                    type: 'talk',
                    speaker: speaker,
                    displayName: displayName,
                    subtitle: combinedSubtitle,
                    multiSpeakerLines: multiLines,
                    isBatched: true
                });
            } else {
                // 单人对话模式（原有逻辑）
                const displayName = hostNames[speaker] || speaker;

                setDisplayInfo({
                    type: 'talk',
                    speaker: speaker,
                    displayName: displayName,
                    subtitle: text
                });
            }
        }
    }, [currentLine]);

    const getIcon = () => {
        switch (displayInfo.type) {
            case 'music': return <Music size={24} />;
            case 'talk': return <Mic2 size={24} />;
            case 'system': return <Radio size={24} />;
            default: return <Sparkles size={24} />;
        }
    };

    const getGradient = () => {
        switch (displayInfo.type) {
            case 'music': return 'from-pink-500 to-orange-400';
            case 'talk': return 'from-violet-500 to-pink-500';
            case 'system': return 'from-blue-500 to-cyan-400';
            default: return 'from-neutral-600 to-neutral-500';
        }
    };

    // 模拟声波数据
    const bars = Array.from({ length: 20 });

    // State for dynamic cover art
    const [coverUrl, setCoverUrl] = useState("/default_cover.png");
    const lastFetchedTrack = useRef<string>("");

    // Fetch cover art when music track changes
    useEffect(() => {
        if (displayInfo.type === 'music' && displayInfo.displayName && displayInfo.displayName !== 'Now Playing' && displayInfo.displayName !== 'Radio Nowhere') {
            const trackName = displayInfo.displayName;

            // Avoid refetching same track
            if (lastFetchedTrack.current === trackName) return;
            lastFetchedTrack.current = trackName;

            const fetchCover = async () => {
                try {
                    // 1. Search for the track to get IDs (pic_id, lyric_id)
                    const searchRes = await fetch(`https://music-api.gdstudio.xyz/api.php?types=search&source=netease&name=${encodeURIComponent(trackName)}&count=1&pages=1`);
                    const searchData = await searchRes.json();

                    if (searchData && searchData.length > 0) {
                        const trackInfo = searchData[0];
                        
                        // Set Cover
                        const picId = trackInfo.pic_id;
                        if (picId) {
                            const artUrl = `https://music-api.gdstudio.xyz/api.php?types=pic&source=netease&id=${picId}&size=500`;
                            setCoverUrl(artUrl);
                        } else {
                            setCoverUrl("/default_cover.png");
                        }
                        
                        // Fetch Lyrics if lyric_id exists
                        const lyricId = trackInfo.lyric_id;
                        if (lyricId) {
                            const lyricRes = await fetch(`https://music-api.gdstudio.xyz/api.php?types=lyric&source=netease&id=${lyricId}`);
                            const lyricData = await lyricRes.json();
                            if (lyricData.lyric) {
                                setLyricsText(lyricData.lyric);
                            }
                        }
                    } else {
                        setCoverUrl("/default_cover.png");
                        setLyricsText("");
                    }
                } catch (err) {
                    console.error("Failed to fetch cover art/lyrics:", err);
                    setCoverUrl("/default_cover.png");
                    setLyricsText("");
                }
            };

            fetchCover();
        } else if (displayInfo.type !== 'music') {
            // Reset to default for non-music
            setCoverUrl("/default_cover.png");
            setLyricsText("");
            lastFetchedTrack.current = "";
        }
    }, [displayInfo.type, displayInfo.displayName]);

    // Lyrics state
    const [showLyricsOverlay, setShowLyricsOverlay] = useState(false);
    const [lyricsText, setLyricsText] = useState("");

    // Bug2 Fix: 当切换到非 music 模式时，立即关闭歌词弹窗
    useEffect(() => {
        if (displayInfo.type !== 'music' && showLyricsOverlay) {
            setShowLyricsOverlay(false);
        }
    }, [displayInfo.type, showLyricsOverlay]);

    // Parse lyrics to simple text array
    const parsedLyrics = React.useMemo(() => {
        if (!lyricsText) return [];
        return lyricsText
            .split('\n')
            .map(line => line.replace(/\[\d{2}:\d{2}(\.\d+)?\]/g, '').trim())
            .filter(line => line.length > 0);
    }, [lyricsText]);

    // Default Cover Art Component (Generated Fluid Art)
    // Bug2 Fix: 只在 music 模式下允许点击显示歌词
    const DefaultCover = () => (
        <div 
            className="w-48 h-48 md:w-56 md:h-56 rounded-[24px] overflow-hidden relative shadow-2xl shadow-black/50 group mx-auto cursor-pointer"
            onClick={() => {
                // Bug2 Fix: 只在 music 模式且有歌词时才显示歌词弹窗
                if (displayInfo.type === 'music' && lyricsText) {
                    setShowLyricsOverlay(true);
                }
            }}
        >
            {/* Using the dynamic cover url */}
            <img
                src={coverUrl}
                alt="Album Cover"
                className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110 bg-neutral-900"
                onError={(e) => {
                    // Fallback if image fails loading
                    (e.target as HTMLImageElement).src = "/default_cover.png";
                }}
            />

            {/* Overlay for music state */}
            {displayInfo.type === 'music' && (
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    {lyricsText && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white/80 text-xs font-medium tracking-widest uppercase border border-white/30 px-3 py-1 rounded-full backdrop-blur-sm">
                            Show Lyrics
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const showCover = displayInfo.type !== 'talk' && !isExpanded;

    return (
        <div className={`relative flex flex-col items-center w-full transition-all duration-500 ${isExpanded ? 'h-full justify-start' : 'justify-center h-full'
            }`}>
            <AnimatePresence mode="wait">
                <div className="relative w-full flex flex-col items-center z-10 h-full justify-center">

                    {/* Cover Art Area - Only for Music/Idle */}
                    <AnimatePresence>
                        {showCover && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, height: 0 }}
                                animate={{ opacity: 1, scale: 1, height: 'auto' }}
                                exit={{ opacity: 0, scale: 0.9, height: 0 }}
                                transition={{ duration: 0.4 }}
                                className="mb-6 sm:mb-8"
                            >
                                <DefaultCover />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Expanded State Mini Header (When expanded, show small icon/text) */}
                    {isExpanded && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="w-full flex items-center gap-3 px-4 pb-4 border-b border-white/5 mb-4"
                        >
                            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                                <img src={coverUrl} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-white font-bold truncate">{displayInfo.displayName}</span>
                                <span className="text-xs text-neutral-400 uppercase tracking-wider">{displayInfo.type}</span>
                            </div>
                        </motion.div>
                    )}

                    {/* Lyrics Overlay Modal */}
                    <AnimatePresence>
                        {showLyricsOverlay && (
                            <motion.div
                                initial={{ opacity: 0, y: 50 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 50 }}
                                className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl rounded-[24px] overflow-hidden flex flex-col"
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-neutral-900/50">
                                    <div className="flex flex-col">
                                        <h3 className="text-white font-bold text-lg leading-tight line-clamp-1">{displayInfo.displayName}</h3>
                                        <span className="text-neutral-400 text-xs">{displayInfo.subtitle}</span>
                                    </div>
                                    <button 
                                        onClick={() => setShowLyricsOverlay(false)}
                                        className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M18 6L6 18M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Lyrics Content */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6 text-center">
                                    {parsedLyrics.length > 0 ? (
                                        parsedLyrics.map((line, i) => (
                                            <p key={i} className="text-neutral-300 text-lg font-light leading-relaxed">
                                                {line}
                                            </p>
                                        ))
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-neutral-500 gap-4">
                                            <Music size={48} className="opacity-20" />
                                            <p>No lyrics available</p>
                                        </div>
                                    )}
                                    <div className="h-12" /> {/* Bottom padding */}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Layout for Music/Idle Mode: Title -> Status */}
                    {(displayInfo.type === 'music' || displayInfo.type === 'idle') && (
                        <>
                            {/* Main Title */}
                            <motion.h2
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`font-black tracking-tight text-center max-w-sm leading-tight text-white/90 ${isExpanded ? 'text-lg mb-4' : 'text-xl md:text-2xl mb-4'
                                    }`}
                            >
                                {displayInfo.displayName}
                            </motion.h2>

                            {/* Status & Visualizer */}
                            {!isExpanded && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-col items-center gap-3 mb-6"
                                >
                                    {/* Visualizer (Animated) */}
                                    {displayInfo.type === 'music' && (
                                        <div className="flex items-center justify-center gap-1 h-8">
                                            {bars.map((_, i) => (
                                                <motion.div
                                                    key={i}
                                                    animate={{
                                                        height: [8, Math.random() * 24 + 8, 8],
                                                        opacity: [0.3, 1, 0.3]
                                                    }}
                                                    transition={{
                                                        duration: 0.4,
                                                        repeat: Infinity,
                                                        repeatType: "reverse",
                                                        delay: i * 0.05,
                                                        ease: "easeInOut"
                                                    }}
                                                    className="w-1 rounded-full bg-orange-400"
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Status Pill */}
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${displayInfo.type === 'music' ? 'bg-orange-500' : 'bg-violet-500'
                                            }`} />
                                        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400">
                                            {displayInfo.type === 'music' ? 'NOW PLAYING' : 'SYSTEM'}
                                        </span>
                                    </div>
                                </motion.div>
                            )}
                        </>
                    )}

                    {/* Layout for Talk Mode: Visualizer -> Status -> Title */}
                    {displayInfo.type === 'talk' && (
                        <>
                            {/* Status & Visualizer */}
                            {!isExpanded && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-col items-center gap-3 mb-6"
                                >
                                    {/* Visualizer (Animated) */}
                                    <div className="flex items-center justify-center gap-1 h-12 mb-2">
                                        {bars.map((_, i) => (
                                            <motion.div
                                                key={i}
                                                animate={{
                                                    height: [12, Math.random() * 48 + 12, 12],
                                                    opacity: [0.3, 0.8, 0.3]
                                                }}
                                                transition={{
                                                    duration: 0.5,
                                                    repeat: Infinity,
                                                    repeatType: "reverse",
                                                    delay: i * 0.05,
                                                    ease: "easeInOut"
                                                }}
                                                className="w-1 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.5)]"
                                            />
                                        ))}
                                    </div>

                                    {/* Status Pill */}
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                                        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-violet-300">
                                            LIVE BROADCAST
                                        </span>
                                    </div>
                                </motion.div>
                            )}

                            {/* Main Title (Speaker Name) - Bug1 Fix: 减小主持人名称字体，让台词更突出 */}
                            <motion.h2
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`font-bold tracking-tight text-center text-white mb-4 ${isExpanded ? 'text-base' : 'text-lg md:text-xl'
                                    }`}
                            >
                                {displayInfo.displayName}
                            </motion.h2>
                        </>
                    )}


                    {/* Subtitle / Context (Expandable) */}
                    {displayInfo.subtitle && displayInfo.type === 'talk' && (
                        <motion.div
                            layout
                            className={`relative group cursor-pointer transition-all duration-500 flex flex-col ${isExpanded ? 'flex-1 w-full overflow-hidden' : 'w-full max-w-sm'
                                }`}
                            onClick={() => !isExpanded && onExpandChange(true)}
                        >
                            {!isExpanded && (
                                <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent h-px w-full -top-6" />
                            )}

                            <motion.div
                                layout
                                className={`relative transition-all duration-500 ${isExpanded
                                    ? 'flex-1 bg-white/5 rounded-2xl p-6 overflow-y-auto no-scrollbar'
                                    : 'px-4 py-2 hover:bg-white/5 rounded-xl'
                                    }`}
                            >
                                <p className={`text-neutral-300 font-light leading-relaxed transition-all ${isExpanded
                                    ? 'text-base text-left whitespace-pre-wrap'
                                    : 'text-sm text-center line-clamp-3 text-neutral-400'
                                    }`}>
                                    {displayInfo.subtitle}
                                </p>

                                {/* Hint arrow for collapsed state */}
                                {!isExpanded && displayInfo.subtitle.length > 60 && (
                                    <div className="flex justify-center mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="text-neutral-500">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M6 9l6 6 6-6" />
                                            </svg>
                                        </div>
                                    </div>
                                )}
                            </motion.div>

                            {/* Collapse button for expanded state */}
                            {isExpanded && (
                                <div
                                    className="flex justify-center pt-4 pb-2"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onExpandChange(false);
                                    }}
                                >
                                    <div className="bg-neutral-800/80 backdrop-blur-md px-4 py-1.5 rounded-full flex items-center gap-2 text-[10px] text-neutral-400 hover:text-white transition-colors border border-white/5 cursor-pointer hover:bg-white/10">
                                        <span>COLLAPSE</span>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <path d="M18 15l-6-6-6 6" />
                                        </svg>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>
            </AnimatePresence>
        </div>
    );
});

SubtitleDisplay.displayName = 'SubtitleDisplay';

export default SubtitleDisplay;

