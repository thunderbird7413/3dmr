import os

path = "validator-2.0.0-dev.3.10-win64"
print(f"Checking: {path}")
print(f"Exists: {os.path.exists(path)}")
print(f"Is File: {os.path.isfile(path)}")
print(f"Is Dir: {os.path.isdir(path)}")
print(f"Abs Path: {os.path.abspath(path)}")
