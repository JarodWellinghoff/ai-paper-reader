import React from "react";
import { RotateCcw } from "lucide-react";

interface PDFViewerProps {
  pdfUrl: string;
  onReset: () => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ pdfUrl, onReset }) => {
  return (
    <div className='lg:col-span-2 bg-white rounded-lg shadow-lg p-6'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-semibold text-gray-900'>PDF Document</h3>
        <button
          onClick={onReset}
          className='flex items-center gap-2 px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50'>
          <RotateCcw className='h-4 w-4' />
          New File
        </button>
      </div>
      <div
        className='border border-gray-200 rounded-lg overflow-hidden'
        style={{ height: "700px" }}>
        <iframe src={pdfUrl} className='w-full h-full' title='PDF Document' />
      </div>
    </div>
  );
};
