"use client";

import { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

export default function ConflictTerminal({ events }: { events: any[] }) {
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [events]);

    const renderEventContent = (ev: any) => {
        if (!ev) return 'Loading kernel signal...';

        const timestamp = new Date(ev.timestamp || Date.now()).toLocaleTimeString();
        const type = ev.type || 'SYSTEM';
        const from = ev.from ? `[${ev.from.toUpperCase()}]` : '[KERNEL]';

        let colorClass = 'text-green-400';
        if (type === 'BLOCK_REQUEST') colorClass = 'text-red-400';
        if (type === 'ESCALATE') colorClass = 'text-yellow-400';
        if (type === 'TASK_START') colorClass = 'text-blue-400';

        const payloadStr = typeof ev.payload === 'object'
            ? JSON.stringify(ev.payload)
            : String(ev.payload || '');

        return (
            <div className="mb-2 opacity-90 hover:opacity-100 transition-opacity">
                <span className="text-neutral-500 mr-2">[{timestamp}]</span>
                <span className="text-purple-400 mr-2">{from}</span>
                <span className={`font-bold ${colorClass} mr-2`}>{type}</span>
                <span className="text-neutral-300 break-words">{payloadStr}</span>
            </div >
        );
    };

    return (
        <div className="flex-1 w-full bg-black rounded-lg border border-neutral-800 p-4 font-mono text-xs overflow-y-auto custom-scrollbar relative">
            <div className="absolute top-2 right-2 opacity-20">
                <Terminal size={48} />
            </div>

            <div className="flex flex-col gap-1 z-10 relative">
                <div className="text-neutral-500 mb-4 border-b border-neutral-800 pb-2">
                    Jarvis OS v3.0 - Event Event Bus Monitor
                    <br />
                    Listening on Redis channels: jarvis:events, jarvis:blocks
                </div>

                {events.length === 0 ? (
                    <div className="text-neutral-600 animate-pulse">Awaiting signals...</div>
                ) : (
                    events.map((ev, i) => (
                        <div key={i}>{renderEventContent(ev)}</div>
                    ))
                )}

                <div ref={endRef} />
            </div>
        </div>
    );
}
