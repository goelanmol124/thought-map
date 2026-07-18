export type InquiryStatus = 'exploring' | 'blocked' | 'decided' | 'monitoring' | 'archived';
export type QuestionState = 'open' | 'active' | 'resolved' | 'parked' | 'invalidated';
export type QuestionPriority = 'blocking' | 'high' | 'normal';
export type Stance = 'unknown' | 'leaning' | 'supported' | 'decided' | 'disputed';
export type RelationshipType = 'breaks-into' | 'hinges-on';
export type EvidencePolarity = 'supports' | 'weakens' | 'context';

/** Closed sets used by runtime validation — keep in sync with the union types above. */
export const INQUIRY_STATUSES = [
    'exploring',
    'blocked',
    'decided',
    'monitoring',
    'archived',
] as const satisfies readonly InquiryStatus[];

export const QUESTION_STATES = [
    'open',
    'active',
    'resolved',
    'parked',
    'invalidated',
] as const satisfies readonly QuestionState[];

export const QUESTION_PRIORITIES = [
    'blocking',
    'high',
    'normal',
] as const satisfies readonly QuestionPriority[];

export const STANCES = [
    'unknown',
    'leaning',
    'supported',
    'decided',
    'disputed',
] as const satisfies readonly Stance[];

export const RELATIONSHIP_TYPES = [
    'breaks-into',
    'hinges-on',
] as const satisfies readonly RelationshipType[];

export const EVIDENCE_POLARITIES = [
    'supports',
    'weakens',
    'context',
] as const satisfies readonly EvidencePolarity[];

export interface Evidence {
    id: string;
    note: string;
    source: string;
    url: string;
    polarity: EvidencePolarity;
    createdAt: string;
}

export interface InquiryQuestion {
    id: string;
    text: string;
    answer: string;
    parentId: string | null;
    relationship: RelationshipType;
    state: QuestionState;
    priority: QuestionPriority;
    stance: Stance;
    evidence: Evidence[];
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
}

export interface DecisionSnapshot {
    id: string;
    createdAt: string;
    answer: string;
    stance: Stance;
    synthesis: string;
    openRisks: string[];
}

export interface Inquiry {
    schemaVersion: 1;
    id: string;
    title: string;
    desiredOutcome: string;
    status: InquiryStatus;
    rootQuestionId: string;
    currentQuestionId: string | null;
    questions: InquiryQuestion[];
    synthesis: string;
    snapshots: DecisionSnapshot[];
    createdAt: string;
    updatedAt: string;
    reviewAt: string | null;
    reviewTrigger?: string;
}

export interface InquiryFile {
    format: 'ideamap-inquiry' | 'thought-map-inquiry';
    version: 1;
    exportedAt: string;
    inquiry: Inquiry;
}

// Legacy data types are retained solely for lossless migration.
export interface ThoughtNode {
    id: number;
    question: string;
    answer: string;
    parentId: number | null;
    isAnswered: boolean;
}

export interface ThoughtMap {
    id: string;
    topic: string;
    nodes: ThoughtNode[];
    currentQuestionId: number | null;
}

export interface LegacyMapStorage {
    [mapId: string]: ThoughtMap;
}
