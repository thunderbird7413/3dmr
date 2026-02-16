import subprocess
try:
    subprocess.run(["gltf_validator"], check=True)
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
