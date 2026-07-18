import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    createEvidence,
    createInquiry as createInquiryModel,
    createQuestion,
    createSnapshot,
    getDecisionReadiness,
    getOpenQuestions,
    parseInquiryFile,
} from '../inquiry';
import { yConfig, yDoc, yInquiries, yInquiryTombstones } from '../store/yjs';
import type {
    EvidencePolarity,
    Inquiry,
    InquiryQuestion,
    QuestionPriority,
    RelationshipType,
    Stance,
} from '../types';

export interface FollowUpDraft {
    text: string;
    relationship: RelationshipType;
    priority: QuestionPriority;
}

export interface EvidenceDraft {
    note: string;
    source: string;
    url: string;
    polarity: EvidencePolarity;
}

type InquiryPatch = Partial<Pick<
    Inquiry,
    'title' | 'desiredOutcome' | 'status' | 'reviewAt' | 'reviewTrigger'
>>;
type QuestionPatch = Partial<Pick<
    InquiryQuestion,
    'text' | 'answer' | 'state' | 'priority' | 'stance' | 'relationship'
>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** Lightweight structural guard for values read from Yjs. */
const isInquiryLike = (value: unknown): value is Inquiry => {
    if (!isRecord(value)) return false;
    return typeof value.id === 'string'
        && typeof value.rootQuestionId === 'string'
        && Array.isArray(value.questions)
        && value.questions.length > 0
        && typeof value.title === 'string'
        && typeof value.updatedAt === 'string';
};

const configBoolean = (key: string, fallback: boolean): boolean => {
    const value = yConfig.get(key);
    return typeof value === 'boolean' ? value : fallback;
};

const withUpdatedAt = (inquiry: Inquiry): Inquiry => ({
    ...inquiry,
    updatedAt: new Date().toISOString(),
});

const readInquiries = (): Record<string, Inquiry> => {
    const raw = yInquiries.toJSON() as Record<string, unknown>;
    const next: Record<string, Inquiry> = {};
    for (const [id, value] of Object.entries(raw)) {
        if (!isInquiryLike(value)) {
            console.warn(`IdeaMap ignored corrupt inquiry "${id}".`);
            continue;
        }
        // Prefer the map key if the embedded id drifted.
        next[id] = reconcileStatus(value.id === id ? value : { ...value, id });
    }
    return next;
};

const getInquiry = (inquiryId: string): Inquiry | null => {
    if (!inquiryId) return null;
    const value = yInquiries.get(inquiryId);
    if (!isInquiryLike(value)) return null;
    return reconcileStatus(value.id === inquiryId ? value : { ...value, id: inquiryId });
};

const questionExists = (inquiry: Inquiry, questionId: string): boolean =>
    inquiry.questions.some((question) => question.id === questionId);

const reconcileStatus = (inquiry: Inquiry): Inquiry => {
    if (inquiry.status !== 'decided') return inquiry;
    try {
        const readiness = getDecisionReadiness(inquiry);
        if (readiness.ready) return inquiry;
        return {
            ...inquiry,
            status: readiness.blockingQuestions.length > 0 ? 'blocked' : 'exploring',
        };
    } catch {
        return inquiry;
    }
};

/** Remove legacy shared focus markers whenever durable content is next written. */
const withoutSharedSelection = (inquiry: Inquiry): Inquiry => ({
    ...inquiry,
    currentQuestionId: null,
    questions: inquiry.questions.map((question) =>
        question.state === 'active' ? { ...question, state: 'open' as const } : question),
});

const safeWrite = (label: string, write: () => void): boolean => {
    try {
        write();
        return true;
    } catch (error) {
        console.error(`IdeaMap could not ${label}.`, error);
        return false;
    }
};

const COMPOSER_DRAFT_PREFIX = 'thought-map:composer-draft:v1:';
const ACTIVE_INQUIRY_SESSION_KEY = 'thought-map:session:v1:active-inquiry';
const FOCUSED_QUESTIONS_SESSION_KEY = 'thought-map:session:v1:focused-questions';

const readSessionActiveInquiry = (): string | null => {
    try {
        const value = sessionStorage.getItem(ACTIVE_INQUIRY_SESSION_KEY);
        return value?.trim() || null;
    } catch {
        return null;
    }
};

const readSessionFocusedQuestions = (): Record<string, string> => {
    try {
        const raw = sessionStorage.getItem(FOCUSED_QUESTIONS_SESSION_KEY);
        if (!raw || raw.length > 250_000) return {};
        const value: unknown = JSON.parse(raw);
        if (!isRecord(value)) return {};
        return Object.fromEntries(
            Object.entries(value).filter(
                (entry): entry is [string, string] => typeof entry[1] === 'string',
            ),
        );
    } catch {
        return {};
    }
};

const storeSessionActiveInquiry = (inquiryId: string | null) => {
    try {
        if (inquiryId) sessionStorage.setItem(ACTIVE_INQUIRY_SESSION_KEY, inquiryId);
        else sessionStorage.removeItem(ACTIVE_INQUIRY_SESSION_KEY);
    } catch {
        // React state still isolates this tab when sessionStorage is unavailable.
    }
};

const storeSessionFocusedQuestions = (focused: Record<string, string>) => {
    try {
        sessionStorage.setItem(FOCUSED_QUESTIONS_SESSION_KEY, JSON.stringify(focused));
    } catch {
        // React state still isolates this tab when sessionStorage is unavailable.
    }
};

const defaultFocusedQuestionId = (inquiry: Inquiry): string | null =>
    getOpenQuestions(inquiry)[0]?.id
    ?? (questionExists(inquiry, inquiry.rootQuestionId) ? inquiry.rootQuestionId : null)
    ?? inquiry.questions[0]?.id
    ?? null;

const clearComposerDrafts = (inquiryId: string, questionIds?: Set<string>) => {
    try {
        const inquiryPrefix = `${COMPOSER_DRAFT_PREFIX}${encodeURIComponent(inquiryId)}:`;
        for (let index = localStorage.length - 1; index >= 0; index -= 1) {
            const key = localStorage.key(index);
            if (!key?.startsWith(inquiryPrefix)) continue;
            if (questionIds) {
                const questionId = decodeURIComponent(key.slice(inquiryPrefix.length));
                if (!questionIds.has(questionId)) continue;
            }
            localStorage.removeItem(key);
        }
    } catch (error) {
        console.warn('IdeaMap could not clear local composer drafts.', error);
    }
};

const allocateImportId = (preferredId: string): string => {
    if (!yInquiries.has(preferredId)) return preferredId;

    let candidate = `${preferredId}_imported_${Date.now()}`;
    let suffix = 0;
    while (yInquiries.has(candidate)) {
        suffix += 1;
        candidate = `${preferredId}_imported_${Date.now()}_${suffix}`;
    }
    return candidate;
};

export function useInquiries() {
    const [inquiries, setInquiries] = useState<Record<string, Inquiry>>(readInquiries);
    const [activeInquiryId, setActiveInquiryIdState] = useState<string | null>(
        readSessionActiveInquiry,
    );
    const [focusedQuestionIds, setFocusedQuestionIds] = useState<Record<string, string>>(
        readSessionFocusedQuestions,
    );
    const [isDarkMode, setIsDarkMode] = useState<boolean>(
        () => configBoolean('isDarkMode', false),
    );

    const setLocalActiveInquiry = useCallback((inquiryId: string | null) => {
        setActiveInquiryIdState(inquiryId);
        storeSessionActiveInquiry(inquiryId);
    }, []);

    const setLocalFocusedQuestion = useCallback((inquiryId: string, questionId: string | null) => {
        setFocusedQuestionIds((current) => {
            const next = { ...current };
            if (questionId) next[inquiryId] = questionId;
            else delete next[inquiryId];
            storeSessionFocusedQuestions(next);
            return next;
        });
    }, []);

    useEffect(() => {
        const onInquiryChange = () => {
            setInquiries(readInquiries());
        };
        const onConfigChange = () => {
            setIsDarkMode(configBoolean('isDarkMode', false));
        };

        yInquiries.observeDeep(onInquiryChange);
        yConfig.observeDeep(onConfigChange);
        onInquiryChange();
        onConfigChange();

        return () => {
            yInquiries.unobserveDeep(onInquiryChange);
            yConfig.unobserveDeep(onConfigChange);
        };
    }, []);

    // Clear stale active selection when the referenced inquiry is gone or corrupt.
    useEffect(() => {
        if (!activeInquiryId) return;
        if (inquiries[activeInquiryId]) return;
        setLocalActiveInquiry(null);
    }, [activeInquiryId, inquiries, setLocalActiveInquiry]);

    // Pin a valid fallback once per tab so remote content changes cannot rerank live focus.
    useEffect(() => {
        if (!activeInquiryId) return;
        const inquiry = inquiries[activeInquiryId];
        if (!inquiry) return;
        const selected = focusedQuestionIds[activeInquiryId];
        if (selected && questionExists(inquiry, selected)) return;
        setLocalFocusedQuestion(activeInquiryId, defaultFocusedQuestionId(inquiry));
    }, [
        activeInquiryId,
        focusedQuestionIds,
        inquiries,
        setLocalFocusedQuestion,
    ]);

    const writeInquiry = useCallback((inquiry: Inquiry) => {
        const durable = reconcileStatus(withoutSharedSelection(inquiry));
        return safeWrite(`persist inquiry ${durable.id}`, () => {
            yInquiries.set(durable.id, withUpdatedAt(durable));
        });
    }, []);

    const createInquiry = useCallback((rootQuestion: string, desiredOutcome = '') => {
        const trimmed = rootQuestion.trim();
        if (!trimmed) return '';

        const inquiry = createInquiryModel(trimmed, desiredOutcome);
        const ok = safeWrite('create inquiry', () => {
            yInquiries.set(inquiry.id, inquiry);
        });
        if (ok) {
            setLocalFocusedQuestion(inquiry.id, inquiry.rootQuestionId);
            setLocalActiveInquiry(inquiry.id);
        }
        return ok ? inquiry.id : '';
    }, [setLocalActiveInquiry, setLocalFocusedQuestion]);

    const deleteInquiry = useCallback((inquiryId: string) => {
        if (!inquiryId || !yInquiries.has(inquiryId)) return;
        const deleted = safeWrite('delete inquiry', () => {
            yDoc.transact(() => {
                yInquiries.delete(inquiryId);
                // Durable tombstone: migration must not resurrect from preserved yMaps/localStorage.
                yInquiryTombstones.set(inquiryId, new Date().toISOString());
            });
        });
        if (deleted) {
            clearComposerDrafts(inquiryId);
            setLocalFocusedQuestion(inquiryId, null);
            if (activeInquiryId === inquiryId) setLocalActiveInquiry(null);
        }
    }, [
        activeInquiryId,
        setLocalActiveInquiry,
        setLocalFocusedQuestion,
    ]);

    const openInquiry = useCallback((inquiryId: string | null) => {
        if (inquiryId === null) {
            setLocalActiveInquiry(null);
            return;
        }
        const inquiry = getInquiry(inquiryId);
        if (!inquiry) {
            setLocalActiveInquiry(null);
            return;
        }
        const selected = focusedQuestionIds[inquiryId];
        if (!selected || !questionExists(inquiry, selected)) {
            setLocalFocusedQuestion(inquiryId, defaultFocusedQuestionId(inquiry));
        }
        setLocalActiveInquiry(inquiryId);
    }, [
        focusedQuestionIds,
        setLocalActiveInquiry,
        setLocalFocusedQuestion,
    ]);

    const updateInquiry = useCallback((inquiryId: string, patch: InquiryPatch) => {
        const inquiry = getInquiry(inquiryId);
        if (!inquiry) return false;
        const next = { ...inquiry, ...patch };
        if (patch.status === 'decided' && !getDecisionReadiness(next).ready) return false;
        return writeInquiry(next);
    }, [writeInquiry]);

    const selectQuestion = useCallback((inquiryId: string, questionId: string) => {
        const inquiry = getInquiry(inquiryId);
        if (!inquiry || !questionExists(inquiry, questionId)) return;
        setLocalFocusedQuestion(inquiryId, questionId);
    }, [setLocalFocusedQuestion]);

    const updateQuestion = useCallback((
        inquiryId: string,
        questionId: string,
        patch: QuestionPatch,
    ) => {
        const inquiry = getInquiry(inquiryId);
        if (!inquiry || !questionExists(inquiry, questionId)) return false;

        const updatedAt = new Date().toISOString();
        const questions = inquiry.questions.map((question) =>
            question.id === questionId
                ? { ...question, ...patch, updatedAt }
                : question,
        );
        const title = questionId === inquiry.rootQuestionId && patch.text?.trim()
            ? patch.text.trim()
            : inquiry.title;
        return writeInquiry({ ...inquiry, title, questions });
    }, [writeInquiry]);

    const resolveQuestion = useCallback((
        inquiryId: string,
        questionId: string,
        answer: string,
        stance: Stance,
        followUps: FollowUpDraft[],
    ) => {
        const inquiry = getInquiry(inquiryId);
        if (!inquiry || !questionExists(inquiry, questionId)) return false;

        const now = new Date().toISOString();
        const children = followUps
            .filter((draft) => draft.text.trim())
            .map((draft, index) => {
                const child = createQuestion(
                    draft.text,
                    questionId,
                    draft.relationship,
                    draft.priority,
                );
                const createdAt = new Date(Date.now() + index).toISOString();
                return { ...child, createdAt, updatedAt: createdAt };
            });
        const questions = inquiry.questions
            .map((question) => question.id === questionId
                ? {
                    ...question,
                    answer: answer.trim(),
                    stance,
                    state: 'resolved' as const,
                    resolvedAt: now,
                    updatedAt: now,
                }
                : question)
            .concat(children);

        const candidate = getOpenQuestions({ ...inquiry, questions })[0] ?? null;
        const resolved = writeInquiry({
            ...inquiry,
            questions,
        });
        if (resolved) {
            setLocalFocusedQuestion(inquiryId, candidate?.id ?? questionId);
        }
        return resolved;
    }, [setLocalFocusedQuestion, writeInquiry]);

    const addEvidence = useCallback((
        inquiryId: string,
        questionId: string,
        draft: EvidenceDraft,
    ) => {
        const inquiry = getInquiry(inquiryId);
        if (!inquiry || !questionExists(inquiry, questionId) || !draft.note.trim()) return false;

        const evidence = createEvidence(
            draft.note,
            draft.polarity,
            draft.source,
            draft.url,
        );
        const questions = inquiry.questions.map((question) =>
            question.id === questionId
                ? {
                    ...question,
                    evidence: [...(Array.isArray(question.evidence) ? question.evidence : []), evidence],
                    updatedAt: new Date().toISOString(),
                }
                : question,
        );
        return writeInquiry({ ...inquiry, questions });
    }, [writeInquiry]);

    const removeEvidence = useCallback((
        inquiryId: string,
        questionId: string,
        evidenceId: string,
    ) => {
        const inquiry = getInquiry(inquiryId);
        if (!inquiry || !questionExists(inquiry, questionId)) return;

        const questions = inquiry.questions.map((question) =>
            question.id === questionId
                ? {
                    ...question,
                    evidence: (Array.isArray(question.evidence) ? question.evidence : [])
                        .filter((item) => item.id !== evidenceId),
                    updatedAt: new Date().toISOString(),
                }
                : question,
        );
        writeInquiry({ ...inquiry, questions });
    }, [writeInquiry]);

    const deleteQuestion = useCallback((inquiryId: string, questionId: string) => {
        const inquiry = getInquiry(inquiryId);
        if (!inquiry || !questionExists(inquiry, questionId)) return;
        // Never delete the root question.
        if (questionId === inquiry.rootQuestionId) return;

        const ids = new Set<string>([questionId]);
        let changed = true;
        while (changed) {
            changed = false;
            inquiry.questions.forEach((question) => {
                if (question.parentId && ids.has(question.parentId) && !ids.has(question.id)) {
                    ids.add(question.id);
                    changed = true;
                }
            });
        }

        const questions = inquiry.questions.filter((question) => !ids.has(question.id));
        if (questions.length === 0) return;

        const next = getOpenQuestions({ ...inquiry, questions })[0]
            ?? questions.find((question) => question.id === inquiry.rootQuestionId)
            ?? questions[0]
            ?? null;

        const deleted = writeInquiry({
            ...inquiry,
            questions,
        });
        if (deleted) {
            clearComposerDrafts(inquiryId, ids);
            if (ids.has(focusedQuestionIds[inquiryId] ?? '')) {
                setLocalFocusedQuestion(inquiryId, next?.id ?? null);
            }
        }
    }, [focusedQuestionIds, setLocalFocusedQuestion, writeInquiry]);

    const updateSynthesis = useCallback((inquiryId: string, synthesis: string) => {
        const inquiry = getInquiry(inquiryId);
        if (!inquiry) return;
        writeInquiry({ ...inquiry, synthesis });
    }, [writeInquiry]);

    const captureSnapshot = useCallback((inquiryId: string) => {
        const inquiry = getInquiry(inquiryId);
        if (!inquiry) return false;
        if (!getDecisionReadiness(inquiry).ready) return false;
        return writeInquiry({
            ...inquiry,
            snapshots: [...(Array.isArray(inquiry.snapshots) ? inquiry.snapshots : []), createSnapshot(inquiry)],
            status: 'decided',
        });
    }, [writeInquiry]);

    const importInquiry = useCallback((raw: string) => {
        let parsed: Inquiry;
        try {
            parsed = parseInquiryFile(raw);
        } catch (error) {
            console.error('IdeaMap could not import inquiry file.', error);
            throw error;
        }

        const id = allocateImportId(parsed.id);
        const inquiry = withUpdatedAt(reconcileStatus(withoutSharedSelection({
            ...parsed,
            id,
            title: id === parsed.id ? parsed.title : `${parsed.title} (imported)`,
        })));

        const ok = safeWrite('import inquiry', () => {
            yDoc.transact(() => {
                // Explicit import overrides a prior deletion tombstone for this id.
                yInquiryTombstones.delete(id);
                yInquiries.set(id, inquiry);
            });
        });
        if (!ok) {
            throw new Error('IdeaMap could not save the imported inquiry.');
        }
        setLocalFocusedQuestion(id, defaultFocusedQuestionId(inquiry));
        setLocalActiveInquiry(id);
        return id;
    }, [setLocalActiveInquiry, setLocalFocusedQuestion]);

    const toggleTheme = useCallback(() => {
        const next = !configBoolean('isDarkMode', false);
        safeWrite('toggle theme', () => {
            yConfig.set('isDarkMode', next);
            try {
                localStorage.setItem('theme', next ? 'dark' : 'light');
            } catch (error) {
                console.warn('IdeaMap could not mirror theme to localStorage.', error);
            }
        });
    }, []);

    const activeInquiry = activeInquiryId ? inquiries[activeInquiryId] ?? null : null;
    const focusedQuestionId = activeInquiry
        ? (
            questionExists(activeInquiry, focusedQuestionIds[activeInquiry.id] ?? '')
                ? focusedQuestionIds[activeInquiry.id]
                : defaultFocusedQuestionId(activeInquiry)
        )
        : null;
    const inquiryList = useMemo(
        () => Object.values(inquiries).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        [inquiries],
    );

    return {
        inquiries,
        inquiryList,
        activeInquiryId,
        activeInquiry,
        focusedQuestionId,
        isDarkMode,
        actions: {
            createInquiry,
            deleteInquiry,
            openInquiry,
            updateInquiry,
            selectQuestion,
            updateQuestion,
            resolveQuestion,
            addEvidence,
            removeEvidence,
            deleteQuestion,
            updateSynthesis,
            captureSnapshot,
            importInquiry,
            toggleTheme,
        },
    };
}
