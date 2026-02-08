"use client";

import React, { useState } from 'react';
import { ShowType } from '@features/content/lib/cast-system';
import {
    UserPreference,
    getUserPreference,
    saveUserPreference,
    ExplorationLevel
} from '../lib';

const SHOW_TYPE_OPTIONS: Array<{ value: ShowType; label: string }> = [
    { value: 'talk', label: '脱口秀' },
    { value: 'interview', label: '访谈' },
    { value: 'news', label: '新闻' },
    { value: 'drama', label: '广播剧' },
    { value: 'entertainment', label: '娱乐综艺' },
    { value: 'story', label: '故事' },
    { value: 'history', label: '历史' },
    { value: 'science', label: '科普' },
    { value: 'mystery', label: '奇闻' },
    { value: 'nighttalk', label: '深夜心声' },
    { value: 'music', label: '音乐专题' }
];

const EXPLORATION_OPTIONS: Array<{ value: ExplorationLevel; label: string }> = [
    { value: 'conservative', label: '保守（更贴近已知偏好）' },
    { value: 'balanced', label: '平衡（默认）' },
    { value: 'adventurous', label: '冒险（探索新风格）' }
];

function parseTags(input: string): string[] {
    return input
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

export default function UserPreferenceSettings() {
    const [preference, setPreference] = useState<UserPreference>(() => getUserPreference());
    const [favoriteGenreInput, setFavoriteGenreInput] = useState(() => getUserPreference().favoriteGenres.join(', '));
    const [dislikedGenreInput, setDislikedGenreInput] = useState(() => getUserPreference().dislikedGenres.join(', '));
    const [saved, setSaved] = useState(false);

    const toggleShowType = (showType: ShowType) => {
        setPreference(prev => {
            const has = prev.favoriteShowTypes.includes(showType);
            return {
                ...prev,
                favoriteShowTypes: has
                    ? prev.favoriteShowTypes.filter(item => item !== showType)
                    : [...prev.favoriteShowTypes, showType]
            };
        });
    };

    const handleSave = () => {
        const next: UserPreference = {
            ...preference,
            favoriteGenres: parseTags(favoriteGenreInput),
            dislikedGenres: parseTags(dislikedGenreInput)
        };

        saveUserPreference(next);
        setPreference(next);
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
    };

    return (
        <div className="space-y-3 pt-3 border-t border-neutral-800">
            <label className="text-sm font-medium text-neutral-400">听众偏好</label>

            <div className="space-y-2">
                <label className="text-xs text-neutral-500">探索等级</label>
                <select
                    value={preference.explorationLevel}
                    onChange={(e) => setPreference(prev => ({ ...prev, explorationLevel: e.target.value as ExplorationLevel }))}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm"
                >
                    {EXPLORATION_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-2">
                <label className="text-xs text-neutral-500">偏好节目类型（可多选）</label>
                <div className="flex flex-wrap gap-2">
                    {SHOW_TYPE_OPTIONS.map(option => {
                        const active = preference.favoriteShowTypes.includes(option.value);
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => toggleShowType(option.value)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                                    active
                                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                                        : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                                }`}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs text-neutral-500">喜爱曲风（逗号分隔）</label>
                <input
                    type="text"
                    value={favoriteGenreInput}
                    onChange={(e) => setFavoriteGenreInput(e.target.value)}
                    placeholder="例如：民谣, 电子, City Pop"
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm"
                />
            </div>

            <div className="space-y-2">
                <label className="text-xs text-neutral-500">不喜欢曲风（逗号分隔）</label>
                <input
                    type="text"
                    value={dislikedGenreInput}
                    onChange={(e) => setDislikedGenreInput(e.target.value)}
                    placeholder="例如：硬核金属, 纯器乐"
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm"
                />
            </div>

            <button
                type="button"
                onClick={handleSave}
                className="w-full px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm rounded-lg transition-colors"
            >
                保存偏好
            </button>

            {saved && (
                <p className="text-xs text-emerald-400">偏好已保存</p>
            )}
        </div>
    );
}
