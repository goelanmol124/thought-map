import type { SignalData, SignalingService } from './types';

interface SignalMessage {
    targetId: string;
    senderId: string;
    data: SignalData;
}

// --- Local Signaling (Same Browser, Different Tabs) ---
export class LocalSignaling implements SignalingService {
    private channel: BroadcastChannel;
    private onSignalCallback: ((senderId: string, data: SignalData) => void) | null = null;
    private myId: string;

    constructor(myId: string) {
        this.myId = myId;
        this.channel = new BroadcastChannel('thought-map-signaling');

        this.channel.onmessage = (event) => {
            const msg = event.data as SignalMessage;
            // Only process messages intended for me
            if (msg.targetId === this.myId && this.onSignalCallback) {
                this.onSignalCallback(msg.senderId, msg.data);
            }
        };
    }

    sendSignal(targetId: string, data: SignalData): void {
        const msg: SignalMessage = {
            targetId,
            senderId: this.myId,
            // RTCSessionDescription is not structured-cloneable; send a plain object.
            data: { type: data.type, sdp: data.sdp }
        };
        this.channel.postMessage(msg);
    }

    onSignal(callback: (senderId: string, data: SignalData) => void): void {
        this.onSignalCallback = callback;
    }

    destroy(): void {
        this.channel.close();
        this.onSignalCallback = null;
    }
}

// --- Manual Signaling (Different Computers, Copy-Paste) ---
// This class doesn't "send" automatically. It exposes the signal for the user to copy.
export class ManualSignaling implements SignalingService {
    private onSignalCallback: ((senderId: string, data: SignalData) => void) | null = null;
    private onOutgoingSignal: (data: string) => void;

    constructor(onOutgoingSignal: (data: string) => void) {
        this.onOutgoingSignal = onOutgoingSignal;
    }

    sendSignal(targetId: string, data: SignalData): void {
        console.log('[ManualSignaling] sendSignal called', { targetId, data });
        try {
            // Convert the signal object to a base64 string for easy copying
            const signalString = btoa(JSON.stringify({ targetId, data }));
            console.log('[ManualSignaling] Generated signal string length:', signalString.length);
            this.onOutgoingSignal(signalString);
        } catch (e) {
            console.error('[ManualSignaling] Error generating signal string:', e);
        }
    }

    /**
     * Call this when the user pastes a signal string from the other person.
     * Returns the kind of description applied; throws if the text is not a signal.
     */
    receiveManualSignal(signalString: string): 'offer' | 'answer' {
        let parsed: { data?: SignalData };
        try {
            parsed = JSON.parse(atob(signalString.trim()));
        } catch {
            throw new Error('not a valid signal string');
        }
        const kind = parsed.data?.type;
        if (kind !== 'offer' && kind !== 'answer') {
            throw new Error('signal is neither an offer nor an answer');
        }
        // We don't check targetId here since the exchange is manual.
        this.onSignalCallback?.('manual-peer', parsed.data!);
        return kind;
    }

    onSignal(callback: (senderId: string, data: SignalData) => void): void {
        this.onSignalCallback = callback;
    }

    destroy(): void {
        this.onSignalCallback = null;
    }
}
