import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
// FIX: Added 'type' keyword here
import type { ThoughtMap } from '../types';

export type ConfigValue = string | boolean | null;

export const yDoc = new Y.Doc();
export const yMaps = yDoc.getMap<ThoughtMap>('thoughtMaps');
export const yConfig = yDoc.getMap<ConfigValue>('config');

export const localProvider = new IndexeddbPersistence('thought-map-data', yDoc);

localProvider.on('synced', () => {
    console.log('✅ Y.js successfully connected to local IndexedDB');
});