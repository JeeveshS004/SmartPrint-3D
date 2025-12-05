from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import shutil
import os
import uuid
from smart_splitter import SmartSplitter
import numpy as np
import trimesh

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Mount static files
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

# Store file paths
file_registry = {}

class SplitRequest(BaseModel):
    fileId: str
    axis: Optional[str] = None

class PerformSplitRequest(BaseModel):
    fileId: str
    origin: List[float]
    normal: List[float]
    addKeys: bool

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    file_registry[file_id] = file_path
    
    return {
        "success": True,
        "fileId": file_id,
        "url": f"/uploads/{file_id}_{file.filename}", 
        "message": "File uploaded successfully"
    }

@app.post("/suggest_split")
async def suggest_split(req: SplitRequest):
    if req.fileId not in file_registry:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = file_registry[req.fileId]
    try:
        splitter = SmartSplitter(file_path)
        
        # Get suggestion
        axis_idx = None
        if req.axis:
            axis_map = {'x': 0, 'y': 1, 'z': 2}
            axis_idx = axis_map.get(req.axis.lower())
            
        origin, normal, section_mesh = splitter.suggest_split(axis_idx=axis_idx)
        
        # Extract visualization mesh data if available
        viz_mesh = None
        if section_mesh:
            viz_mesh = {
                "vertices": section_mesh.vertices.tolist(),
                "faces": section_mesh.faces.tolist()
            }
        
        return {
            "position": origin.tolist(),
            "normal": normal.tolist(),
            "axis": "auto",
            "visualizationMesh": viz_mesh
        }
    except Exception as e:
        print(f"Error suggesting split: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/perform_split")
async def perform_split(req: PerformSplitRequest):
    if req.fileId not in file_registry:
        raise HTTPException(status_code=404, detail="File not found")
        
    file_path = file_registry[req.fileId]
    try:
        splitter = SmartSplitter(file_path)
        
        origin = np.array(req.origin)
        normal = np.array(req.normal)
        
        if req.addKeys:
            part_a, part_b = splitter.perform_split_and_key(origin, normal)
        else:
            # Just split without keys
            part_a = trimesh.intersections.slice_mesh_plane(splitter.mesh, plane_origin=origin, plane_normal=normal, cap=True)
            part_b = trimesh.intersections.slice_mesh_plane(splitter.mesh, plane_origin=origin, plane_normal=-normal, cap=True)

        # Rotate parts to lay flat on cut surface (align cut normal to down Z)
        z_down = np.array([0, 0, -1])
        
        # Part A: Cut normal is -normal
        try:
            T_a = trimesh.geometry.align_vectors(-normal, z_down)
            part_a.apply_transform(T_a)
        except Exception:
            pass # Alignment might fail if vectors are zero or same, though unlikely for normal

        # Part B: Cut normal is normal
        try:
            T_b = trimesh.geometry.align_vectors(normal, z_down)
            part_b.apply_transform(T_b)
        except Exception:
            pass

        # Move to floor (Z=0)
        if part_a.bounds is not None:
             part_a.apply_translation([0, 0, -part_a.bounds[0][2]])
        if part_b.bounds is not None:
             part_b.apply_translation([0, 0, -part_b.bounds[0][2]])

        # Save parts
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        id_a = str(uuid.uuid4())
        id_b = str(uuid.uuid4())
        
        path_a = os.path.join(OUTPUT_DIR, f"{base_name}_part_a_{id_a}.stl")
        path_b = os.path.join(OUTPUT_DIR, f"{base_name}_part_b_{id_b}.stl")
        
        part_a.export(path_a)
        part_b.export(path_b)
        
        # Register new files
        file_registry[id_a] = path_a
        file_registry[id_b] = path_b
        
        base_url = "http://localhost:8000" 
        
        return {
            "partA": {
                "id": id_a,
                "url": f"{base_url}/outputs/{os.path.basename(path_a)}",
                "volume": part_a.volume
            },
            "partB": {
                "id": id_b,
                "url": f"{base_url}/outputs/{os.path.basename(path_b)}",
                "volume": part_b.volume
            }
        }
    except Exception as e:
        print(f"Error performing split: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/printers")
def get_printers():
    return [
        {"id": "ender3", "name": "Creality Ender 3", "bedSize": {"x": 220, "y": 220, "z": 250}, "supportedMaterials": ["pla", "petg", "abs"]},
        {"id": "bambu_x1c", "name": "Bambu Lab X1C", "bedSize": {"x": 256, "y": 256, "z": 256}, "supportedMaterials": ["pla", "petg", "abs", "asa", "pa", "pc"]},
        {"id": "prusa_mk4", "name": "Prusa MK4", "bedSize": {"x": 250, "y": 210, "z": 220}, "supportedMaterials": ["pla", "petg", "abs", "asa", "pa", "pc"]},
        {"id": "neptune4", "name": "Elegoo Neptune 4", "bedSize": {"x": 225, "y": 225, "z": 265}, "supportedMaterials": ["pla", "petg", "abs", "tpu"]}
    ]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
