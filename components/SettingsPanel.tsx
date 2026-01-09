"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Zap, CheckCircle, AlertCircle, Loader2, RefreshCw, ChevronDown } from "lucide-react";
import { getSettings, saveSettings, IApiSettings, ApiType } from "@/lib/settings_store";
import { testConnection, fetchModels } from "@/lib/ai_service";

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
    const [settings, setSettings] = useState<IApiSettings>({
        endpoint: "",
        apiKey: "",
        modelName: "gpt-4o",
        apiType: "openai",
        ttsEndpoint: "",
        ttsApiKey: "",
        ttsModel: "gemini-2.5-flash-preview-tts",
        ttsVoice: "Aoede",
    });
    const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [testMessage, setTestMessage] = useState("");
    const [saved, setSaved] = useState(false);

    // Model list state
    const [models, setModels] = useState<string[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const [showModelDropdown, setShowModelDropdown] = useState(false);

    // Load settings on mount
    useEffect(() => {
        if (isOpen) {
            const stored = getSettings();
            setSettings(stored);
            setTestStatus("idle");
            setTestMessage("");
            setSaved(false);
            setModels([]);
            setShowModelDropdown(false);
        }
    }, [isOpen]);

    // Fetch models when endpoint/apiKey change
    const handleFetchModels = useCallback(async () => {
        if (!settings.endpoint || !settings.apiKey) return;

        setLoadingModels(true);
        const modelList = await fetchModels(settings.endpoint, settings.apiKey, settings.apiType);
        setModels(modelList);
        setLoadingModels(false);

        if (modelList.length > 0) {
            setShowModelDropdown(true);
        }
    }, [settings.endpoint, settings.apiKey]);

    const handleSave = () => {
        saveSettings(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleTest = async () => {
        setTestStatus("testing");
        setTestMessage("");

        // Temporarily save for test
        saveSettings(settings);

        const result = await testConnection();
        setTestStatus(result.success ? "success" : "error");
        setTestMessage(result.message);

        // Auto-fetch models on successful connection
        if (result.success && models.length === 0) {
            handleFetchModels();
        }
    };

    const handleChange = (field: keyof IApiSettings, value: string) => {
        setSettings((prev) => ({ ...prev, [field]: value }));
        setSaved(false);
    };

    const handleSelectModel = (model: string) => {
        handleChange("modelName", model);
        setShowModelDropdown(false);
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
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-100"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.95 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-neutral-900 border border-neutral-700 rounded-2xl z-101 overflow-hidden shadow-2xl max-h-[85vh] overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 sticky top-0 bg-neutral-900">
                            <h2 className="text-lg font-semibold text-white tracking-wide">API Settings</h2>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
                            >
                                <X size={20} className="text-neutral-400" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-5">
                            {/* API Type Selector */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-400">API Type</label>
                                <div className="flex gap-2">
                                    {(["openai", "gemini"] as ApiType[]).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => handleChange("apiType", type)}
                                            className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${settings.apiType === type
                                                ? "bg-emerald-600 text-white"
                                                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                                                }`}
                                        >
                                            {type === "openai" ? "OpenAI" : "Gemini"}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-neutral-500">
                                    {settings.apiType === "openai"
                                        ? "OpenAI, DeepSeek, Groq, Ollama, etc."
                                        : "Google Gemini native API format"
                                    }
                                </p>
                            </div>

                            {/* Endpoint */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-400">API Endpoint</label>
                                <input
                                    type="text"
                                    value={settings.endpoint}
                                    onChange={(e) => handleChange("endpoint", e.target.value)}
                                    placeholder={settings.apiType === "openai"
                                        ? "https://api.openai.com"
                                        : "https://generativelanguage.googleapis.com"
                                    }
                                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                            </div>

                            {/* API Key */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-400">API Key</label>
                                <input
                                    type="password"
                                    value={settings.apiKey}
                                    onChange={(e) => handleChange("apiKey", e.target.value)}
                                    placeholder="sk-..."
                                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                            </div>

                            {/* Model Name with Dropdown */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-neutral-400">Model Name</label>
                                    <button
                                        onClick={handleFetchModels}
                                        disabled={!settings.endpoint || !settings.apiKey || loadingModels}
                                        className="flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 disabled:text-neutral-600 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <RefreshCw size={12} className={loadingModels ? "animate-spin" : ""} />
                                        {loadingModels ? "Loading..." : "Fetch Models"}
                                    </button>
                                </div>

                                <div className="relative">
                                    <input
                                        type="text"
                                        value={settings.modelName}
                                        onChange={(e) => handleChange("modelName", e.target.value)}
                                        placeholder="gpt-4o"
                                        className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors pr-10"
                                    />
                                    {models.length > 0 && (
                                        <button
                                            onClick={() => setShowModelDropdown(!showModelDropdown)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-700 rounded transition-colors"
                                        >
                                            <ChevronDown size={16} className={`text-neutral-400 transition-transform ${showModelDropdown ? "rotate-180" : ""}`} />
                                        </button>
                                    )}

                                    {/* Model Dropdown */}
                                    <AnimatePresence>
                                        {showModelDropdown && models.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="absolute top-full left-0 right-0 mt-2 bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden z-10 max-h-48 overflow-y-auto"
                                            >
                                                {models.map((model) => (
                                                    <button
                                                        key={model}
                                                        onClick={() => handleSelectModel(model)}
                                                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-700 transition-colors ${model === settings.modelName
                                                            ? "text-emerald-400 bg-emerald-500/10"
                                                            : "text-neutral-300"
                                                            }`}
                                                    >
                                                        {model}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <p className="text-xs text-neutral-500">
                                    {models.length > 0
                                        ? `${models.length} models available - click dropdown or type manually`
                                        : "e.g., gpt-4o, gpt-3.5-turbo, deepseek-chat"
                                    }
                                </p>
                            </div>

                            {/* Test Status */}
                            {testStatus !== "idle" && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex items-center gap-2 p-3 rounded-xl ${testStatus === "testing"
                                        ? "bg-neutral-800 text-neutral-300"
                                        : testStatus === "success"
                                            ? "bg-emerald-500/20 text-emerald-400"
                                            : "bg-red-500/20 text-red-400"
                                        }`}
                                >
                                    {testStatus === "testing" && <Loader2 size={16} className="animate-spin" />}
                                    {testStatus === "success" && <CheckCircle size={16} />}
                                    {testStatus === "error" && <AlertCircle size={16} />}
                                    <span className="text-sm">{testMessage || "Testing connection..."}</span>
                                </motion.div>
                            )}

                            {/* Divider */}
                            <div className="border-t border-neutral-800 pt-4">
                                <h3 className="text-sm font-semibold text-neutral-300 mb-3">🎤 TTS Settings</h3>
                            </div>

                            {/* TTS Endpoint */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-400">TTS Endpoint</label>
                                <input
                                    type="text"
                                    value={settings.ttsEndpoint}
                                    onChange={(e) => handleChange("ttsEndpoint", e.target.value)}
                                    placeholder="留空使用官方 (https://generativelanguage.googleapis.com)"
                                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition-colors"
                                />
                            </div>

                            {/* TTS API Key */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-400">TTS API Key</label>
                                <input
                                    type="password"
                                    value={settings.ttsApiKey}
                                    onChange={(e) => handleChange("ttsApiKey", e.target.value)}
                                    placeholder="AIzaSy... (Gemini官方密钥)"
                                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition-colors"
                                />
                                <p className="text-xs text-neutral-500">
                                    留空则使用主 API Key
                                </p>
                            </div>

                            {/* TTS Model */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-400">TTS Model</label>
                                <select
                                    value={settings.ttsModel}
                                    onChange={(e) => handleChange("ttsModel", e.target.value)}
                                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-purple-500 transition-colors"
                                >
                                    <option value="gemini-2.5-flash-preview-tts">Flash TTS (快速推荐)</option>
                                    <option value="gemini-2.5-pro-preview-tts">Pro TTS (高质量)</option>
                                </select>
                            </div>

                            {/* TTS Voice - All 30 voices */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-400">Default Voice (全部 30 种音色)</label>
                                <select
                                    value={settings.ttsVoice}
                                    onChange={(e) => handleChange("ttsVoice", e.target.value)}
                                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-purple-500 transition-colors"
                                >
                                    <optgroup label="🇨🇳 中文推荐">
                                        <option value="Aoede">Aoede - 女声·清澈温柔 (Breezy)</option>
                                        <option value="Kore">​Kore - 女声·坚定专业 (Firm)</option>
                                        <option value="Gacrux">Gacrux - 男声·成熟稳重 (Mature)</option>
                                        <option value="Charon">Charon - 男声·专业播报 (Informative)</option>
                                        <option value="Puck">Puck - 中性·活泼开朗 (Upbeat)</option>
                                    </optgroup>
                                    <optgroup label="🇬🇧 英文推荐">
                                        <option value="Zephyr">Zephyr - Female·Bright</option>
                                        <option value="Fenrir">Fenrir - Male·Excitable</option>
                                        <option value="Leda">Leda - Female·Youthful</option>
                                        <option value="Orus">Orus - Male·Firm</option>
                                        <option value="Callirrhoe">Callirrhoe - Female·Confident</option>
                                    </optgroup>
                                    <optgroup label="🇯🇵 日文推荐">
                                        <option value="Despina">Despina - 女性·温もり (Warm)</option>
                                        <option value="Autonoe">Autonoe - 女性·深み (Bright Mature)</option>
                                        <option value="Umbriel">Umbriel - 男性·おっとり (Easy-going)</option>
                                        <option value="Iapetus">Iapetus - 男性·親しみ (Friendly)</option>
                                    </optgroup>
                                    <optgroup label="🌍 其他音色">
                                        <option value="Enceladus">Enceladus - Breathy</option>
                                        <option value="Algieba">Algieba - Smooth</option>
                                        <option value="Erinome">Erinome - Clear</option>
                                        <option value="Algenib">Algenib - Warm Confident</option>
                                        <option value="Rasalgethi">Rasalgethi - Conversational</option>
                                        <option value="Laomedeia">Laomedeia - Upbeat</option>
                                        <option value="Achernar">Achernar - Soft</option>
                                        <option value="Alnilam">Alnilam - Energetic</option>
                                        <option value="Schedar">Schedar - Even</option>
                                        <option value="Pulcherrima">Pulcherrima - Bright Youthful</option>
                                        <option value="Achird">Achird - Friendly</option>
                                        <option value="Zubenelgenubi">Zubenelgenubi - Casual</option>
                                        <option value="Vindemiatrix">Vindemiatrix - Gentle</option>
                                        <option value="Sadachbia">Sadachbia - Deep Confident</option>
                                        <option value="Sadaltager">Sadaltager - Knowledgeable</option>
                                        <option value="Sulafar">Sulafar - Warm</option>
                                    </optgroup>
                                </select>
                                <p className="text-xs text-neutral-500">
                                    支持中英日等 24 种语言自动识别，AI 可动态选择不同音色
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleTest}
                                    disabled={!settings.endpoint || !settings.apiKey || testStatus === "testing"}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
                                >
                                    <Zap size={18} />
                                    Test
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors"
                                >
                                    {saved ? <CheckCircle size={18} /> : <Save size={18} />}
                                    {saved ? "Saved!" : "Save"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
