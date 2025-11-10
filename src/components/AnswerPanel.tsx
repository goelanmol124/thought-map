import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Pencil } from 'lucide-react';
import { useThoughtMap } from '../hooks/useThoughtMap';
import type { ThoughtNode } from '../types';

export const AnswerPanel = () => {
    const { currentMap, activeMapId, actions } = useThoughtMap();
    const allNodes = currentMap?.nodes || [];
    const currentQuestionId = currentMap?.currentQuestionId ?? null;
    const node = allNodes.find(n => n.id === currentQuestionId);
    const parentNode = node ? allNodes.find(n => n.id === node.parentId) : null;

    const [currentAnswer, setCurrentAnswer] = useState('');
    const [currentNewQuestion, setCurrentNewQuestion] = useState('');
    const [stagedNewQuestions, setStagedNewQuestions] = useState<string[]>([]);
    const [isEditingQuestion, setIsEditingQuestion] = useState(false);
    const [editedQuestionText, setEditedQuestionText] = useState('');

    const answerRef = useRef<HTMLTextAreaElement>(null);
    const questionRef = useRef<HTMLInputElement>(null);
    const editQuestionRef = useRef<HTMLInputElement>(null);

    // Sync local state when the selected node changes
    useEffect(() => {
        if(node) {
            answerRef.current?.focus();
            setCurrentAnswer(node.answer || '');
            setCurrentNewQuestion('');
            setStagedNewQuestions([]);
            setIsEditingQuestion(false);
            setEditedQuestionText(node.question);
        }
    }, [node?.id]);

    useEffect(() => {
        if (isEditingQuestion && editQuestionRef.current) {
            editQuestionRef.current.focus();
        }
    }, [isEditingQuestion]);

    if (!activeMapId) return null;

    const onAnswer = () => {
        if (currentQuestionId === null) return;

        const finalStaged = currentNewQuestion.trim() ? [...stagedNewQuestions, currentNewQuestion.trim()] : stagedNewQuestions;
        const updatedNodes = allNodes.map(n => n.id === currentQuestionId ? { ...n, isAnswered: true, answer: currentAnswer } : n);
        
        const nextId = allNodes.length > 0 ? Math.max(...allNodes.map(n => n.id)) + 1 : 1;
        const newNodes = finalStaged.map((q, i) => ({
            id: nextId + i,
            question: q,
            isAnswered: false,
            parentId: currentQuestionId,
            answer: ''
        }));

        const newNodesList = [...updatedNodes, ...newNodes];

        // Calculate next node to focus
        const currentInbox = newNodesList.filter(n => !n.isAnswered);
        // Try to find the first newly added question, otherwise default to first in inbox
        const nextNode = currentInbox.find(n => n.id >= nextId) || currentInbox[0];

        actions.updateMapData(activeMapId, newNodesList, nextNode ? nextNode.id : null);
    };

    const onDeleteNode = (nodeId: number) => {
        const nodeToDelete = allNodes.find(n => n.id === nodeId);
        if (!nodeToDelete) return;

        // Recursive descendant finder
        const getDescendants = (id: number): ThoughtNode[] => {
            const children = allNodes.filter(n => n.parentId === id);
            return children.reduce((acc, child) => [...acc, child, ...getDescendants(child.id)], [] as ThoughtNode[]);
        };

        const descendants = getDescendants(nodeId);
        const confirmMsg = `Delete "${nodeToDelete.question}"?${descendants.length > 0 ? ` WARNING: Deletes ${descendants.length} sub-thought(s).` : ''}`;
        
        if (!window.confirm(confirmMsg)) return;

        const idsToDelete = new Set([nodeId, ...descendants.map(n => n.id)]);
        const newNodesList = allNodes.filter(n => !idsToDelete.has(n.id));
        
        // If we deleted the active node, jump to its parent
        const nextActiveId = (nodeId === currentQuestionId) ? nodeToDelete.parentId : currentQuestionId;
        
        actions.updateMapData(activeMapId, newNodesList, nextActiveId);
    };

    const onEditSave = () => {
        if (node && editedQuestionText.trim() !== '' && editedQuestionText !== node.question) {
            const newNodesList = allNodes.map(n => n.id === node.id ? { ...n, question: editedQuestionText.trim() } : n);
            actions.updateMapData(activeMapId, newNodesList, currentQuestionId);
        }
        setIsEditingQuestion(false);
    };

    // --- Keyboard Handlers ---
    const handleAnswerKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); questionRef.current?.focus(); }
        if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); onAnswer(); }
    };

    const handleQuestionKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); answerRef.current?.focus(); }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (currentNewQuestion.trim()) {
                setStagedNewQuestions([...stagedNewQuestions, currentNewQuestion.trim()]);
                setCurrentNewQuestion('');
            }
        }
        if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); onAnswer(); }
    };

    if (!node) {
        return (
            <div className="flex-shrink-0 p-4 border-t bg-stone-100 dark:bg-slate-800/50 border-stone-300 dark:border-slate-700 flex items-center justify-center">
                <p className="text-stone-500 dark:text-slate-500">
                    {currentQuestionId === null ? "All questions answered. Well done!" : "Select a question from the inbox to begin."}
                </p>
            </div>
        );
    }

    return (
        <div className="flex-shrink-0 p-4 border-t bg-stone-100 dark:bg-slate-800/50 border-stone-300 dark:border-slate-700 flex flex-col gap-3">
            {/* Header & Edit/Delete Controls */}
            <div>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            {node.isAnswered ? "Editing" : "Currently Answering"}
                        </p>
                        {parentNode && (
                            <p className="text-sm truncate text-stone-500 dark:text-slate-500" title={parentNode.question}>
                                Context: {parentNode.question}
                            </p>
                        )}
                    </div>
                    <button onClick={() => onDeleteNode(node.id)} className="p-1 text-stone-400 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 transition-colors" title="Delete">
                        <Trash2 size={16} />
                    </button>
                </div>

                {isEditingQuestion ? (
                    <input
                        ref={editQuestionRef}
                        type="text"
                        value={editedQuestionText}
                        onChange={(e) => setEditedQuestionText(e.target.value)}
                        onBlur={onEditSave}
                        onKeyDown={(e) => e.key === 'Enter' ? onEditSave() : e.key === 'Escape' && setIsEditingQuestion(false)}
                        className="text-xl font-bold border border-indigo-500 rounded px-1 w-full mt-1 focus:outline-none text-stone-900 dark:text-slate-100 bg-white dark:bg-slate-900"
                    />
                ) : (
                    <div 
                        className="group flex items-center gap-2 cursor-pointer rounded -ml-1 px-1 mt-1 hover:bg-stone-200/50 dark:hover:bg-slate-800/50 transition-colors"
                        onClick={() => { setEditedQuestionText(node.question); setIsEditingQuestion(true); }}
                        title="Click to edit"
                    >
                        <h3 className="text-xl font-bold break-words text-stone-900 dark:text-slate-100">{node.question}</h3>
                        <Pencil size={16} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-stone-400 dark:text-slate-500" />
                    </div>
                )}
            </div>

            {/* Inputs */}
            <textarea
                ref={answerRef}
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                onKeyDown={handleAnswerKeyDown}
                placeholder="Write your answer or thoughts here..."
                rows={3}
                className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-stone-300 dark:border-slate-600 text-stone-800 dark:text-slate-200 transition-colors"
            />
            <div className="flex gap-2">
                <input
                    ref={questionRef}
                    type="text"
                    value={currentNewQuestion}
                    onChange={(e) => setCurrentNewQuestion(e.target.value)}
                    onKeyDown={handleQuestionKeyDown}
                    placeholder="Add a follow-up..."
                    className="flex-grow p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-stone-300 dark:border-slate-600 text-stone-800 dark:text-slate-200 transition-colors"
                />
                <button onClick={onAnswer} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-semibold transition-colors whitespace-nowrap">
                    Save (Ctrl+Enter)
                </button>
            </div>
            <div className="text-xs h-4 overflow-y-auto whitespace-nowrap text-stone-500 dark:text-slate-500">
                {stagedNewQuestions.length > 0 && `Queued: ${stagedNewQuestions.join(' | ')}`}
            </div>
        </div>
    );
};