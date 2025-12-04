import React from 'react';
import { motion } from 'framer-motion';
import { Ruler } from 'lucide-react';

interface UnitSelectorProps {
    currentUnit: 'mm' | 'm' | 'cm';
    onUnitChange: (unit: 'mm' | 'm' | 'cm') => void;
}

export const UnitSelector: React.FC<UnitSelectorProps> = ({ currentUnit, onUnitChange }) => {
    return (
        <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
            <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 p-1.5 rounded-full shadow-2xl flex items-center gap-1">

                {/* Label / Icon */}
                <div className="px-3 flex items-center gap-2 text-zinc-500 border-r border-white/5 mr-1">
                    <Ruler size={14} />
                    <span className="text-xs font-medium uppercase tracking-wider">Unit</span>
                </div>

                {/* MM Option */}
                <button
                    onClick={() => onUnitChange('mm')}
                    className={`
            relative px-4 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 z-10
            ${currentUnit === 'mm' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}
          `}
                >
                    {currentUnit === 'mm' && (
                        <motion.div
                            layoutId="activeUnit"
                            className="absolute inset-0 bg-zinc-700 rounded-full shadow-inner"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                    )}
                    <span className="relative z-10">mm</span>
                </button>

                {/* CM Option */}
                <button
                    onClick={() => onUnitChange('cm')}
                    className={`
            relative px-4 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 z-10
            ${currentUnit === 'cm' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}
          `}
                >
                    {currentUnit === 'cm' && (
                        <motion.div
                            layoutId="activeUnit"
                            className="absolute inset-0 bg-zinc-700 rounded-full shadow-inner"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                    )}
                    <span className="relative z-10">cm</span>
                </button>

                {/* Meter Option */}
                <button
                    onClick={() => onUnitChange('m')}
                    className={`
            relative px-4 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 z-10
            ${currentUnit === 'm' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}
          `}
                >
                    {currentUnit === 'm' && (
                        <motion.div
                            layoutId="activeUnit"
                            className="absolute inset-0 bg-zinc-700 rounded-full shadow-inner"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                    )}
                    <span className="relative z-10">m</span>
                </button>

            </div>
        </div>
    );
};
