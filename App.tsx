import React, { useState, useRef, useCallback } from 'react';
import { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch';
import html2canvas from 'html2canvas';

import Toolbar from './components/Toolbar';
import EditorPanel from './components/EditorPanel';
import DiagramCanvas from './components/DiagramCanvas';
import { INITIAL_CODE } from './constants';
import { ViewMode } from './types';
import { fixMermaidCode } from './services/geminiService';

const App: React.FC = () => {
  const [code, setCode] = useState<string>(INITIAL_CODE);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Split);
  const [isFixing, setIsFixing] = useState<boolean>(false);
  const [zoomControls, setZoomControls] = useState<ReactZoomPanPinchContentRef | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);

  const handleError = useCallback((msg: string) => {
    setError(msg);
  }, []);

  const handleSuccess = useCallback(() => {
    setError(null);
  }, []);

  const handleZoomChange = useCallback((scale: number) => {
    setZoomScale(scale);
  }, []);

  const handleFix = async () => {
    if (!code || !error) return;
    
    setIsFixing(true);
    try {
      const fixedCode = await fixMermaidCode(code, error);
      setCode(fixedCode);
      // Wait a moment for render, then clear error if successful
      setTimeout(() => {
        if (!document.querySelector('.error-banner')) {
            setError(null);
        }
      }, 500);
    } catch (err) {
      alert("Failed to auto-fix code. Please check your API key or internet connection.");
    } finally {
      setIsFixing(false);
    }
  };

  const handleDownload = async () => {
    const svgElement = document.querySelector('.mermaid svg') as SVGSVGElement;
    if (!svgElement) return;

    // Method 1: Get bounding box for better cropping
    const bbox = svgElement.getBBox();
    const width = bbox.width + 40; // padding
    const height = bbox.height + 40;
    
    // Create a canvas via html2canvas (captures styles better than raw SVG conversion sometimes)
    // Or simpler: Convert SVG string to Blob
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = width * 2; // High res
      canvas.height = height * 2;
      if(ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, width * 2, height * 2);
        
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `diagram-${Date.now()}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-white text-gray-900 overflow-hidden font-sans">
      <Toolbar 
        viewMode={viewMode} 
        setViewMode={setViewMode} 
        onDownload={handleDownload}
        zoomControls={zoomControls}
        scale={zoomScale}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Editor Pane */}
        {(viewMode === ViewMode.Split || viewMode === ViewMode.EditorOnly) && (
          <div className={`${viewMode === ViewMode.Split ? 'w-1/3 min-w-[350px]' : 'w-full'} h-full transition-all duration-300 ease-in-out z-10 shadow-xl`}>
            <EditorPanel 
              code={code} 
              setCode={setCode} 
              error={error}
              isFixing={isFixing}
              onFix={handleFix}
            />
          </div>
        )}

        {/* Preview Pane */}
        {(viewMode === ViewMode.Split || viewMode === ViewMode.ViewOnly) && (
          <div className="flex-1 h-full relative z-0">
             <DiagramCanvas 
                code={code}
                onError={handleError}
                onSuccess={handleSuccess}
                setZoomControls={setZoomControls}
                onZoomChange={handleZoomChange}
             />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;