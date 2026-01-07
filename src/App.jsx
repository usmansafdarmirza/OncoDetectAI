import React, { useState, useRef } from 'react'; 
import JSZip from 'jszip'; 
import { saveAs } from 'file-saver';

function App() {
  const [selectedModel, setSelectedModel] = useState("YOLOv11-Prostate-Seg"); 
  const [isGPU, setIsGPU] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [mainImage, setMainImage] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);
  const [folderImages, setFolderImages] = useState([]);
  const [currentStats, setCurrentStats] = useState({ conf: 0, pni: 0, benign: 0 });
  const [inferenceTime, setInferenceTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detections, setDetections] = useState([]);
  
  const imageRef = useRef(null);

  // English: Drawing function updated to use strictly Red theme for labels and polygons
  const drawDetectionsOnCanvas = (canvas, img, dts) => {
    const ctx = canvas.getContext('2d');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    const scale = Math.max(canvas.width, canvas.height) / 1000;
    const lineWidth = 3 * scale;
    const fontSize = Math.round(22 * scale);

    dts.forEach((det) => {
      if (det.segments && det.segments.length > 0) {
        // English: Draw Red Polygon
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444'; // Red
        ctx.lineWidth = lineWidth;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)'; 

        det.segments.forEach((point, index) => {
          const x = (point[0] / 100) * canvas.width;
          const y = (point[1] / 100) * canvas.height;
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // English: Draw Red Label Box
        const label = `${det.name.toUpperCase()} ${det.conf}%`;
        ctx.font = `bold ${fontSize}px sans-serif`;
        const textWidth = ctx.measureText(label).width;
        const lx = (det.segments[0][0] / 100) * canvas.width;
        const ly = (det.segments[0][1] / 100) * canvas.height;

        ctx.fillStyle = '#ef4444'; // Pure Red Background
        ctx.fillRect(lx, ly - fontSize - 10, textWidth + 15, fontSize + 10);
        
        ctx.fillStyle = 'white'; // Text is white for readability on red background
        ctx.fillText(label, lx + 7, ly - 12);
      }
    });
    return canvas.toDataURL('image/png');
  };

  const analyzeImage = async (fileOrBlob, isExistingUrl = false, modelOverride = null) => {
    setLoading(true);
    setZoomLevel(1);

    let fileToUpload;
    if (isExistingUrl) {
      setMainImage(fileOrBlob.url);
      fileToUpload = fileOrBlob.file;
      setCurrentFile(fileOrBlob.file);
    } else {
      fileToUpload = fileOrBlob;
      setCurrentFile(fileToUpload);
      setMainImage(URL.createObjectURL(fileToUpload));
    }

    const formData = new FormData();
    formData.append('image', fileToUpload);
    formData.append('device', isGPU ? '0' : 'cpu');
    formData.append('model_type', modelOverride || selectedModel); 

    try {
      const response = await fetch('http://localhost:5000/analyze', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (data.status === 'success') {
        setDetections(data.detections || []);
        setInferenceTime(data.inference_speed);
        
        const pniCount = (data.detections || []).length;
        const avgConf = pniCount > 0 
          ? parseFloat((data.detections.reduce((acc, curr) => acc + curr.conf, 0) / pniCount).toFixed(1))
          : 0;

        const updatedStats = {
          conf: avgConf,
          pni: pniCount > 0 ? avgConf : 0,
          benign: pniCount === 0 ? 100 : parseFloat((100 - avgConf).toFixed(1))
        };
        setCurrentStats(updatedStats);

        setFolderImages(prev => prev.map(img => 
          (img.url === (isExistingUrl ? fileOrBlob.url : URL.createObjectURL(fileToUpload)) || img.name === fileToUpload.name)
          ? { ...img, detections: data.detections } 
          : img
        ));
      }
    } catch (error) {
      console.error("Backend Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const downloadAsImage = () => {
    if (!mainImage || !imageRef.current) return;
    const canvas = document.createElement('canvas');
    const dataUrl = drawDetectionsOnCanvas(canvas, imageRef.current, detections);
    const link = document.createElement('a');
    link.download = `Analysis_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  const downloadAllImages = async () => {
    if (folderImages.length === 0) return;
    setLoading(true);
    const zip = new JSZip();
    const folder = zip.folder("Analysis_Results");

    for (const imgObj of folderImages) {
      const img = new Image();
      img.src = imgObj.url;
      await new Promise(res => img.onload = res);
      const canvas = document.createElement('canvas');
      const dataUrl = drawDetectionsOnCanvas(canvas, img, imgObj.detections || []);
      const base64Data = dataUrl.replace(/^data:image\/(png|jpg);base64,/, "");
      folder.file(`Result_${imgObj.name}`, base64Data, { base64: true });
    }
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "All_Analysis_Results.zip");
    setLoading(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) analyzeImage(file);
  };

  const handleFolderUpload = async (e) => {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    const imgs = files.map(f => ({
      name: f.name,
      url: URL.createObjectURL(f),
      file: f,
      detections: [] 
    }));
    setFolderImages(imgs);
    for (let i = 0; i < imgs.length; i++) {
        await analyzeImage(imgs[i], true);
    }
  };

  const deleteCurrentImage = () => {
    setMainImage(null);
    setCurrentFile(null);
    setDetections([]);
    setInferenceTime(0);
    setCurrentStats({ conf: 0, pni: 0, benign: 0 });
  };

  const deleteImageFromGallery = (e, index) => {
    e.stopPropagation();
    const newImages = folderImages.filter((_, i) => i !== index);
    setFolderImages(newImages);
    if (newImages.length === 0) deleteCurrentImage();
  };

  const deleteAllImages = () => {
    if (window.confirm("Are you sure?")) {
      setFolderImages([]);
      deleteCurrentImage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] text-slate-300 overflow-hidden font-sans">
      
      {/* HEADER */}
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-[#1e293b] shadow-xl z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 border-r border-slate-700 pr-8">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-xl italic">O</span>
            </div>
            <h1 className="text-lg font-black tracking-tighter text-white leading-none">
              OncoDetect<span className="text-blue-500 italic">AI</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <input type="file" id="single" className="hidden" accept="image/*" onChange={handleImageUpload} />
            <label htmlFor="single" className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase px-4 py-2 rounded cursor-pointer flex items-center gap-2 transition-all">
              <span>📤</span> {loading ? "Processing..." : "Upload"}
            </label>

            <input type="file" id="folder" className="hidden" webkitdirectory="true" directory="true" onChange={handleFolderUpload} />
            <label htmlFor="folder" className="bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-black uppercase px-4 py-2 rounded cursor-pointer flex items-center gap-2 transition-all">
              <span>📁</span> {loading ? "Reading..." : "Folder"}
            </label>

            <button 
              onClick={downloadAllImages} 
              disabled={folderImages.length === 0}
              className={`${folderImages.length > 0 ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-800 opacity-50 cursor-not-allowed'} text-white text-[10px] font-black uppercase px-4 py-2 rounded flex items-center gap-2 transition-all`}
            >
              <span>📦</span> Download All
            </button>
            
            <button onClick={deleteAllImages} className="text-red-500 hover:text-red-400 text-[10px] font-black uppercase px-2 transition-all">
              <span>🗑️</span> DeleteAll
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center bg-slate-900 rounded-full p-1 border border-slate-700">
            <button onClick={() => setIsGPU(false)} className={`px-4 py-1 rounded-full text-[9px] font-bold ${!isGPU ? 'bg-blue-500 text-white' : 'text-slate-500'}`}>CPU</button>
            <button onClick={() => setIsGPU(true)} className={`px-4 py-1 rounded-full text-[9px] font-bold ${isGPU ? 'bg-orange-600 text-white' : 'text-slate-500'}`}>GPU</button>
          </div>
          
          <select 
            value={selectedModel} 
            onChange={(e) => {
              const newModel = e.target.value;
              setSelectedModel(newModel);
              if (currentFile) analyzeImage(currentFile, false, newModel);
            }}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-bold text-white outline-none"
          >
            <option value="YOLOv11-Prostate-Seg">YOLOv11-Prostate-Seg</option>
            <option value="Recall-Boost-Final">Recall-Boost-Final</option>
            <option value="Standard-YOLO-v11">Standard-YOLO-v11</option>
          </select>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 bg-[#020617] relative flex items-center justify-center p-4 overflow-hidden">
          
          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-blue-400 font-black uppercase tracking-[0.2em] text-xs">Analyzing with AI System...</p>
            </div>
          )}

          <div style={{ transform: `scale(${zoomLevel})` }} className="relative transition-transform duration-300">
            {mainImage ? (
              <div className="relative shadow-2xl">
                <img 
                  ref={imageRef}
                  src={mainImage} 
                  alt="Slide" 
                  className="max-w-[70vw] max-h-[60vh] object-contain rounded-sm border border-slate-800" 
                />
                
                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {!loading && detections.map((det, idx) => (
                    <g key={idx}>
                      <polygon points={det.segments?.map(p => `${p[0]},${p[1]}`).join(' ')} className="fill-red-500/30 stroke-red-500 stroke-[0.3]" />
                      {/* English: Pure Red Labels for Real-time preview */}
                      <rect 
                        x={det.segments[0][0]} 
                        y={det.segments[0][1] - 4.5} 
                        width={det.name.length * 2 + 6} 
                        height="4" 
                        fill="#ef4444" 
                      />
                      <text 
                        x={det.segments[0][0] + 0.5} 
                        y={det.segments[0][1] - 1.5} 
                        fill="white" 
                        fontSize="2.5" 
                        fontWeight="bold"
                      >
                        {det.name.toUpperCase()} {det.conf}%
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            ) : (
              <div className="text-slate-800 flex flex-col items-center border-4 border-dashed border-slate-900 p-20 rounded-3xl">
                <p className="text-sm uppercase tracking-[0.4em] font-black opacity-20 italic">AI System Standby</p>
              </div>
            )}
          </div>

          <div className="absolute bottom-6 right-6 flex flex-col gap-2">
            <button onClick={downloadAsImage} disabled={!mainImage} className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg hover:bg-blue-500 disabled:opacity-50 text-xl">⬇</button>
            <button onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 3))} className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white shadow-lg hover:bg-slate-700">+</button>
            <button onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.5))} className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white shadow-lg hover:bg-slate-700">-</button>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="w-[320px] bg-[#111827] border-l border-slate-800 p-4 flex flex-col gap-4">
          <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">AI Diagnostics</h2>
          
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 flex-shrink-0">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] text-slate-400">Latency:</span>
                <span className="text-white font-mono text-xs">{inferenceTime ? `${inferenceTime}ms` : "--"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400">Detections:</span>
                <span className="text-emerald-400 font-black">{detections.length}</span>
              </div>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 flex-shrink-0">
              <span className="text-[9px] text-slate-500 uppercase font-black mb-3 block tracking-widest text-center">Breakdown</span>
              <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[10px] font-bold mb-1">
                      <span className="text-emerald-500">NORMAL</span>
                      <span className="text-white">{currentStats.benign}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${currentStats.benign}%` }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-bold mb-1">
                      <span className="text-red-500">AFFECTED</span>
                      <span className="text-white">{currentStats.pni}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 transition-all" style={{ width: `${currentStats.pni}%` }}></div>
                    </div>
                  </div>
              </div>
          </div>

          <div className="bg-blue-600/10 p-5 rounded-xl border border-blue-600/30 text-center flex-shrink-0">
              <div className="text-4xl font-mono font-black text-blue-400 leading-none mb-1">{currentStats.conf}%</div>
              <span className="text-[9px] text-blue-500 uppercase tracking-tighter font-black">AVG CONFIDENCE</span>
          </div>
        </div>
      </main>

      {/* FOOTER - GALLERY */}
      <footer className="h-32 bg-[#020617] border-t border-slate-800 p-3">
        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
          {folderImages.map((img, i) => (
            <div key={i} className="group relative min-w-[150px] h-24 bg-slate-900 rounded-lg border border-slate-700 cursor-pointer overflow-hidden transition-all hover:border-blue-500 flex-shrink-0">
              <div className="w-full h-full" onClick={() => analyzeImage(img, true)}>
                <img src={img.url} alt="thumb" className="w-full h-full object-cover opacity-60 group-hover:opacity-100" />
                <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/60 text-[9px] truncate text-white">{img.name}</div>
                {img.detections && img.detections.length > 0 && (
                   <div className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_5px_#10b981]"></div>
                )}
              </div>
              <button 
                onClick={(e) => deleteImageFromGallery(e, i)} 
                className="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}

export default App;