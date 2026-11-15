import { describe, expect, it } from 'vitest';
import type { ThoughtMap, ThoughtNode } from '../types';
import { answerDraftReducer, initDraft, pendingFollowUps, type AnswerDraft, type AnswerDraftEvent } from './answerDraft';
import { answerNode, deleteSubtree, focusOf, inboxOf, renameNode, viewOf } from './mapOps';
import { escapeMarkdown, mapToMarkdown } from './markdown';
import { connectionReducer, initialConnection, type ConnectionEvent, type ConnectionState } from '../webrtc/connectionMachine';

const node = (id: number, parentId: number | null, isAnswered: boolean, question = `Q${id}`, answer = ''): ThoughtNode =>
    ({ id, parentId, isAnswered, question, answer });

const mapWith = (nodes: ThoughtNode[], currentQuestionId: number | null): ThoughtMap =>
    ({ id: 'map_1', topic: 'Topic', nodes, currentQuestionId });

const run = (events: AnswerDraftEvent[], start: AnswerDraft = initDraft('')) => events.reduce(answerDraftReducer, start);

describe('answer draft machine', () => {
    it('queues trimmed follow-ups and ignores blank ones', () => {
        const s = run([
            { type: 'FOLLOW_UP_CHANGED', text: '  Why? ' },
            { type: 'FOLLOW_UP_QUEUED' },
            { type: 'FOLLOW_UP_CHANGED', text: '   ' },
            { type: 'FOLLOW_UP_QUEUED' },
        ]);
        expect(s.queued).toEqual(['Why?']);
        expect(s.followUp).toBe('   ');
    });

    it('keeps the queue across a question edit', () => {
        const s = run([
            { type: 'FOLLOW_UP_CHANGED', text: 'Q1' },
            { type: 'FOLLOW_UP_QUEUED' },
            { type: 'EDIT_STARTED', text: 'Old' },
            { type: 'EDIT_CHANGED', text: 'New' },
            { type: 'EDIT_FINISHED' },
        ]);
        expect(s.queued).toEqual(['Q1']);
        expect(s.edit).toEqual({ mode: 'viewing' });
    });

    it('ignores EDIT_CHANGED when not editing', () => {
        const s = run([{ type: 'EDIT_CHANGED', text: 'x' }]);
        expect(s.edit).toEqual({ mode: 'viewing' });
    });

    it('removes a queued follow-up by index', () => {
        const s = run([{ type: 'QUEUED_REMOVED', index: 1 }], { ...initDraft(''), queued: ['a', 'b', 'c'] });
        expect(s.queued).toEqual(['a', 'c']);
    });

    it('includes un-queued typed text in pending follow-ups', () => {
        expect(pendingFollowUps({ ...initDraft(''), queued: ['a'], followUp: ' b ' })).toEqual(['a', 'b']);
    });
});

describe('map operations', () => {
    it('answers a node, adds children and focuses the first new one', () => {
        const nodes = [node(0, null, false, 'Topic'), node(1, 0, false)];
        const u = answerNode(nodes, 0, 'yes', ['A', 'B']);
        expect(u.nodes.find(n => n.id === 0)).toMatchObject({ isAnswered: true, answer: 'yes' });
        expect(u.nodes.filter(n => n.parentId === 0).map(n => n.question)).toEqual(['Q1', 'A', 'B']);
        expect(u.currentQuestionId).toBe(2);
    });

    it('falls back to the oldest inbox question, then to null', () => {
        const nodes = [node(0, null, true), node(3, 0, false), node(2, 0, false)];
        expect(answerNode(nodes, 3, '', []).currentQuestionId).toBe(2);
        expect(answerNode([node(0, null, false)], 0, '', []).currentQuestionId).toBeNull();
    });

    it('deletes a subtree and moves selection to the parent', () => {
        const nodes = [node(0, null, true), node(1, 0, true), node(2, 1, false), node(3, 2, false), node(4, 0, false)];
        const u = deleteSubtree(nodes, 1, 3);
        expect(u.nodes.map(n => n.id)).toEqual([0, 4]);
        expect(u.currentQuestionId).toBe(0);
        expect(deleteSubtree(nodes, 1, 4).currentQuestionId).toBe(4);
    });

    it('does not rename to blank text', () => {
        const nodes = [node(0, null, false, 'Keep')];
        expect(renameNode(nodes, 0, '  ')).toBe(nodes);
        expect(renameNode(nodes, 0, ' New ')[0].question).toBe('New');
    });

    it('sorts the inbox by id', () => {
        expect(inboxOf([node(5, 0, false), node(2, 0, false), node(1, 0, true)]).map(n => n.id)).toEqual([2, 5]);
    });

    it('derives focus states', () => {
        expect(focusOf(mapWith([node(0, null, false)], 0)).kind).toBe('answering');
        expect(focusOf(mapWith([node(0, null, true)], 0)).kind).toBe('revising');
        expect(focusOf(mapWith([node(0, null, true)], null)).kind).toBe('all-answered');
        expect(focusOf(mapWith([node(0, null, true), node(1, 0, false)], null)).kind).toBe('nothing-selected');
        expect(focusOf(mapWith([node(0, null, true), node(1, 0, false)], 99)).kind).toBe('nothing-selected');
    });

    it('resolves a dangling active map id to home', () => {
        const m = mapWith([], null);
        expect(viewOf({ map_1: m }, 'map_1')).toEqual({ screen: 'map', map: m });
        expect(viewOf({ map_1: m }, 'gone')).toEqual({ screen: 'home' });
        expect(viewOf({}, null)).toEqual({ screen: 'home' });
    });
});

describe('markdown export', () => {
    it('leaves ordinary punctuation alone but escapes structure', () => {
        expect(escapeMarkdown('Costs (approx.) - fine.')).toBe('Costs (approx.) - fine.');
        expect(escapeMarkdown('# not a heading')).toBe('\\# not a heading');
        expect(escapeMarkdown('a *b* [c]')).toBe('a \\*b\\* \\[c\\]');
    });

    it('renders the answered tree and the inbox', () => {
        const md = mapToMarkdown(mapWith([
            node(0, null, true, 'Topic', 'Root answer'),
            node(1, 0, true, 'Child', 'line 1\nline 2'),
            node(2, 0, false, 'Open question'),
        ], 2));
        expect(md).toBe([
            '# Topic',
            '',
            '- Topic',
            '  > Root answer',
            '  - Child',
            '    > line 1',
            '    > line 2',
            '',
            '## Inbox (unanswered)',
            '',
            '- Open question',
            '',
        ].join('\n'));
    });
});

describe('connection machine', () => {
    const runConn = (events: ConnectionEvent[], start: ConnectionState = initialConnection) => events.reduce(connectionReducer, start);

    it('walks the manual offer flow', () => {
        expect(runConn([{ type: 'GATHER' }])).toEqual({ status: 'gathering' });
        expect(runConn([{ type: 'GATHER' }, { type: 'SIGNAL_READY', signal: 'abc' }])).toEqual({ status: 'awaiting-peer', outgoing: 'abc' });
        expect(runConn([{ type: 'GATHER' }, { type: 'SIGNAL_READY', signal: 'abc' }, { type: 'PEER_CONNECTED' }])).toEqual({ status: 'connected' });
    });

    it('does not step back from connected on late signals', () => {
        const connected: ConnectionState = { status: 'connected' };
        expect(runConn([{ type: 'SIGNAL_READY', signal: 'x' }, { type: 'GATHER' }, { type: 'CONNECT', target: 'p' }], connected)).toBe(connected);
    });

    it('ignores disconnects before anything started, and resets', () => {
        expect(runConn([{ type: 'PEER_DISCONNECTED' }])).toEqual({ status: 'idle' });
        expect(runConn([{ type: 'CONNECT', target: 'p' }, { type: 'PEER_DISCONNECTED' }])).toEqual({ status: 'disconnected' });
        expect(runConn([{ type: 'FAILED', error: 'x' }, { type: 'RESET' }])).toEqual({ status: 'idle' });
    });
});
