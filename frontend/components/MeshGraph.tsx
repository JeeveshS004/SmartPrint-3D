import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MeshNode, NodeType, Printer, FailureReport, Material } from '../types';
import { GitCommit, AlertTriangle, CheckCircle, Printer as PrinterIcon, Box, ZoomIn, Scale, Database } from 'lucide-react';
import { getMaterialById } from '../services/materials';

interface MeshGraphProps {
  registry: Record<string, MeshNode>;
  rootId: string | null;
  printers: Printer[];
  onNodeDoubleClick: (id: string) => void;
  displayUnit: 'mm' | 'm' | 'cm';
  onMaterialChange: (nodeId: string, materialId: string) => void;
  onInfillChange: (nodeId: string, infill: number) => void;
  materials: Material[];
}

// Helper to layout nodes in a tree structure
// Returns a map of id -> {x, y}
const calculateLayout = (
  registry: Record<string, MeshNode>,
  rootId: string | null
): Record<string, { x: number, y: number }> => {
  if (!rootId) return {};

  const positions: Record<string, { x: number, y: number }> = {};
  const levelHeight = 200; // Vertical space between siblings
  const levelWidth = 350;  // Horizontal space between generations

  const traverse = (nodeId: string, depth: number, offset: number) => {
    const node = registry[nodeId];
    if (!node) return;

    // Simple layout strategy: 
    // X is based on depth
    // Y is based on a global counter or relative offset. 
    // To keep it simple for this demo, we'll use a pre-calculated hierarchy check.

    positions[nodeId] = { x: depth * levelWidth, y: offset };

    if (node.childrenIds.length > 0) {
      const childOffsetStep = levelHeight / (node.childrenIds.length || 1);
      let currentY = offset - (levelHeight / 2) + (childOffsetStep / 2);

      node.childrenIds.forEach((childId, index) => {
        // Spread children vertically
        const spread = node.childrenIds.length === 1 ? 0 : (index === 0 ? -150 : 150);
        traverse(childId, depth + 1, offset + spread);
      });
    }
  };

  traverse(rootId, 0, 0);
  return positions;
};

export const MeshGraph: React.FC<MeshGraphProps> = ({ registry, rootId, printers, onNodeDoubleClick, displayUnit, onMaterialChange, onInfillChange, materials }) => {
  const [pan, setPan] = useState({ x: 100, y: window.innerHeight / 2 - 100 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const positions = calculateLayout(registry, rootId);

  // Handle Panning
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    // Simple zoom logic
    // setZoom(prev => Math.min(Math.max(prev - e.deltaY * 0.001, 0.5), 2));
  };

  return (
    <div
      className="absolute inset-0 bg-[#09090b] overflow-hidden cursor-grab active:cursor-grabbing selection:bg-transparent"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      ref={containerRef}
    >
      {/* Grid Background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)',
          backgroundSize: `${30 * zoom}px ${30 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`
        }}
      />

      {/* Canvas Content */}
      <motion.div
        className="absolute top-0 left-0 w-full h-full origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
        }}
      >
        {/* Draw Connections (Edges) */}
        <svg className="absolute top-0 left-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
          {Object.entries(positions).map(([id, pos]) => {
            const node = registry[id];
            if (!node || !node.childrenIds.length) return null;

            return node.childrenIds.map(childId => {
              const childPos = positions[childId];
              if (!childPos) return null;

              // Calculate Bezier Curve
              const startX = pos.x + 280; // Right side of parent card
              const startY = pos.y + 80;  // Middle of parent card height (approx)
              const endX = childPos.x;
              const endY = childPos.y + 80;

              const cp1x = startX + 100;
              const cp1y = startY;
              const cp2x = endX - 100;
              const cp2y = endY;

              return (
                <path
                  key={`${id}-${childId}`}
                  d={`M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`}
                  fill="none"
                  stroke="#3f3f46"
                  strokeWidth="2"
                  className="transition-colors duration-500"
                />
              );
            });
          })}
        </svg>

        {/* Draw Nodes */}
        {Object.entries(positions).map(([id, pos]) => {
          const node = registry[id];
          const printer = printers.find(p => p.id === node.printerId);

          return (
            <div
              key={id}
              className="absolute group"
              style={{
                left: pos.x,
                top: pos.y,
                width: '280px'
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onNodeDoubleClick(id);
              }}
            >
              {/* n8n Style Node Card */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.02 }}
                className={`
                  relative bg-zinc-900 border-2 rounded-xl shadow-2xl transition-all duration-200 overflow-hidden cursor-pointer
                  ${node.type === NodeType.ORIGIN ? 'border-indigo-500/50 hover:border-indigo-400' : 'border-zinc-700 hover:border-zinc-500'}
                `}
              >
                {/* Header Color Strip */}
                <div className={`h-1.5 w-full ${node.type === NodeType.ORIGIN ? 'bg-indigo-500' : 'bg-emerald-500'}`} />

                <div className="p-4 space-y-3">
                  {/* Title Section */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${node.type === NodeType.ORIGIN ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        <GitCommit size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white truncate w-32">{node.name}</h3>
                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{node.type}</p>
                      </div>
                    </div>
                    {/* Double click Hint */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <ZoomIn size={14} className="text-zinc-500" />
                    </div>
                  </div>

                  <div className="h-px bg-white/5" />

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-zinc-950/50 p-2 rounded border border-white/5">
                      <div className="flex items-center gap-1 text-zinc-500 mb-1">
                        <PrinterIcon size={10} /> Printer
                      </div>
                      <div className="text-zinc-300 truncate font-medium">
                        {printer ? printer.name : 'None'}
                      </div>
                    </div>

                    <div className="bg-zinc-950/50 p-2 rounded border border-white/5">
                      <div className="flex items-center gap-1 text-zinc-500 mb-1">
                        <Box size={10} /> Volume
                      </div>
                      <div className="text-zinc-300 font-medium">
                        {node.volume ? (
                          displayUnit === 'mm'
                            ? `${(node.volume).toLocaleString()} mm³`
                            : displayUnit === 'cm'
                              ? `${(node.volume / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cm³`
                              : `${(node.volume * 1e-9).toExponential(2)} m³`
                        ) : '--'}
                      </div>
                    </div>
                  </div>

                  {/* Material & Weight Row */}
                  <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                    <div className="bg-zinc-950/50 p-2 rounded border border-white/5 relative group/select">
                      <div className="flex items-center gap-1 text-zinc-500 mb-1">
                        <Database size={10} /> Material
                      </div>
                      <select
                        value={node.materialId || 'pla'}
                        onChange={(e) => {
                          e.stopPropagation();
                          onMaterialChange(id, e.target.value);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className="w-full bg-transparent text-zinc-300 font-medium outline-none appearance-none cursor-pointer absolute inset-0 pl-2 pt-5 z-10 opacity-0"
                      >
                        {materials.map(m => (
                          <option key={m.id} value={m.id} className="bg-zinc-900 text-white">
                            {m.name.split(' ')[0]}
                          </option>
                        ))}
                      </select>
                      <div className="text-zinc-300 font-medium truncate relative z-0 pointer-events-none">
                        {getMaterialById(node.materialId || 'pla')?.name.split(' ')[0]}
                      </div>
                    </div>

                    <div className="bg-zinc-950/50 p-2 rounded border border-white/5">
                      <div className="flex items-center gap-1 text-zinc-500 mb-1">
                        <Scale size={10} /> Weight
                      </div>
                      <div className="text-zinc-300 font-medium">
                        {node.volume ? (
                          `${((node.volume * (getMaterialById(node.materialId || 'pla')?.density || 1.24) * ((node.infill || 20) / 100)) / 1000).toFixed(1)} g`
                        ) : '--'}
                      </div>
                    </div>
                  </div>

                  {/* Infill Slider Row */}
                  <div className="mt-2 bg-zinc-950/50 p-2 rounded border border-white/5">
                    <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                      <span>Infill</span>
                      <span>{node.infill || 20}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={node.infill || 20}
                      onChange={(e) => {
                        e.stopPropagation();
                        onInfillChange(id, parseInt(e.target.value));
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Failure Report Pill */}
                  {node.failureReport ? (
                    <div className={`
                       flex items-center justify-between px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wide
                       ${node.failureReport.riskScore > 30 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}
                     `}>
                      <span className="flex items-center gap-1">
                        {node.failureReport.riskScore > 30 ? <AlertTriangle size={10} /> : <CheckCircle size={10} />}
                        Failure Risk
                      </span>
                      <span>{node.failureReport.riskScore}%</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-1.5 border border-dashed border-zinc-700 rounded-lg text-[10px] text-zinc-600">
                      No Analysis Run
                    </div>
                  )}

                </div>
              </motion.div>
            </div>
          );
        })}

      </motion.div>

      {/* Floating Controls for Graph */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2">
        <button onClick={() => setZoom(z => z + 0.1)} className="p-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 border border-white/10 shadow-xl">+</button>
        <button onClick={() => setZoom(z => z - 0.1)} className="p-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 border border-white/10 shadow-xl">-</button>
        <button onClick={() => { setPan({ x: 100, y: window.innerHeight / 2 - 100 }); setZoom(1); }} className="p-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 border border-white/10 shadow-xl text-xs">Reset</button>
      </div>

      {/* Instructions */}
      <div className="absolute top-6 left-6 pointer-events-none">
        <h1 className="text-2xl font-bold text-white mb-2">Workflow Canvas</h1>
        <p className="text-zinc-400 text-sm">Double-click a node to edit, split, or analyze.</p>
      </div>

    </div>
  );
};