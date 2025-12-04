import { Material } from '../types';

export const MATERIALS: Material[] = [
    {
        id: 'pla',
        name: 'PLA (Polylactic Acid)',
        density: 1.24,
        description: 'Easy to print, biodegradable, low odor. Ideal for prototypes and models.',
        requirements: { bedTemp: 40, nozzleTemp: 200, enclosure: false }
    },
    {
        id: 'abs',
        name: 'ABS (Acrylonitrile Butadiene Styrene)',
        density: 1.04,
        description: 'Strong, durable, heat resistant. Prone to warping, requires ventilation.',
        requirements: { bedTemp: 100, nozzleTemp: 240, enclosure: true }
    },
    {
        id: 'petg',
        name: 'PETG (Polyethylene Terephthalate Glycol)',
        density: 1.27,
        description: 'Combines ease of PLA with strength of ABS. Moisture resistant.',
        requirements: { bedTemp: 70, nozzleTemp: 240, enclosure: false }
    },
    {
        id: 'tpu',
        name: 'TPU (Thermoplastic Polyurethane)',
        density: 1.21,
        description: 'Flexible, rubber-like. Great for gaskets, phone cases, and wearables.',
        requirements: { bedTemp: 50, nozzleTemp: 220, enclosure: false }
    },
    {
        id: 'nylon',
        name: 'Nylon (Polyamide)',
        density: 1.14,
        description: 'Extremely tough, high impact resistance. Hygroscopic (absorbs moisture).',
        requirements: { bedTemp: 80, nozzleTemp: 250, enclosure: true }
    },
    {
        id: 'pva',
        name: 'PVA (Polyvinyl Alcohol)',
        density: 1.23,
        description: 'Water soluble support material. Dissolves in water.',
        requirements: { bedTemp: 50, nozzleTemp: 200, enclosure: false }
    }
];

export const getMaterialById = (id: string): Material | undefined => {
    return MATERIALS.find(m => m.id === id);
};
