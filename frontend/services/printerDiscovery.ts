import { GoogleGenAI, Type } from "@google/genai";
import { Printer } from "../types";

export const printerDiscovery = {
  /**
   * Uses Gemini to generate a list of modern 3D printers and their specifications.
   */
  scanMarket: async (): Promise<Printer[]> => {
    try {
      // Initialize inside the function to avoid top-level process access issues
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: "Generate a list of 15 popular modern consumer 3D printers (FDM) from brands like Creality, Prusa, Bambu Lab, Elegoo, and Anycubic. For each, provide the precise bed size in mm and a list of supported materials (ids: pla, abs, petg, tpu, nylon, pva) based on their capabilities (e.g. max temp, enclosure). Do not invent data, use real specifications.",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                series: { type: Type.STRING, description: "The brand or series name (e.g. Creality, Prusa)" },
                bedSize: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    z: { type: Type.NUMBER },
                  },
                  required: ["x", "y", "z"]
                },
                supportedMaterials: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "List of supported material IDs (pla, abs, petg, tpu, nylon, pva)"
                }
              },
              required: ["id", "name", "series", "bedSize", "supportedMaterials"]
            }
          }
        }
      });

      // Corrected: .text is a property, not a method in the latest SDK
      const jsonStr = response.text;

      if (!jsonStr) return [];

      const data = JSON.parse(jsonStr);
      return data as Printer[];
    } catch (error) {
      console.error("AI Market Scan failed:", error);
      throw error;
    }
  }
};