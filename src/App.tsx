import { useState, useEffect, useRef, useMemo } from 'react';
import { Sun, Moon, Home, Download, FileText, Inbox, Trash2 } from 'lucide-react';
import { useThoughtMap } from './hooks/useThoughtMap';
import { TreeNode } from './components/TreeNode';
import { AnswerPanel } from './components/AnswerPanel';
import type { ThoughtMap, ThoughtNode } from './types';

function App() {
    const { maps, activeMapId, isDarkMode, currentMap, actions } = useThoughtMap();
    const [tempTopic, setTempTopic] = useState('');
    const inboxRef = useRef<HTMLDivElement>(null);

    // Issue #12 - Sync theme changes (initial state already set in main.tsx to prevent flash)
    useEffect(() => {
        if (isDarkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [isDarkMode]);

    // Issue #9 - Validate that activeMapId exists in maps
    useEffect(() => {
        if (activeMapId && !maps[activeMapId]) {
            console.error(`Active map ID "${activeMapId}" not found in maps. Returning to home.`);
            actions.openMap(null);
        }
    }, [activeMapId, maps, actions]);

    // Issue #1 - Replace any with proper types
    const mapsList = useMemo(
        () => Object.values(maps).sort((a: ThoughtMap, b: ThoughtMap) => b.id.localeCompare(a.id)),
        [maps]
    );
    
    // Issue #10 - Memoize expensive computed values for performance
    // Issue #8 - Ensure consistent state synchronization
    const inbox = useMemo(
        () => currentMap ? currentMap.nodes.filter(n => !n.isAnswered) : [],
        [currentMap]
    );
    
    const answeredNodes = useMemo(
        () => currentMap ? currentMap.nodes.filter(n => n.isAnswered) : [],
        [currentMap]
    );
    
    const rootNodes = useMemo(
        () => currentMap ? answeredNodes.filter(n => n.parentId === null) : [],
        [currentMap, answeredNodes]
    );

    const handleStartNewMap = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tempTopic.trim()) {
            actions.createMap(tempTopic.trim());
            setTempTopic('');
        }
    };

    const handleDeleteMap = (mapId: string, mapTopic: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`Delete "${mapTopic}"?`)) {
            actions.deleteMap(mapId);
        }
    };

    // Issue #5 - Proper markdown escaping, Issue #6 - Clean up created element, Issue #1 - Replace any with proper types
    const exportToMarkdown = () => {
        if (!currentMap) return;

        try {
            // Escape markdown special characters
            const escapeMarkdown = (text: string): string => {
                return text.replace(/([\\`*_{}[\]()#+\-.!|>])/g, '\\$1');
            };

            const buildMarkdownTree = (node: ThoughtNode, allNodes: ThoughtNode[], level: number): string => {
                let md = `${'  '.repeat(level)}- ${escapeMarkdown(node.question)}\n`;
                if (node.answer && node.answer.trim()) {
                    const trimmedAnswer = node.answer.trim();
                    md += `${trimmedAnswer.split('\n').map((line: string) => `${'  '.repeat(level + 1)}> ${escapeMarkdown(line)}`).join('\n')}\n`;
                }
                allNodes.filter((n: ThoughtNode) => n.parentId === node.id).forEach((child: ThoughtNode) => {
                    md += buildMarkdownTree(child, allNodes, level + 1);
                });
                return md;
            };

            let md = `# ${escapeMarkdown(currentMap.topic)}\n\n`;
            rootNodes.forEach((root: ThoughtNode) => {
                md += buildMarkdownTree(root, answeredNodes, 0);
            });
            if (inbox.length > 0) {
                md += `\n## Inbox (Unanswered)\n\n`;
                inbox.forEach((node: ThoughtNode) => {
                    md += `- ${escapeMarkdown(node.question)}\n`;
                });
            }

            const link = document.createElement('a');
            try {
                link.href = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(md);
                link.download = `${currentMap.topic.replace(/[/\\?%*:|"<>]/g, '_')}.md`;
                link.click();
            } finally {
                // Clean up the created element
                link.remove();
            }
        } catch (error) {
            console.error('Failed to export markdown:', error);
            alert('Failed to export markdown. Please try again.');
        }
    };
    
    // Issue #3 - Fix race condition, Issue #4 - Remove non-null assertions
    const handleInboxKeyDown = (e: React.KeyboardEvent) => {
        if (!currentMap || !activeMapId || inbox.length === 0) return;
        
        const currentIndex = inbox.findIndex(n => n.id === currentMap.currentQuestionId);
        let nextIndex = -1;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            nextIndex = Math.max(0, currentIndex - 1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            nextIndex = Math.min(inbox.length - 1, currentIndex + 1);
        }

        if (nextIndex !== -1 && inbox[nextIndex]) {
            const nextNode = inbox[nextIndex];
            // Update state first
            actions.updateMapData(activeMapId, currentMap.nodes, nextNode.id);
            // Use requestAnimationFrame for more reliable focus timing
            requestAnimationFrame(() => {
                inboxRef.current?.focus();
            });
        }
    };

    // --- HOME SCREEN ---
    if (!activeMapId) {
        return (
            <main className="min-h-screen w-full flex flex-col items-center p-4 pt-16 font-sans bg-stone-50 dark:bg-slate-900 text-stone-900 dark:text-white transition-colors duration-150">
                <div className="absolute top-4 right-4">
                    <button onClick={actions.toggleTheme} className="p-2 rounded-md text-stone-500 dark:text-slate-400 hover:bg-stone-200 dark:hover:bg-slate-800 transition-colors">
                        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>
                <div className="w-full max-w-lg">
                    <h1 className="text-5xl font-extrabold tracking-tight text-center text-stone-900 dark:text-slate-100">Thought Map</h1>
                    <p className="mt-2 mb-8 text-center text-indigo-600 dark:text-indigo-400">Start a new map or load an existing one.</p>
                    
                    <input
                        type="text"
                        value={tempTopic}
                        onChange={e => setTempTopic(e.target.value)}
                        onKeyDown={handleStartNewMap}
                        placeholder="Enter a new topic and press Enter..."
                        className="w-full p-3 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 border-stone-300 dark:border-slate-700 text-stone-900 dark:text-white transition-colors"
                    />
                    
                    {mapsList.length > 0 && (
                        <div className="mt-12">
                            <h2 className="text-sm font-semibold uppercase tracking-wider mb-3 text-stone-500 dark:text-slate-500">Your Existing Maps</h2>
                            <div className="flex flex-col gap-3">
                                {mapsList.map((map: ThoughtMap) => (
                                    <div key={map.id} className="group relative flex items-center">
                                        <button
                                            onClick={() => actions.openMap(map.id)}
                                            className="w-full p-4 rounded-lg text-left transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-12 bg-white dark:bg-slate-800 border border-stone-200 dark:border-transparent hover:border-stone-300 dark:hover:bg-slate-700 hover:bg-stone-100"
                                        >
                                            <h3 className="text-lg font-semibold text-stone-800 dark:text-slate-100">{map.topic}</h3>
                                            <p className="text-sm text-stone-500 dark:text-slate-400">
                                                {map.nodes.filter((n: ThoughtNode) => n.isAnswered).length} nodes answered, {map.nodes.filter((n: ThoughtNode) => !n.isAnswered).length} in inbox
                                            </p>
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteMap(map.id, map.topic, e)}
                                            className="absolute right-2 p-2 rounded-md transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 text-stone-400 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-stone-200/50 dark:hover:bg-slate-900/50"
                                            title="Delete"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        );
    }

    // --- MAIN APP SCREEN ---
    return (
        <main className="h-screen w-full flex flex-col font-sans bg-stone-50 dark:bg-slate-900 text-stone-900 dark:text-white transition-colors duration-150">
            <header className="text-center p-4 border-b flex-shrink-0 flex justify-between items-center border-stone-200 dark:border-slate-800 bg-white dark:bg-transparent">
                <div className="w-40 flex justify-start gap-2">
                    <button onClick={() => actions.openMap(null)} className="p-1 rounded-md transition-colors text-stone-500 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-700" title="Back to Maps">
                        <Home size={18} />
                    </button>
                    <button onClick={actions.toggleTheme} className="p-1 rounded-md transition-colors text-stone-500 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-700">
                        {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-stone-800 dark:text-slate-200">{currentMap?.topic}</h1>
                <div className="w-40 flex justify-end">
                    <button onClick={exportToMarkdown} className="flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-semibold bg-stone-200 dark:bg-slate-700 text-stone-700 dark:text-slate-200 hover:bg-stone-300 dark:hover:bg-slate-600">
                        <Download size={16} /> Export
                    </button>
                </div>
            </header>

            <div className="flex flex-grow overflow-hidden">
                {/* Tree View */}
                <div className="flex-grow p-6 overflow-y-auto">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-stone-700 dark:text-slate-300">
                        <FileText size={18} /> Thought Map
                    </h2>
                    {rootNodes.length > 0 && currentMap ? (
                        rootNodes.map(node => (
                            <TreeNode
                                key={node.id}
                                node={node}
                                allNodes={currentMap.nodes}
                                level={0}
                                activeMapId={activeMapId}
                                updateMapData={actions.updateMapData}
                            />
                        ))
                    ) : (
                        <p className="text-stone-500 dark:text-slate-500">Your answered thoughts will appear here.</p>
                    )}
                </div>

                {/* Inbox View */}
                <div 
                    ref = {inboxRef}
                    className="w-80 flex-shrink-0 border-l flex flex-col bg-stone-50/70 dark:bg-slate-900/70 border-stone-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    tabIndex={inbox.length > 0 ? 0 : -1}
                    onKeyDown={handleInboxKeyDown}
                    role="navigation"
                    aria-label={`Inbox with ${inbox.length} unanswered question${inbox.length !== 1 ? 's' : ''}`}
                    aria-describedby="inbox-instructions"
                >
                    <h2 className="text-lg font-semibold p-4 flex items-center gap-2 border-b border-stone-200 dark:border-slate-800">
                        <Inbox size={18} /> Inbox
                    </h2>
                    <div className="sr-only" id="inbox-instructions">
                        Use arrow up and down keys to navigate between questions. Press Tab to move to answer panel.
                    </div>
                    <div className="overflow-y-auto flex-grow p-2" role="list">
                        {inbox.map((node, index) => (
                            <div
                                key={node.id}
                                onClick={() => {
                                    if (activeMapId && currentMap) {
                                        actions.updateMapData(activeMapId, currentMap.nodes, node.id);
                                    }
                                }}
                                className={`p-2 rounded-md cursor-pointer text-sm transition-colors ${
                                    currentMap?.currentQuestionId === node.id
                                        ? 'bg-indigo-600 text-white'
                                        : 'hover:bg-stone-200 dark:hover:bg-slate-800 text-stone-700 dark:text-slate-300'
                                }`}
                                role="listitem"
                                aria-label={`Question ${index + 1} of ${inbox.length}: ${node.question}`}
                                aria-current={currentMap?.currentQuestionId === node.id ? 'true' : 'false'}
                            >
                                {node.question}
                            </div>
                        ))}
                        {inbox.length === 0 && <p className="text-sm p-2 text-stone-500 dark:text-slate-500">Inbox is empty.</p>}
                    </div>
                </div>
            </div>

            <AnswerPanel />
        </main>
    );


}

export default App;