import { useState, useRef } from 'react';
import { WebRTCPeer } from '../webrtc/PeerNode';
import { LocalSignaling, ManualSignaling } from '../webrtc/Signaling';
import type { Message } from '../webrtc/types';

export function WebRTCDebugger() {
    const [myId] = useState(() => 'peer-' + Math.floor(Math.random() * 1000));
    const [targetId, setTargetId] = useState('');
    const [mode, setMode] = useState<'local' | 'manual'>('local');
    const [status, setStatus] = useState('Disconnected');
    const [logs, setLogs] = useState<string[]>([]);
    const [msgInput, setMsgInput] = useState('');

    // For Manual Signaling
    const [outgoingSignal, setOutgoingSignal] = useState('');
    const [incomingSignal, setIncomingSignal] = useState('');

    const peerRef = useRef<WebRTCPeer | null>(null);
    const manualSignalingRef = useRef<ManualSignaling | null>(null);

    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    const initPeer = () => {
        if (peerRef.current) return;

        let signaling;
        if (mode === 'local') {
            signaling = new LocalSignaling(myId);
        } else {
            signaling = new ManualSignaling((data) => {
                setOutgoingSignal(data);
                addLog('Generated Signal (Copy this to other peer)');
            });
            manualSignalingRef.current = signaling;
        }

        const peer = new WebRTCPeer(myId, signaling);

        peer.on('connect', () => setStatus('Connected'));
        peer.on('disconnect', () => setStatus('Disconnected'));
        peer.on('error', (err: any) => addLog(`Error: ${err.message}`));
        peer.on('data', (msg: Message) => {
            if (msg.type === 'CHAT') {
                addLog(`Received: ${msg.payload}`);
            }
        });

        peerRef.current = peer;
        addLog(`Initialized Peer: ${myId} (${mode})`);
    };

    const handleConnect = async () => {
        if (!peerRef.current) initPeer();
        if (mode === 'local' && targetId) {
            addLog(`Connecting to ${targetId}...`);
            await peerRef.current?.connect(targetId);
        } else if (mode === 'manual') {
            // In manual mode, 'connect' starts the offer generation
            addLog('Generating Offer (Waiting for ICE candidates)...');
            await peerRef.current?.connect('manual-peer');
        }
    };

    const handlePasteSignal = () => {
        if (!manualSignalingRef.current) return;
        manualSignalingRef.current.receiveManualSignal(incomingSignal);
        addLog('Processed Incoming Signal');
        setIncomingSignal('');
    };

    const handleSend = () => {
        if (peerRef.current && msgInput) {
            peerRef.current.send({ type: 'CHAT', payload: msgInput });
            addLog(`Sent: ${msgInput}`);
            setMsgInput('');
        }
    };

    return (
        <div className="p-4 border rounded bg-gray-100 dark:bg-slate-800 text-sm">
            <h3 className="font-bold mb-2">WebRTC Debugger</h3>

            <div className="mb-4 flex gap-2">
                <label>
                    <input type="radio" checked={mode === 'local'} onChange={() => setMode('local')} /> Local (Tabs)
                </label>
                <label>
                    <input type="radio" checked={mode === 'manual'} onChange={() => setMode('manual')} /> Manual (Copy-Paste)
                </label>
            </div>

            <div className="mb-2">
                <strong>My ID:</strong> {myId} <br />
                <strong>Status:</strong> <span className={status === 'Connected' ? 'text-green-600' : 'text-red-600'}>{status}</span>
            </div>

            {mode === 'local' && (
                <div className="flex gap-2 mb-2">
                    <input
                        className="border p-1"
                        placeholder="Target ID"
                        value={targetId}
                        onChange={e => setTargetId(e.target.value)}
                    />
                    <button onClick={handleConnect} className="bg-blue-500 text-white px-2 py-1 rounded">Connect</button>
                </div>
            )}

            {mode === 'manual' && (
                <div className="mb-2 space-y-2">
                    <button onClick={handleConnect} className="bg-blue-500 text-white px-2 py-1 rounded">Generate Offer</button>

                    {outgoingSignal && (
                        <div>
                            <p>Copy this to other peer:</p>
                            <textarea readOnly className="w-full h-20 text-xs font-mono" value={outgoingSignal} onClick={e => e.currentTarget.select()} />
                        </div>
                    )}

                    <div>
                        <p>Paste signal from other peer:</p>
                        <textarea
                            className="w-full h-20 text-xs font-mono border"
                            value={incomingSignal}
                            onChange={e => setIncomingSignal(e.target.value)}
                            placeholder="Paste Offer/Answer here..."
                        />
                        <button onClick={handlePasteSignal} className="bg-green-500 text-white px-2 py-1 rounded mt-1">Process Signal</button>
                    </div>
                </div>
            )}

            <div className="flex gap-2 mb-2">
                <input
                    className="border p-1 flex-grow"
                    placeholder="Type message..."
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                />
                <button onClick={handleSend} className="bg-indigo-500 text-white px-2 py-1 rounded">Send</button>
            </div>

            <div className="h-40 overflow-y-auto bg-white dark:bg-slate-900 border p-2 font-mono text-xs">
                {logs.map((log, i) => <div key={i}>{log}</div>)}
            </div>
        </div>
    );
}
