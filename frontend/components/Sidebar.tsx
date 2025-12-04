import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
  Upload, Printer as PrinterIcon, Scissors, CheckCircle, Download,
  ArrowLeft, Sparkles, AlertTriangle,
  Activity, WifiOff, Settings2, Layers
} from 'lucide-react';
import { AppState, Printer, AppMode, Material } from '../types';
import { Button } from './ui/Button';
import { getMaterialById } from '../services/materials';

interface SidebarProps {
  appState: AppState;
  materials: Material[]; // Added prop
  onFileSelect: (file: File) => void;
  onOpenPrinterModal: () => void;
  onSuggestSplit: () => void;
  onPerformSplit: (withKeys: boolean) => void;
  onModeChange: (mode: AppMode) => void;
  onRunFailureAnalysis: () => void;
  onBackToGraph: () => void;
  onMaterialChange: (materialId: string) => void;
  onInfillChange: (infill: number) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  appState,
  materials,
  onFileSelect,
  onOpenPrinterModal,
  onSuggestSplit,
  onPerformSplit,
  onModeChange,
  onRunFailureAnalysis,
  onBackToGraph,
  onMaterialChange,
  onInfillChange
}) => {
  const {
    isLoading, loadingMessage,
    meshRegistry, rootNodeId, selectedNodeId, mode, viewMode, printers
  } = appState;

  // Derived state: Get current active node
  const activeNode = selectedNodeId ? meshRegistry[selectedNodeId] : null;
  const activePrinter = activeNode ? printers.find(p => p.id === activeNode.printerId) : null;

  // Check connection status
  const isNodeSynced = activeNode && activeNode.serverFileId !== '';

  // Dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'model/stl': ['.stl'], 'model/gltf-binary': ['.glb'] },
    multiple: false
  });

  const hasLoadedFile = !!rootNodeId;

  // Don't render Sidebar if we are in Graph Mode, EXCEPT if we are uploading (no root node yet)
  if (viewMode === 'graph' && hasLoadedFile) {
    return null;
  }

  return (
    <div className="absolute left-6 top-6 bottom-6 w-96 flex flex-col z-10 pointer-events-none">
      <div className="flex-1 flex flex-col bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden pointer-events-auto">

        {/* Header */}
        <div className="p-6 border-b border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            {hasLoadedFile && (
              <button
                onClick={onBackToGraph}
                className="p-2 -ml-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors flex items-center gap-1 text-xs font-bold uppercase"
              >
                <ArrowLeft size={16} /> Graph
              </button>
            )}
            {!hasLoadedFile && (
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                Smart Print 3D
              </h1>
            )}
          </div>

          {activeNode && (
            <div className="space-y-1">
              <div className="flex justify-between items-start">
                <h2 className="text-lg font-bold text-white truncate w-48">{activeNode.name}</h2>
                {!isNodeSynced && (
                  <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-1 rounded-full flex items-center gap-1">
                    <WifiOff size={10} /> Offline
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 font-mono">{activeNode.id.substring(0, 8)}...</p>
            </div>
          )}

          {hasLoadedFile && (
            <div className="bg-zinc-900/50 p-1 rounded-xl flex gap-1 border border-white/5">
              <button
                onClick={() => onModeChange('split')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all
                  ${mode === 'split'
                    ? 'bg-zinc-800 text-white shadow-lg border border-white/5'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'}`}
              >
                <Scissors className="w-3 h-3" />
                Split
              </button>
              <button
                onClick={() => onModeChange('failure')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all
                  ${mode === 'failure'
                    ? 'bg-zinc-800 text-white shadow-lg border border-white/5'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'}`}
              >
                <Activity className="w-3 h-3" />
                Failure Check
              </button>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6 relative">
          <AnimatePresence mode="wait">

            {/* 1. UPLOAD VIEW (Visible if no root node) */}
            {!hasLoadedFile && (
              <motion.div
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col justify-center"
              >
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer h-64 flex flex-col items-center justify-center gap-4 group
                    ${isDragActive ? 'border-primary-500 bg-primary-500/10' : 'border-zinc-700 hover:border-zinc-500 hover:bg-white/5'}
                  `}
                >
                  <input {...getInputProps()} />
                  <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-black/50">
                    <Upload className="w-8 h-8 text-zinc-400 group-hover:text-white transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-300">Drop STL model here</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 2. EDITOR VIEW */}
            {hasLoadedFile && activeNode && (
              <motion.div
                key="editor"
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="space-y-6"
              >
                <div className="space-y-4">

                  {/* PRINTER SELECTOR CARD */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-white">Target Machine</h2>
                    </div>

                    <button
                      onClick={onOpenPrinterModal}
                      className="w-full bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 hover:border-indigo-500/30 rounded-xl p-4 flex items-center gap-4 text-left group transition-all"
                    >
                      <div className="w-10 h-10 rounded-lg bg-zinc-950 flex items-center justify-center border border-white/5 group-hover:border-indigo-500/50 transition-colors">
                        <PrinterIcon className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors">
                          {activePrinter ? activePrinter.name : 'Select Printer'}
                        </h3>
                        <p className="text-xs text-zinc-500 font-mono mt-0.5">
                          {activePrinter
                            ? `${activePrinter.bedSize.x} × ${activePrinter.bedSize.y} × ${activePrinter.bedSize.z} mm`
                            : 'No printer selected'}
                        </p>
                      </div>
                      <Settings2 className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                    </button>
                  </div>

                  {/* MATERIAL SELECTOR */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-white">Material & Weight</h2>
                    </div>

                    <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-4 space-y-3">
                      {/* Material Dropdown */}
                      <div className="relative">
                        <select
                          value={activeNode.materialId || 'pla'}
                          onChange={(e) => onMaterialChange(e.target.value)}
                          className="w-full bg-zinc-800 text-white text-xs rounded-lg p-2 border border-zinc-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                        >
                          {materials.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                        <div className="absolute right-3 top-2.5 pointer-events-none text-zinc-400">
                          <Settings2 size={12} />
                        </div>
                      </div>

                      {/* Infill Slider */}
                      <div className="space-y-1 pt-2 border-t border-white/5">
                        <div className="flex justify-between text-xs text-zinc-400">
                          <span>Infill</span>
                          <span>{activeNode.infill || 20}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={activeNode.infill || 20}
                          onChange={(e) => onInfillChange(parseInt(e.target.value))}
                          className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      {/* Weight Display */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <span className="text-xs text-zinc-400">Estimated Weight</span>
                        <span className="text-sm font-bold text-white">
                          {activeNode.volume ? (
                            // Weight = Volume * Density * (Infill/100)
                            `${((activeNode.volume * (getMaterialById(activeNode.materialId || 'pla')?.density || 1.24) * ((activeNode.infill || 20) / 100)) / 1000).toFixed(1)} g`
                          ) : '--'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ACTION: SMART SPLIT */}
                  {mode === 'split' && (
                    <div className="pt-2 border-t border-white/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-white">Split Actions</h3>
                      </div>

                      {!isNodeSynced ? (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-300 text-center">
                          Backend unreachable. <br /> Visualization Only.
                        </div>
                      ) : (
                        <>
                          {!activeNode.splitPlane ? (
                            <Button onClick={onSuggestSplit} isLoading={isLoading} className="w-full text-xs py-2">
                              Analyze & Suggest Cut
                            </Button>
                          ) : (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                              <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs text-emerald-100">Cut Plane Ready</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <Button variant="secondary" onClick={() => onPerformSplit(false)} className="text-xs py-2">
                                  Simple Cut
                                </Button>
                                <Button onClick={() => onPerformSplit(true)} className="text-xs py-2">
                                  <Layers className="w-3 h-3 mr-1" /> With Keys
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* ACTION: FAILURE CHECK */}
                  {mode === 'failure' && (
                    <div className="pt-2 border-t border-white/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-white">Safety Check</h3>
                      </div>

                      {!activeNode.failureReport ? (
                        <Button onClick={onRunFailureAnalysis} isLoading={isLoading} className="w-full text-xs bg-orange-600 hover:bg-orange-500 border-orange-500/50">
                          Run Simulation
                        </Button>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl border border-white/5">
                            <span className="text-xs text-zinc-400">Risk Score</span>
                            <span className={`text-xl font-bold ${activeNode.failureReport.riskScore > 30 ? 'text-red-400' : 'text-emerald-400'}`}>
                              {activeNode.failureReport.riskScore}%
                            </span>
                          </div>
                          <div className="space-y-2">
                            {activeNode.failureReport.issues.map(issue => (
                              <div key={issue.id} className="text-[10px] p-2 bg-zinc-800/30 rounded border border-zinc-700/50">
                                <div className="flex items-center gap-1 font-bold text-zinc-300 mb-1">
                                  <AlertTriangle className="w-3 h-3 text-orange-400" /> {issue.title}
                                </div>
                                <div className="text-zinc-500">{issue.description}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* DOWNLOAD */}
                  <div className="pt-4 border-t border-white/5">
                    <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-medium transition-colors">
                      <Download className="w-4 h-4" /> Download STL
                    </button>
                  </div>

                </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Loading Overlay */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-6"
              >
                <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
                <h3 className="text-sm font-medium text-white">{loadingMessage}</h3>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};