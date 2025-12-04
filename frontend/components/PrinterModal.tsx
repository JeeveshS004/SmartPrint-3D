import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, X, Search, Sparkles, Server } from 'lucide-react';
import { Printer as PrinterType } from '../types';

interface PrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  printers: PrinterType[];
  selectedPrinterId: string | undefined;
  onSelect: (printer: PrinterType) => void;
  onScanMarket: () => void;
  isScanning: boolean;
}

export const PrinterModal: React.FC<PrinterModalProps> = ({
  isOpen,
  onClose,
  printers,
  selectedPrinterId,
  onSelect,
  onScanMarket,
  isScanning
}) => {
  const [search, setSearch] = useState('');

  // Group and Filter Printers
  const groupedPrinters = useMemo(() => {
    const filtered = printers.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.series.toLowerCase().includes(search.toLowerCase())
    );

    return filtered.reduce((acc, printer) => {
      if (!acc[printer.series]) acc[printer.series] = [];
      acc[printer.series].push(printer);
      return acc;
    }, {} as Record<string, PrinterType[]>);
  }, [printers, search]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-zinc-900 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Server className="text-indigo-500" /> Select Printer Profile
                </h2>
                <p className="text-sm text-zinc-400">Choose a target machine to visualize build volume.</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Toolbar */}
            <div className="px-6 py-4 flex gap-4 border-b border-white/5 bg-zinc-800/50">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
                <input 
                  type="text"
                  placeholder="Search brand or model..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <button 
                onClick={onScanMarket}
                disabled={isScanning}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              >
                {isScanning ? (
                  <span className="animate-spin mr-1">⚡</span> 
                ) : (
                  <Sparkles size={16} />
                )}
                {isScanning ? 'Scanning...' : 'AI Sync'}
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-950/30">
              {Object.entries(groupedPrinters).length > 0 ? (
                Object.entries(groupedPrinters).map(([series, list]: [string, PrinterType[]]) => (
                  <div key={series}>
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 px-1">{series} Series</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {list.map(printer => (
                        <button
                          key={printer.id}
                          onClick={() => { onSelect(printer); onClose(); }}
                          className={`
                            relative flex flex-col p-4 rounded-xl border text-left transition-all
                            ${selectedPrinterId === printer.id 
                              ? 'bg-indigo-600/10 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                              : 'bg-zinc-800/40 border-white/5 hover:bg-zinc-800 hover:border-white/10'}
                          `}
                        >
                          <span className={`font-semibold ${selectedPrinterId === printer.id ? 'text-indigo-300' : 'text-zinc-200'}`}>
                            {printer.name}
                          </span>
                          <span className="text-xs text-zinc-500 mt-1 font-mono">
                            Volume: {printer.bedSize.x} × {printer.bedSize.y} × {printer.bedSize.z} mm
                          </span>
                          {selectedPrinterId === printer.id && (
                            <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                   <p className="text-zinc-500">No printers found. Try syncing with AI.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-zinc-900 rounded-b-2xl text-center">
              <p className="text-xs text-zinc-600">
                Data generated by Gemini AI. Specifications may vary from real-world hardware.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};