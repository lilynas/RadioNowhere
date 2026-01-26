"use client";

import React from 'react';
import { IApiSettings } from '@shared/services/storage-service/settings';

interface PreloadSettingsProps {
    settings: IApiSettings;
    onSettingChange: (field: keyof IApiSettings, value: any) => void;
}

export default function PreloadSettings({
    settings,
    onSettingChange,
}: PreloadSettingsProps) {
    return (
        <div className="space-y-3 pt-3 border-t border-neutral-800">
            <label className="text-sm font-medium text-neutral-400">播放配置</label>
            
            {/* 预加载设置 */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500">提前准备节目数量</span>
                    <span className="text-sm font-mono text-emerald-400">{settings.preloadBlockCount}</span>
                </div>
                <input
                    type="range"
                    min={1}
                    max={10}
                    value={settings.preloadBlockCount}
                    onChange={(e) => onSettingChange("preloadBlockCount", parseInt(e.target.value))}
                    className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] text-neutral-600">
                    <span>1 (省内存)</span>
                    <span className="text-emerald-500">推荐: 3</span>
                    <span>10 (流畅)</span>
                </div>
            </div>

            {/* 音乐播放模式 */}
            <div className="space-y-3 pt-2 border-t border-neutral-800/50">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500">音乐播放模式</span>
                    <div className="flex bg-neutral-800 rounded-lg p-1">
                        <button
                            onClick={() => onSettingChange("musicPlaybackMode", "truncated")}
                            className={`px-3 py-1.5 text-xs rounded-md transition-all ${settings.musicPlaybackMode === 'truncated'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-neutral-400 hover:text-neutral-300'
                                }`}
                        >
                            精选片段
                        </button>
                        <button
                            onClick={() => onSettingChange("musicPlaybackMode", "full")}
                            className={`px-3 py-1.5 text-xs rounded-md transition-all ${settings.musicPlaybackMode === 'full'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-neutral-400 hover:text-neutral-300'
                                }`}
                        >
                            完整播放
                        </button>
                    </div>
                </div>

                {/* 截断时长设置 (仅在截断模式显示) */}
                {settings.musicPlaybackMode === 'truncated' && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-neutral-500">片段时长限制</span>
                            <span className="text-sm font-mono text-emerald-400">{settings.maxMusicDuration}秒</span>
                        </div>
                        <input
                            type="range"
                            min={30}
                            max={180}
                            step={10}
                            value={settings.maxMusicDuration}
                            onChange={(e) => onSettingChange("maxMusicDuration", parseInt(e.target.value))}
                            className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <div className="flex justify-between text-[10px] text-neutral-600">
                            <span>30s</span>
                            <span>60s</span>
                            <span>180s</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
