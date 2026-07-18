import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { Inquiry, ThoughtMap } from '../types';

export const LOCAL_DB_NAME = 'thought-map-data';

export class LocalPersistenceError extends Error {
    readonly cause: unknown;

    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = 'LocalPersistenceError';
        this.cause = cause;
    }
}

export const yDoc = new Y.Doc();

/** Primary inquiry store for the current product. */
export const yInquiries = yDoc.getMap<Inquiry>('inquiries');

/**
 * Retained as a durable migration source for earlier releases.
 * Never delete or overwrite wholesale — migration only reads and fills gaps.
 */
export const yMaps = yDoc.getMap<ThoughtMap>('thoughtMaps');

/**
 * Durable deletion records for inquiry ids.
 * Prevents migration from re-creating intentionally deleted inquiries while
 * leaving legacy yMaps / localStorage sources intact.
 */
export const yInquiryTombstones = yDoc.getMap<string>('inquiryTombstones');

/** App-level preferences and migration markers. */
export const yConfig = yDoc.getMap<unknown>('config');

export const localProvider = new IndexeddbPersistence(LOCAL_DB_NAME, yDoc);

localProvider.on('synced', () => {
    console.info('IdeaMap is ready offline.');
});

/**
 * Wait until IndexedDB has hydrated the doc.
 * Rejects on open/hydration failure — callers must fail closed (no empty writable boot).
 */
export const whenLocalReady = (): Promise<void> => {
    if (localProvider.synced) {
        return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
        let settled = false;

        const succeed = () => {
            if (settled) return;
            settled = true;
            resolve();
        };

        const fail = (error: unknown) => {
            if (settled) return;
            settled = true;
            const wrapped = error instanceof LocalPersistenceError
                ? error
                : new LocalPersistenceError(
                    'IdeaMap could not load local data from IndexedDB. Continuing would risk unsaved work.',
                    error,
                );
            console.error(wrapped.message, wrapped.cause ?? error);
            reject(wrapped);
        };

        localProvider.whenSynced.then(
            () => succeed(),
            (error: unknown) => fail(error),
        );

        // whenSynced only resolves on 'synced'; surface DB open failures explicitly.
        localProvider._db.then(
            () => undefined,
            (error: unknown) => fail(error),
        );
    });
};

/** Close the IndexedDB persistence connection without deleting data. */
export const destroyLocalPersistence = (): Promise<void> => {
    if (localProvider._destroyed) {
        return Promise.resolve();
    }
    return localProvider.destroy();
};

const deleteLocalDatabase = (): Promise<void> =>
    new Promise((resolve, reject) => {
        let request: IDBOpenDBRequest;
        try {
            request = indexedDB.deleteDatabase(LOCAL_DB_NAME);
        } catch (error) {
            reject(new LocalPersistenceError(
                'IdeaMap could not start IndexedDB deletion.',
                error,
            ));
            return;
        }

        request.onsuccess = () => resolve();
        request.onerror = () => {
            reject(new LocalPersistenceError(
                'IdeaMap could not delete local IndexedDB data. Close other tabs and retry.',
                request.error,
            ));
        };
        request.onblocked = () => {
            reject(new LocalPersistenceError(
                'IdeaMap could not delete local IndexedDB data because another tab is still using it. Close other IdeaMap tabs, then retry.',
            ));
        };
    });

/**
 * Close persistence, then delete the IndexedDB database.
 * Does not touch localStorage — callers clear legacy backups only after this succeeds.
 */
export const resetLocalPersistence = async (): Promise<void> => {
    await destroyLocalPersistence();
    await deleteLocalDatabase();
};
