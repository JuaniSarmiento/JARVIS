"use client";

import { Activity, Moon, Zap, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function HealthWidget() {
    // In a real scenario, this would also consume SSE or a REST endpoint from Sargento
    const [metrics, setMetrics] = useState({
        heartRate: 72,
        sleepQuality: 85,
        activityLevel: 'optimal',
        warning: null
    });

    useEffect(() => {
        // SSE Listener specifically for biometrics could go here
    }, []);

    return (
        <div className="flex flex-col h-full justify-between">
            <div className="grid grid-cols-2 gap-4">

                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 rounded-full text-red-500">
                        <Activity size={24} className="animate-pulse" />
                    </div>
                    <div>
                        <div className="text-xs text-neutral-500 uppercase font-bold tracking-wider">BPM</div>
                        <div className="text-2xl font-bold text-neutral-200">{metrics.heartRate}</div>
                    </div>
                </div>

                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-400">
                        <Moon size={24} />
                    </div>
                    <div>
                        <div className="text-xs text-neutral-500 uppercase font-bold tracking-wider">Sleep</div>
                        <div className="text-2xl font-bold text-neutral-200">{metrics.sleepQuality}%</div>
                    </div>
                </div>

            </div>

            <div className="mt-4 bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Zap className="text-yellow-500" size={20} />
                    <span className="text-sm font-semibold text-neutral-300">Energy Level</span>
                </div>
                <span className="text-emerald-400 font-bold uppercase text-sm">{metrics.activityLevel}</span>
            </div>

            {metrics.warning && (
                <div className="mt-4 bg-red-950/30 border border-red-900 p-3 rounded-lg flex items-center gap-3">
                    <AlertTriangle className="text-red-500 shrink-0" size={18} />
                    <span className="text-xs text-red-200">{metrics.warning}</span>
                </div>
            )}
        </div>
    );
}
