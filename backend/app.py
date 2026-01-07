import os
import sys
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import numpy as np
import io

# --- ROBUST PATH CONFIGURATION ---
# English: Get the directory where the script or EXE is located
if getattr(sys, 'frozen', False):
    base_path = os.path.dirname(sys.executable)
else:
    base_path = os.path.dirname(os.path.abspath(__file__))

# English: Ensure the script always uses its own folder as the working directory
os.chdir(base_path)

# English: Look for frontend folder (assuming it's a sibling of backend)
# This goes one level up from 'backend' and then into 'frontend'
frontend_folder = os.path.abspath(os.path.join(base_path, '..', 'frontend'))

app = Flask(__name__)
CORS(app)

# English: Debugging prints
print(f"--- 📂 Backend Base Path: {base_path} ---")
print(f"--- 📂 Frontend Folder Path: {frontend_folder} ---")

# --- ROUTES FOR FRONTEND ---

@app.route('/')
def serve_index():
    index_path = os.path.join(frontend_folder, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(frontend_folder, 'index.html')
    else:
        # English: If 404 occurs, it will print the EXACT path it tried to find
        return f"CRITICAL ERROR: index.html not found at: {index_path}", 404

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory(os.path.join(frontend_folder, 'assets'), filename)

@app.route('/<path:filename>')
def serve_root_files(filename):
    return send_from_directory(frontend_folder, filename)

# --- AI MODEL LOGIC ---
loaded_models = {}

def get_model(model_name):
    model_map = {
        "YOLOv11-Prostate-Seg": "best.pt",
        "Recall-Boost-Final": "last.pt",
        "Standard-YOLO-v11": "yolo11n-seg.pt"
    }
    file_name = model_map.get(model_name, "best.pt")
    model_path = os.path.join(base_path, file_name)
    
    if file_name not in loaded_models:
        if os.path.exists(model_path):
            print(f"--- 🚀 Loading Model: {file_name} ---")
            loaded_models[file_name] = YOLO(model_path)
        else:
            fallback_path = os.path.join(base_path, "best.pt")
            if os.path.exists(fallback_path):
                loaded_models["best.pt"] = YOLO(fallback_path)
                return loaded_models["best.pt"]
            return None
    return loaded_models.get(file_name)

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image uploaded"}), 400
        file = request.files['image']
        device = request.form.get('device', 'cpu')
        model_type = request.form.get('model_type', 'YOLOv11-Prostate-Seg')
        current_model = get_model(model_type)
        
        if current_model is None:
            return jsonify({"status": "error", "message": "Model not found"}), 500
            
        img_bytes = file.read()
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        h, w, _ = img.shape
        results = current_model.predict(source=img, device=device, conf=0.25)
        
        detections = []
        result = results[0]
        if result.masks is not None:
            for i in range(len(result.boxes)):
                box = result.boxes[i]
                mask = result.masks.xy[i]
                detections.append({
                    "bbox": [round(x, 2) for x in box.xyxy[0].tolist()],
                    "conf": round(float(box.conf[0]) * 100, 2),
                    "class": int(box.cls[0]),
                    "name": current_model.names[int(box.cls[0])],
                    "segments": [[round(float(pt[0])/w*100, 2), round(float(pt[1])/h*100, 2)] for pt in mask]
                })
        return jsonify({
            "status": "success",
            "detections": detections,
            "inference_speed": round(result.speed['inference'], 2),
            "model_used": model_type
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)