export interface Printer {
  id: string;
  name: string;
  series: string; // e.g., "Creality", "Prusa"
  bedSize: {
    x: number;
    y: number;
    z: number;
  };
  supportedMaterials: string[]; // List of Material IDs
}

export interface Material {
  id: string;
  name: string;
  density: number; // g/cm³
  description: string;
  requirements: {
    bedTemp: number;
    nozzleTemp: number;
    enclosure: boolean;
  };
}

export interface SplitPlane {
  position: [number, number, number]; // [x, y, z]
  normal: [number, number, number];   // [x, y, z]
  axis: 'x' | 'y' | 'z' | 'custom';
}

export interface FailureIssue {
  id: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
}

export interface FailureReport {
  riskScore: number; // 0-100
  issues: FailureIssue[];
}

// --- NEW TREE STRUCTURE TYPES ---

export enum NodeType {
  ORIGIN = 'origin',
  PART = 'part'
}

export interface MeshNode {
  id: string;
  serverFileId: string; // ID used by backend to reference this file
  type: NodeType;
  name: string;
  fileUrl: string; // URL for frontend viewer (localhost:8000/files/...)
  parentId: string | null;
  childrenIds: string[];
  printerId: string; // The printer assigned to this specific part
  materialId: string; // The material assigned to this part

  // State for this specific node
  volume?: number;
  infill: number; // 0-100 percentage
  splitPlane?: SplitPlane | null; // If we are currently suggesting a split for this node
  failureReport?: FailureReport | null; // If analysis was run on this node
}

export type AppMode = 'split' | 'failure';
export type ViewMode = 'graph' | 'editor';

export interface AppState {
  viewMode: ViewMode;
  mode: AppMode; // 'split' or 'failure' (tool mode)

  // Tree State
  meshRegistry: Record<string, MeshNode>; // Flat map of ID -> Node
  rootNodeId: string | null;
  selectedNodeId: string | null; // The currently active node being viewed/edited

  // Global Resources
  printers: Printer[];
  materials: Material[];

  // UI State
  isLoading: boolean;
  loadingMessage: string;

  // User Preferences
  displayUnit: 'mm' | 'm' | 'cm';
}