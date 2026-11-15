import { CornerDownRight, CircleDashed } from 'lucide-react';
import type { ThoughtNode } from '../types';

interface Props {
    node: ThoughtNode;
    allNodes: ThoughtNode[];
    level: number;
    selectedId: number | null;
    onSelect: (id: number) => void;
}

export const TreeNode = ({ node, allNodes, level, selectedId, onSelect }: Props) => {
    const children = allNodes.filter(n => n.parentId === node.id);
    const selected = node.id === selectedId;
    const Icon = node.isAnswered ? CornerDownRight : CircleDashed;

    return (
        <div style={{ marginLeft: `${level * 1.5}rem` }} role="treeitem" aria-selected={selected}>
            <button
                type="button"
                className={`w-full text-left rounded-md p-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${selected
                    ? 'bg-indigo-100 dark:bg-indigo-900/40'
                    : 'hover:bg-stone-200 dark:hover:bg-slate-800'}`}
                onClick={() => onSelect(node.id)}
                title={node.isAnswered ? 'Click to revise or add follow-ups' : 'Unanswered: click to answer'}
            >
                <span className={`flex items-start ${node.isAnswered ? 'text-stone-800 dark:text-slate-100' : 'text-stone-500 dark:text-slate-400'}`}>
                    <Icon size={16} className="text-stone-400 dark:text-slate-500 mr-2 mt-1 flex-shrink-0" aria-hidden="true" />
                    <span className="break-words">{node.question}</span>
                    {!node.isAnswered && <span className="sr-only"> (unanswered)</span>}
                </span>
                {node.answer && (
                    <span className="block pl-8 ml-[7px] my-1 border-l-2 border-stone-300 dark:border-slate-700 text-stone-600 dark:text-slate-400">
                        <span className="italic break-words whitespace-pre-wrap">{node.answer}</span>
                    </span>
                )}
            </button>
            {children.length > 0 && (
                <div role="group">
                    {children.map(child => (
                        <TreeNode key={child.id} node={child} allNodes={allNodes} level={level + 1} selectedId={selectedId} onSelect={onSelect} />
                    ))}
                </div>
            )}
        </div>
    );
};
