export type MessageType = 'HANDSHAKE' | 'SYNC_STEP_1' | 'SYNC_STEP_2' | 'UPDATE' | 'CHAT';

export interface Message {
    type: MessageType;
    payload: string; // Base64 encoded for binary data, or plain string for CHAT
}

/** Session description exchanged during signaling (offer or answer, ICE candidates inlined). */
export type SignalData = RTCSessionDescriptionInit;

export interface SignalingService {
    // Send a signal to a specific peer
    sendSignal(targetId: string, data: SignalData): void;

    // Receive signals intended for this peer
    onSignal(callback: (senderId: string, data: SignalData) => void): void;

    // Clean up
    destroy(): void;
}

export interface PeerNode {
    readonly id: string;

    // Connect to a remote peer
    connect(targetPeerId: string): Promise<void>;

    // Send data
    send(data: Message): void;

    // Close connection
    disconnect(): void;

    // Event Listeners
    on(event: 'connect', listener: () => void): void;
    on(event: 'disconnect', listener: () => void): void;
    on(event: 'data', listener: (data: Message) => void): void;
    on(event: 'error', listener: (error: Error) => void): void;
}
