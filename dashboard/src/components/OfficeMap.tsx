"use client";

import { motion } from 'framer-motion';
import { Hammer, HardHat, TrendingUp, Activity, Eye, ShieldAlert } from 'lucide-react';

interface DeptProps {
    id: string;
    name: string;
    icon: any;
    status: string;
    color: string;
}

const DEPARTMENTS: DeptProps[] = [
    { id: 'arquitecto', name: 'El Arquitecto', icon: Hammer, status: 'idle', color: 'from-blue-500 to-cyan-500' },
    { id: 'capataz', name: 'Capataz de Obra', icon: HardHat, status: 'idle', color: 'from-orange-500 to-amber-500' },
    { id: 'lobo', name: 'Lobo de Wall St', icon: TrendingUp, status: 'idle', color: 'from-emerald-500 to-green-600' },
    { id: 'sargento', name: 'Sargento Hierro', icon: Activity, status: 'idle', color: 'from-red-500 to-rose-600' },
    { id: 'espejo', name: 'Espejo Crítico', icon: Eye, status: 'idle', color: 'from-purple-500 to-fuchsia-500' },
];

export default function OfficeMap({ states }: { states: Record<string, string> }) {

    const getStatusStyles = (status: string, baseColor: string) => {
        switch (status) {
            case 'working':
                return `bg-gradient-to-br ${baseColor} shadow-lg shadow-${baseColor.split('-')[1]}/50 border-transparent animate-pulse`;
            case 'blocked':
                return 'bg-neutral-900 border-red-500/50 shadow-[inset_0_0_20px_rgba(239,68,68,0.2)] opacity-80';
            case 'alert':
                return 'bg-yellow-900/40 border-yellow-500 animate-bounce';
            default: // idle
                return 'bg-neutral-900 border-neutral-800 hover:border-neutral-700';
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
            {DEPARTMENTS.map(dept => {
                const Icon = dept.icon;
                const activeStatus = states[dept.id] || 'idle';
                const style = getStatusStyles(activeStatus, dept.color);
                const isWorking = activeStatus === 'working';

                return (
                    <motion.div
                        key={dept.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className={`relative rounded-2xl border p-6 flex flex-col items-center justify-center min-h-[160px] ${style} overflow-hidden transition-all duration-300`}
                    >
                        {isWorking && (
                            <div className="absolute inset-0 bg-white/10 shimmer-effect pointer-events-none" />
                        )}

                        <div className="flex flex-col items-center gap-4 z-10">
                            <div className={`p-4 rounded-full ${isWorking ? 'bg-white/20' : 'bg-neutral-800'}`}>
                                <Icon className={`w-8 h-8 ${isWorking ? 'text-white' : 'text-neutral-400'}`} />
                            </div>
                            <div className="text-center">
                                <h3 className={`font-bold text-lg ${isWorking ? 'text-white' : 'text-neutral-300'}`}>{dept.name}</h3>
                                <div className="flex items-center justify-center gap-2 mt-2">
                                    <span className={`text-xs uppercase tracking-wider font-semibold px-2 py-1 rounded-md ${activeStatus === 'working' ? 'bg-white/20 text-white' :
                                            activeStatus === 'blocked' ? 'bg-red-500/20 text-red-400' :
                                                activeStatus === 'alert' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-neutral-800 text-neutral-500'
                                        }`}>
                                        {activeStatus}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Top right badges for blockers */}
                        {activeStatus === 'blocked' && (
                            <div className="absolute top-4 right-4 text-red-500">
                                <ShieldAlert size={20} />
                            </div>
                        )}
                    </motion.div>
                );
            })}
        </div>
    );
}
