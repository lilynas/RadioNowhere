# RadioNowhere 问题验证与修复报告

## 验证结论

经代码审查，原诊断报告中的三个问题**均已确认存在**。此外还发现了若干补充问题。

---

## 问题 1：台词展开状态异常 ✅ 已确认

### 问题验证

**代码位置确认**：
- [index.tsx:50](src/widgets/radio-player/index.tsx#L50)：`isSubtitleExpanded` 独立管理
- [SubtitleDisplay.tsx:195](src/widgets/radio-player/ui/SubtitleDisplay.tsx#L195)：`showCover = displayInfo.type !== 'talk' && !isExpanded`
- [SubtitleDisplay.tsx:348](src/widgets/radio-player/ui/SubtitleDisplay.tsx#L348)：展开区域仅对 `type === 'talk'` 渲染

**问题复现路径**：
1. Talk block 播放时展开台词详情
2. 自动切换到 music block
3. `displayInfo.type` 变为 `'music'`，但 `isExpanded` 仍为 `true`
4. 第195行 `showCover = 'music' !== 'talk' && !true = false`，封面不显示
5. 第348行条件 `displayInfo.type === 'talk'` 不满足，展开区域消失
6. **结果**：UI 处于"既不显示封面也不显示展开内容"的异常状态

### 修复方案

**方案 A：SubtitleDisplay 内部自动收起（推荐）**

```typescript
// SubtitleDisplay.tsx，在 useEffect (line 29) 后添加
useEffect(() => {
    // Block 类型变化时自动收起展开状态
    if (displayInfo.type !== 'talk' && isExpanded) {
        onExpandChange(false);
    }
}, [displayInfo.type, isExpanded, onExpandChange]);
```

**方案 B：父组件监听类型变化**

```typescript
// index.tsx:50 后添加
React.useEffect(() => {
    if (currentScript?.speaker === 'music' && isSubtitleExpanded) {
        setIsSubtitleExpanded(false);
    }
}, [currentScript?.speaker, isSubtitleExpanded]);
```

**推荐方案 A**，因为状态归属逻辑更清晰。

---

## 问题 2：手机窄屏输入框适配 ✅ 已确认

### 问题验证

**代码位置确认**：
- [MailboxDrawer.tsx:36](src/widgets/radio-player/ui/MailboxDrawer.tsx#L36)：`max-w-md` (448px) 固定宽度
- [MailboxDrawer.tsx:49](src/widgets/radio-player/ui/MailboxDrawer.tsx#L49)：水平 flex 布局 `flex items-center gap-2`
- [MailboxDrawer.tsx:66](src/widgets/radio-player/ui/MailboxDrawer.tsx#L66)：按钮区域 `gap-1.5 pr-1.5`

**问题分析**：
- 在 320px 屏幕上，容器被 `max-w-md` 限制，但实际可用宽度不足
- 输入框 `flex-1` 与按钮 `p-2.5` 竞争空间
- 按钮区域包含两个按钮（Send + Close），总宽度约 80px
- 图标区域 `pl-3` 约 12px
- **剩余输入区域**：320px - 80px - 12px - 间距 ≈ 210px，非常局促

### 修复方案

```tsx
// MailboxDrawer.tsx:36 修改为响应式宽度
className="mt-6 w-full max-w-xs sm:max-w-md mx-auto"

// MailboxDrawer.tsx:49 可选：为极窄屏幕添加堆叠布局
// 移动端按钮可考虑只保留 Send 按钮，通过 backdrop 点击关闭

// MailboxDrawer.tsx:73, 86 按钮尺寸响应式调整
className={`p-2 sm:p-2.5 rounded-xl ...`}
```

**完整修复**：

```tsx
// MailboxDrawer.tsx 第36行
className="mt-6 w-full max-w-[calc(100%-2rem)] sm:max-w-md mx-auto"

// 第73行 Send 按钮
className={`p-2 sm:p-2.5 rounded-xl transition-all duration-300 ${...}`}

// 第78行 Send 图标
<Send size={12} className="sm:w-3.5 sm:h-3.5" />

// 第86行 Close 按钮
className="p-2 sm:p-2.5 rounded-xl ..."
```

---

## 问题 3：节目手动切换问题 ✅ 已确认（部分）

### 3.1 切换延迟 - 已确认

**代码位置确认**：
- [playback-controller.ts:66-102](src/features/agents/lib/playback-controller.ts#L66)：`skipToBlock` 函数
- [director-agent.ts:435-452](src/features/agents/lib/director-agent.ts#L435)：Block 准备检查等待循环

**延迟来源分析**：

| 延迟点 | 代码位置 | 延迟时长 |
|--------|----------|----------|
| 音频停止 | playback-controller.ts:87 | ~50-200ms |
| Block 准备检查 | director-agent.ts:441-443 | 0-10000ms（循环等待） |
| 预加载触发 | director-agent.ts:421 | 取决于网络和 TTS |

**关键问题**：director-agent.ts:441-443 的轮询等待间隔为 500ms，最大等待 10 秒

### 3.2 TimelinePanel 标签显示 - 需要修正

**原报告诊断偏差**：
- [TimelinePanel.tsx:22](src/widgets/radio-player/ui/TimelinePanel.tsx#L22)：`case 'music': return block.search;`
- **这实际上是正确的行为**：`block.search` 是搜索关键词，在播放前确实无法获取真实歌曲名
- 真实歌曲名仅在 `executeMusicBlock` 时通过 `emitMusicScript` 发送

**真正的问题**：TimelinePanel 显示的是"即将播放"的节目，此时尚未获取真实歌曲信息，显示搜索关键词是合理的预览信息。但可以优化为在歌曲播放后更新标签。

### 3.3 批量 TTS 台词同步 - 已确认

**代码位置确认**：
- [talk-executor.ts:25-29](src/features/agents/lib/talk-executor.ts#L25)：智能选择批量/单句模式
- [talk-executor.ts:127-129](src/features/agents/lib/talk-executor.ts#L127)：批量模式立即发送所有 script 事件

**问题核心**：
```typescript
// talk-executor.ts:127-129
for (const script of block.scripts) {
    radioMonitor.emitScript(script.speaker, script.text, block.id);
}
// 然后播放单个合并的音频 (line 132)
await audioMixer.playVoice(batchAudioData);
```

**结果**：前端瞬间收到所有 ScriptEvent，但只有最后一个被显示（因为 React state 快速更新），与单个长音频播放不同步。

### 3.4 修复方案

**切换延迟优化**：

```typescript
// playback-controller.ts:66-102 优化
export function skipToBlock(state: DirectorState, index: number): void {
    // ... 现有验证代码 ...

    // 立即更新索引，减少 executeTimeline 循环等待
    if (state.context) {
        state.context.currentBlockIndex = index - 1; // -1 因为循环结束会 +1
    }

    state.skipRequested = true;
    state.targetBlockIndex = index;
    audioMixer.stopAll();

    // 触发立即预加载目标 block
    // （需要暴露 prepareBlocks 方法或通过事件）
}
```

**批量 TTS 显示修复**：

```typescript
// talk-executor.ts:127-129 替换为
// 合并发送，让前端知道这是多人对话
const combinedScripts = block.scripts.map(s => ({
    speaker: s.speaker,
    text: s.text
}));
radioMonitor.emitBatchScript(combinedScripts, block.id);

// 或者：在音频播放过程中分时发送（需要估算每句时长）
```

---

## 补充发现的问题

### 问题 4：内存泄漏风险

**代码位置**：
- [music-executor.ts:209](src/features/agents/lib/music-executor.ts#L209)：`URL.createObjectURL` 30秒后释放
- [director-agent.ts:98-101](src/features/agents/lib/director-agent.ts#L98)：`stopShow` 时清除缓存

**问题**：如果用户频繁跳转 music block，`musicDataCache` 中的 Blob 可能积累。虽然 `stopShow` 会清理，但长时间运行可能占用大量内存。

**修复建议**：
```typescript
// 在 skipToBlock 或每次 timeline 完成后清理旧的缓存
private cleanupOldCaches(): void {
    // 只保留当前 timeline 相关的缓存
    const currentBlocks = new Set(this.state.context?.timeline.blocks.map(b =>
        b.type === 'music' ? (b as MusicBlock).search : null
    ).filter(Boolean));

    for (const key of this.state.musicDataCache.keys()) {
        if (!currentBlocks.has(key)) {
            this.state.musicDataCache.delete(key);
        }
    }
}
```

### 问题 5：ScriptEvent blockId 不一致

**代码位置**：
- [playback-controller.ts:93-97](src/features/agents/lib/playback-controller.ts#L93)：跳转时发送 `targetBlock.id`
- [director-agent.ts:455](src/features/agents/lib/director-agent.ts#L455)：执行时发送 `block.id`
- [useRadioPlayer.ts:42-43](src/widgets/radio-player/hooks/useRadioPlayer.ts#L42)：同时更新 `currentScript` 和 `currentBlockId`

**潜在问题**：跳转期间可能出现短暂的 `currentBlockId` 与实际播放 block 不匹配。

### 问题 6：Timeline 历史记录处理逻辑缺陷

**代码位置**：
- [useRadioPlayer.ts:46-63](src/widgets/radio-player/hooks/useRadioPlayer.ts#L46)：新 timeline 到达时的处理

**问题**：
```typescript
const prevWithHistory = prev.map(block => ({
    ...block,
    isHistory: true  // 所有旧 block 都标记为历史
}));
```

当新 timeline 生成时，**正在播放的 block** 也会被标记为 `isHistory`，可能导致 UI 错误显示。

**修复建议**：
```typescript
const cleanupTimeline = radioMonitor.on('timeline', (data: ShowTimeline) => {
    setTimeline(prev => {
        // 只标记已完成的 blocks 为历史
        const currentIndex = prev.findIndex(b => b.id === currentBlockId);
        const prevWithHistory = prev.map((block, i) => ({
            ...block,
            isHistory: i <= currentIndex || block.isHistory
        }));
        // ...
    });
});
```

---

## 修复优先级

### P0 - 立即修复（影响核心体验）

| 问题 | 修复文件 | 修复复杂度 |
|------|----------|------------|
| 展开状态异常 | SubtitleDisplay.tsx | 低 |
| 窄屏输入框 | MailboxDrawer.tsx | 低 |

### P1 - 短期修复（影响功能正确性）

| 问题 | 修复文件 | 修复复杂度 |
|------|----------|------------|
| 批量 TTS 显示 | talk-executor.ts, monitor-service | 中 |
| 切换延迟 | playback-controller.ts, director-agent.ts | 中 |
| Timeline 历史标记 | useRadioPlayer.ts | 低 |

### P2 - 中期优化（影响性能和稳定性）

| 问题 | 修复文件 | 修复复杂度 |
|------|----------|------------|
| 内存泄漏 | director-agent.ts, music-executor.ts | 中 |
| BlockId 一致性 | playback-controller.ts | 低 |

---

## 具体修复代码

### 修复 1：展开状态自动重置

```typescript
// src/widgets/radio-player/ui/SubtitleDisplay.tsx
// 在第 101 行 useEffect 后添加：

useEffect(() => {
    // 当 block 类型不再是 talk 时，自动收起展开状态
    if (displayInfo.type !== 'talk' && isExpanded) {
        onExpandChange(false);
    }
}, [displayInfo.type, isExpanded, onExpandChange]);
```

### 修复 2：窄屏响应式适配

```typescript
// src/widgets/radio-player/ui/MailboxDrawer.tsx
// 第 36 行修改：
className="mt-6 w-full max-w-[calc(100vw-2rem)] sm:max-w-md mx-auto"

// 第 73 行修改：
className={`p-2 sm:p-2.5 rounded-xl transition-all duration-300 ${userMessage.trim()
    ? 'bg-linear-to-r from-violet-500 to-pink-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40'
    : 'bg-white/5 text-neutral-600 cursor-not-allowed'
}`}

// 第 78 行修改：
<Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" />

// 第 86 行修改：
className="p-2 sm:p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all duration-200"

// 第 88 行修改：
<X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
```

### 修复 3：批量 TTS 显示同步（架构调整）

**步骤 1：扩展 ScriptEvent 接口**
```typescript
// src/shared/services/monitor-service/index.ts
export interface ScriptEvent {
    speaker: string;
    text: string;
    blockId: string;
    musicMeta?: MusicMeta;
    isBatched?: boolean;           // 新增：标记是否为批量对话
    batchScripts?: Array<{         // 新增：批量对话的全部脚本
        speaker: string;
        text: string;
    }>;
}

// 新增方法
emitBatchScript(scripts: Array<{speaker: string; text: string}>, blockId: string): void {
    const data: ScriptEvent = {
        speaker: scripts.map(s => s.speaker).join('&'),
        text: scripts.map(s => `${s.speaker}: ${s.text}`).join('\n'),
        blockId,
        isBatched: true,
        batchScripts: scripts
    };
    this.emit('script', data);
}
```

**步骤 2：修改 talk-executor**
```typescript
// src/features/agents/lib/talk-executor.ts:127-129 替换为：
radioMonitor.emitBatchScript(
    block.scripts.map(s => ({ speaker: s.speaker, text: s.text })),
    block.id
);
```

**步骤 3：前端处理批量脚本**
```typescript
// SubtitleDisplay.tsx 中处理 batchScripts
if (currentLine.isBatched && currentLine.batchScripts) {
    // 显示多人对话格式
    setDisplayInfo({
        type: 'talk',
        speaker: currentLine.batchScripts.map(s => s.speaker).join(' & '),
        displayName: '对话中...',
        subtitle: currentLine.batchScripts.map(s =>
            `${hostNames[s.speaker] || s.speaker}: ${s.text}`
        ).join('\n')
    });
}
```

---

## 测试清单

### 展开状态测试
- [ ] Talk block 展开时切换到 music block，验证自动收起
- [ ] Music block 时点击展开区域，验证无响应
- [ ] 快速连续切换 block 类型，验证状态稳定

### 窄屏测试
- [ ] 320px 宽度设备上 MailboxDrawer 完整显示
- [ ] 375px 宽度设备上输入框可正常使用
- [ ] 触屏设备上按钮点击区域足够大

### 切换功能测试
- [ ] TimelinePanel 点击跳转响应时间 < 2s
- [ ] 跳转后台词显示与音频同步
- [ ] 批量 TTS 对话显示完整内容

---

## 结论

原诊断报告准确度较高，三个主要问题均已验证存在。通过本报告提供的修复方案，可以系统性地解决这些问题。建议按 P0 → P1 → P2 优先级依次修复，每个修复后进行对应的测试验证。
