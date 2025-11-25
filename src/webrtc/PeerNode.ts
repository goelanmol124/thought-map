import type { PeerNode, Message, SignalingService } from './types';

// Use a free STUN server for NAT traversal
const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ]
};

export class WebRTCPeer implements PeerNode {
    readonly id: string;
    private connection: RTCPeerConnection;
    private dataChannel: RTCDataChannel | null = null;
    private signaling: SignalingService;
    private listeners: Record<string, Function[]> = {
        connect: [],
        disconnect: [],
        data: [],
        error: []
    };

    constructor(id: string, signaling: SignalingService) {
        this.id = id;
        this.signaling = signaling;
        this.connection = new RTCPeerConnection(ICE_SERVERS);

        this.setupConnectionListeners();
        this.setupSignalingListeners();
    }

    private setupConnectionListeners() {
        this.connection.onicecandidate = (event) => {
            if (event.candidate) {
                // In a real mesh, we'd send this to a specific peer. 
                // For now, we broadcast or rely on the signaling layer's target.
                // We assume the 'connect' method sets up the target.
            }
        };

        this.connection.onconnectionstatechange = () => {
            const state = this.connection.connectionState;
            if (state === 'connected') {
                this.emit('connect');
            } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                this.emit('disconnect');
            }
        };

        // Handle receiving a data channel (if we are the answerer)
        this.connection.ondatachannel = (event) => {
            this.setupDataChannel(event.channel);
        };
    }

    private setupSignalingListeners() {
        this.signaling.onSignal(async (senderId, data) => {
            try {
                if (data.type === 'offer') {
                    await this.connection.setRemoteDescription(new RTCSessionDescription(data));
                    const answer = await this.connection.createAnswer();
                    await this.connection.setLocalDescription(answer);
                    this.signaling.sendSignal(senderId, answer);
                } else if (data.type === 'answer') {
                    await this.connection.setRemoteDescription(new RTCSessionDescription(data));
                } else if (data.candidate) {
                    await this.connection.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            } catch (err) {
                this.emit('error', err as Error);
            }
        });
    }

    private setupDataChannel(channel: RTCDataChannel) {
        this.dataChannel = channel;

        this.dataChannel.onopen = () => {
            // Channel ready
        };

        this.dataChannel.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data) as Message;
                this.emit('data', msg);
            } catch (e) {
                console.error('Failed to parse message', e);
            }
        };

        this.dataChannel.onerror = (error) => {
            this.emit('error', error as any); // RTCError is not strictly Error
        };
    }

    async connect(targetPeerId: string): Promise<void> {
        // Create Data Channel (Initiator)
        const channel = this.connection.createDataChannel('thought-map-sync');
        this.setupDataChannel(channel);

        // Create Offer
        const offer = await this.connection.createOffer();
        await this.connection.setLocalDescription(offer);

        // Send Offer via Signaling
        this.signaling.sendSignal(targetPeerId, offer);

        // Handle ICE candidates for this specific connection attempt
        this.connection.onicecandidate = (event) => {
            if (event.candidate) {
                this.signaling.sendSignal(targetPeerId, { candidate: event.candidate });
            }
        };
    }

    send(data: Message): void {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(data));
        } else {
            console.warn('Data channel not open, cannot send message');
        }
    }

    disconnect(): void {
        this.dataChannel?.close();
        this.connection.close();
        this.signaling.destroy();
    }

    on(event: 'connect' | 'disconnect' | 'data' | 'error', listener: Function): void {
        this.listeners[event].push(listener);
    }

    private emit(event: string, ...args: any[]) {
        this.listeners[event].forEach(fn => fn(...args));
    }
}
