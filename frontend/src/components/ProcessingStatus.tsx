import React from "react";
import { Loader2 } from "lucide-react";

interface ProcessingStatus {
  stage: string;
  progress: number;
}

interface ProcessingStatusProps {
  status: ProcessingStatus;
}

export const ProcessingStatusComponent: React.FC<ProcessingStatusProps> = ({
  status,
}) => {
  return (
    <div className='bg-white rounded-lg shadow-lg p-6 mb-6'>
      <div className='flex items-center mb-4'>
        <Loader2 className='h-6 w-6 text-blue-500 animate-spin mr-3' />
        <h3 className='text-lg font-semibold text-gray-900'>
          Processing Your PDF
        </h3>
      </div>
      <div className='mb-2'>
        <p className='text-sm text-gray-600'>{status.stage}</p>
      </div>
      <div className='w-full bg-gray-200 rounded-full h-2'>
        <div
          className='bg-blue-600 h-2 rounded-full transition-all duration-300'
          style={{ width: `${status.progress}%` }}></div>
      </div>
      <p className='text-xs text-gray-500 mt-2'>{status.progress}% complete</p>
    </div>
  );
};
