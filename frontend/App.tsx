import React, { useState, useEffect } from 'react';
import { AppState, Printer, AppMode, MeshNode, NodeType, ViewMode } from './types';
import { api } from './services/api';
import { printerDiscovery } from './services/printerDiscovery';
import { geometryUtils } from './services/geometryUtils';
import { Sidebar } from './components/Sidebar';
import { Viewer3D } from './components/Viewer3D';
import { MeshGraph } from './components/MeshGraph';
import { PrinterModal } from './components/PrinterModal';
import { UnitSelector } from './components/ui/UnitSelector';
import { materialDiscovery } from './services/materialDiscovery';
import { MATERIALS } from './services/materials';
import { v4 as uuidv4 } from 'uuid';

const generateId = () => uuidv4();

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    viewMode: 'graph',
    mode: 'split',
    meshRegistry: {},
    rootNodeId: null,
    selectedNodeId: null,
    printers: [],
    materials: MATERIALS, // Initialize with default materials
    isLoading: false,
    loadingMessage: '',
    displayUnit: 'mm'
  });

  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);

  // Load available printers on mount
  useEffect(() => {
    const loadPrinters = async () => {
      try {
        const printers = await api.getPrinters();
        setState(prev => ({ ...prev, printers }));
      } catch (error) {
        console.warn("Backend offline: Could not fetch printers. Using defaults if available.");
      }
    };
    loadPrinters();
  }, []);

  // --- ACTIONS ---

  const handleFileSelect = async (file: File) => {
    const localUrl = URL.createObjectURL(file);
    const newId = generateId();

    // 1. Start loading state
    setState(prev => ({
      ...prev,
      isLoading: true,
      loadingMessage: 'Analyzing mesh geometry...',
    }));

    try {
      // 2. Client-side processing: Calculate Volume immediately
      const volume = await geometryUtils.calculateVolume(file);

      const tempRootNode: MeshNode = {
        id: newId,
        serverFileId: '', // Placeholder, indicates "not synced yet"
        type: NodeType.ORIGIN,
        name: file.name,
        fileUrl: localUrl,
        parentId: null,
        childrenIds: [],
        printerId: state.printers[0]?.id || 'default',
        materialId: 'pla', // Default to PLA
        volume: volume, // Set the calculated volume here
        infill: 20, // Default to 20%
        splitPlane: null,
        failureReport: null
      };

      // 3. Update UI immediately with the analysed node
      setState(prev => ({
        ...prev,
        meshRegistry: { [newId]: tempRootNode },
        rootNodeId: newId,
        selectedNodeId: newId,
        viewMode: 'graph',
        isLoading: false,
        loadingMessage: ''
      }));

      // 4. Background Upload to Python Backend
      // We don't block the UI for this, but we show a small syncing status if we wanted
      // For now we just update the ID when done.
      try {
        const result = await api.uploadFile(file);

        setState(prev => ({
          ...prev,
          meshRegistry: {
            ...prev.meshRegistry,
            [newId]: {
              ...prev.meshRegistry[newId],
              serverFileId: result.fileId,
            }
          }
        }));
      } catch (error) {
        console.warn("Upload failed (Offline Mode)", error);
        // App continues to work in offline mode for visualization
      }

    } catch (error) {
      console.error("File processing failed", error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        loadingMessage: ''
      }));
      alert("Failed to load file. Please try a valid STL.");
    }
  };

  const handleModeChange = (newMode: AppMode) => {
    setState(prev => ({ ...prev, mode: newMode }));
  };

  const handlePrinterSelect = (printer: Printer) => {
    if (!state.selectedNodeId) return;

    // Check compatibility with current material
    const node = state.meshRegistry[state.selectedNodeId];
    if (node && printer.supportedMaterials && !printer.supportedMaterials.includes(node.materialId)) {
      alert(`Warning: The selected printer '${printer.name}' may not support '${node.materialId}'.\n\nPlease check printer specifications or choose a different material.`);
    }

    setState(prev => ({
      ...prev,
      meshRegistry: {
        ...prev.meshRegistry,
        [prev.selectedNodeId!]: {
          ...prev.meshRegistry[prev.selectedNodeId!],
          printerId: printer.id,
          splitPlane: null
        }
      }
    }));
  };

  const handleMaterialChange = (materialId: string, nodeId?: string) => {
    const targetId = nodeId || state.selectedNodeId;
    if (!targetId) return;

    setState(prev => ({
      ...prev,
      meshRegistry: {
        ...prev.meshRegistry,
        [targetId]: {
          ...prev.meshRegistry[targetId],
          materialId: materialId
        }
      }
    }));
  };

  const handleInfillChange = (infill: number, nodeId?: string) => {
    const targetId = nodeId || state.selectedNodeId;
    if (!targetId) return;

    setState(prev => ({
      ...prev,
      meshRegistry: {
        ...prev.meshRegistry,
        [targetId]: {
          ...prev.meshRegistry[targetId],
          infill: Math.max(0, Math.min(100, infill))
        }
      }
    }));
  };

  const handleScanMarket = async () => {
    setState(prev => ({ ...prev, isLoading: true, loadingMessage: 'Scanning Global Market for Printers & Materials...' }));
    try {
      // Run both scans in parallel
      const [newPrinters, newMaterials] = await Promise.all([
        printerDiscovery.scanMarket(),
        materialDiscovery.scanMaterials()
      ]);

      if (newPrinters.length > 0 || newMaterials.length > 0) {
        setState(prev => ({
          ...prev,
          printers: newPrinters.length > 0 ? newPrinters : prev.printers,
          materials: newMaterials.length > 0 ? newMaterials : prev.materials,
          isLoading: false
        }));
        // Automatically open the modal to show results
        setIsPrinterModalOpen(true);
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error("Market scan failed", error);
      setState(prev => ({ ...prev, isLoading: false }));
      alert("Backend offline: Could not fetch AI data. Using default local data.");
    }
  };

  const handleUndoSplit = () => {
    const { selectedNodeId } = state;
    if (!selectedNodeId) return;

    setState(prev => ({
      ...prev,
      meshRegistry: {
        ...prev.meshRegistry,
        [selectedNodeId]: {
          ...prev.meshRegistry[selectedNodeId],
          splitPlane: null
        }
      }
    }));
  };

  const handleSuggestSplit = async () => {
    const { selectedNodeId, meshRegistry, printers } = state;
    if (!selectedNodeId) return;

    const node = meshRegistry[selectedNodeId];

    if (!node.serverFileId) {
      alert("Server Offline: Cannot calculate split logic. Ensure backend is running.");
      return;
    }

    const printer = printers.find(p => p.id === node.printerId);
    if (!printer && printers.length > 0) {
      alert("Please select a printer first");
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, loadingMessage: 'Calculating best split plane...' }));

    try {
      const splitPlane = await api.suggestSplit(node.serverFileId);
      setState(prev => ({
        ...prev,
        isLoading: false,
        meshRegistry: {
          ...prev.meshRegistry,
          [selectedNodeId]: { ...node, splitPlane }
        }
      }));
    } catch (error) {
      console.error("Suggestion failed", error);
      alert("Failed to suggest split. Is the Python backend running?");
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handlePerformSplit = async (withKeys: boolean) => {
    const { selectedNodeId, meshRegistry } = state;
    if (!selectedNodeId) return;

    const node = meshRegistry[selectedNodeId];
    if (!node.splitPlane) return;
    if (!node.serverFileId) return;

    setState(prev => ({
      ...prev,
      isLoading: true,
      loadingMessage: withKeys ? 'Generating alignment keys...' : 'Slicing mesh geometry...'
    }));

    try {
      const result = await api.performSplit(node.serverFileId, node.splitPlane, withKeys);

      const idA = generateId();
      const idB = generateId();

      const nodeA: MeshNode = {
        id: idA,
        serverFileId: result.partA.id,
        type: NodeType.PART,
        name: `${node.name} (Part A)`,
        fileUrl: result.partA.url,
        parentId: node.id,
        childrenIds: [],
        printerId: node.printerId,
        materialId: node.materialId,
        volume: result.partA.volume,
        infill: node.infill,
        splitPlane: null,
        failureReport: null
      };

      const nodeB: MeshNode = {
        id: idB,
        serverFileId: result.partB.id,
        type: NodeType.PART,
        name: `${node.name} (Part B)`,
        fileUrl: result.partB.url,
        parentId: node.id,
        childrenIds: [],
        printerId: node.printerId,
        materialId: node.materialId,
        volume: result.partB.volume,
        infill: node.infill,
        splitPlane: null,
        failureReport: null
      };

      setState(prev => ({
        ...prev,
        isLoading: false,
        viewMode: 'graph',
        meshRegistry: {
          ...prev.meshRegistry,
          [node.id]: {
            ...node,
            childrenIds: [idA, idB],
            splitPlane: null
          },
          [idA]: nodeA,
          [idB]: nodeB
        }
      }));

    } catch (error) {
      console.error("Split failed", error);
      alert("Failed to perform split. Check backend console.");
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleRunFailureAnalysis = async () => {
    const { selectedNodeId, meshRegistry } = state;
    if (!selectedNodeId) return;

    const node = meshRegistry[selectedNodeId];
    if (!node) return;

    alert("Smart Print 3D AI Failure Analysis Model is currently under development.\n\nThis feature will use physics simulations to predict structural weaknesses.");
  };

  const handleNodeDoubleClick = (id: string) => {
    setState(prev => ({
      ...prev,
      selectedNodeId: id,
      viewMode: 'editor'
    }));
  };

  const handleBackToGraph = () => {
    setState(prev => ({ ...prev, viewMode: 'graph' }));
  };

  const toggleUnit = () => {
    setState(prev => ({ ...prev, displayUnit: prev.displayUnit === 'mm' ? 'm' : 'mm' }));
  };

  // Helper for active printer
  const activeNode = state.selectedNodeId ? state.meshRegistry[state.selectedNodeId] : null;
  const activePrinterId = activeNode?.printerId;

  return (
    <div className="relative w-full h-full bg-zinc-950 text-white overflow-hidden font-sans">

      {/* 1. GRAPH VIEW */}
      {state.viewMode === 'graph' && state.rootNodeId && (
        <MeshGraph
          registry={state.meshRegistry}
          rootId={state.rootNodeId}
          printers={state.printers}
          onNodeDoubleClick={handleNodeDoubleClick}
          displayUnit={state.displayUnit}
          onMaterialChange={(nodeId, materialId) => handleMaterialChange(materialId, nodeId)}
          onInfillChange={(nodeId, infill) => handleInfillChange(infill, nodeId)}
          materials={state.materials}
        />
      )}

      {/* 2. EDITOR VIEW (3D) */}
      {state.viewMode === 'editor' && state.rootNodeId && (
        <Viewer3D appState={state} />
      )}

      {/* Sidebar handles Upload (when no root) and Editor Controls */}
      <Sidebar
        appState={state}
        onFileSelect={handleFileSelect}
        onOpenPrinterModal={() => setIsPrinterModalOpen(true)}
        onSuggestSplit={handleSuggestSplit}
        onUndoSplit={handleUndoSplit}
        onPerformSplit={handlePerformSplit}
        onModeChange={handleModeChange}
        onRunFailureAnalysis={handleRunFailureAnalysis}
        onBackToGraph={handleBackToGraph}
        onMaterialChange={handleMaterialChange}
        onInfillChange={handleInfillChange}
        materials={state.materials}
      />

      {/* Printer Selection Modal */}
      <PrinterModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
        printers={state.printers}
        selectedPrinterId={activePrinterId}
        onSelect={handlePrinterSelect}
        onScanMarket={handleScanMarket}
        isScanning={state.isLoading && state.loadingMessage.includes('Scanning')}
      />

      {/* Unit Selector - Top Right Overlay */}
      <UnitSelector
        currentUnit={state.displayUnit}
        onUnitChange={(unit) => setState(prev => ({ ...prev, displayUnit: unit }))}
      />

    </div>
  );
};

export default App;