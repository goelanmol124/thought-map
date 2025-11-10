import { CornerDownRight } from 'lucide-react';
import type { ThoughtNode } from '../types';

interface Props {
    node: ThoughtNode;
    allNodes: ThoughtNode[];
    level: number;
    activeMapId: string;
    updateMapData: (mapId: string, nodes: ThoughtNode[], currentQuestionId: number | null) => void;
}

export const TreeNode = ({ node, allNodes, level, activeMapId, updateMapData }: Props) => {
    const children = allNodes.filter(n => n.parentId === node.id);

    const handleClick = () => {
        updateMapData(activeMapId, allNodes, node.id);
    };

    return (
        <div style={{ marginLeft: `${level * 1.5}rem` }}>
            <div 
                className="flex items-start p-1 cursor-pointer rounded-md text-stone-800 dark:text-slate-100 hover:bg-stone-200 dark:hover:bg-slate-800 transition-colors"
                onClick={handleClick}
                title="Click to edit"
            >
                <CornerDownRight size={16} className="text-stone-400 dark:text-slate-500 mr-2 mt-1 flex-shrink-0" />
                <span className="break-words">{node.question}</span>
            </div>
            {node.answer && (
                 <div 
                    className="pl-8 ml-[7px] my-1 cursor-pointer rounded-md border-l-2 border-stone-300 dark:border-slate-700 text-stone-600 dark:text-slate-400 hover:bg-stone-200 dark:hover:bg-slate-800 transition-colors"
                    onClick={handleClick}
                    title="Click to edit"
                >
                    <p className="italic break-words">{node.answer}</p>
                 </div>
            )}
            {children.map(child => (
                <TreeNode 
                    key={child.id} 
                    node={child} 
                    allNodes={allNodes} 
                    level={level + 1} 
                    activeMapId={activeMapId}
                    updateMapData={updateMapData}
                />
            ))}
        </div>
    );
};