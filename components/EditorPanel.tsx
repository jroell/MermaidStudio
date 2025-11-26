import React from 'react';
import { EXAMPLES } from '../constants';
import { DiagramExample } from '../types';

interface EditorPanelProps {
  code: string;
  setCode: (code: string) => void;
  error: string | null;
  isFixing: boolean;
  onFix: () => void;
}

const EditorPanel: React.FC<EditorPanelProps> = ({ code, setCode, error, isFixing, onFix }) => {
  const handleExampleClick = (example: DiagramExample) => {
    if (window.confirm('This will replace your current code. Continue?')) {
      setCode(example.code);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 border-r border-gray-200">
      {/* Examples Bar */}
      <div className="p-3 bg-white border-b border-gray-200 overflow-x-auto whitespace-nowrap custom-scrollbar">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-3">Examples:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.id}
            onClick={() => handleExampleClick(ex)}
            className="inline-block px-3 py-1 mr-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-colors border border-transparent hover:border-indigo-200"
          >
            {ex.name}
          </button>
        ))}
      </div>

      {/* Code Area */}
      <div className="flex-1 relative group">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full h-full p-6 bg-[#1e1e1e] text-gray-100 font-mono text-sm resize-none focus:outline-none custom-scrollbar leading-relaxed"
          spellCheck={false}
          placeholder="Enter Mermaid syntax here..."
        />
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
                onClick={() => setCode('')} 
                className="text-xs text-gray-400 hover:text-white bg-white/10 px-2 py-1 rounded"
            >
                Clear
            </button>
        </div>
      </div>

      {/* Error / AI Fix Bar */}
      {error && (
        <div className="bg-red-50 border-t border-red-200 p-4 animate-in slide-in-from-bottom-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 mr-4">
              <h4 className="text-sm font-bold text-red-800 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Syntax Error
              </h4>
              <p className="text-xs text-red-600 mt-1 font-mono break-all">{error.split('\n')[0]}</p>
            </div>
            <button
              onClick={onFix}
              disabled={isFixing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                isFixing 
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-indigo-200'
              }`}
            >
              {isFixing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Fixing...
                </>
              ) : (
                <>
                  <span className="text-lg">✨</span>
                  Auto-Fix
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditorPanel;