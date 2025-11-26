import React from 'react';
import { ViewMode } from '../types';
import { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch';

interface ToolbarProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onDownload: () => void;
  zoomControls: ReactZoomPanPinchContentRef | null;
  scale: number;
}

const Toolbar: React.FC<ToolbarProps> = ({ viewMode, setViewMode, onDownload, zoomControls, scale }) => {
  return (
    <div className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4 shadow-sm z-10">
      <div className="flex items-center space-x-2">
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mr-4">
          Mermaid Studio
        </h1>
        
        <div className="hidden md:flex bg-gray-100 rounded-lg p-1 space-x-1">
          <button
            onClick={() => setViewMode(ViewMode.EditorOnly)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              viewMode === ViewMode.EditorOnly ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setViewMode(ViewMode.Split)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              viewMode === ViewMode.Split ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Split
          </button>
          <button
            onClick={() => setViewMode(ViewMode.ViewOnly)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              viewMode === ViewMode.ViewOnly ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {zoomControls && (
          <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 mr-2">
            <button 
              onClick={() => zoomControls.zoomOut()}
              className="p-2 hover:bg-gray-100 text-gray-600 rounded-l-lg border-r border-gray-200"
              title="Zoom Out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
            </button>
            <button 
              onClick={() => zoomControls.resetTransform()}
              className="p-2 hover:bg-gray-100 text-gray-600 text-xs font-medium px-3 min-w-[3rem]"
              title="Reset View"
            >
              {Math.round(scale * 100)}%
            </button>
            <button 
              onClick={() => zoomControls.zoomIn()}
              className="p-2 hover:bg-gray-100 text-gray-600 rounded-r-lg border-l border-gray-200"
              title="Zoom In"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
        )}

        <button
          onClick={onDownload}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          <span className="hidden sm:inline">Export PNG</span>
        </button>
      </div>
    </div>
  );
};

export default Toolbar;