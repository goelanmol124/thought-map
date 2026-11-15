/**
 * Explicit state machine for a peer connection as seen by the UI.
 *
 * Replaces a free-form `status` string plus loosely related flags
 * (outgoing signal text, whether a peer had been created yet) in the panel.
 */

export type SignalingMode = 'local' | 'manual';

export type ConnectionState =
    | { status: 'idle' }
    /** Local mode: offer sent over BroadcastChannel, waiting for the other tab. */
    | { status: 'connecting'; target: string }
    /** Manual mode: gathering ICE candidates before an offer/answer can be shown. */
    | { status: 'gathering' }
    /** Manual mode: our offer or answer is ready to copy to the other peer. */
    | { status: 'awaiting-peer'; outgoing: string }
    | { status: 'connected' }
    | { status: 'disconnected' }
    | { status: 'failed'; error: string };

export type ConnectionEvent =
    | { type: 'CONNECT'; target: string }
    | { type: 'GATHER' }
    | { type: 'SIGNAL_READY'; signal: string }
    | { type: 'PEER_CONNECTED' }
    | { type: 'PEER_DISCONNECTED' }
    | { type: 'FAILED'; error: string }
    | { type: 'RESET' };

export const initialConnection: ConnectionState = { status: 'idle' };

export function connectionReducer(state: ConnectionState, event: ConnectionEvent): ConnectionState {
    switch (event.type) {
        case 'RESET':
            return initialConnection;
        case 'CONNECT':
            return state.status === 'connected' ? state : { status: 'connecting', target: event.target };
        case 'GATHER':
            return state.status === 'connected' ? state : { status: 'gathering' };
        case 'SIGNAL_READY':
            // A signal can arrive after we already connected; never step backwards.
            return state.status === 'connected' ? state : { status: 'awaiting-peer', outgoing: event.signal };
        case 'PEER_CONNECTED':
            return { status: 'connected' };
        case 'PEER_DISCONNECTED':
            return state.status === 'idle' ? state : { status: 'disconnected' };
        case 'FAILED':
            return { status: 'failed', error: event.error };
    }
}

export function connectionLabel(s: ConnectionState): string {
    switch (s.status) {
        case 'idle': return 'Not connected';
        case 'connecting': return `Connecting to ${s.target}...`;
        case 'gathering': return 'Preparing signal...';
        case 'awaiting-peer': return 'Waiting for the other peer';
        case 'connected': return 'Connected';
        case 'disconnected': return 'Disconnected';
        case 'failed': return `Failed: ${s.error}`;
    }
}
