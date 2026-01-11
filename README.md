# RadioNowhere

<div align="center">

**AI-Generated Internet Radio / AI 生成的网络电台**

[Next.js 16](https://nextjs.org) + [React 19](https://reactjs.org) + [TypeScript](https://www.typescriptlang.org/) + [Tailwind CSS 4](https://tailwindcss.com)

*A multi-agent orchestrated AI radio experience with real-time content generation and intelligent audio mixing.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org)

</div>

---

## 📻 Project Overview

**RadioNowhere** is an AI-driven internet radio platform that generates dynamic radio shows in real-time using a multi-agent system. The platform features three core agents working in concert:

- **Writer Agent** - Generates radio content using ReAct tool-calling pattern
- **Director Agent** - Orchestrates show timelines with double-buffered preloading
- **TTS Agent** - Converts text to speech with 30+ voice options

The radio station operates under the identity **"NOWHERE FM 404.2"** (无处电台), broadcasting diverse programs including talk shows, historical stories, science trivia, urban legends, interviews, late-night thoughts, music specials, and interactive entertainment.

### 🎭 World Setting

The station exists in a fictional atmosphere blending cyberpunk aesthetics with post-apocalyptic warmth. **Radio Nowhere - The Frequency of the Lost** provides solace for wandering souls through melancholic yet comforting programming, creating a unique "post-apocalyptic romanticism" experience.

---

## ✨ Core Features

### 🤖 Multi-Agent System

| Agent | Role | Key Features |
|-------|------|--------------|
| **Writer Agent** | Content Generation | ReAct tool-calling (MAX_REACT_LOOPS: 30), dynamic program types, multi-character support, world-bible context |
| **Director Agent** | Show Orchestration | Timeline management, double-buffered preloading, session persistence, music URL caching (10min TTL) |
| **TTS Agent** | Speech Synthesis | 30+ Gemini voices, Microsoft TTS backup, priority queue (MAX_CONCURRENT_TTS: 5), audio caching |

### 🎭 Program Types

The Writer Agent dynamically generates diverse content:

- **💬 Talk Show / 脱口秀** - Lively conversations between hosts sharing life anecdotes and trending topics
- **📚 Historical Stories / 历史风云** - Historical narratives, biographies, and tales of dynasties
- **🔬 Science Trivia / 科普百科** - Interesting scientific knowledge, natural mysteries, and fun facts
- **👻 Urban Legends / 奇闻异事** - Urban legends and unsolved mysteries (suspenseful but not too scary)
- **🎤 Interviews / 访谈对话** - Simulated interviews with celebrities, experts, or fictional characters
- **🌙 Late Night Thoughts / 深夜心声** - Emotional topics and life insights (perfect for quiet hours)
- **🎵 Music Specials / 音乐专题** - Introductions to genres, artists, or stories behind music
- **🎪 Interactive Entertainment / 娱乐互动** - Fun discussions, games, and light-hearted comedy

### 🎵 Audio System

- **🎶 GD Studio Music API** - Smart music discovery with netease/kuwo/joox sources
- **📝 LRC Lyrics Parser** - Real-time synchronized lyrics display
- **🎛️ Audio Mixer** - Multi-track mixing with independent volume controls and fade effects
- **📡 Howler.js Engine** - High-performance web audio playback
- **🎚️ Smart Mixing** - Automatic volume ducking (MUSIC_DURING_VOICE: 0.15)

### 🎨 User Interface

- **📻 RadioPlayer** - Main player with Agent console, subtitle display, playback controls, and visualizer
- **📅 Program Schedule** - Timeline visualization with jump controls
- **💬 System Terminal** - Real-time logs and agent status monitoring
- **📮 Mailbox** - Listener request queue for interactive content
- **⚙️ Settings Panel** - API configuration, model selection, voice testing, and preload tuning

### 💾 Data Persistence

- **🏠 localStorage Support** - Settings, session, preferences, and cache storage
- **⏯️ Session Recovery** - Full playback restoration with context rebuilding
- **🔄 Context Memory** - Cross-session content continuity with GlobalState management
- **📜 History Tracking** - Show history (max 50) and track history (max 100)

---

## 🛠️ Tech Stack

```yaml
Framework:
  - Next.js: 16.1.1        # App Router for full-stack React
  - React: 19.2.3          # Latest React with concurrent features
  - TypeScript: 5.0         # Type-safe development

Styling & Animation:
  - Tailwind CSS: 4        # Utility-first CSS with v4 improvements
  - tailwind-merge: 3.4.0  # Merge Tailwind classes intelligently
  - Framer Motion: 12.25.0 # Production-ready animation library
  - Lucide React: 0.562.0  # Beautiful & consistent icon toolkit

Audio & State:
  - Howler.js: 2.2.4       # Web audio engine
  - @types/howler: 2.2.12 # TypeScript definitions
  - Zustand: 5.0.9         # Lightweight state management

AI Services:
  - @google/generative-ai: 0.24.1  # Gemini AI SDK

Utilities:
  - clsx: 2.1.1            # Conditional className utility
```

---

## 📁 Project Structure

```
radio-nowhere/
├── app/                          # Next.js App Router
│   ├── api/
│   │   └── proxy/                # API proxy route (relays to external AI/TTS/music services)
│   ├── globals.css               # Global styles with Tailwind
│   ├── icon.svg                  # App icon
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main page entry
│
├── components/                   # React Components
│   ├── AgentMonitor.tsx          # Agent monitoring display (11KB)
│   ├── ApiCallBubbles.tsx        # API call visualization bubbles
│   ├── PwaRegistrar.tsx          # Progressive Web App registration
│   ├── RadioPlayer.tsx           # Main radio player (511 lines)
│   └── SettingsPanel.tsx         # Settings configuration panel (651 lines)
│
├── lib/                          # Core Business Logic
│   ├── agents/                   # Multi-Agent System
│   │   ├── director_agent.ts     # Director: timeline execution, music control, session recovery
│   │   ├── tts_agent.ts          # TTS: Gemini/Microsoft TTS with caching and rate limiting
│   │   ├── writer_agent.ts       # Writer: ReAct-based content generation with tools
│   │   └── writer_tools.ts       # Writer's tools: search_music, get_lyrics, fetch_news, check_duplicate, submit_show
│   │
│   ├── types/
│   │   └── radio_types.ts        # Complete type system: ShowTimeline, TimelineBlock, TalkBlock, MusicBlock, etc.
│   │
│   ├── audio_mixer.ts            # Multi-track audio mixer with Howler.js
│   ├── cast_system.ts            # Character system for radio personalities
│   ├── constants.ts              # Global configuration constants
│   ├── fictional_world.ts        # World bible and setting definitions
│   ├── gdmusic_service.ts        # GD Studio music API integration (netease/kuwo/joox)
│   ├── global_state.ts           # Global state management for context memory
│   ├── lrc_parser.ts             # LRC format lyrics parser
│   ├── mail_queue.ts             # Listener request queue system
│   ├── microsoft_tts_voices.ts   # Microsoft TTS voice definitions
│   ├── radio_monitor.ts          # Radio monitoring: agent status, logs, API call tracking
│   ├── session_store.ts          # localStorage-based session persistence
│   ├── settings_store.ts         # localStorage-based settings storage
│   ├── show_history.ts           # Show and track history management
│   ├── time_announcement.ts      # Hourly time announcement service
│   ├── tts_voices.ts             # Gemini TTS voice configuration (30+ voices)
│   └── voice_provider.ts         # Voice provider abstraction
│
├── public/                       # Static assets
├── .gitignore
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

---

## 🤖 Agent Architecture

### Writer Agent (`lib/agents/writer_agent.ts`)

The Writer Agent generates radio content using the ReAct (Reasoning + Acting) pattern with a tool-calling capability.

**Key Features:**

- **ReAct Loops**: Up to 30 reasoning-acting cycles per show generation
- **Tool Calling**: Five built-in tools:
  - `search_music` - Search for specific artists or songs via GD Studio API
  - `get_lyrics` - Fetch LRC format lyrics for music integration
  - `fetch_news` - Get today's trending news for content inspiration
  - `check_duplicate` - Verify concept uniqueness within 1-hour history
  - `submit_show` - Submit the final ShowTimeline JSON
- **Dynamic Character System**: Five character types (host1/Aoede, host2/Gacrux, guest/Puck, news/Charon, announcer/Kore)
- **Time-Aware Content**: Adapts program selection to current time of day
- **Context Memory**: Maintains story world coherence through GlobalState

**Constants:**
- `MAX_REACT_LOOPS: 30` - Maximum tool-calling iterations
- `MAX_PARSE_RETRIES: 3` - JSON parsing retry attempts
- `MAX_OUTPUT_TOKENS: 8192` - AI generation token limit

### Director Agent (`lib/agents/director_agent.ts`)

The Director Agent orchestrates the entire radio show, managing timelines, audio playback, and session persistence.

**Key Features:**

- **Timeline Management**: Executes ShowTimeline with four block types:
  - `TalkBlock` - Multi-character dialogue scripts
  - `MusicBlock` - Music playback with optional intro narration
  - `MusicControlBlock` - Music actions (pause, resume, fade, stop)
  - `SilenceBlock` - Timed silence segments
- **Double-Buffered Preloading**: Generates `nextTimeline` while playing current timeline for seamless transitions
- **Music URL Caching**: 10-minute TTL cache for GD Studio music URLs
- **Session Persistence**: Complete session state saving/resuming via SessionStore
- **Time Announcements**: Automatic hourly time announcements via TimeAnnouncementService
- **Error Recovery**: Automatic block retry logic with graceful degradation

**Constants:**
- `PRELOAD_BLOCKS_DEFAULT: 5` - Number of blocks to preload ahead
- `MUSIC_URL_TTL_MS: 10 * 60 * 1000` - URL cache validity (10 minutes)
- `HALFWAY_DELAY_MIN_MS: 5000` - Minimum delay before pre-generating next timeline

### TTS Agent (`lib/agents/tts_agent.ts`)

The TTS Agent handles all text-to-speech generation with support for Gemini and Microsoft TTS.

**Key Features:**

- **Gemini TTS Support**: 30+ voice options across Chinese, English, and Japanese
- **Microsoft TTS Fallback**: Alternative TTS provider with extensive voice library
- **Priority Queue**: Processes TTS requests by priority (1-10 scale)
- **Audio Caching**: Caches generated audio to avoid redundant API calls
- **Automatic Retries**: Up to 3 retry attempts for failed requests
- **Style Prompts**: Google-recommended structure (Audio Profile, The Scene, Director's Notes)

**Constants:**
- `MAX_CONCURRENT_TTS: 5` - Maximum parallel TTS generations
- `API_RETRY_COUNT: 3` - Number of retry attempts
- `API_RETRY_BASE_DELAY: 1000` - Base delay between retries (ms)

**Supported Voice Profiles:**

| Speaker ID | Voice Name | Gender | Style | Description |
|------------|------------|--------|-------|-------------|
| host1 | Aoede | Female | Gentle | Female host, emotional topics & late-night companionship |
| host2 | Gacrux | Male | Humorous | Male host, music recommendations & casual chat |
| guest | Puck | Neutral | Upbeat | Guest or special character |
| news | Charon | Male | Professional | News anchor |
| announcer | Kore | Female | Serious | Time announcement announcer |

---

## 🎛️ Audio System

### AudioMixer (`lib/audio_mixer.ts`)

A multi-track audio controller using Howler.js for seamless music and voice mixing.

**Features:**

- **Dual Tracks**: Independent music and voice track management
- **Volume Control**: Master, music, and voice volume with ducking
- **Fade Effects**: Configurable fade-in/fade-out durations
- **PCM to WAV Conversion**: Converts Gemini TTS PCM output (24kHz, 16-bit, mono) to playable WAV
- **State Management**: Real-time tracking of playback state for each track

**Key Constants:**

```typescript
MUSIC_DEFAULT_VOLUME: 0.9      // Default music volume
VOICE_DEFAULT_VOLUME: 1.0      // Default voice volume
MUSIC_DURING_VOICE: 0.15      // Duck music to 15% when speaking
FADE_DURATION_QUICK: 500      // Quick fade (ms)
FADE_DURATION_NORMAL: 1000    // Normal fade (ms)
FADE_DURATION_SLOW: 2000      // Slow fade (ms)
```

### GD Studio Music Service (`lib/gdmusic_service.ts`)

Integrates with GD Studio Music API for music discovery and playback.

**Features:**

- **Multiple Sources**: Netease, Kuwo, Joox (stable sources)
- **Search API**: Find songs by artist or title
- **URL Fetching**: Get direct streaming URLs with bitrate options (default 320kbps)
- **Lyrics Parsing**: Fetch and parse LRC format lyrics
- **Rate Limiting**: 50 requests per 5 minutes

**API Base:** `https://music-api.gdstudio.xyz/api.php`

---

## 🔌 API Integration

### Supported AI Services

#### OpenAI
```typescript
// Models
- GPT-4o
- GPT-3.5-turbo

// Configuration
endpoint: string  // e.g., "https://api.openai.com/v1"
apiKey: string
modelName: string
```

#### Google Gemini
```typescript
// Models
- gemini-2.5-flash-preview-tts  // TTS model

// Configuration
endpoint: string  // e.g., "https://generativelanguage.googleapis.com/v1beta"
apiKey: string
```

#### Google Vertex AI
```typescript
// Configuration
gcpProject: string
gcpLocation: string  // e.g., "us-central1"
```

### Environment Configuration

Configure API keys through the Settings Panel (stored in localStorage):

```typescript
{
  // AI Service
  apiType: "openai" | "gemini" | "vertexai",
  endpoint: string,
  apiKey: string,
  modelName: string,

  // Vertex AI (if using)
  gcpProject: string,
  gcpLocation: string,

  // TTS Provider
  ttsProvider: "gemini" | "microsoft",

  // Gemini TTS
  ttsEndpoint: string,
  ttsApiKey: string,
  ttsModel: string,
  ttsVoice: string,

  // Microsoft TTS (alternative)
  msTtsEndpoint: string,
  msTtsVoice: string,
  msTtsVolume: number,  // 0-100
  msTtsRate: number,    // Speed adjustment
  msTtsPitch: number,   // Pitch adjustment
  msTtsAuthKey: string,

  // Playback
  preloadBlockCount: number  // Default: 3
}
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0 or higher
- **npm**, **yarn**, **pnpm**, or **bun**

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd radio-nowhere
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   # or
   bun install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   
   Navigate to: **[http://localhost:3000](http://localhost:3000)**

### Configuration

1. **Open Settings Panel**
   - Click the settings icon in the RadioPlayer

2. **Configure AI Service**
   - Choose API provider (OpenAI, Gemini, or Vertex AI)
   - Enter your API key
   - Select model
   - Click "Test Connection" to verify

3. **Configure TTS**
   - Choose TTS provider (Gemini or Microsoft)
   - Select preferred voice
   - Test voice synthesis

4. **Start Listening**
   - Click "Connect" to start the radio
   - Agents will begin generating content

### Production Build

```bash
# Build
npm run build

# Start production server
npm start
```

---

## 📋 Configuration Guide

### Settings Panel Features

#### API Configuration
- 🔑 **API Key Management** - Secure key storage in localStorage
- 🌐 **Service Endpoints** - Custom API endpoint configuration
- 🔍 **Connection Testing** - Real-time connection validation
- 📊 **Model List** - Fetch and select available models

#### Voice Settings
- 🎤 **Voice Selection** - 30+ TTS voices with preview
- 😊 **Style Customization** - Voice style and mood adjustment
- ⚡ **Speed Control** - Playback rate adjustment
- 🔊 **Volume Balance** - Voice-to-music ratio tuning

#### Playback Settings
- 🎚️ **Audio Quality** - Bitrate selection (320kbps recommended)
- 📡 **Preload Configuration** - Number of blocks to preload ahead (default: 3)
- ⏯️ **Auto-play** - Auto-start on page load
- 🔄 **Loop Mode** - Continuous playback options

### Data Persistence

All data is stored in localStorage:

```typescript
// Storage Keys
{
  'radio-nowhere-settings': IApiSettings,    // User configuration
  'radio-nowhere-session': SessionData,     // Current session state
  'radio-nowhere-preferences': UserPrefs,   // User preferences
  'radio-nowhere-cache': CacheData          // Audio and music cache
}
```

**Session Recovery Flow:**
1. Detect saved session on page load
2. Load playback position and context
3. Rebuild agent states from saved timeline
4. Resume playback seamlessly

---

## 🎯 Component Details

### RadioPlayer (`components/RadioPlayer.tsx`)

The main player interface with 511 lines of code.

**Subcomponents:**

- **AgentConsole** - Real-time status monitoring for WRITER, TTS, DIRECTOR, and MIXER agents
- **SubtitleDisplay** - Dynamic scrolling subtitle display (maintains last 3 lines)
- **PlaybackControls** - Connect, pause, skip, mute, volume controls
- **Visualizer** - Audio visual animation
- **TimelineView** - Program schedule visualization with time-based navigation

**Features:**
- Session detection and recovery prompt
- Real-time agent status updates via RadioMonitor
- Interactive timeline with block-by-block navigation
- Mail queue for listener submissions
- Responsive design with cyberpunk dark theme

### SettingsPanel (`components/SettingsPanel.tsx`)

Comprehensive settings interface with 651 lines of code.

**Sections:**

1. **AI Service Configuration**
   - API provider selection
   - Endpoint and key input
   - Model selection with dropdown
   - Connection testing with status feedback

2. **TTS Configuration**
   - Provider selection (Gemini/Microsoft)
   - Voice selection with preview
   - Voice testing functionality
   - Style and emotion settings

3. **Playback Settings**
   - Preload block count (1-10)
   - Audio quality preferences
   - Auto-play and loop toggles

**Features:**
- Auto-load saved settings
- Real-time connection validation
- Voice synthesis testing
- Settings persistence with save confirmation

### AgentMonitor (`components/AgentMonitor.tsx`)

Dedicated agent monitoring interface (11KB).

**Displays:**
- Agent status (IDLE, BUSY, ERROR)
- Thought processes and reasoning
- Action logs and events
- API call tracking
- Performance metrics

---

## 📚 Type System (`lib/types/radio_types.ts`)

Complete TypeScript definitions for the radio system.

### Core Types

```typescript
// Speaker IDs
type SpeakerId = 'host1' | 'host2' | 'guest' | 'news' | 'announcer';

// Mood/Emotion types
type MoodType = 'cheerful' | 'calm' | 'excited' | 'serious' | 'warm' | 'playful' | 'melancholy' | 'mysterious';

// Voice configuration
interface VoiceProfile {
  voiceName: string;
  gender: 'male' | 'female' | 'neutral';
  style: string;
  description: string;
}

// Timeline structures
interface ShowTimeline {
  id: string;
  title?: string;
  estimatedDuration: number;
  blocks: TimelineBlock[];
  metadata?: {
    theme?: string;
    mood?: MoodType;
    userRequest?: string;
  };
}

// Block types
type TimelineBlock = TalkBlock | MusicBlock | MusicControlBlock | SilenceBlock;

// TTS request/response
interface TTSRequest {
  id: string;
  text: string;
  voiceName: string;
  stylePrompt: string;
  priority: number;
  retryCount?: number;
}

// Player state
interface PlayerState {
  isPlaying: boolean;
  currentBlockId: string | null;
  musicState: { isPlaying: boolean; currentTrack: string | null; volume: number };
  voiceState: { isPlaying: boolean; currentScriptId: string | null };
  queue: { pending: number; ready: number; generating: number };
}
```

---

## 🔧 Development Guide

### Adding New Program Types

To add a new program type, extend the Writer Agent's prompt in `lib/agents/writer_agent.ts`:

```typescript
// Add new program type in getRadioSetting()
const programTypes = [
  // ... existing types
  {
    name: 'Podcast',
    description: '深度访谈、专题讨论、故事讲述'
  }
];
```

### Adding New TTS Voices

Add voice definitions in `lib/tts_voices.ts` or `lib/microsoft_tts_voices.ts`:

```typescript
// For Gemini voices
export const ALL_VOICES = {
  // ... existing voices
  NewVoice: {
    gender: 'female',
    lang: 'zh',
    style: 'Warm',
    desc: '温暖亲切的女声'
  }
} as const;
```

### Customizing Audio Mixing

Adjust audio constants in `lib/constants.ts`:

```typescript
export const AUDIO = {
  MUSIC_DURING_VOICE: 0.15,      // Duck music to 15% when speaking
  FADE_DURATION_NORMAL: 1000,    // Normal fade duration (ms)
  // ... other constants
};
```

### Debugging

**Chrome DevTools:**
- Network Tab - Monitor API calls and timing
- Application Tab - Inspect localStorage data
- Console - View agent logs and errors

**Radio Monitor:**
- Open AgentMonitor component for real-time agent insights
- View thought processes, actions, and API calls
- Track agent states and performance

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch** - `git checkout -b feature/amazing-feature`
3. **Make your changes** following existing code style
4. **Commit with clear messages** - `git commit -m 'Add amazing feature'`
5. **Push to your branch** - `git push origin feature/amazing-feature`
6. **Open a Pull Request**

### Bug Reports

Please include:
- Bug description and steps to reproduce
- Expected vs actual behavior
- Screenshots or logs
- Environment information (browser, Node.js version)

### Feature Requests

Please describe:
- Feature goal and use case
- Implementation suggestions
- UI/UX considerations

---

## 📄 License

This project is open source under the [MIT License](./LICENSE).

---

## 🙏 Acknowledgments

**Core Technologies:**

- [Next.js](https://nextjs.org) - Full-stack React framework
- [React](https://reactjs.org) - UI library
- [TypeScript](https://www.typescriptlang.org) - Type safety
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS
- [Framer Motion](https://framer.com/motion/) - Animation library
- [Howler.js](https://howlerjs.com) - Web audio engine
- [Lucide](https://lucide.dev) - Icon library
- [Zustand](https://zustand-demo.pmnd.rs) - State management

**Special Thanks:**

- All contributors and users of RadioNowhere
- The open source community
- AI technology providers enabling this project

---

<div align="center">

**🎵 RadioNowhere - Where AI Meets Radio 🎵**

[⭐ Star this repo](https://github.com/your-repo/radio-nowhere) | [🐛 Report Bug](https://github.com/your-repo/radio-nowhere/issues) | [💡 Request Feature](https://github.com/your-repo/radio-nowhere/issues)

</div>
