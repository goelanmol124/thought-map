import { useState, useEffect, useCallback, useMemo } from 'react';
import { yMaps, yConfig, yDoc } from '../store/yjs';
import type { ThoughtMap, ThoughtNode } from '../types';
import type { MapUpdate } from '../state/mapOps';

export const THEME_STORAGE_KEY = 'theme';

const readMaps = () => yMaps.toJSON() as Record<string, ThoughtMap>;
const readActiveMapId = () => {
    const v = yConfig.get('activeMapId');
    return typeof v === 'string' && v ? v : null;
};
const readIsDarkMode = () => {
    const v = yConfig.get('isDarkMode');
    return typeof v === 'boolean' ? v : true;
};

/**
 * React view of the Yjs document. Yjs is the source of truth (persisted to
 * IndexedDB); actions write to Yjs and the observers below re-render.
 */
export function useThoughtMap() {
    const [maps, setMaps] = useState<Record<string, ThoughtMap>>(readMaps);
    const [activeMapId, setActiveMapId] = useState<string | null>(readActiveMapId);
    const [isDarkMode, setIsDarkMode] = useState<boolean>(readIsDarkMode);

    useEffect(() => {
        const onMapChange = () => setMaps(readMaps());
        const onConfigChange = () => {
            setActiveMapId(readActiveMapId());
            setIsDarkMode(readIsDarkMode());
        };
        yMaps.observeDeep(onMapChange);
        yConfig.observeDeep(onConfigChange);
        return () => {
            yMaps.unobserveDeep(onMapChange);
            yConfig.unobserveDeep(onConfigChange);
        };
    }, []);

    const createMap = useCallback((topic: string) => {
        const newId = `map_${Date.now()}`;
        const rootNode: ThoughtNode = { id: 0, question: topic, answer: '', parentId: null, isAnswered: false };
        const newMap: ThoughtMap = { id: newId, topic, nodes: [rootNode], currentQuestionId: 0 };
        yDoc.transact(() => {
            yMaps.set(newId, newMap);
            yConfig.set('activeMapId', newId);
        });
    }, []);

    const deleteMap = useCallback((mapId: string) => {
        yDoc.transact(() => {
            yMaps.delete(mapId);
            if (yConfig.get('activeMapId') === mapId) yConfig.set('activeMapId', null);
        });
    }, []);

    const openMap = useCallback((mapId: string | null) => {
        yConfig.set('activeMapId', mapId);
    }, []);

    const toggleTheme = useCallback(() => {
        const next = !readIsDarkMode();
        yConfig.set('isDarkMode', next);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
        } catch {
            // Storage can be unavailable (private mode); the Yjs value still applies.
        }
    }, []);

    const applyUpdate = useCallback((mapId: string, update: MapUpdate) => {
        const map = yMaps.get(mapId);
        if (map) yMaps.set(mapId, { ...map, nodes: update.nodes, currentQuestionId: update.currentQuestionId });
    }, []);

    const selectQuestion = useCallback((mapId: string, questionId: number | null) => {
        const map = yMaps.get(mapId);
        if (map && map.currentQuestionId !== questionId) yMaps.set(mapId, { ...map, currentQuestionId: questionId });
    }, []);

    const actions = useMemo(
        () => ({ createMap, deleteMap, openMap, toggleTheme, applyUpdate, selectQuestion }),
        [createMap, deleteMap, openMap, toggleTheme, applyUpdate, selectQuestion],
    );

    return { maps, activeMapId, isDarkMode, actions };
}
