// The shape of a single thought node
export interface ThoughtNode {
    id: number;
    question: string;
    answer: string;
    parentId: number | null;
    isAnswered: boolean;
}

// The shape of an entire map
export interface ThoughtMap {
    id: string;
    topic: string;
    nodes: ThoughtNode[];
    currentQuestionId: number | null;
}

// The shape of our old localStorage data
export interface LegacyMapStorage {
    [mapId: string]: ThoughtMap;
}