"use client";

import { useEffect, useState } from 'react';
import OfficeMap from '@/components/OfficeMap';
import ConflictTerminal from '@/components/ConflictTerminal';
import HealthWidget from '@/components/HealthWidget';
import { Network } from 'lucide-react';

export default function Home() {
  const [events, setEvents] = useState<any[]>([]);
  const [departmentStates, setDepartmentStates] = useState<Record<string, string>>({
    arquitecto: 'idle',
    capataz: 'idle',
    lobo: 'idle',
    sargento: 'idle',
    espejo: 'idle'
  });

  useEffect(() => {
    // SSE Connection to the Jarvis Kernel
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const eventSource = new EventSource(`${apiUrl}/api/events`);

    eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'connected') return;

        // Handle incoming raw event from Redis
        setEvents(prev => [...prev.slice(-49), payload]);

        // Update dept states if the event mentions a department doing something
        if (payload.from && payload.type === 'TASK_START') {
          setDepartmentStates(prev => ({ ...prev, [payload.from]: 'working' }));
        } else if (payload.from && payload.type === 'TASK_COMPLETE') {
          setDepartmentStates(prev => ({ ...prev, [payload.from]: 'idle' }));
        } else if (payload.from && payload.type === 'BLOCK_REQUEST') {
          setDepartmentStates(prev => ({ ...prev, [payload.from]: 'alert' }));
          if (payload.payload?.target) {
            setDepartmentStates(prev => ({ ...prev, [payload.payload.target]: 'blocked' }));
          }
        }
      } catch (err) {
        console.error("Failed to parse SSE event", err);
      }
    };

    // Custom listener for jarvis:status channel
    eventSource.addEventListener('jarvis:status', (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.department && payload.status) {
          setDepartmentStates(prev => ({ ...prev, [payload.department]: payload.status }));
        }
      } catch (err) { }
    });

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans p-6 overflow-hidden">
      <header className="flex items-center justify-between mb-8 border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <Network className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            Jarvis: The Glass Office
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-neutral-400">Kernel Online</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-120px)]">
        {/* Left Column: Flow & Departments */}
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 backdrop-blur-sm flex-1">
            <h2 className="text-lg font-semibold mb-4 text-neutral-300">Operations Map</h2>
            <OfficeMap states={departmentStates} />
          </div>
        </div>

        {/* Right Column: Widgets & Terminal */}
        <div className="col-span-1 flex flex-col gap-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 h-1/3">
            <h2 className="text-lg font-semibold mb-4 text-neutral-300">Biometrics & Discipline</h2>
            <HealthWidget />
          </div>

          <div className="bg-black border border-neutral-800 rounded-xl p-4 flex-1 overflow-hidden font-mono flex flex-col shadow-2xl">
            <h2 className="text-sm font-semibold mb-2 text-neutral-500 uppercase tracking-widest flex items-center justify-between">
              <span>Conflict Terminal</span>
              <span className="text-xs text-neutral-600">Event Bus Stream</span>
            </h2>
            <ConflictTerminal events={events} />
          </div>
        </div>
      </div>
    </div>
  );
}
