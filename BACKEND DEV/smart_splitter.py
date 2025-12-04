import trimesh
import numpy as np
import os
import time

class SmartSplitter:
    def __init__(self, file_path):
        self.file_path = file_path
        self.mesh = self._load_mesh(file_path)
        self.filename = os.path.basename(file_path)
        self.base_dir = os.path.dirname(file_path)

    def _load_mesh(self, path):
        print(f"Loading {path}...")
        mesh = trimesh.load(path)
        if isinstance(mesh, trimesh.Scene):
            print("Merging scene into single mesh...")
            mesh = trimesh.util.concatenate(tuple(mesh.geometry.values()))
        
        if not mesh.is_watertight:
            print("Warning: Mesh is not watertight. Attempting repair...")
            trimesh.repair.fill_holes(mesh)
        
        print(f"Mesh loaded: {len(mesh.vertices)} vertices, {len(mesh.faces)} faces.")
        return mesh

    def suggest_split(self, axis_idx=None):
        """
        Suggests a split plane. 
        If axis_idx is None, picks the longest axis.
        Returns (origin, normal, section_mesh)
        """
        bounds = self.mesh.bounds
        extents = self.mesh.extents
        
        if axis_idx is None:
            axis_idx = np.argmax(extents)
        
        axis_names = ['X', 'Y', 'Z']
        print(f"Suggesting split along {axis_names[axis_idx]} axis (length: {extents[axis_idx]:.2f}mm)")

        # Simple heuristic: Split at the middle
        # TODO: Implement 'smart' split (min area) if needed, but for now mid-point is robust
        mid_point = (bounds[0][axis_idx] + bounds[1][axis_idx]) / 2.0
        
        origin = self.mesh.centroid.copy()
        origin[axis_idx] = mid_point
        
        normal = np.zeros(3)
        normal[axis_idx] = 1.0

        # Create a visualization of the cut plane (Finite, not infinite)
        # We use mesh.section to get the cross-section
        section = self.mesh.section(plane_origin=origin, plane_normal=normal)
        
        section_mesh = None
        if section:
            # Convert the Path3D section to a flat mesh for visualization
            # This makes it "adhere to the locality"
            try:
                # triangulate_polygon requires a planar polygon. 
                # section.to_planar() returns (Path2D, transform)
                planar_section, to_3d = section.to_planar()
                # We can try to triangulate the polygons in the 2D path
                # This creates a flat mesh representing the cut surface
                v, f = [], []
                offset = 0
                for poly in planar_section.polygons_full:
                    # trimesh.creation.triangulate_polygon returns (vertices, faces) usually
                    tri = trimesh.creation.triangulate_polygon(poly)
                    if tri is not None:
                        # Check if it's a tuple (v, f) or a Trimesh object
                        if isinstance(tri, tuple):
                            tv, tf = tri
                            v.append(tv)
                            f.append(tf + offset)
                            offset += len(tv)
                        elif hasattr(tri, 'vertices'):
                            v.append(tri.vertices)
                            f.append(tri.faces + offset)
                            offset += len(tri.vertices)
                
                if v:
                    v = np.vstack(v)
                    f = np.vstack(f)
                    # Vertices are 2D (x, y). We need 3D (x, y, 0) for the transform
                    if v.shape[1] == 2:
                        v = np.column_stack((v, np.zeros(len(v))))
                    
                    # Create Mesh
                    flat_mesh = trimesh.Trimesh(vertices=v, faces=f)
                    # Transform back to 3D
                    flat_mesh.apply_transform(to_3d)
                    section_mesh = flat_mesh
                    section_mesh.visual.face_colors = [0, 255, 0, 150] # Green, semi-transparent
            except Exception as e:
                print(f"Could not triangulate section for visualization: {e}")
                # Fallback: Create a small box at the cut
                section_mesh = trimesh.creation.box(extents=[extents[0], extents[1], 1], transform=trimesh.transformations.translation_matrix(origin))

        return origin, normal, section_mesh

    def preview_split(self, origin, normal, section_mesh):
        print("Showing split preview... Close the window to proceed.")
        
        # Create a scene
        scene = trimesh.Scene()
        
        # Add original mesh (transparent)
        self.mesh.visual.face_colors = [200, 200, 200, 100]
        scene.add_geometry(self.mesh)
        
        # Add the cut plane visualization
        if section_mesh:
            scene.add_geometry(section_mesh)
        else:
            # Fallback if triangulation failed: Show a plane widget
            print("No section mesh generated, showing infinite plane representation.")
            
        try:
            scene.show()
        except ImportError:
             print("Visualization library (pyglet) not found. Skipping preview.")
        except Exception as e:
             print(f"Preview failed: {e}")

    def perform_split_and_key(self, origin, normal):
        print("Splitting mesh...")
        
        # Split the mesh
        mesh_a = trimesh.intersections.slice_mesh_plane(self.mesh, plane_origin=origin, plane_normal=normal, cap=True)
        
        neg_normal = -normal
        mesh_b = trimesh.intersections.slice_mesh_plane(self.mesh, plane_origin=origin, plane_normal=neg_normal, cap=True)
        
        print("Split complete. Analyzing cut surfaces for keys...")
        
        # Identify the cap face on Mesh A to place the pin
        cap_data = self._analyze_cap_surface(mesh_a, origin, normal)

        if not cap_data:
            print("Error: Could not identify valid cut surface on Part A. Skipping keys.")
            return mesh_a, mesh_b
            
        centers_3d = cap_data['centers']
        max_radius = cap_data['max_radius']
        print(f"Cut surface analyzed. Found {len(centers_3d)} pin location(s). Max Inscribed Radius: {max_radius:.2f}")
        
        # Smart Sizing
        pin_radius = max_radius * 0.6
        pin_radius = max(2.0, min(pin_radius, 20.0))
        pin_diameter = 2 * pin_radius
        
        pin_height = pin_radius * 3.0
        pin_height = max(10.0, min(pin_height, 30.0))
        
        tolerance = 0.4 # Diameter difference
        
        print(f"Smart Pin Dimensions: Radius={pin_radius:.2f}mm, Height={pin_height:.2f}mm")
        
        # Create Pins and Holes
        pins = []
        hole_cutters = []
        
        target_direction = -normal
        z_axis = np.array([0,0,1])
        rotation = trimesh.geometry.align_vectors(z_axis, target_direction)
        
        for center in centers_3d:
            # Create Pin
            # Chamfer = 10% of diameter
            pin_chamfer = 0.1 * pin_diameter
            
            # Helper to create chamfered pin
            # Pin: Tapered top (insertion), Flared bottom (strength)
            pin = self._create_chamfered_pin(pin_radius, pin_height, pin_chamfer, taper_top=True, flare_bottom=True)
            pin.apply_transform(rotation)
            pin.apply_translation(center)
            pins.append(pin)
            
            # Create Hole Cutter
            # Hole diameter = Pin diameter + tolerance
            # Hole radius = Pin radius + tolerance/2
            hole_radius = pin_radius + (tolerance / 2.0)
            hole_diameter = 2 * hole_radius
            hole_height = pin_height # Same depth as pin length
            
            hole_chamfer = 0.1 * hole_diameter
            
            # Hole Cutter: Flared bottom (entry chamfer), Flat top (full depth)
            # We disable taper_top so the hole is full diameter at the bottom
            hole_cutter = self._create_chamfered_pin(hole_radius, hole_height, hole_chamfer, taper_top=False, flare_bottom=True)
            hole_cutter.apply_transform(rotation)
            hole_cutter.apply_translation(center)
            hole_cutters.append(hole_cutter)
            
        print("Applying Boolean operations...")
        
        # Union Pins to Mesh A
        try:
            # Combine all pins first
            if len(pins) > 1:
                all_pins = trimesh.util.concatenate(pins)
            else:
                all_pins = pins[0]
                
            mesh_a_keyed = trimesh.boolean.union([mesh_a, all_pins])
            if isinstance(mesh_a_keyed, trimesh.Scene):
                 mesh_a_keyed = trimesh.util.concatenate(mesh_a_keyed.geometry.values())
        except Exception as e:
            print(f"Boolean Union failed: {e}. Falling back to concatenation.")
            mesh_a_keyed = trimesh.util.concatenate([mesh_a] + pins)

        # Difference Holes from Mesh B
        try:
            if len(hole_cutters) > 1:
                all_cutters = trimesh.util.concatenate(hole_cutters)
            else:
                all_cutters = hole_cutters[0]
                
            mesh_b_keyed = trimesh.boolean.difference([mesh_b, all_cutters])
            if isinstance(mesh_b_keyed, trimesh.Scene):
                 mesh_b_keyed = trimesh.util.concatenate(mesh_b_keyed.geometry.values())
        except Exception as e:
            print(f"Boolean Difference failed: {e}.")
            mesh_b_keyed = mesh_b

        return mesh_a_keyed, mesh_b_keyed

    def _analyze_cap_surface(self, mesh, plane_origin, plane_normal):
        """
        Analyzes the cut surface to find the best spot(s) for pins.
        Returns dict with 'centers' (list of 3D points) and 'max_radius'.
        """
        try:
            # 1. Identify faces on the cut plane
            vectors = mesh.vertices - plane_origin
            distances = np.dot(vectors, plane_normal)
            on_plane_mask = np.abs(distances) < 1e-4
            face_mask = np.all(on_plane_mask[mesh.faces], axis=1)
            cap_faces_indices = np.where(face_mask)[0]
            
            if len(cap_faces_indices) == 0:
                return None
            
            # 2. Create a sub-mesh of just the cap
            cap_mesh = mesh.submesh([cap_faces_indices], append=True)
            
            # 3. Transform to 2D plane
            z_axis = np.array([0,0,1])
            T_trans = trimesh.transformations.translation_matrix(-plane_origin)
            T_rot = trimesh.geometry.align_vectors(plane_normal, z_axis)
            
            to_2d = trimesh.transformations.concatenate_matrices(T_rot, T_trans)
            to_3d = trimesh.transformations.inverse_matrix(to_2d)
            
            cap_2d = cap_mesh.copy()
            cap_2d.merge_vertices()
            cap_2d.apply_transform(to_2d)
            
            # 4. Extract Polygons
            poly_or_multi = trimesh.path.polygons.projected(cap_mesh, normal=plane_normal, origin=plane_origin)
            
            if not poly_or_multi or poly_or_multi.is_empty:
                return None
                
            from shapely.geometry import Polygon, MultiPolygon, Point, LineString
            from shapely.ops import polylabel, unary_union
            
            if isinstance(poly_or_multi, MultiPolygon):
                 main_poly = unary_union(poly_or_multi)
            else:
                 main_poly = poly_or_multi
            
            if not main_poly.is_valid:
                main_poly = main_poly.buffer(0)
                
            # 5. Analyze Shape for Multiple Pins
            min_rect = main_poly.minimum_rotated_rectangle
            
            # Get rectangle dimensions
            x, y = min_rect.exterior.coords.xy
            # Calculate edge lengths
            edge_lengths = [Point(x[i], y[i]).distance(Point(x[i+1], y[i+1])) for i in range(4)]
            length = max(edge_lengths)
            width = min(edge_lengths)
            
            # Avoid division by zero
            if width < 0.1: width = 0.1
            
            aspect_ratio = length / width
            
            centers_2d = []
            
            # Determine number of pins
            if aspect_ratio > 10.0:
                num_pins = 3
            elif aspect_ratio > 3.0:
                num_pins = 2
            else:
                num_pins = 1
                
            if num_pins == 1:
                # Use centroid
                pt = main_poly.centroid
                if not main_poly.contains(pt):
                    pt = polylabel(main_poly, tolerance=0.1)
                centers_2d.append(pt)
            else:
                # Generate points along the long axis
                # 1. Find the long axis line of the min_rect
                # The min_rect vertices are ordered. Longest side is either 0-1 or 1-2
                p0 = Point(x[0], y[0])
                p1 = Point(x[1], y[1])
                p2 = Point(x[2], y[2])
                
                dist01 = p0.distance(p1)
                dist12 = p1.distance(p2)
                
                if dist01 >= dist12:
                    # Long axis is parallel to p0-p1
                    # Center axis starts at midpoint of p0-p3 and goes to midpoint of p1-p2?
                    # Easier: Get the centerline of the rectangle
                    # Midpoint of short edges
                    p3 = Point(x[3], y[3])
                    start = Point((p0.x+p3.x)/2, (p0.y+p3.y)/2)
                    end = Point((p1.x+p2.x)/2, (p1.y+p2.y)/2)
                else:
                    # Long axis is parallel to p1-p2
                    start = Point((p0.x+p1.x)/2, (p0.y+p1.y)/2)
                    end = Point((p3.x+p2.x)/2, (p3.y+p2.y)/2)
                    
                # Generate points along start-end line
                line = LineString([start, end])
                
                for i in range(num_pins):
                    # For n=2: 1/4, 3/4.  Formula: (2*i + 1) / (2*n)
                    fraction = (2 * i + 1) / (2 * num_pins)
                    pt = line.interpolate(fraction, normalized=True)
                    
                    # Verify point is inside the actual polygon (not just the rect)
                    if main_poly.contains(pt):
                        centers_2d.append(pt)
                    else:
                        # Fallback: Try to find nearest point inside?
                        # Or just skip/revert to single center if complex shape
                        print(f"Warning: Suggested pin point {pt} is outside shape. Skipping.")
            
            if not centers_2d:
                # Fallback if all generated points failed
                centers_2d.append(polylabel(main_poly, tolerance=0.1))

            # 6. Calculate Max Radius (based on width roughly, or distance from first center)
            # Use the first center to determine safe radius
            max_radius = centers_2d[0].distance(main_poly.boundary)
            
            # 7. Transform Centers back to 3D
            centers_3d = []
            for c2d in centers_2d:
                center_local = np.array([c2d.x, c2d.y, 0, 1])
                center_global = np.dot(to_3d, center_local)
                centers_3d.append(center_global[:3])
            
            return {
                'centers': centers_3d,
                'max_radius': max_radius
            }

        except Exception as e:
            print(f"Error analyzing cap: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _create_chamfered_pin(self, radius, height, chamfer, taper_top=True, flare_bottom=True):
        # Ensure chamfer isn't too big
        needed_height = 0
        if taper_top: needed_height += chamfer
        if flare_bottom: needed_height += chamfer
        
        if needed_height >= height:
            chamfer = height / 3.0
            
        # Define Profile (Z, R)
        profile = []
        
        # Bottom
        if flare_bottom:
            profile.append((0.0, radius + chamfer))
            profile.append((chamfer, radius))
        else:
            profile.append((0.0, radius))
            
        # Top
        if taper_top:
            profile.append((height - chamfer, radius))
            profile.append((height, radius - chamfer))
        else:
            profile.append((height, radius))
            
        # Generate Mesh
        sections = 32
        vertices = []
        faces = []
        
        theta = np.linspace(0, 2*np.pi, sections, endpoint=False)
        cos_theta = np.cos(theta)
        sin_theta = np.sin(theta)
        
        # Create vertices for each ring
        for z, r in profile:
            # Generate ring vertices
            # shape: (sections, 3)
            ring_v = np.column_stack((r * cos_theta, r * sin_theta, np.full(sections, z)))
            vertices.append(ring_v)
            
        vertices = np.vstack(vertices)
        num_rings = len(profile)
        
        # Create faces between rings
        for i in range(num_rings - 1):
            # Ring i and Ring i+1
            # Vertices indices:
            # Ring i: i*sections to (i+1)*sections - 1
            # Ring i+1: (i+1)*sections to (i+2)*sections - 1
            
            base_i = i * sections
            base_next = (i + 1) * sections
            
            for j in range(sections):
                j_next = (j + 1) % sections
                
                # Quad formed by (i,j), (i,j_next), (i+1, j_next), (i+1, j)
                # Split into 2 triangles
                
                # Triangle 1: (i,j), (i, j_next), (i+1, j)
                faces.append([base_i + j, base_i + j_next, base_next + j])
                
                # Triangle 2: (i+1, j), (i, j_next), (i+1, j_next)
                faces.append([base_next + j, base_i + j_next, base_next + j_next])
                
        # Cap the bottom
        # Add center vertex at bottom
        vertices = np.vstack((vertices, [0, 0, profile[0][0]]))
        bottom_center_idx = len(vertices) - 1
        # Bottom ring is ring 0
        for j in range(sections):
            j_next = (j + 1) % sections
            # Clockwise winding for bottom cap (looking from outside)
            # Normal should point down.
            # Vertices are CCW around Z.
            # Triangle: (Center, j_next, j)
            faces.append([bottom_center_idx, j_next, j])
            
        # Cap the top
        # Add center vertex at top
        vertices = np.vstack((vertices, [0, 0, profile[-1][0]]))
        top_center_idx = len(vertices) - 1
        # Top ring is ring -1
        base_top = (num_rings - 1) * sections
        for j in range(sections):
            j_next = (j + 1) % sections
            # CCW winding for top cap
            # Triangle: (Center, j, j_next)
            faces.append([top_center_idx, base_top + j, base_top + j_next])
            
        mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
        return mesh

    def save_parts(self, mesh_a, mesh_b):
        base = os.path.splitext(self.filename)[0]
        path_a = os.path.join(self.base_dir, f"{base}_part_a.stl")
        path_b = os.path.join(self.base_dir, f"{base}_part_b.stl")
        
        print(f"Saving {path_a}...")
        mesh_a.export(path_a)
        
        print(f"Saving {path_b}...")
        mesh_b.export(path_b)
        
        print("Done!")

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        INPUT_FILE = sys.argv[1]
    else:
        INPUT_FILE = "Test.STL" 
    
    if not os.path.exists(INPUT_FILE):
        print(f"File {INPUT_FILE} not found in current directory.")
        # Try to find it in uploads if running from python_backend
        if os.path.exists("../uploads/Test.STL"):
             print("Found in ../uploads, copying...")
             import shutil
             shutil.copy("../uploads/Test.STL", "Test.STL")
        else:
             print("Please place a .STL file in this folder.")
             exit()

    splitter = SmartSplitter(INPUT_FILE)
    
    # 1. Suggest Split
    origin, normal, section_mesh = splitter.suggest_split()
    
    # 2. Preview
    splitter.preview_split(origin, normal, section_mesh)
    
    # 3. Confirm
    response = input("Proceed with this split? (y/n): ")
    if response.lower() == 'y':
        # 4. Perform Split & Key
        part_a, part_b = splitter.perform_split_and_key(origin, normal)
        
        # 5. Save
        splitter.save_parts(part_a, part_b)
    else:
        print("Operation cancelled.")
