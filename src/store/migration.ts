import {
    yDoc,
    yInquiries,
    yInquiryTombstones,
    yMaps,
    yConfig,
    whenLocalReady,
} from './yjs';
import type { Inquiry, ThoughtMap, ThoughtNode } from '../types';

const questionId = (mapId: string, nodeId: number): string => `${mapId}_question_${nodeId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isThoughtNode = (value: unknown): value is ThoughtNode => {
    if (!isRecord(value)) return false;
    return typeof value.id === 'number'
        && Number.isFinite(value.id)
        && typeof value.question === 'string'
        && typeof value.answer === 'string'
        && (typeof value.parentId === 'number' || value.parentId === null)
        && typeof value.isAnswered === 'boolean';
};

const isThoughtMap = (value: unknown): value is ThoughtMap => {
    if (!isRecord(value)) return false;
    return typeof value.id === 'string'
        && value.id.length > 0
        && typeof value.topic === 'string'
        && Array.isArray(value.nodes)
        && value.nodes.every(isThoughtNode)
        && (typeof value.currentQuestionId === 'number' || value.currentQuestionId === null);
};

const isTombstoned = (id: string): boolean => yInquiryTombstones.has(id);

const mapCreatedAt = (mapId: string): string => {
    const milliseconds = Number(mapId.replace('map_', ''));
    return Number.isFinite(milliseconds)
        ? new Date(milliseconds).toISOString()
        : new Date().toISOString();
};

const convertLegacyMap = (map: ThoughtMap): Inquiry => {
    const createdAt = mapCreatedAt(map.id);
    const rootNode = map.nodes.find((node) => node.parentId === null) ?? map.nodes[0];
    const fallbackRootId = questionId(map.id, 0);
    const rootQuestionId = rootNode ? questionId(map.id, rootNode.id) : fallbackRootId;
    const currentQuestionId = map.currentQuestionId === null
        ? null
        : questionId(map.id, map.currentQuestionId);

    const questions = map.nodes.length > 0
        ? map.nodes.map((node) => ({
            id: questionId(map.id, node.id),
            text: node.question,
            answer: node.answer,
            parentId: node.parentId === null ? null : questionId(map.id, node.parentId),
            relationship: 'breaks-into' as const,
            state: node.isAnswered
                ? 'resolved' as const
                : currentQuestionId === questionId(map.id, node.id)
                    ? 'active' as const
                    : 'open' as const,
            priority: node.parentId === null ? 'blocking' as const : 'normal' as const,
            stance: node.isAnswered ? 'supported' as const : 'unknown' as const,
            evidence: [],
            createdAt,
            updatedAt: createdAt,
            resolvedAt: node.isAnswered ? createdAt : null,
        }))
        : [{
            id: fallbackRootId,
            text: map.topic,
            answer: '',
            parentId: null,
            relationship: 'breaks-into' as const,
            state: 'active' as const,
            priority: 'blocking' as const,
            stance: 'unknown' as const,
            evidence: [],
            createdAt,
            updatedAt: createdAt,
            resolvedAt: null,
        }];

    return {
        schemaVersion: 1,
        id: map.id,
        title: map.topic,
        desiredOutcome: '',
        status: 'exploring',
        rootQuestionId,
        currentQuestionId: questions.some((question) => question.id === currentQuestionId)
            ? currentQuestionId
            : rootQuestionId,
        questions,
        synthesis: '',
        snapshots: [],
        createdAt,
        updatedAt: createdAt,
        reviewAt: null,
    };
};

/**
 * Import missing entries from legacy localStorage into yMaps.
 * Never deletes localStorage or existing yMaps entries.
 * Skips malformed individual maps; does not wipe the source blob.
 * Skips ids with durable deletion tombstones so deleted inquiries stay gone.
 */
const importLegacyLocalStorageMaps = (): void => {
    let oldRawData: string | null = null;
    try {
        oldRawData = localStorage.getItem('thoughtMaps');
    } catch (error) {
        console.warn('IdeaMap could not read legacy localStorage maps.', error);
        return;
    }

    if (!oldRawData) return;

    let parsed: unknown;
    try {
        parsed = JSON.parse(oldRawData);
    } catch (error) {
        console.warn('IdeaMap ignored malformed legacy localStorage JSON.', error);
        return;
    }

    if (!isRecord(parsed)) {
        console.warn('IdeaMap ignored non-object legacy localStorage maps.');
        return;
    }

    const toImport: Array<[string, ThoughtMap]> = [];
    for (const [id, candidate] of Object.entries(parsed)) {
        if (yMaps.has(id) || yInquiries.has(id) || isTombstoned(id)) continue;

        if (!isThoughtMap(candidate)) {
            console.warn(`IdeaMap skipped malformed legacy map "${id}".`);
            continue;
        }

        // Prefer the storage key when the embedded id disagrees.
        const map: ThoughtMap = candidate.id === id
            ? candidate
            : { ...candidate, id };
        toImport.push([id, map]);
    }

    if (toImport.length === 0) return;

    yDoc.transact(() => {
        for (const [id, map] of toImport) {
            if (!yMaps.has(id) && !isTombstoned(id)) {
                yMaps.set(id, map);
            }
        }
    });
};

/**
 * Convert any yMaps entries that are not yet present in yInquiries.
 * Idempotent: never overwrites an existing inquiry; never deletes yMaps.
 * Respects tombstones so intentional deletes are not re-imported.
 */
const convertMissingMapsToInquiries = (): void => {
    const converted: Inquiry[] = [];

    yMaps.forEach((raw, id) => {
        if (yInquiries.has(id) || isTombstoned(id)) return;

        if (!isThoughtMap(raw)) {
            console.warn(`IdeaMap skipped corrupt yMaps entry "${id}" during conversion.`);
            return;
        }

        try {
            const map: ThoughtMap = raw.id === id ? raw : { ...raw, id };
            converted.push(convertLegacyMap(map));
        } catch (error) {
            console.warn(`IdeaMap failed to convert legacy map "${id}".`, error);
        }
    });

    if (converted.length === 0) return;

    const legacyActiveId = yConfig.get('activeMapId');
    let localActiveId: string | null = null;
    try {
        localActiveId = localStorage.getItem('activeMapId');
    } catch {
        localActiveId = null;
    }

    yDoc.transact(() => {
        for (const inquiry of converted) {
            if (!yInquiries.has(inquiry.id) && !isTombstoned(inquiry.id)) {
                yInquiries.set(inquiry.id, inquiry);
            }
        }

        const existingActive = yConfig.get('activeInquiryId');
        const hasValidActive = typeof existingActive === 'string' && yInquiries.has(existingActive);
        if (!hasValidActive) {
            const activeId = typeof legacyActiveId === 'string'
                ? legacyActiveId
                : localActiveId;
            if (activeId && yInquiries.has(activeId) && !isTombstoned(activeId)) {
                yConfig.set('activeInquiryId', activeId);
            }
        }

        if (yConfig.get('schemaVersion') == null) {
            yConfig.set('schemaVersion', 1);
        }
    });
};

const reconcileTheme = (): void => {
    const storedTheme = yConfig.get('isDarkMode');
    if (typeof storedTheme === 'boolean') {
        try {
            localStorage.setItem('theme', storedTheme ? 'dark' : 'light');
        } catch {
            // Preference already lives in Yjs; local mirror is best-effort.
        }
        return;
    }

    let currentTheme: string | null = null;
    let legacyTheme: string | null = null;
    try {
        currentTheme = localStorage.getItem('theme');
        legacyTheme = localStorage.getItem('themePreference');
    } catch {
        // Fall through to light default.
    }

    let isDark = false;
    if (currentTheme === 'dark' || currentTheme === 'light') {
        isDark = currentTheme === 'dark';
    } else if (legacyTheme != null) {
        try {
            isDark = JSON.parse(legacyTheme) === true;
        } catch {
            isDark = legacyTheme === 'dark' || legacyTheme === 'true';
        }
    }

    yConfig.set('isDarkMode', isDark);
    try {
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch {
        // Non-fatal.
    }
};

const reconcileActiveSelection = (): void => {
    yDoc.transact(() => {
        const activeInquiryId = yConfig.get('activeInquiryId');
        if (typeof activeInquiryId === 'string' && !yInquiries.has(activeInquiryId)) {
            yConfig.set('activeInquiryId', null);
        } else if (activeInquiryId != null && typeof activeInquiryId !== 'string') {
            yConfig.set('activeInquiryId', null);
        }
        yConfig.set('migrationComplete', true);
        if (yConfig.get('schemaVersion') == null) {
            yConfig.set('schemaVersion', 1);
        }
    });
};

/**
 * Lossless, idempotent migration from legacy ThoughtMap storage into inquiries.
 * Source data (localStorage + yMaps) is never deleted.
 * Requires IndexedDB hydration to succeed first (fail closed via whenLocalReady).
 */
export async function performDataMigration(): Promise<void> {
    // Hydration failures must propagate — do not boot against an empty in-memory doc.
    await whenLocalReady();

    try {
        importLegacyLocalStorageMaps();
        convertMissingMapsToInquiries();
        reconcileTheme();
        reconcileActiveSelection();
    } catch (error) {
        console.error('IdeaMap could not migrate earlier local data.', error);
        // Still mark complete so the app can boot; sources remain intact for a retry.
        try {
            yConfig.set('migrationComplete', true);
        } catch {
            // Ignore secondary failure.
        }
    }
}
