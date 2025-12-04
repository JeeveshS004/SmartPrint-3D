import { Printer, SplitPlane, FailureReport } from '../types';

const BASE_URL = 'http://localhost:8000';

export const api = {
  uploadFile: async (file: File): Promise<{ success: boolean; fileId: string; url: string; message: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return { 
      success: true, 
      fileId: data.fileId,
      url: data.url,
      message: 'File uploaded successfully' 
    };
  },

  getPrinters: async (): Promise<Printer[]> => {
    const response = await fetch(`${BASE_URL}/printers`);
    if (!response.ok) {
      throw new Error(`Failed to fetch printers: ${response.statusText}`);
    }
    return await response.json();
  },

  suggestSplit: async (fileId: string): Promise<SplitPlane> => {
    const response = await fetch(`${BASE_URL}/suggest_split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId })
    });
    
    if (!response.ok) {
      throw new Error(`Split suggestion failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      position: data.position,
      normal: data.normal,
      axis: data.axis
    };
  },

  performSplit: async (fileId: string, plane: SplitPlane, addKeys: boolean): Promise<{ partA: any, partB: any }> => {
    const response = await fetch(`${BASE_URL}/perform_split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId,
        origin: plane.position,
        normal: plane.normal,
        addKeys
      })
    });

    if (!response.ok) {
      throw new Error(`Split execution failed: ${response.statusText}`);
    }
    
    return await response.json();
  },

  analyzeFailure: async (fileId: string): Promise<FailureReport> => {
    const response = await fetch(`${BASE_URL}/analyze_failure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId })
    });

    if (!response.ok) {
      throw new Error(`Failure analysis failed: ${response.statusText}`);
    }

    return await response.json();
  }
};