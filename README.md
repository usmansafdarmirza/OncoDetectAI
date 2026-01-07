OncoDetectAI: AI-Powered Prostate PNI Detection System
OncoDetectAI is a full-stack medical AI solution designed to assist pathologists in identifying Perineural Invasion (PNI) in prostate histopathology slides. It combines a high-performance YOLOv11 deep learning model with a modern React dashboard for seamless clinical use.

🌟 Project Overview
Detecting PNI is a time-consuming task for pathologists but critical for determining cancer aggressiveness. This project automates the detection process using Instance Segmentation,
 providing real-time visual feedback and diagnostic statistics.

🛠️ System Architecture
The project is divided into three main components:

1. AI Model (The Engine)
Architecture: YOLOv11 (Instance Segmentation).

Training: Fine-tuned on a specialized dataset of prostate slides.

Performance: Achieved 92.4% Precision and 89.1% Recall.

Optimization: Supports both CPU and GPU (CUDA) inference.

2. Backend (The Server)
Framework: Python Flask.

Features:

REST API for image and batch/folder processing.

Dynamic model switching (YOLOv11-Prostate, Recall-Boost, Standard).

Image pre-processing using OpenCV and NumPy.

3. Frontend (The Dashboard)
Framework: React.js + Tailwind CSS.

Capabilities:

Interactive Workspace: Zoom, pan, and real-time polygon overlays.

AI Diagnostics: Latency tracking, PNI vs. Normal breakdown charts.

Batch Export: Download analyzed results as individual images or a consolidated ZIP file.


🔹 Technologies Used

Frontend: React.js, Tailwind CSS, Vite

Backend: Python, Flask/FastAPI, YOLOv11n AI model

Tools: Git, GitHub, VSCode, Node.js, Python 3.10

Other: JSON, REST APIs, Image Processing Libraries

🔹 Author

Usman Safdar
BSc Software Engineering | Full-stack Developer | AI Enthusiast
https://github.com/usmansafdarmirza