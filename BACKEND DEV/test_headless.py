from smart_splitter import SmartSplitter
import os

# Create a dummy file if not exists
if not os.path.exists("Test.STL"):
    import trimesh
    m = trimesh.creation.box(extents=[100, 50, 20])
    m.export("Test.STL")

splitter = SmartSplitter("Test.STL")
print("Suggesting split...")
origin, normal, section = splitter.suggest_split()
print(f"Origin: {origin}, Normal: {normal}")

print("Performing split and key (headless)...")
# Skip preview
a, b = splitter.perform_split_and_key(origin, normal)

print("Saving...")
splitter.save_parts(a, b)
print("Headless test passed.")
