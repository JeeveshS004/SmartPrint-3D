import { GoogleGenAI, Type } from "@google/genai";
import { Material } from "../types";

export const materialDiscovery = {
    /**
     * Uses Gemini to generate a list of common 3D printing materials and their properties.
     */
    scanMaterials: async (): Promise<Material[]> => {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: "Generate a list of 10 common FDM 3D printing materials (e.g., PLA, ABS, PETG, TPU, Nylon, ASA, PC, PVA, HIPS, Carbon Fiber). For each, provide the density in g/cm³ and printing requirements. Do not invent data, use real specifications.",
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING, description: "Lowercase unique identifier (e.g. pla, abs)" },
                                name: { type: Type.STRING },
                                density: { type: Type.NUMBER, description: "Density in g/cm³" },
                                description: { type: Type.STRING },
                                requirements: {
                                    type: Type.OBJECT,
                                    properties: {
                                        bedTemp: { type: Type.NUMBER },
                                        nozzleTemp: { type: Type.NUMBER },
                                        enclosure: { type: Type.BOOLEAN }
                                    },
                                    required: ["bedTemp", "nozzleTemp", "enclosure"]
                                }
                            },
                            required: ["id", "name", "density", "description", "requirements"]
                        }
                    }
                }
            });

            const jsonStr = response.text;

            if (!jsonStr) return [];

            const data = JSON.parse(jsonStr);
            return data as Material[];
        } catch (error) {
            console.error("AI Material Scan failed:", error);
            throw error;
        }
    }
};
