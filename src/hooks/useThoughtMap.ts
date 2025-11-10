import { useState, useEffect, useCallback } from 'react';
import { yMaps, yConfig, yDoc } from '../store/yjs';
import type { ThoughtMap, ThoughtNode } from '../types';

export function useThoughtMap() {
    // Local React state that mirrors Y.js state
    const [maps, setMaps] = useState<Record<string, ThoughtMap>>(yMaps.toJSON() as any);
    const [activeMapId, setActiveMapId] = useState<string | null>(yConfig.get('activeMapId') || null);
    const [isDarkMode, setIsDarkMode] = useState<boolean>(yConfig.get('isDarkMode') ?? true);

    // --- SUBSCRIPTIONS (The Nervous System) ---
    useEffect(() => {
        // When Y.js data changes, update our local React state to trigger a re-render
        const onMapChange = () => setMaps(yMaps.toJSON() as any);
        const onConfigChange = () => {
            setActiveMapId(yConfig.get('activeMapId') || null);
            setIsDarkMode(yConfig.get('isDarkMode') ?? true);
        };

        yMaps.observeDeep(onMapChange);
        yConfig.observeDeep(onConfigChange);

        return () => {
            yMaps.unobserveDeep(onMapChange);
            yConfig.unobserveDeep(onConfigChange);
        };
    }, []);

    // --- ACTIONS (The Muscles) ---
    // These replace your old dispatch({ type: ... }) calls.
    // They write directly to Y.js, which then triggers the useEffect above.

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
            if (yConfig.get('activeMapId') === mapId) {
                yConfig.set('activeMapId', null);
            }
        });
    }, []);

    const openMap = useCallback((mapId: string | null) => {
        yConfig.set('activeMapId', mapId);
    }, []);


    const toggleTheme = () => {
        const newIsDarkMode = !isDarkMode;
            try {
                yConfig.set('isDarkMode', newIsDarkMode);  // Update Y.js config
                localStorage.setItem('theme', newIsDarkMode ? 'dark' : 'light');  // Update localStorage only if Y.js succeeds
            } catch (error) {
                console.error('Failed to update theme in Y.js:', error);
                // Do not update localStorage on failure to prevent mismatch
            }
        };

    const updateMapData = useCallback((mapId: string, nodes: ThoughtNode[], currentQuestionId: number | null) => {
        const map = yMaps.get(mapId);
        if (map) {
            // We spread existing map properties to avoid accidental data loss if we add new fields later
            yMaps.set(mapId, { ...map, nodes, currentQuestionId });
        }
    }, []);

    return {
        maps,
        activeMapId,
        isDarkMode,
        currentMap: activeMapId ? maps[activeMapId] : null,
        actions: {
            createMap,
            deleteMap,
            openMap,
            toggleTheme,
            updateMapData
        }
    };
}