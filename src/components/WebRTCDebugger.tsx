import { useEffect, useReducer, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { WebRTCPeer } from '../webrtc/PeerNode';
import { LocalSignaling, ManualSignaling } from '../webrtc/Signaling';
import { connectionLabel, connectionReducer, initialConnection, type SignalingMode } from '../webrtc/connectionMachine';

const MAX_LOG_LINES = 200;

interface Props {
    onClose: () => void;
}

/**
 * Experimental peer-to-peer panel. Exercises the WebRTC transport layer with
 * chat messages; map sync over this channel is not wired up yet.
 */
export function WebRTCDebugger({ onClose }: Props) {
    const [myId] = useState(() => 'peer-' + Math.floor(1000 + Math.random() * 9000));
    const [mode, setMode] = useState<SignalingMode>('local');
    const [conn, dispatch] = useReducer(connectionReducer, initialConnection);
    const [targetId, setTargetId] = useState('');
    const [incomingSignal, setIncomingSignal] = useState('');
    const [msgInput, setMsgInput] = useState('');
    const [logs, setLogs] = useState<string[]>([]);

    const peerRef = useRef<WebRTCPeer | null>(null);
    const manualRef = useRef<ManualSignaling | null>(null);

    const addLog = (msg: string) =>
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-MAX_LOG_LINES));

    // One peer per signaling mode, created eagerly so this tab can answer
    // incoming offers without clicking anything first.
    useEffect(() => {
        let signaling: LocalSignaling | ManualSignaling;
        if (mode === 'local') {
            signaling = new LocalSignaling(myId);
            manualRef.current = null;
        } else {
            const manual = new ManualSignaling(signal => {
                dispatch({ type: 'SIGNAL_READY', signal });
                addLog(`Signal ready to copy (${signal.length} chars)`);
            });
            manualRef.current = manual;
            signaling = manual;
        }

        const peer = new WebRTCPeer(myId, signaling);
        let active = true;
        peer.on('connect', () => { if (active) { dispatch({ type: 'PEER_CONNECTED' }); addLog('Connected'); } });
        peer.on('disconnect', () => { if (active) { dispatch({ type: 'PEER_DISCONNECTED' }); addLog('Disconnected'); } });
        peer.on('error', err => { if (active) { dispatch({ type: 'FAILED', error: err.message }); addLog(`Error: ${err.message}`); } });
        peer.on('data', msg => { if (active && msg.type === 'CHAT') addLog(`Received: ${msg.payload}`); });
        peerRef.current = peer;
        dispatch({ type: 'RESET' });
        addLog(`Ready as ${myId} (${mode === 'local' ? 'local tabs' : 'copy-paste'})`);

        return () => {
            active = false;
            peer.disconnect();
            peerRef.current = null;
            manualRef.current = null;
        };
    }, [mode, myId]);

    const handleConnect = async () => {
        const peer = peerRef.current;
        if (!peer) return;
        try {
            if (mode === 'local') {
                const target = targetId.trim();
                if (!target) return;
                dispatch({ type: 'CONNECT', target });
                addLog(`Connecting to ${target}...`);
                await peer.connect(target);
            } else {
                dispatch({ type: 'GATHER' });
                addLog('Creating offer (gathering ICE candidates)...');
                await peer.connect('manual-peer');
            }
        } catch (e) {
            const error = e instanceof Error ? e.message : String(e);
            dispatch({ type: 'FAILED', error });
            addLog(`Error: ${error}`);
        }
    };

    const handleApplySignal = () => {
        const manual = manualRef.current;
        const signal = incomingSignal.trim();
        if (!manual || !signal) return;
        try {
            const kind = manual.receiveManualSignal(signal);
            addLog(`Applied ${kind} from the other peer`);
            if (kind === 'offer') dispatch({ type: 'GATHER' });
            setIncomingSignal('');
        } catch (e) {
            addLog(`Could not read that signal: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const handleSend = () => {
        if (peerRef.current && msgInput) {
            peerRef.current.send({ type: 'CHAT', payload: msgInput });
            addLog(`Sent: ${msgInput}`);
            setMsgInput('');
        }
    };

    const connected = conn.status === 'connected';
    const busy = conn.status === 'connecting' || conn.status === 'gathering';

    return (
        <section className="p-4 border rounded-lg bg-white dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-sm text-stone-800 dark:text-slate-200" aria-label="Peer-to-peer connection">
            <div className="flex items-start justify-between mb-2">
                <div>
                    <h3 className="font-bold">Peer-to-peer (WebRTC, experimental)</h3>
                    <p className="text-xs text-stone-500 dark:text-slate-400">Tests a direct browser-to-browser channel. Map sync over it is not wired up yet.</p>
                </div>
                <button onClick={onClose} className="p-1 rounded hover:bg-stone-100 dark:hover:bg-slate-700" aria-label="Close peer-to-peer panel">
                    <X size={16} />
                </button>
            </div>

            <fieldset className="mb-3 flex gap-4" disabled={busy}>
                <legend className="sr-only">Signaling mode</legend>
                <label className="flex items-center gap-1">
                    <input type="radio" name="signaling-mode" checked={mode === 'local'} onChange={() => setMode('local')} /> Local (tabs)
                </label>
                <label className="flex items-center gap-1">
                    <input type="radio" name="signaling-mode" checked={mode === 'manual'} onChange={() => setMode('manual')} /> Manual (copy-paste)
                </label>
            </fieldset>

            <div className="mb-2">
                <strong>My ID:</strong> {myId} <br />
                <strong>Status:</strong> <span className={connected ? 'text-green-600' : conn.status === 'failed' ? 'text-red-600' : 'text-amber-600'}>{connectionLabel(conn)}</span>
            </div>

            {mode === 'local' && (
                <div className="flex gap-2 mb-2">
                    <input
                        className="border rounded p-1 flex-grow min-w-0 bg-white dark:bg-slate-900 border-stone-300 dark:border-slate-600"
                        placeholder="Target ID"
                        aria-label="ID of the other tab"
                        value={targetId}
                        onChange={e => setTargetId(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleConnect()}
                    />
                    <button onClick={handleConnect} disabled={busy || connected || !targetId.trim()} className="bg-blue-600 disabled:opacity-50 text-white px-2 py-1 rounded">Connect</button>
                </div>
            )}

            {mode === 'manual' && (
                <div className="mb-2 space-y-2">
                    <p className="text-xs text-stone-500 dark:text-slate-400">
                        One side creates an offer and sends it to the other. The other side applies it and sends back the answer it gets.
                    </p>
                    <button onClick={handleConnect} disabled={busy || connected} className="bg-blue-600 disabled:opacity-50 text-white px-2 py-1 rounded">Create offer</button>

                    {conn.status === 'awaiting-peer' && (
                        <div>
                            <p>Copy this to the other peer:</p>
                            <textarea readOnly className="w-full h-20 text-xs font-mono border rounded bg-stone-50 dark:bg-slate-900" value={conn.outgoing} onClick={e => e.currentTarget.select()} />
                        </div>
                    )}

                    <div>
                        <p>Paste the signal from the other peer:</p>
                        <textarea
                            className="w-full h-20 text-xs font-mono border rounded bg-white dark:bg-slate-900 border-stone-300 dark:border-slate-600"
                            value={incomingSignal}
                            onChange={e => setIncomingSignal(e.target.value)}
                            placeholder="Paste offer or answer here..."
                        />
                        <button onClick={handleApplySignal} disabled={!incomingSignal.trim()} className="bg-green-600 disabled:opacity-50 text-white px-2 py-1 rounded mt-1">Apply signal</button>
                    </div>
                </div>
            )}

            <div className="flex gap-2 mb-2">
                <input
                    className="border rounded p-1 flex-grow min-w-0 bg-white dark:bg-slate-900 border-stone-300 dark:border-slate-600"
                    placeholder="Type message..."
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    disabled={!connected}
                />
                <button onClick={handleSend} disabled={!connected || !msgInput} className="bg-indigo-600 disabled:opacity-50 text-white px-2 py-1 rounded">Send</button>
            </div>

            <div className="h-40 overflow-y-auto bg-stone-50 dark:bg-slate-900 border rounded border-stone-200 dark:border-slate-700 p-2 font-mono text-xs" aria-live="polite">
                {logs.map((log, i) => <div key={i}>{log}</div>)}
            </div>
        </section>
    );
}
