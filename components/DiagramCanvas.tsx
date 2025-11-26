import React, { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch';
import { ConnectionMap } from '../types';

interface DiagramCanvasProps {
  code: string;
  onError: (errorMsg: string) => void;
  onSuccess: () => void;
  setZoomControls: (controls: ReactZoomPanPinchContentRef | null) => void;
  onZoomChange: (scale: number) => void;
}

const DiagramCanvas: React.FC<DiagramCanvasProps> = ({ code, onError, onSuccess, setZoomControls, onZoomChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const transformComponentRef = useRef<ReactZoomPanPinchContentRef | null>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [lastCode, setLastCode] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  
  // Stable ref callback
  const handleRef = useCallback((ref: ReactZoomPanPinchContentRef | null) => {
    if (ref) {
      transformComponentRef.current = ref;
      setZoomControls(ref);
    }
  }, [setZoomControls]);

  // Stable transform handler
  const handleTransform = useCallback((e: any) => {
    onZoomChange(e.state.scale);
  }, [onZoomChange]);

  // Initialize Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'loose',
      fontFamily: 'Inter',
      flowchart: {
        htmlLabels: true,
        curve: 'basis'
      }
    });
  }, []);

  // Render Effect
  useEffect(() => {
    if (code === lastCode) return;

    let isMounted = true;

    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Date.now()}`;
        if (!await mermaid.parse(code)) {
             throw new Error("Parsing failed");
        }

        const { svg } = await mermaid.render(id, code);
        
        if (isMounted) {
          // Clean the SVG to ensure it doesn't have restrictive styles that mess up zooming
          // Mermaid often adds style="max-width: 100%" or specific widths which we want to override
          // so the zoom library controls the size.
          const cleanSvg = svg
            .replace(/style="[^"]*"/g, '') // Remove inline styles (like max-width)
            .replace(/width="[^"]*"/, '')  // Remove width attribute
            .replace(/height="[^"]*"/, ''); // Remove height attribute
            
          setSvgContent(cleanSvg);
          setLastCode(code);
          onSuccess();
          setSelectedNode(null);
        }
      } catch (err: any) {
        if (isMounted) {
            const msg = err.message || (typeof err === 'string' ? err : 'Unknown rendering error');
            onError(msg);
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Post-Render Auto-Fit Logic
  useEffect(() => {
    if (!svgContent || !containerRef.current || !transformComponentRef.current) return;

    // We need to wait for the DOM to update with the new SVG
    setTimeout(() => {
      const svgElement = containerRef.current?.querySelector('svg');
      if (!svgElement) return;

      // 1. Force the SVG to take up its natural size defined by viewBox
      // This is crucial for the Zoom library to understand the "real" size of the content
      const viewBox = svgElement.getAttribute('viewBox');
      if (viewBox) {
        const [,, w, h] = viewBox.split(' ').map(Number);
        if (w && h) {
          svgElement.setAttribute('width', `${w}px`);
          svgElement.setAttribute('height', `${h}px`);
          svgElement.style.maxWidth = 'none'; // Ensure no CSS overrides it
        }
      }

      // 2. Calculate the scale needed to fit the diagram into the view
      const wrapper = containerRef.current?.closest('.react-transform-component') as HTMLElement;
      if (wrapper && viewBox) {
        const [,, w, h] = viewBox.split(' ').map(Number);
        const wrapperWidth = wrapper.clientWidth;
        const wrapperHeight = wrapper.clientHeight;
        
        const widthRatio = (wrapperWidth - 80) / w; // 80px padding
        const heightRatio = (wrapperHeight - 80) / h;
        
        // Choose the smaller ratio to ensure it fits entirely
        let fitScale = Math.min(widthRatio, heightRatio);
        
        // Clamp scale logic
        // If the diagram is tiny, don't zoom in massively (cap at 1)
        // If huge, zoom out as much as needed (down to minScale)
        fitScale = Math.min(fitScale, 1); 
        fitScale = Math.max(fitScale, 0.05); // Don't go below reasonable visibility

        // Apply the fit transform
        transformComponentRef.current?.centerView(fitScale, 0); // 0 duration for instant fit
      }
    }, 50); // Small delay to allow DOM paint
  }, [svgContent]);

  // Interaction Logic (Highlighting)
  const handleDiagramClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const nodeElement = target.closest('.node');
    
    if (!nodeElement) {
      if (selectedNode) setSelectedNode(null);
      return;
    }

    const nodeId = nodeElement.id;
    setSelectedNode(nodeId);
  }, [selectedNode]);

  // Apply Styles based on selection
  useEffect(() => {
    if (!containerRef.current) return;
    const svg = containerRef.current.querySelector('svg');
    if (!svg) return;

    const nodes = svg.querySelectorAll('.node');
    const edges = svg.querySelectorAll('.edgePath');

    nodes.forEach(n => n.classList.remove('node-dimmed', 'node-highlighted'));
    edges.forEach(e => e.classList.remove('edge-dimmed', 'edge-highlighted'));

    if (!selectedNode) return;

    const selectedElement = svg.querySelector(`[id="${selectedNode}"]`);
    if (selectedElement) selectedElement.classList.add('node-highlighted');

    nodes.forEach(n => {
        if (n.id !== selectedNode) n.classList.add('node-dimmed');
    });
    
    edges.forEach(e => e.classList.add('edge-dimmed'));

    const rawId = selectedNode.split('-')[1] || selectedNode;

    edges.forEach(edge => {
        if (edge.id.includes(rawId)) {
             edge.classList.remove('edge-dimmed');
             edge.classList.add('edge-highlighted');
        }
    });

  }, [selectedNode, svgContent]);

  return (
    <div className="flex-1 bg-gray-50/50 overflow-hidden relative h-full w-full">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
             style={{ 
                 backgroundImage: 'radial-gradient(#4F46E5 1px, transparent 1px)', 
                 backgroundSize: '20px 20px' 
             }} 
        />
        
        <TransformWrapper
            initialScale={1}
            minScale={0.05} // Allow zooming out further for massive diagrams
            maxScale={100}
            centerOnInit
            wheel={{ step: 0.5 }}
            ref={handleRef}
            onTransformed={handleTransform}
        >
            {({ zoomIn, zoomOut, resetTransform, centerView }) => (
            <React.Fragment>
                <TransformComponent 
                    wrapperClass="w-full h-full" 
                    contentClass="w-full h-full"
                    wrapperStyle={{ width: "100%", height: "100%" }}
                >
                    <div 
                        ref={containerRef}
                        className="w-full h-full flex items-center justify-center p-20 min-h-screen origin-center"
                        onClick={handleDiagramClick}
                        dangerouslySetInnerHTML={{ __html: svgContent }}
                    />
                </TransformComponent>
            </React.Fragment>
            )}
        </TransformWrapper>
        
        {/* Info Overlay */}
        <div className="absolute bottom-6 right-6 pointer-events-none z-10">
             <div className="bg-white/90 backdrop-blur border border-gray-200 shadow-lg rounded-lg p-3 text-xs text-gray-500">
                {selectedNode ? (
                    <span className="text-indigo-600 font-bold">Selected: {selectedNode.split('-')[1] || 'Node'}</span>
                ) : (
                    <span>Click a node to focus • Scroll to zoom</span>
                )}
             </div>
        </div>
    </div>
  );
};

export default DiagramCanvas;