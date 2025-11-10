// FIX 1: Added 'yDoc' to the import list
import { yDoc, yMaps, yConfig, localProvider } from './yjs';
// FIX 2: Added 'type' keyword here
import type { LegacyMapStorage } from '../types';

export async function performDataMigration() {
    await localProvider.whenSynced;

    const hasNewData = yMaps.size > 0;
    const oldRawData = localStorage.getItem('thoughtMaps');
    
    if (hasNewData) {
        console.log('Migration skipped: New data already exists.');
        return;
    }

    if (!oldRawData) {
        console.log('Migration skipped: No legacy data found.');
        return;
    }

    console.log('🚀 Starting Data Migration...');

    try {
        const oldMaps: LegacyMapStorage = JSON.parse(oldRawData);
        // yDoc is now properly imported and should work here
        yDoc.transact(() => {
            for (const [id, map] of Object.entries(oldMaps)) {
                yMaps.set(id, map);
                console.log(`Migrated map: ${map.topic}`);
            }
        });

        const oldActiveId = localStorage.getItem('activeMapId');
        if (oldActiveId) {
            yConfig.set('activeMapId', oldActiveId);
        }

        const oldTheme = localStorage.getItem('themePreference');
        if (oldTheme) {
            yConfig.set('isDarkMode', JSON.parse(oldTheme));
        }

        console.log('✅ Migration Complete! Welcome to the future.');

    } catch (e) {
        console.error('CRITICAL: Migration failed', e);
    }
}