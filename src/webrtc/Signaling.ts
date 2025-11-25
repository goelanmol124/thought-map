import type { SignalingService } from './types';

interface SignalMessage {
    targetId: string;
    senderId: string;
    data: any;
}

// --- Local Signaling (Same Browser, Different Tabs) ---
export class LocalSignaling implements SignalingService {
    private channel: BroadcastChannel;
    private onSignalCallback: ((senderId: string, data: any) => void) | null = null;
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

    sendSignal(targetId: string, data: any): void {
        const msg: SignalMessage = {
            targetId,
            senderId: this.myId,
            data
        };
        this.channel.postMessage(msg);
    }

    onSignal(callback: (senderId: string, data: any) => void): void {
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
    private onSignalCallback: ((senderId: string, data: any) => void) | null = null;
    private onOutgoingSignal: (data: string) => void;

    constructor(onOutgoingSignal: (data: string) => void) {
        this.onOutgoingSignal = onOutgoingSignal;
    }

    sendSignal(targetId: string, data: any): void {
        // Convert the signal object to a base64 string for easy copying
        const signalString = btoa(JSON.stringify({ targetId, data }));
        this.onOutgoingSignal(signalString);
    }

    // Call this when the user pastes a signal string from the other person
    receiveManualSignal(signalString: string) {
        try {
            const parsed = JSON.parse(atob(signalString));
            if (this.onSignalCallback) {
                // We don't strictly check targetId here since it's manual
                this.onSignalCallback('manual-peer', parsed.data);
            }
        } catch (e) {
            console.error('Invalid signal string', e);
        }
    }

    onSignal(callback: (senderId: string, data: any) => void): void {
        this.onSignalCallback = callback;
    }

    destroy(): void {
        this.onSignalCallback = null;
    }
}
