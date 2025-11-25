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
        console.log(`[WebRTCPeer ${this.id}] Created peer connection`);

        this.setupConnectionListeners();
        this.setupSignalingListeners();
    }

    private setupConnectionListeners() {
        this.connection.onicecandidate = () => {
            // We use Vanilla ICE (wait for all candidates), so we don't need to send individual candidates.
        };

        this.connection.onicegatheringstatechange = () => {
            console.log(`[WebRTCPeer ${this.id}] ICE gathering state: ${this.connection.iceGatheringState}`);
        };

        this.connection.oniceconnectionstatechange = () => {
            console.log(`[WebRTCPeer ${this.id}] ICE connection state: ${this.connection.iceConnectionState}`);
        };

        this.connection.onconnectionstatechange = () => {
            const state = this.connection.connectionState;
            console.log(`[WebRTCPeer ${this.id}] Connection state: ${state}`);

            if (state === 'connected') {
                console.log(`[WebRTCPeer ${this.id}] ✅ Connection established!`);
                this.emit('connect');
            } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                console.log(`[WebRTCPeer ${this.id}] ❌ Connection ${state}`);
                this.emit('disconnect');
            }
        };

        this.connection.onsignalingstatechange = () => {
            console.log(`[WebRTCPeer ${this.id}] Signaling state: ${this.connection.signalingState}`);
        };

        // Handle receiving a data channel (if we are the answerer)
        this.connection.ondatachannel = (event) => {
            console.log(`[WebRTCPeer ${this.id}] Received data channel from remote peer`);
            this.setupDataChannel(event.channel);
        };
    }

    private waitForIceGathering(): Promise<void> {
        return new Promise((resolve) => {
            if (this.connection.iceGatheringState === 'complete') {
                console.log(`[WebRTCPeer ${this.id}] ICE gathering already complete`);
                resolve();
            } else {
                console.log(`[WebRTCPeer ${this.id}] Waiting for ICE gathering to complete...`);
                const checkState = () => {
                    if (this.connection.iceGatheringState === 'complete') {
                        console.log(`[WebRTCPeer ${this.id}] ICE gathering completed`);
                        this.connection.removeEventListener('icegatheringstatechange', checkState);
                        resolve();
                    }
                };
                this.connection.addEventListener('icegatheringstatechange', checkState);
            }
        });
    }

    private setupSignalingListeners() {
        this.signaling.onSignal(async (senderId, data) => {
            console.log(`[WebRTCPeer ${this.id}] Received signal from ${senderId}:`, data.type);

            try {
                if (data.type === 'offer') {
                    console.log(`[WebRTCPeer ${this.id}] Processing offer...`);
                    console.log(`[WebRTCPeer ${this.id}] Offer SDP:`, data.sdp?.substring(0, 100) + '...');

                    await this.connection.setRemoteDescription(new RTCSessionDescription(data));
                    console.log(`[WebRTCPeer ${this.id}] Remote description set (offer)`);

                    const answer = await this.connection.createAnswer();
                    console.log(`[WebRTCPeer ${this.id}] Created answer`);

                    await this.connection.setLocalDescription(answer);
                    console.log(`[WebRTCPeer ${this.id}] Local description set (answer)`);

                    // Wait for ICE candidates to be gathered before sending answer
                    await this.waitForIceGathering();

                    // Send the complete answer with candidates
                    if (this.connection.localDescription) {
                        console.log(`[WebRTCPeer ${this.id}] Sending answer with ${this.connection.localDescription.sdp?.match(/a=candidate/g)?.length || 0} ICE candidates`);
                        this.signaling.sendSignal(senderId, this.connection.localDescription);
                    }
                } else if (data.type === 'answer') {
                    console.log(`[WebRTCPeer ${this.id}] Processing answer...`);
                    console.log(`[WebRTCPeer ${this.id}] Answer SDP:`, data.sdp?.substring(0, 100) + '...');
                    console.log(`[WebRTCPeer ${this.id}] Answer has ${data.sdp?.match(/a=candidate/g)?.length || 0} ICE candidates`);

                    await this.connection.setRemoteDescription(new RTCSessionDescription(data));
                    console.log(`[WebRTCPeer ${this.id}] Remote description set (answer)`);
                }
            } catch (err) {
                console.error(`[WebRTCPeer ${this.id}] Error processing signal:`, err);
                this.emit('error', err as Error);
            }
        });
    }

    private setupDataChannel(channel: RTCDataChannel) {
        this.dataChannel = channel;
        console.log(`[WebRTCPeer ${this.id}] Setting up data channel: ${channel.label}`);

        this.dataChannel.onopen = () => {
            console.log(`[WebRTCPeer ${this.id}] 📡 Data channel opened!`);
        };

        this.dataChannel.onclose = () => {
            console.log(`[WebRTCPeer ${this.id}] Data channel closed`);
        };

        this.dataChannel.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data) as Message;
                console.log(`[WebRTCPeer ${this.id}] Received message:`, msg);
                this.emit('data', msg);
            } catch (e) {
                console.error(`[WebRTCPeer ${this.id}] Failed to parse message:`, e);
            }
        };

        this.dataChannel.onerror = (error) => {
            console.error(`[WebRTCPeer ${this.id}] Data channel error:`, error);
            this.emit('error', error as any);
        };
    }

    async connect(targetPeerId: string): Promise<void> {
        console.log(`[WebRTCPeer ${this.id}] Initiating connection to ${targetPeerId}...`);

        // Create Data Channel (Initiator)
        const channel = this.connection.createDataChannel('thought-map-sync');
        console.log(`[WebRTCPeer ${this.id}] Created data channel`);
        this.setupDataChannel(channel);

        // Create Offer
        const offer = await this.connection.createOffer();
        console.log(`[WebRTCPeer ${this.id}] Created offer`);

        await this.connection.setLocalDescription(offer);
        console.log(`[WebRTCPeer ${this.id}] Local description set (offer)`);

        // Wait for ICE candidates to be gathered
        await this.waitForIceGathering();

        // Send the complete offer with candidates
        if (this.connection.localDescription) {
            const candidateCount = this.connection.localDescription.sdp?.match(/a=candidate/g)?.length || 0;
            console.log(`[WebRTCPeer ${this.id}] Sending offer with ${candidateCount} ICE candidates`);
            this.signaling.sendSignal(targetPeerId, this.connection.localDescription);
        }
    }

    send(data: Message): void {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            console.log(`[WebRTCPeer ${this.id}] Sending message:`, data);
            this.dataChannel.send(JSON.stringify(data));
        } else {
            console.warn(`[WebRTCPeer ${this.id}] Cannot send message - channel state: ${this.dataChannel?.readyState || 'null'}`);
        }
    }

    disconnect(): void {
        console.log(`[WebRTCPeer ${this.id}] Disconnecting...`);
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
