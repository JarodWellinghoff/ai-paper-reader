import React, { useRef } from "react";
import { Upload, FileText } from "lucide-react";

interface FileUploadProps {
  file: File | null;
  onFileSelect: (file: File) => void;
  onProcess: () => void;
  onCancel: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  file,
  onFileSelect,
  onProcess,
  onCancel,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      onFileSelect(selectedFile);
    }
  };

  if (!file) {
    return (
      <div className='bg-white rounded-lg shadow-lg p-8 mb-6'>
        <div
          className='border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors cursor-pointer'
          onClick={() => fileInputRef.current?.click()}>
          <Upload className='mx-auto h-12 w-12 text-gray-400 mb-4' />
          <p className='text-xl text-gray-600 mb-2'>
            Drop your PDF here or click to upload
          </p>
          <p className='text-sm text-gray-400'>Supports PDF files up to 10MB</p>
          <input
            ref={fileInputRef}
            type='file'
            accept='.pdf'
            onChange={handleFileChange}
            className='hidden'
          />
        </div>
      </div>
    );
  }

  return (
    <div className='bg-white rounded-lg shadow-lg p-6 mb-6'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center'>
          <FileText className='h-8 w-8 text-blue-500 mr-3' />
          <div>
            <p className='font-semibold text-gray-900'>{file.name}</p>
            <p className='text-sm text-gray-500'>
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
        <div className='flex gap-3'>
          <button
            onClick={onCancel}
            className='px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50'>
            Cancel
          </button>
          <button
            onClick={onProcess}
            className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'>
            Process PDF
          </button>
        </div>
      </div>
    </div>
  );
};
