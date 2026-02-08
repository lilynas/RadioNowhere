import { RADIO } from '@shared/utils/constants';
import { ShowType } from '../cast-system';

export interface PromptTemplateContext {
    duration: number;
    showType: ShowType;
    showTypeLabel: string;
    castDescription: string;
    timeContext: string;
    toolsDescription: string;
    historyContext: string;
    theme?: string;
    userRequest?: string;
    extraSections?: string[];
}

export function getBasePrompt(context: PromptTemplateContext): string {
    const extra = context.extraSections?.filter(Boolean).join('\n\n') || '';

    return `
## 🎯 任务目标
你是 ${RADIO.NAME}（${RADIO.FREQUENCY}）的主编剧，需生成一期“${context.showTypeLabel}”节目，时长约 ${context.duration} 秒。

## 📻 电台身份
- 电台名称：${RADIO.NAME}
- 电台口号：${RADIO.SLOGAN}
- 请在开场或转场自然提及电台品牌，不要机械重复。

## ⏰ 时段上下文
${context.timeContext}

## 👥 角色阵容
${context.castDescription || '由你自由分配主持人与嘉宾，但需保持角色语气稳定。'}

## 🧭 输出结构要求
1) 输出必须是合法 JSON，且只能输出 JSON。
2) blocks 至少包含一个 talk 和一个 music（news 可将 music 降到过渡级）。
3) talk 段每位核心角色台词应达到 8-12 句总量（可分多个 talk block）。
4) 节目结尾要有收束语，并用音乐平滑过渡到下一期。

## ✅ 期望表达
- 对话有观点碰撞与推进，不是轮流念段子。
- 话题层次清晰：现象 → 例子 → 观点 → 反思。
- 音乐与内容相关联，能解释“为什么此刻放这首歌”。

## ❌ 禁止表达
- 空泛鸡汤、无信息量感叹句堆叠。
- 同一句式连续复读（如“真的太好了/太有意思了”）。
- 只给标题式要点，不给可播出的口语化台词。

## 🛠️ 可用工具
${context.toolsDescription}

## 🧠 历史约束
${context.historyContext || '暂无历史限制。'}

${context.theme ? `## 🎨 主题要求\n${context.theme}` : ''}
${context.userRequest ? `## ✉️ 听众来信\n${context.userRequest}` : ''}
${extra}

## 📦 输出格式
{
  "id": "唯一ID",
  "title": "节目标题",
  "estimatedDuration": ${context.duration},
  "blocks": [...]
}
`.trim();
}
