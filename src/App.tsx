import { useState, useEffect, useRef, useMemo } from 'react';
import { Sun, Moon, Home, Download, FileText, Inbox, Trash2, Radio, Plus } from 'lucide-react';
import { useThoughtMap } from './hooks/useThoughtMap';
import { TreeNode } from './components/TreeNode';
import { AnswerPanel } from './components/AnswerPanel';
import { WebRTCDebugger } from './components/WebRTCDebugger';
import { inboxOf, viewOf, type MapUpdate } from './state/mapOps';
import { mapToMarkdown, markdownFileName } from './state/markdown';
import type { ThoughtMap } from './types';

function ThemeToggle({ isDarkMode, onToggle, size }: { isDarkMode: boolean; onToggle: () => void; size: number }) {
    return (
        <button
            onClick={onToggle}
            className="p-2 rounded-md text-stone-500 dark:text-slate-400 hover:bg-stone-200 dark:hover:bg-slate-800 transition-colors"
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDarkMode ? 'Light mode' : 'Dark mode'}
        >
            {isDarkMode ? <Sun size={size} /> : <Moon size={size} />}
        </button>
    );
}

function downloadMarkdown(map: ThoughtMap) {
    try {
        const blob = new Blob([mapToMarkdown(map)], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = markdownFileName(map.topic);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
        console.error('Failed to export markdown:', error);
        alert('Failed to export markdown. Please try again.');
    }
}

function HomeScreen({ maps, isDarkMode, actions }: {
    maps: Record<string, ThoughtMap>;
    isDarkMode: boolean;
    actions: ReturnType<typeof useThoughtMap>['actions'];
}) {
    const [topic, setTopic] = useState('');
    const mapsList = useMemo(() => Object.values(maps).sort((a, b) => b.id.localeCompare(a.id)), [maps]);

    const create = () => {
        if (topic.trim()) {
            actions.createMap(topic.trim());
            setTopic('');
        }
    };

    const remove = (map: ThoughtMap) => {
        if (window.confirm(`Delete "${map.topic}"? This cannot be undone.`)) actions.deleteMap(map.id);
    };

    return (
        <main className="min-h-screen w-full flex flex-col items-center p-4 pt-16 font-sans bg-stone-50 dark:bg-slate-900 text-stone-900 dark:text-white transition-colors duration-150">
            <div className="absolute top-4 right-4">
                <ThemeToggle isDarkMode={isDarkMode} onToggle={actions.toggleTheme} size={20} />
            </div>
            <div className="w-full max-w-lg">
                <h1 className="text-5xl font-extrabold tracking-tight text-center text-stone-900 dark:text-slate-100">Thought Map</h1>
                <p className="mt-2 mb-8 text-center text-indigo-600 dark:text-indigo-400">
                    Think a topic through one question at a time.
                </p>

                <form className="flex gap-2" onSubmit={e => { e.preventDefault(); create(); }}>
                    <input
                        type="text"
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        placeholder="Enter a new topic and press Enter..."
                        className="flex-grow min-w-0 p-3 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 border-stone-300 dark:border-slate-700 text-stone-900 dark:text-white transition-colors"
                        aria-label="Create a new thought map topic"
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={!topic.trim()}
                        className="flex items-center gap-1 px-4 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                    >
                        <Plus size={18} /> Start
                    </button>
                </form>

                {mapsList.length === 0 ? (
                    <ol className="mt-10 space-y-2 text-sm text-stone-500 dark:text-slate-400 list-decimal list-inside">
                        <li>Name a topic. It becomes the first question.</li>
                        <li>Answer it, and queue the follow-up questions it raises.</li>
                        <li>Work through the inbox. Your answers grow into a tree you can export as Markdown.</li>
                    </ol>
                ) : (
                    <div className="mt-12">
                        <h2 className="text-sm font-semibold uppercase tracking-wider mb-3 text-stone-500 dark:text-slate-500">Your maps</h2>
                        <ul className="flex flex-col gap-3" aria-label="Your thought maps">
                            {mapsList.map(map => {
                                const answered = map.nodes.filter(n => n.isAnswered).length;
                                const open = map.nodes.length - answered;
                                return (
                                    <li key={map.id} className="group relative flex items-center">
                                        <button
                                            onClick={() => actions.openMap(map.id)}
                                            className="w-full p-4 rounded-lg text-left transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-12 bg-white dark:bg-slate-800 border border-stone-200 dark:border-transparent hover:border-stone-300 dark:hover:bg-slate-700 hover:bg-stone-100"
                                            aria-label={`Open ${map.topic}: ${answered} answered, ${open} open`}
                                        >
                                            <h3 className="text-lg font-semibold text-stone-800 dark:text-slate-100">{map.topic}</h3>
                                            <p className="text-sm text-stone-500 dark:text-slate-400">
                                                {answered} answered, {open} open
                                            </p>
                                        </button>
                                        <button
                                            onClick={() => remove(map)}
                                            className="absolute right-2 p-2 rounded-md transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 text-stone-400 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-stone-200/50 dark:hover:bg-slate-900/50"
                                            title="Delete"
                                            aria-label={`Delete ${map.topic}`}
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>
        </main>
    );
}

function MapScreen({ map, isDarkMode, actions }: {
    map: ThoughtMap;
    isDarkMode: boolean;
    actions: ReturnType<typeof useThoughtMap>['actions'];
}) {
    const [peerPanelOpen, setPeerPanelOpen] = useState(false);
    const inboxRef = useRef<HTMLDivElement>(null);

    const inbox = useMemo(() => inboxOf(map.nodes), [map.nodes]);
    const roots = useMemo(() => map.nodes.filter(n => n.parentId === null && n.isAnswered), [map.nodes]);

    const select = (id: number) => actions.selectQuestion(map.id, id);
    const update = (u: MapUpdate) => actions.applyUpdate(map.id, u);

    const handleInboxKeyDown = (e: React.KeyboardEvent) => {
        if (inbox.length === 0 || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
        e.preventDefault();
        const i = inbox.findIndex(n => n.id === map.currentQuestionId);
        const next = e.key === 'ArrowUp' ? Math.max(0, i - 1) : Math.min(inbox.length - 1, i + 1);
        select(inbox[next].id);
        requestAnimationFrame(() => inboxRef.current?.focus());
    };

    return (
        <main className="h-screen w-full flex flex-col font-sans bg-stone-50 dark:bg-slate-900 text-stone-900 dark:text-white transition-colors duration-150">
            <header className="p-3 sm:p-4 border-b flex-shrink-0 flex justify-between items-center gap-2 border-stone-200 dark:border-slate-800 bg-white dark:bg-transparent">
                <div className="flex justify-start gap-1 flex-shrink-0">
                    <button
                        onClick={() => actions.openMap(null)}
                        className="p-2 rounded-md transition-colors text-stone-500 dark:text-slate-400 hover:bg-stone-200 dark:hover:bg-slate-800"
                        title="Back to maps"
                        aria-label="Back to maps"
                    >
                        <Home size={18} />
                    </button>
                    <ThemeToggle isDarkMode={isDarkMode} onToggle={actions.toggleTheme} size={18} />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-800 dark:text-slate-200 truncate">{map.topic}</h1>
                <div className="flex justify-end gap-2 flex-shrink-0">
                    <button
                        onClick={() => setPeerPanelOpen(o => !o)}
                        className={`p-2 rounded-md transition-colors text-stone-500 dark:text-slate-400 hover:bg-stone-200 dark:hover:bg-slate-800 ${peerPanelOpen ? 'bg-stone-200 dark:bg-slate-800' : ''}`}
                        title="Peer-to-peer (experimental)"
                        aria-label="Toggle peer-to-peer panel"
                        aria-expanded={peerPanelOpen}
                    >
                        <Radio size={18} />
                    </button>
                    <button
                        onClick={() => downloadMarkdown(map)}
                        className="flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-semibold bg-stone-200 dark:bg-slate-700 text-stone-700 dark:text-slate-200 hover:bg-stone-300 dark:hover:bg-slate-600"
                        aria-label="Export thought map to markdown file"
                    >
                        <Download size={16} /> <span className="hidden sm:inline">Export</span>
                    </button>
                </div>
            </header>

            <div className="flex flex-grow overflow-hidden">
                <div className="flex-grow p-4 sm:p-6 overflow-y-auto" role="region" aria-label="Thought map tree">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-stone-700 dark:text-slate-300">
                        <FileText size={18} /> Thought Map
                    </h2>
                    {roots.length > 0 ? (
                        <div role="tree" aria-label="Questions and answers">
                            {roots.map(node => (
                                <TreeNode key={node.id} node={node} allNodes={map.nodes} level={0} selectedId={map.currentQuestionId} onSelect={select} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-stone-500 dark:text-slate-500">Answer the first question below. Your answers will grow into a tree here.</p>
                    )}
                </div>

                <div
                    ref={inboxRef}
                    className="w-56 sm:w-72 lg:w-80 flex-shrink-0 border-l flex flex-col bg-stone-50/70 dark:bg-slate-900/70 border-stone-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    tabIndex={inbox.length > 0 ? 0 : -1}
                    onKeyDown={handleInboxKeyDown}
                    role="navigation"
                    aria-label={`Inbox with ${inbox.length} unanswered question${inbox.length !== 1 ? 's' : ''}`}
                    aria-describedby="inbox-instructions"
                >
                    <h2 className="text-lg font-semibold p-4 flex items-center gap-2 border-b border-stone-200 dark:border-slate-800">
                        <Inbox size={18} /> Inbox
                        {inbox.length > 0 && <span className="ml-auto text-xs font-normal px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200">{inbox.length}</span>}
                    </h2>
                    <div className="sr-only" id="inbox-instructions">
                        Use the up and down arrow keys to move between questions.
                    </div>
                    <div className="overflow-y-auto flex-grow p-2" role="list">
                        {inbox.map((node, index) => {
                            const active = map.currentQuestionId === node.id;
                            return (
                                <div
                                    key={node.id}
                                    onClick={() => select(node.id)}
                                    className={`p-2 rounded-md cursor-pointer text-sm transition-colors ${active
                                        ? 'bg-indigo-600 text-white'
                                        : 'hover:bg-stone-200 dark:hover:bg-slate-800 text-stone-700 dark:text-slate-300'}`}
                                    role="listitem"
                                    aria-label={`Question ${index + 1} of ${inbox.length}: ${node.question}`}
                                    aria-current={active ? 'true' : undefined}
                                >
                                    {node.question}
                                </div>
                            );
                        })}
                        {inbox.length === 0 && <p className="text-sm p-2 text-stone-500 dark:text-slate-500">Inbox is empty. Add follow-ups while answering to fill it.</p>}
                    </div>
                </div>
            </div>

            <AnswerPanel map={map} onUpdate={update} />

            {/* Kept mounted while hidden so an open connection survives closing the panel. */}
            <div className="fixed bottom-4 right-4 w-[min(24rem,calc(100vw-2rem))] max-h-[80vh] overflow-y-auto z-50 shadow-xl rounded-lg" hidden={!peerPanelOpen}>
                <WebRTCDebugger onClose={() => setPeerPanelOpen(false)} />
            </div>
        </main>
    );
}

function App() {
    const { maps, activeMapId, isDarkMode, actions } = useThoughtMap();
    const view = viewOf(maps, activeMapId);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    // A map deleted elsewhere (another tab, a peer) leaves a dangling id; clear it.
    useEffect(() => {
        if (activeMapId && view.screen === 'home') actions.openMap(null);
    }, [activeMapId, view.screen, actions]);

    return view.screen === 'map'
        ? <MapScreen key={view.map.id} map={view.map} isDarkMode={isDarkMode} actions={actions} />
        : <HomeScreen maps={maps} isDarkMode={isDarkMode} actions={actions} />;
}

export default App;
