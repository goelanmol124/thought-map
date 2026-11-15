import React, { useEffect, useReducer, useRef } from 'react';
import { Trash2, Pencil, X } from 'lucide-react';
import type { ThoughtMap, ThoughtNode } from '../types';
import { answerDraftReducer, initDraft, pendingFollowUps } from '../state/answerDraft';
import { answerNode, deleteSubtree, descendantsOf, focusOf, renameNode, type MapUpdate } from '../state/mapOps';

interface Props {
    map: ThoughtMap;
    onUpdate: (update: MapUpdate) => void;
}

const isSaveShortcut = (e: React.KeyboardEvent) => (e.ctrlKey || e.metaKey) && e.key === 'Enter';

export const AnswerPanel = ({ map, onUpdate }: Props) => {
    const focus = focusOf(map);

    if (focus.kind === 'all-answered' || focus.kind === 'nothing-selected') {
        return (
            <div className="flex-shrink-0 p-4 border-t bg-stone-100 dark:bg-slate-800/50 border-stone-300 dark:border-slate-700 flex items-center justify-center text-center">
                <p className="text-stone-500 dark:text-slate-500">
                    {focus.kind === 'all-answered'
                        ? 'Every question has an answer. Click any thought in the map to revise it or add follow-ups.'
                        : 'Pick a question from the inbox to answer it.'}
                </p>
            </div>
        );
    }

    // Keyed by node id: selecting another node starts a fresh draft.
    return <AnswerEditor key={focus.node.id} map={map} node={focus.node} revising={focus.kind === 'revising'} onUpdate={onUpdate} />;
};

interface EditorProps extends Props {
    node: ThoughtNode;
    revising: boolean;
}

const AnswerEditor = ({ map, node, revising, onUpdate }: EditorProps) => {
    const [draft, dispatch] = useReducer(answerDraftReducer, node.answer || '', initDraft);
    const parentNode = map.nodes.find(n => n.id === node.parentId);

    const answerRef = useRef<HTMLTextAreaElement>(null);
    const followUpRef = useRef<HTMLInputElement>(null);
    const editRef = useRef<HTMLInputElement>(null);
    // Escape cancels an edit; the blur that follows must not commit it.
    const skipBlurCommit = useRef(false);

    useEffect(() => {
        answerRef.current?.focus();
    }, []);

    useEffect(() => {
        if (draft.edit.mode === 'editing') editRef.current?.focus();
    }, [draft.edit.mode]);

    const save = () => {
        onUpdate(answerNode(map.nodes, node.id, draft.answer, pendingFollowUps(draft)));
    };

    const remove = () => {
        const count = descendantsOf(map.nodes, node.id).length;
        const msg = `Delete "${node.question}"?${count > 0 ? `\n\nThis also deletes ${count} follow-up question${count === 1 ? '' : 's'} under it.` : ''}`;
        if (!window.confirm(msg)) return;
        onUpdate(deleteSubtree(map.nodes, node.id, map.currentQuestionId));
    };

    const commitEdit = (text: string) => {
        if (text.trim() && text.trim() !== node.question) {
            onUpdate({ nodes: renameNode(map.nodes, node.id, text), currentQuestionId: map.currentQuestionId });
        }
        dispatch({ type: 'EDIT_FINISHED' });
    };

    const handleAnswerKeyDown = (e: React.KeyboardEvent) => {
        if (isSaveShortcut(e)) { e.preventDefault(); save(); return; }
        if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); followUpRef.current?.focus(); }
    };

    const handleFollowUpKeyDown = (e: React.KeyboardEvent) => {
        if (isSaveShortcut(e)) { e.preventDefault(); save(); return; }
        if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); answerRef.current?.focus(); }
        if (e.key === 'Enter') { e.preventDefault(); dispatch({ type: 'FOLLOW_UP_QUEUED' }); }
    };

    const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); commitEdit(e.currentTarget.value); }
        if (e.key === 'Escape') {
            e.preventDefault();
            skipBlurCommit.current = true;
            dispatch({ type: 'EDIT_FINISHED' });
        }
    };

    const handleEditBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        if (skipBlurCommit.current) { skipBlurCommit.current = false; return; }
        commitEdit(e.currentTarget.value);
    };

    return (
        <div className="flex-shrink-0 p-4 border-t bg-stone-100 dark:bg-slate-800/50 border-stone-300 dark:border-slate-700 flex flex-col gap-3">
            <div>
                <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            {revising ? 'Revising' : 'Answering'}
                        </p>
                        {parentNode && (
                            <p className="text-sm truncate text-stone-500 dark:text-slate-500" title={parentNode.question}>
                                Follow-up to: {parentNode.question}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={remove}
                        className="p-1 text-stone-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete this question"
                        aria-label="Delete this question"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>

                {draft.edit.mode === 'editing' ? (
                    <input
                        ref={editRef}
                        type="text"
                        value={draft.edit.text}
                        onChange={e => dispatch({ type: 'EDIT_CHANGED', text: e.target.value })}
                        onBlur={handleEditBlur}
                        onKeyDown={handleEditKeyDown}
                        aria-label="Edit question"
                        className="text-xl font-bold border border-indigo-500 rounded px-1 w-full mt-1 focus:outline-none text-stone-900 dark:text-slate-100 bg-white dark:bg-slate-900"
                    />
                ) : (
                    <button
                        type="button"
                        className="group flex items-center gap-2 text-left w-full rounded -ml-1 px-1 mt-1 hover:bg-stone-200/50 dark:hover:bg-slate-800/50 transition-colors"
                        onClick={() => dispatch({ type: 'EDIT_STARTED', text: node.question })}
                        title="Click to edit the question"
                    >
                        <h3 className="text-xl font-bold break-words text-stone-900 dark:text-slate-100">{node.question}</h3>
                        <Pencil size={16} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-stone-400 dark:text-slate-500" />
                    </button>
                )}
            </div>

            <textarea
                ref={answerRef}
                value={draft.answer}
                onChange={e => dispatch({ type: 'ANSWER_CHANGED', text: e.target.value })}
                onKeyDown={handleAnswerKeyDown}
                placeholder="Write your answer or thoughts here..."
                aria-label="Answer"
                rows={3}
                className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-stone-300 dark:border-slate-600 text-stone-800 dark:text-slate-200 transition-colors"
            />
            <div className="flex gap-2">
                <input
                    ref={followUpRef}
                    type="text"
                    value={draft.followUp}
                    onChange={e => dispatch({ type: 'FOLLOW_UP_CHANGED', text: e.target.value })}
                    onKeyDown={handleFollowUpKeyDown}
                    placeholder="Add a follow-up..."
                    aria-label="Add a follow-up question (Enter to queue)"
                    className="flex-grow min-w-0 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-stone-300 dark:border-slate-600 text-stone-800 dark:text-slate-200 transition-colors"
                />
                <button
                    onClick={save}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-semibold transition-colors whitespace-nowrap"
                    title="Save answer and queued follow-ups (Ctrl/Cmd+Enter)"
                >
                    Save <span className="hidden sm:inline font-normal opacity-80">(Ctrl+Enter)</span>
                </button>
            </div>
            <div className="flex flex-wrap items-center gap-1 min-h-6 text-xs text-stone-500 dark:text-slate-500">
                {draft.queued.length > 0 ? (
                    <>
                        <span>Queued:</span>
                        <ul className="flex flex-wrap gap-1" aria-label="Queued follow-ups">
                            {draft.queued.map((q, i) => (
                                <li key={`${i}-${q}`} className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200">
                                    {q}
                                    <button
                                        onClick={() => dispatch({ type: 'QUEUED_REMOVED', index: i })}
                                        className="rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 p-0.5"
                                        aria-label={`Remove queued follow-up ${q}`}
                                    >
                                        <X size={12} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </>
                ) : (
                    <span>Enter queues a follow-up. Tab switches fields. Ctrl/Cmd+Enter saves.</span>
                )}
            </div>
        </div>
    );
};
