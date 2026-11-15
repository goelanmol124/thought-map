import type { ThoughtMap, ThoughtNode } from '../types';
import { answeredOf, inboxOf, rootsOf } from './mapOps';

/**
 * Escape only what would change the Markdown structure: inline markup
 * characters and block markers at the start of a line. Ordinary punctuation
 * (periods, hyphens, parentheses) is left alone so the export stays readable.
 */
export function escapeMarkdown(text: string): string {
    return text
        .replace(/([\\`*_[\]<>|])/g, '\\$1')
        .replace(/^(\s*)([#>+-]|\d+\.)(?=\s)/gm, '$1\\$2');
}

function renderNode(node: ThoughtNode, answered: ThoughtNode[], level: number): string {
    const indent = '  '.repeat(level);
    let md = `${indent}- ${escapeMarkdown(node.question)}\n`;
    const answer = node.answer?.trim();
    if (answer) {
        md += answer.split('\n').map(line => `${indent}  > ${escapeMarkdown(line)}`).join('\n') + '\n';
    }
    for (const child of answered.filter(n => n.parentId === node.id)) {
        md += renderNode(child, answered, level + 1);
    }
    return md;
}

export function mapToMarkdown(map: ThoughtMap): string {
    const answered = answeredOf(map.nodes);
    let md = `# ${escapeMarkdown(map.topic)}\n\n`;
    for (const root of rootsOf(map.nodes)) md += renderNode(root, answered, 0);
    const inbox = inboxOf(map.nodes);
    if (inbox.length > 0) {
        md += `\n## Inbox (unanswered)\n\n`;
        for (const n of inbox) md += `- ${escapeMarkdown(n.question)}\n`;
    }
    return md;
}

export const markdownFileName = (topic: string) => `${topic.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'thought-map'}.md`;
