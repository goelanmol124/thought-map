/**
 * Explicit state machine for the answer panel's local draft.
 *
 * The panel used to juggle five independent useState hooks plus an effect that
 * reset them whenever the selected node changed. Here the draft is one value
 * and every transition is a named event, so the allowed transitions are
 * visible in one place and unit-testable.
 *
 * The panel is keyed by node id, so selecting a different node mounts a fresh
 * draft via `initDraft` instead of relying on a reset effect.
 */

export type QuestionEdit =
    | { mode: 'viewing' }
    | { mode: 'editing'; text: string };

export interface AnswerDraft {
    answer: string;
    /** Text currently typed into the follow-up input (not yet queued). */
    followUp: string;
    /** Follow-up questions queued with Enter; created as children on save. */
    queued: string[];
    edit: QuestionEdit;
}

export type AnswerDraftEvent =
    | { type: 'ANSWER_CHANGED'; text: string }
    | { type: 'FOLLOW_UP_CHANGED'; text: string }
    | { type: 'FOLLOW_UP_QUEUED' }
    | { type: 'QUEUED_REMOVED'; index: number }
    | { type: 'EDIT_STARTED'; text: string }
    | { type: 'EDIT_CHANGED'; text: string }
    /** Leaves editing mode; committing the text is the caller's job. */
    | { type: 'EDIT_FINISHED' };

export const initDraft = (answer: string): AnswerDraft => ({
    answer,
    followUp: '',
    queued: [],
    edit: { mode: 'viewing' },
});

export function answerDraftReducer(state: AnswerDraft, event: AnswerDraftEvent): AnswerDraft {
    switch (event.type) {
        case 'ANSWER_CHANGED':
            return { ...state, answer: event.text };
        case 'FOLLOW_UP_CHANGED':
            return { ...state, followUp: event.text };
        case 'FOLLOW_UP_QUEUED': {
            const q = state.followUp.trim();
            if (!q) return state;
            return { ...state, followUp: '', queued: [...state.queued, q] };
        }
        case 'QUEUED_REMOVED':
            return { ...state, queued: state.queued.filter((_, i) => i !== event.index) };
        case 'EDIT_STARTED':
            return { ...state, edit: { mode: 'editing', text: event.text } };
        case 'EDIT_CHANGED':
            if (state.edit.mode !== 'editing') return state;
            return { ...state, edit: { mode: 'editing', text: event.text } };
        case 'EDIT_FINISHED':
            return { ...state, edit: { mode: 'viewing' } };
    }
}

/** Everything that will become a child question on save, including un-queued input. */
export function pendingFollowUps(state: AnswerDraft): string[] {
    const typed = state.followUp.trim();
    return typed ? [...state.queued, typed] : state.queued;
}
