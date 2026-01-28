"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Sparkles, Clock, Check, Loader2 } from 'lucide-react';
import { mailQueue, MailItem } from '@features/feedback/lib/mail-queue';

interface MailboxDrawerProps {
    showMailbox: boolean;
    userMessage: string;
    onUserMessageChange: (message: string) => void;
    onSubmit: () => void;
    onClose: () => void;
}

// 格式化时间戳
function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export default function MailboxDrawer({
    showMailbox,
    userMessage,
    onUserMessageChange,
    onSubmit,
    onClose,
}: MailboxDrawerProps) {
    const [mailHistory, setMailHistory] = useState<MailItem[]>([]);

    // 获取并监听邮件历史
    useEffect(() => {
        if (showMailbox) {
            setMailHistory(mailQueue.getAll());
        }
        
        const cleanup = mailQueue.onMail(() => {
            setMailHistory(mailQueue.getAll());
        });
        
        return cleanup;
    }, [showMailbox]);

    const handleSubmit = () => {
        if (userMessage.trim()) {
            onSubmit();
        }
    };

    return (
        <AnimatePresence>
            {showMailbox && (
                <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="mt-6 w-full max-w-[calc(100%-1rem)] sm:max-w-md mx-auto px-2 sm:px-0"
                >
                    {/* Outer glow wrapper */}
                    <div className="relative group">
                        {/* Gradient glow effect */}
                        <div className="absolute -inset-0.5 bg-linear-to-r from-violet-600/30 via-pink-500/30 to-orange-500/30 rounded-2xl blur-lg opacity-60 group-hover:opacity-80 transition-opacity duration-500" />

                        {/* Main container */}
                        <div className="relative glass-panel rounded-2xl p-1.5 overflow-hidden">
                            {/* Inner gradient border */}
                            <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-white/10 via-transparent to-white/5 pointer-events-none" />

                            {/* 已提交消息历史 */}
                            {mailHistory.length > 0 && (
                                <div className="relative px-3 py-2 mb-1 max-h-32 overflow-y-auto no-scrollbar border-b border-white/5">
                                    <div className="text-[9px] text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <Clock size={10} />
                                        <span>Submitted Messages</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {[...mailHistory].reverse().slice(0, 5).map((mail) => (
                                            <div 
                                                key={mail.id} 
                                                className="flex items-start gap-2 text-[11px]"
                                            >
                                                <span className="text-neutral-600 shrink-0 font-mono">
                                                    {formatTime(mail.timestamp)}
                                                </span>
                                                <span className="text-neutral-400 flex-1 line-clamp-1">
                                                    {mail.content}
                                                </span>
                                                <span className="shrink-0">
                                                    {mail.processed ? (
                                                        <Check size={10} className="text-green-500" />
                                                    ) : (
                                                        <Loader2 size={10} className="text-orange-400 animate-spin" />
                                                    )}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Input row */}
                            <div className="relative flex items-center gap-1 sm:gap-2">
                                {/* Sparkle icon - 窄屏隐藏 */}
                                <div className="hidden sm:block pl-3 text-violet-400/60">
                                    <Sparkles size={16} />
                                </div>

                                {/* Text input */}
                                <input
                                    value={userMessage}
                                    onChange={e => onUserMessageChange(e.target.value)}
                                    placeholder="Whisper to Nowhere..."
                                    className="flex-1 min-w-0 bg-transparent border-none focus:outline-none focus:ring-0 text-sm py-3 pl-3 sm:pl-2 pr-1 sm:px-2 text-white/90 placeholder-neutral-500 font-light tracking-wide"
                                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                                    autoFocus
                                />

                                {/* Action buttons */}
                                <div className="flex items-center gap-1 sm:gap-1.5 pr-1 sm:pr-1.5 shrink-0">
                                    {/* Send button */}
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleSubmit}
                                        disabled={!userMessage.trim()}
                                        className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all duration-300 ${userMessage.trim()
                                            ? 'bg-linear-to-r from-violet-500 to-pink-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40'
                                            : 'bg-white/5 text-neutral-600 cursor-not-allowed'
                                            }`}
                                    >
                                        <Send size={12} className="sm:hidden" />
                                        <Send size={14} className="hidden sm:block" />
                                    </motion.button>

                                    {/* Close button */}
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={onClose}
                                        className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all duration-200"
                                    >
                                        <X size={12} className="sm:hidden" />
                                        <X size={14} className="hidden sm:block" />
                                    </motion.button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Hint text */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-center text-[10px] text-neutral-600 mt-3 font-mono tracking-wider px-2"
                    >
                        <span className="hidden sm:inline">Press Enter to transmit • Messages may influence the broadcast</span>
                        <span className="sm:hidden">Press Enter to send</span>
                    </motion.p>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
