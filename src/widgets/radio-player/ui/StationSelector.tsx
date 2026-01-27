/**
 * StationSelector - 电台类型选择器
 * 让用户选择想听的电台类型
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { ShowType } from '@features/content/lib/cast-system';

export interface StationType {
    type: ShowType | 'random';
    emoji: string;
    titleZh: string;
    titleEn: string;
    description: string;
}

// 电台类型配置
export const STATION_TYPES: StationType[] = [
    {
        type: 'random',
        emoji: '🎲',
        titleZh: '随机播放',
        titleEn: 'Random',
        description: '让电台随机选择内容，每次都有新惊喜'
    },
    {
        type: 'news',
        emoji: '📰',
        titleZh: '新闻时事',
        titleEn: 'News & Current Affairs',
        description: '每日新闻要点、深度分析、社会热点'
    },
    {
        type: 'talk',
        emoji: '💬',
        titleZh: '脱口秀',
        titleEn: 'Talk Show',
        description: '主持人轻松聊天，分享生活趣事和热门话题'
    },
    {
        type: 'history',
        emoji: '📚',
        titleZh: '历史风云',
        titleEn: 'Historical Stories',
        description: '历史故事、人物传记、朝代兴衰'
    },
    {
        type: 'science',
        emoji: '🔬',
        titleZh: '科普百科',
        titleEn: 'Science Trivia',
        description: '有趣的科学知识、自然奥秘、冷知识'
    },
    {
        type: 'mystery',
        emoji: '👻',
        titleZh: '奇闻异事',
        titleEn: 'Urban Legends',
        description: '都市传说、未解之谜（悬疑但不恐怖）'
    },
    {
        type: 'interview',
        emoji: '🎤',
        titleZh: '访谈对话',
        titleEn: 'Interviews',
        description: '模拟采访名人、专家或虚构人物'
    },
    {
        type: 'nighttalk',
        emoji: '🌙',
        titleZh: '深夜心声',
        titleEn: 'Late Night Thoughts',
        description: '情感话题、人生感悟（适合静谧时刻）'
    },
    {
        type: 'music',
        emoji: '🎵',
        titleZh: '音乐专题',
        titleEn: 'Music Specials',
        description: '曲风介绍、歌手特辑、音乐背后的故事'
    },
    {
        type: 'entertainment',
        emoji: '🎪',
        titleZh: '娱乐互动',
        titleEn: 'Interactive Entertainment',
        description: '有趣话题、游戏互动、轻松搞笑'
    },
    {
        type: 'gaming',
        emoji: '🎮',
        titleZh: '游戏二次元',
        titleEn: 'Gaming & ACG',
        description: '游戏、动漫、漫画、粉丝文化讨论'
    }
];

interface StationSelectorProps {
    isOpen: boolean;
    currentStation: ShowType | 'random';
    onSelect: (type: ShowType | 'random') => void;
    onClose: () => void;
}

export default function StationSelector({
    isOpen,
    currentStation,
    onSelect,
    onClose
}: StationSelectorProps) {
    const handleSelect = (type: ShowType | 'random') => {
        onSelect(type);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                    />

                    {/* Selector Panel */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:left-1/2 md:-translate-x-1/2 md:w-[600px] md:inset-x-auto max-h-[80vh] z-50 glass-panel rounded-3xl overflow-hidden shadow-2xl"
                    >
                        {/* Header */}
                        <div className="sticky top-0 z-10 px-6 py-4 bg-gradient-to-b from-black/80 to-black/40 backdrop-blur-xl border-b border-white/10 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white">选择电台类型</h2>
                                <p className="text-xs text-neutral-400 mt-0.5">Choose Your Station</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                            >
                                <X size={20} className="text-neutral-400" />
                            </button>
                        </div>

                        {/* Station Grid */}
                        <div className="overflow-y-auto max-h-[calc(80vh-80px)] px-4 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {STATION_TYPES.map((station) => {
                                    const isActive = currentStation === station.type;
                                    return (
                                        <motion.button
                                            key={station.type}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => handleSelect(station.type)}
                                            className={`
                                                relative p-4 rounded-2xl text-left transition-all duration-300
                                                ${isActive
                                                    ? 'bg-gradient-to-br from-orange-500/20 to-rose-500/20 border-2 border-orange-500/50'
                                                    : 'bg-white/5 hover:bg-white/10 border border-white/10'
                                                }
                                            `}
                                        >
                                            {isActive && (
                                                <motion.div
                                                    layoutId="activeStation"
                                                    className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-rose-500/10 rounded-2xl"
                                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                                />
                                            )}
                                            
                                            <div className="relative z-10">
                                                <div className="flex items-start gap-3">
                                                    <span className="text-3xl">{station.emoji}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-bold text-white text-base mb-0.5">
                                                            {station.titleZh}
                                                        </h3>
                                                        <p className="text-[10px] text-neutral-400 font-mono uppercase tracking-wider mb-2">
                                                            {station.titleEn}
                                                        </p>
                                                        <p className="text-xs text-neutral-300 leading-relaxed">
                                                            {station.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
