import type {
    DecisionSnapshot,
    Evidence,
    EvidencePolarity,
    Inquiry,
    InquiryFile,
    InquiryQuestion,
    QuestionPriority,
    RelationshipType,
    Stance,
} from './types';
import {
    EVIDENCE_POLARITIES,
    INQUIRY_STATUSES,
    QUESTION_PRIORITIES,
    QUESTION_STATES,
    RELATIONSHIP_TYPES,
    STANCES,
} from './types';

/**
 * Soft cap on imported inquiry JSON (characters after read, and File.size bytes before read).
 * Used by the Dashboard import gate and parseInquiryFile.
 */
export const MAX_INQUIRY_JSON_CHARS = 2_000_000;
const MAX_QUESTIONS = 5_000;
const MAX_EVIDENCE_PER_QUESTION = 500;
const MAX_SNAPSHOTS = 500;
const MAX_STRING_CHARS = 50_000;

const priorityWeight: Record<QuestionPriority, number> = {
    blocking: 0,
    high: 1,
    normal: 2,
};

const INVALID_INQUIRY_FILE = 'This is not a valid IdeaMap inquiry file.';

const isOneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
    typeof value === 'string' && (allowed as readonly string[]).includes(value);

const compareFifo = (a: InquiryQuestion, b: InquiryQuestion): number =>
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

const compareOpenPriority = (a: InquiryQuestion, b: InquiryQuestion): number =>
    (priorityWeight[a.priority] ?? 99) - (priorityWeight[b.priority] ?? 99)
    || compareFifo(a, b);

export const createId = (prefix: string): string => {
    const value = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}_${value}`;
};

const timestamp = (): string => new Date().toISOString();

export const createQuestion = (
    text: string,
    parentId: string | null,
    relationship: RelationshipType = 'breaks-into',
    priority: QuestionPriority = 'normal',
): InquiryQuestion => {
    const createdAt = timestamp();
    return {
        id: createId('question'),
        text: text.trim(),
        answer: '',
        parentId,
        relationship,
        state: 'open',
        priority,
        stance: 'unknown',
        evidence: [],
        createdAt,
        updatedAt: createdAt,
        resolvedAt: null,
    };
};

export const createInquiry = (rootQuestion: string, desiredOutcome = ''): Inquiry => {
    const text = rootQuestion.trim();
    if (!text) {
        throw new Error('Inquiry root question cannot be empty.');
    }

    const createdAt = timestamp();
    const root = createQuestion(text, null, 'breaks-into', 'blocking');

    return {
        schemaVersion: 1,
        id: createId('inquiry'),
        title: text,
        desiredOutcome: desiredOutcome.trim(),
        status: 'exploring',
        rootQuestionId: root.id,
        // Focus is tab-local UI state. This field remains null for v1 file compatibility.
        currentQuestionId: null,
        questions: [root],
        synthesis: '',
        snapshots: [],
        createdAt,
        updatedAt: createdAt,
        reviewAt: null,
        reviewTrigger: '',
    };
};

export const getQuestion = (inquiry: Inquiry, questionId: string | null): InquiryQuestion | null =>
    questionId ? inquiry.questions.find((question) => question.id === questionId) ?? null : null;

export const getRootQuestion = (inquiry: Inquiry): InquiryQuestion => {
    const root = inquiry.questions.find((question) => question.id === inquiry.rootQuestionId);
    if (!root) {
        throw new Error('Inquiry is missing its root question.');
    }
    return root;
};

export const getOpenQuestions = (inquiry: Inquiry): InquiryQuestion[] =>
    inquiry.questions
        .filter((question) => question.state === 'open' || question.state === 'active')
        .slice()
        .sort(compareOpenPriority);

export const getResolvedQuestions = (inquiry: Inquiry): InquiryQuestion[] =>
    inquiry.questions.filter((question) => question.state === 'resolved');

/**
 * Canonical progress definition used by every unknown-count and readiness surface.
 * A resolved root is resolved work, never an open unknown.
 */
export const getInquiryProgress = (inquiry: Inquiry) => {
    const openQuestions = getOpenQuestions(inquiry);
    const resolvedQuestions = getResolvedQuestions(inquiry);
    const blockingQuestions = openQuestions.filter((question) => question.priority === 'blocking');
    return {
        openQuestions,
        resolvedQuestions,
        blockingQuestions,
        openCount: openQuestions.length,
        resolvedCount: resolvedQuestions.length,
    };
};

export const getChildQuestions = (inquiry: Inquiry, parentId: string): InquiryQuestion[] =>
    inquiry.questions
        .filter((question) => question.parentId === parentId)
        .slice()
        .sort(compareFifo);

export const getNextQuestion = (inquiry: Inquiry): InquiryQuestion | null =>
    getOpenQuestions(inquiry)[0] ?? null;

export const getDecisionReadiness = (inquiry: Inquiry) => {
    const root = getRootQuestion(inquiry);
    const { blockingQuestions } = getInquiryProgress(inquiry);
    const missing: string[] = [];
    if (!root.answer.trim()) missing.push('Write the current call');
    if (!inquiry.synthesis.trim()) missing.push('Write the decision memo');
    if (blockingQuestions.length > 0) {
        missing.push(`Resolve ${blockingQuestions.length} blocking unknown${blockingQuestions.length === 1 ? '' : 's'}`);
    }
    return {
        ready: missing.length === 0,
        missing,
        blockingQuestions,
    };
};

export const getKeyEvidence = (inquiry: Inquiry) => {
    const evidence = inquiry.questions
        .flatMap((question) => question.evidence.map((item) => ({ ...item, question: question.text })))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    return {
        supports: evidence.find((item) => item.polarity === 'supports') ?? null,
        weakens: evidence.find((item) => item.polarity === 'weakens') ?? null,
    };
};

/**
 * Single safe evidence URL sanitizer/validator for creation, import, UI, and Markdown.
 * Accepts only http(s) URLs with no username/password credentials.
 */
export const sanitizeEvidenceUrl = (url: string): string | null => {
    const trimmed = url.trim();
    if (!trimmed) return null;
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        // Disallow credentials (also blocks phishing forms like https://trusted@evil.example).
        if (parsed.username || parsed.password) return null;
        // Prefer origin without a lone trailing slash for bare hosts (stable for round-trips).
        if (parsed.pathname === '/' && !parsed.search && !parsed.hash) {
            return `${parsed.protocol}//${parsed.host}`;
        }
        return parsed.href;
    } catch {
        return null;
    }
};

/** Hostname from a sanitized evidence URL, or null when the URL is unsafe/empty. */
export const getEvidenceUrlHostname = (url: string): string | null => {
    const safe = sanitizeEvidenceUrl(url);
    if (!safe) return null;
    try {
        return new URL(safe).hostname;
    } catch {
        return null;
    }
};

export const createEvidence = (
    note: string,
    polarity: EvidencePolarity,
    source = '',
    url = '',
): Evidence => {
    const trimmedUrl = url.trim();
    let safeUrl = '';
    if (trimmedUrl) {
        const sanitized = sanitizeEvidenceUrl(trimmedUrl);
        if (!sanitized) {
            throw new Error(
                'Evidence URL must be a valid http(s) link without credentials.',
            );
        }
        safeUrl = sanitized;
    }

    return {
        id: createId('evidence'),
        note: note.trim(),
        source: source.trim(),
        url: safeUrl,
        polarity,
        createdAt: timestamp(),
    };
};

export const createSnapshot = (inquiry: Inquiry): DecisionSnapshot => {
    const root = getRootQuestion(inquiry);
    return {
        id: createId('snapshot'),
        createdAt: timestamp(),
        answer: root.answer,
        stance: root.stance,
        synthesis: inquiry.synthesis,
        openRisks: getOpenQuestions(inquiry).map((question) => question.text),
    };
};

/** Escape plain text for Markdown inline contexts. */
const markdownText = (value: string): string =>
    value
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/([*_#[\]<>])/g, '\\$1')
        .replace(/!/g, '\\!');

/** Escape each line of block content without collapsing whitespace significance. */
const markdownBlock = (value: string): string =>
    value.split('\n').map((line) => markdownText(line)).join('\n');

const formatStableDate = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toISOString().slice(0, 10);
};

const formatStableDateTime = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
};

const markdownLinkUrl = (href: string): string =>
    href.replace(/[\\()]/g, (ch) => encodeURIComponent(ch));

const renderQuestion = (
    inquiry: Inquiry,
    question: InquiryQuestion,
    depth: number,
    visited: Set<string>,
): string => {
    const indent = '  '.repeat(depth);
    if (visited.has(question.id)) {
        return `${indent}- _[cyclic reference omitted]_`;
    }
    visited.add(question.id);

    const stance = question.stance === 'unknown' ? '' : ` · ${question.stance}`;
    const lines = [`${indent}- **${markdownText(question.text)}**${stance}`];

    if (question.answer.trim()) {
        question.answer.trim().split('\n').forEach((line) => {
            lines.push(`${indent}  > ${markdownText(line)}`);
        });
    }

    question.evidence.forEach((evidence) => {
        const safeUrl = sanitizeEvidenceUrl(evidence.url);
        const sourceLabel = markdownText(evidence.source || evidence.url || '');
        const source = safeUrl
            ? `[${sourceLabel || markdownText(safeUrl)}](${markdownLinkUrl(safeUrl)})`
            : sourceLabel;
        lines.push(
            `${indent}  - _${evidence.polarity}:_ ${markdownText(evidence.note)}`
            + `${source ? ` — ${source}` : ''}`,
        );
    });

    getChildQuestions(inquiry, question.id).forEach((child) => {
        lines.push(renderQuestion(inquiry, child, depth + 1, visited));
    });

    return lines.join('\n');
};

export const buildDecisionMarkdown = (inquiry: Inquiry): string => {
    const root = getRootQuestion(inquiry);
    const openQuestions = getOpenQuestions(inquiry);
    const keyEvidence = getKeyEvidence(inquiry);
    const snapshot = inquiry.snapshots.at(-1);
    const lines = [
        `# ${markdownText(inquiry.title)}`,
        '',
        `**Status:** ${inquiry.status}  `,
        `**Stance:** ${root.stance}  `,
        `**Updated:** ${formatStableDate(inquiry.updatedAt)}`,
    ];

    if (inquiry.desiredOutcome.trim()) {
        lines.push('', '## Intended outcome', '', markdownBlock(inquiry.desiredOutcome.trim()));
    }

    lines.push(
        '',
        '## Current answer',
        '',
        root.answer.trim() ? markdownBlock(root.answer.trim()) : '_No provisional answer yet._',
    );

    if (inquiry.synthesis.trim()) {
        lines.push('', '## Decision memo', '', markdownBlock(inquiry.synthesis.trim()));
    }

    lines.push('', '## Evidence basis', '');
    (['supports', 'weakens'] as const).forEach((polarity) => {
        const evidence = keyEvidence[polarity];
        if (!evidence) {
            lines.push(`- **${polarity === 'supports' ? 'Supports' : 'Weakens'}:** _None recorded._`);
            return;
        }
        const safeUrl = sanitizeEvidenceUrl(evidence.url);
        const sourceLabel = markdownText(evidence.source || evidence.url || '');
        const source = safeUrl
            ? `[${sourceLabel || markdownText(safeUrl)}](${markdownLinkUrl(safeUrl)})`
            : sourceLabel;
        lines.push(
            `- **${polarity === 'supports' ? 'Supports' : 'Weakens'}:** ${markdownText(evidence.note)}`
            + `${source ? ` — ${source}` : ''}`,
        );
    });

    if (inquiry.reviewAt || inquiry.reviewTrigger?.trim()) {
        lines.push('', '## Review', '');
        if (inquiry.reviewAt) lines.push(`- **Date:** ${markdownText(inquiry.reviewAt)}`);
        if (inquiry.reviewTrigger?.trim()) {
            lines.push(`- **Trigger:** ${markdownText(inquiry.reviewTrigger.trim())}`);
        }
    }

    lines.push('', '## Reasoning', '', renderQuestion(inquiry, root, 0, new Set()));

    if (openQuestions.length > 0) {
        lines.push('', '## Open blockers and risks', '');
        openQuestions.forEach((question) => {
            lines.push(`- [ ] ${markdownText(question.text)} _(${question.priority})_`);
        });
    }

    if (snapshot) {
        lines.push('', '---', `Last recorded decision: ${formatStableDateTime(snapshot.createdAt)}`);
    }

    return `${lines.join('\n')}\n`;
};

export const serializeInquiry = (inquiry: Inquiry): string => {
    const file: InquiryFile = {
        format: 'ideamap-inquiry',
        version: 1,
        exportedAt: timestamp(),
        inquiry,
    };
    return JSON.stringify(file, null, 2);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const assertString = (value: unknown, field: string, allowEmpty = true): string => {
    if (typeof value !== 'string') {
        throw new Error(`${INVALID_INQUIRY_FILE} Missing or invalid field: ${field}.`);
    }
    if (value.length > MAX_STRING_CHARS) {
        throw new Error(`${INVALID_INQUIRY_FILE} Field too large: ${field}.`);
    }
    if (!allowEmpty && !value.trim()) {
        throw new Error(`${INVALID_INQUIRY_FILE} Empty field: ${field}.`);
    }
    return value;
};

const assertNullableString = (value: unknown, field: string): string | null => {
    if (value === null) return null;
    return assertString(value, field);
};

const parseEvidence = (value: unknown, path: string): Evidence => {
    if (!isRecord(value)) {
        throw new Error(`${INVALID_INQUIRY_FILE} Invalid evidence at ${path}.`);
    }
    if (!isOneOf(value.polarity, EVIDENCE_POLARITIES)) {
        throw new Error(`${INVALID_INQUIRY_FILE} Invalid evidence polarity at ${path}.`);
    }

    const rawUrl = assertString(value.url, `${path}.url`);
    const trimmedUrl = rawUrl.trim();
    let url = '';
    if (trimmedUrl) {
        const sanitized = sanitizeEvidenceUrl(trimmedUrl);
        if (!sanitized) {
            throw new Error(
                `${INVALID_INQUIRY_FILE} Invalid evidence URL at ${path} `
                + '(http(s) only, no credentials).',
            );
        }
        url = sanitized;
    }

    return {
        id: assertString(value.id, `${path}.id`, false),
        note: assertString(value.note, `${path}.note`),
        source: assertString(value.source, `${path}.source`),
        url,
        polarity: value.polarity,
        createdAt: assertString(value.createdAt, `${path}.createdAt`, false),
    };
};

const parseQuestion = (value: unknown, path: string): InquiryQuestion => {
    if (!isRecord(value)) {
        throw new Error(`${INVALID_INQUIRY_FILE} Invalid question at ${path}.`);
    }
    if (!isOneOf(value.relationship, RELATIONSHIP_TYPES)) {
        throw new Error(`${INVALID_INQUIRY_FILE} Invalid relationship at ${path}.`);
    }
    if (!isOneOf(value.state, QUESTION_STATES)) {
        throw new Error(`${INVALID_INQUIRY_FILE} Invalid question state at ${path}.`);
    }
    if (!isOneOf(value.priority, QUESTION_PRIORITIES)) {
        throw new Error(`${INVALID_INQUIRY_FILE} Invalid question priority at ${path}.`);
    }
    if (!isOneOf(value.stance, STANCES)) {
        throw new Error(`${INVALID_INQUIRY_FILE} Invalid stance at ${path}.`);
    }
    if (!Array.isArray(value.evidence)) {
        throw new Error(`${INVALID_INQUIRY_FILE} Invalid evidence list at ${path}.`);
    }
    if (value.evidence.length > MAX_EVIDENCE_PER_QUESTION) {
        throw new Error(`${INVALID_INQUIRY_FILE} Too many evidence items at ${path}.`);
    }

    const evidence = value.evidence.map((item, index) =>
        parseEvidence(item, `${path}.evidence[${index}]`),
    );

    return {
        id: assertString(value.id, `${path}.id`, false),
        text: assertString(value.text, `${path}.text`),
        answer: assertString(value.answer, `${path}.answer`),
        parentId: assertNullableString(value.parentId, `${path}.parentId`),
        relationship: value.relationship,
        state: value.state,
        priority: value.priority,
        stance: value.stance,
        evidence,
        createdAt: assertString(value.createdAt, `${path}.createdAt`, false),
        updatedAt: assertString(value.updatedAt, `${path}.updatedAt`, false),
        resolvedAt: assertNullableString(value.resolvedAt, `${path}.resolvedAt`),
    };
};

const parseSnapshot = (value: unknown, path: string): DecisionSnapshot => {
    if (!isRecord(value)) {
        throw new Error(`${INVALID_INQUIRY_FILE} Invalid snapshot at ${path}.`);
    }
    if (!isOneOf(value.stance, STANCES)) {
        throw new Error(`${INVALID_INQUIRY_FILE} Invalid snapshot stance at ${path}.`);
    }
    if (!Array.isArray(value.openRisks) || !value.openRisks.every((risk) => typeof risk === 'string')) {
        throw new Error(`${INVALID_INQUIRY_FILE} Invalid openRisks at ${path}.`);
    }
    if (value.openRisks.length > MAX_QUESTIONS) {
        throw new Error(`${INVALID_INQUIRY_FILE} Too many openRisks at ${path}.`);
    }
    for (let i = 0; i < value.openRisks.length; i += 1) {
        assertString(value.openRisks[i], `${path}.openRisks[${i}]`);
    }

    return {
        id: assertString(value.id, `${path}.id`, false),
        createdAt: assertString(value.createdAt, `${path}.createdAt`, false),
        answer: assertString(value.answer, `${path}.answer`),
        stance: value.stance,
        synthesis: assertString(value.synthesis, `${path}.synthesis`),
        openRisks: value.openRisks.map((risk) => risk),
    };
};

/**
 * Validates and normalizes an inquiry object.
 * Unknown properties are dropped; every known field is preserved after type checks.
 * Partial/invalid nested records are rejected rather than silently omitted.
 */
const parseInquiry = (value: unknown): Inquiry => {
    if (!isRecord(value)) {
        throw new Error(INVALID_INQUIRY_FILE);
    }
    if (value.schemaVersion !== 1) {
        throw new Error(INVALID_INQUIRY_FILE);
    }
    if (!isOneOf(value.status, INQUIRY_STATUSES)) {
        throw new Error(`${INVALID_INQUIRY_FILE} Invalid inquiry status.`);
    }
    if (!Array.isArray(value.questions) || value.questions.length === 0) {
        throw new Error(`${INVALID_INQUIRY_FILE} Inquiry must include at least one question.`);
    }
    if (value.questions.length > MAX_QUESTIONS) {
        throw new Error(`${INVALID_INQUIRY_FILE} Too many questions.`);
    }
    if (!Array.isArray(value.snapshots)) {
        throw new Error(`${INVALID_INQUIRY_FILE} Invalid snapshots list.`);
    }
    if (value.snapshots.length > MAX_SNAPSHOTS) {
        throw new Error(`${INVALID_INQUIRY_FILE} Too many snapshots.`);
    }

    const questions = value.questions.map((question, index) =>
        parseQuestion(question, `questions[${index}]`),
    );
    const snapshots = value.snapshots.map((snapshot, index) =>
        parseSnapshot(snapshot, `snapshots[${index}]`),
    );

    const rootQuestionId = assertString(value.rootQuestionId, 'rootQuestionId', false);
    const currentQuestionId = assertNullableString(value.currentQuestionId, 'currentQuestionId');

    const byId = new Map<string, InquiryQuestion>();
    for (const question of questions) {
        if (byId.has(question.id)) {
            throw new Error(`${INVALID_INQUIRY_FILE} Duplicate question id: ${question.id}.`);
        }
        byId.set(question.id, question);
    }

    const root = byId.get(rootQuestionId);
    if (!root) {
        throw new Error(`${INVALID_INQUIRY_FILE} rootQuestionId does not match any question.`);
    }

    if (currentQuestionId !== null && !byId.has(currentQuestionId)) {
        throw new Error(`${INVALID_INQUIRY_FILE} currentQuestionId does not match any question.`);
    }

    for (const question of questions) {
        if (question.parentId === null) {
            if (question.id !== rootQuestionId) {
                throw new Error(
                    `${INVALID_INQUIRY_FILE} Only the root question may have a null parentId.`,
                );
            }
            continue;
        }
        if (question.parentId === question.id) {
            throw new Error(`${INVALID_INQUIRY_FILE} Question cannot parent itself: ${question.id}.`);
        }
        if (!byId.has(question.parentId)) {
            throw new Error(
                `${INVALID_INQUIRY_FILE} Question parentId is missing: ${question.parentId}.`,
            );
        }
    }

    for (const question of questions) {
        const seen = new Set<string>();
        let cursor: InquiryQuestion | undefined = question;
        while (cursor) {
            if (seen.has(cursor.id)) {
                throw new Error(`${INVALID_INQUIRY_FILE} Question parent cycle detected.`);
            }
            seen.add(cursor.id);
            cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
        }
    }

    // Normalize root parent linkage without dropping any question content.
    const normalizedQuestions = questions.map((question) =>
        question.id === rootQuestionId
            ? { ...question, parentId: null }
            : question,
    );

    return {
        schemaVersion: 1,
        id: assertString(value.id, 'id', false),
        title: assertString(value.title, 'title'),
        desiredOutcome: assertString(value.desiredOutcome, 'desiredOutcome'),
        status: value.status,
        rootQuestionId,
        currentQuestionId,
        questions: normalizedQuestions,
        synthesis: assertString(value.synthesis, 'synthesis'),
        snapshots,
        createdAt: assertString(value.createdAt, 'createdAt', false),
        updatedAt: assertString(value.updatedAt, 'updatedAt', false),
        reviewAt: assertNullableString(value.reviewAt, 'reviewAt'),
        reviewTrigger: value.reviewTrigger === undefined
            ? ''
            : assertString(value.reviewTrigger, 'reviewTrigger'),
    };
};

export const parseInquiryFile = (raw: string): Inquiry => {
    if (typeof raw !== 'string' || raw.length === 0) {
        throw new Error(INVALID_INQUIRY_FILE);
    }
    if (raw.length > MAX_INQUIRY_JSON_CHARS) {
        throw new Error(`${INVALID_INQUIRY_FILE} Payload exceeds size limit.`);
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error(INVALID_INQUIRY_FILE);
    }

    if (!isRecord(parsed)
        || (parsed.format !== 'ideamap-inquiry' && parsed.format !== 'thought-map-inquiry')
        || parsed.version !== 1
        || typeof parsed.exportedAt !== 'string') {
        throw new Error(INVALID_INQUIRY_FILE);
    }

    return parseInquiry(parsed.inquiry);
};

export const stanceLabel: Record<Stance, string> = {
    unknown: 'Unknown',
    leaning: 'Leaning',
    supported: 'Supported',
    decided: 'Decided',
    disputed: 'Disputed',
};
