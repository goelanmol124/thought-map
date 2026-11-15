/**
 * Pure operations on a map's node list, plus the derived "where is the user"
 * states. Components call these and write the result to the Yjs store;
 * keeping them pure makes the rules testable.
 */
import type { ThoughtMap, ThoughtNode } from '../types';

export const inboxOf = (nodes: ThoughtNode[]) =>
    nodes.filter(n => !n.isAnswered).sort((a, b) => a.id - b.id);

export const answeredOf = (nodes: ThoughtNode[]) => nodes.filter(n => n.isAnswered);

export const rootsOf = (nodes: ThoughtNode[]) => answeredOf(nodes).filter(n => n.parentId === null);

export function descendantsOf(nodes: ThoughtNode[], id: number): ThoughtNode[] {
    const out: ThoughtNode[] = [];
    const stack = [id];
    while (stack.length) {
        const parent = stack.pop()!;
        for (const n of nodes) {
            if (n.parentId === parent) {
                out.push(n);
                stack.push(n.id);
            }
        }
    }
    return out;
}

export interface MapUpdate {
    nodes: ThoughtNode[];
    currentQuestionId: number | null;
}

/**
 * Mark `nodeId` answered, add `followUps` as its children, and pick what to
 * work on next: the first new follow-up, else the oldest inbox question.
 */
export function answerNode(nodes: ThoughtNode[], nodeId: number, answer: string, followUps: string[]): MapUpdate {
    const updated = nodes.map(n => (n.id === nodeId ? { ...n, isAnswered: true, answer } : n));
    const nextId = nodes.length > 0 ? Math.max(...nodes.map(n => n.id)) + 1 : 1;
    const created: ThoughtNode[] = followUps.map((question, i) => ({
        id: nextId + i,
        question,
        answer: '',
        parentId: nodeId,
        isAnswered: false,
    }));
    const all = [...updated, ...created];
    const inbox = inboxOf(all);
    const next = inbox.find(n => n.id >= nextId) ?? inbox[0];
    return { nodes: all, currentQuestionId: next ? next.id : null };
}

/** Remove a node and its whole subtree. If the selection was inside it, select the parent. */
export function deleteSubtree(nodes: ThoughtNode[], nodeId: number, currentQuestionId: number | null): MapUpdate {
    const target = nodes.find(n => n.id === nodeId);
    if (!target) return { nodes, currentQuestionId };
    const removed = new Set([nodeId, ...descendantsOf(nodes, nodeId).map(n => n.id)]);
    const remaining = nodes.filter(n => !removed.has(n.id));
    const selectionGone = currentQuestionId !== null && removed.has(currentQuestionId);
    return { nodes: remaining, currentQuestionId: selectionGone ? target.parentId : currentQuestionId };
}

export function renameNode(nodes: ThoughtNode[], nodeId: number, question: string): ThoughtNode[] {
    const q = question.trim();
    if (!q) return nodes;
    return nodes.map(n => (n.id === nodeId ? { ...n, question: q } : n));
}

/**
 * What the workspace is focused on. Previously implicit in
 * `currentQuestionId` being null, or pointing at an answered / unanswered node.
 */
export type Focus =
    | { kind: 'answering'; node: ThoughtNode }
    | { kind: 'revising'; node: ThoughtNode }
    | { kind: 'all-answered' }
    | { kind: 'nothing-selected' };

export function focusOf(map: ThoughtMap): Focus {
    const node = map.currentQuestionId === null ? undefined : map.nodes.find(n => n.id === map.currentQuestionId);
    if (node) return node.isAnswered ? { kind: 'revising', node } : { kind: 'answering', node };
    return inboxOf(map.nodes).length === 0 ? { kind: 'all-answered' } : { kind: 'nothing-selected' };
}

/** Top-level screen. A dangling activeMapId (map deleted elsewhere) resolves to home. */
export type AppView = { screen: 'home' } | { screen: 'map'; map: ThoughtMap };

export function viewOf(maps: Record<string, ThoughtMap>, activeMapId: string | null): AppView {
    const map = activeMapId ? maps[activeMapId] : undefined;
    return map ? { screen: 'map', map } : { screen: 'home' };
}
