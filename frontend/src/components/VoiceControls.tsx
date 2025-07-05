import React from "react";
import { Play, Pause, Volume2 } from "lucide-react";

interface VoiceControlsProps {
  isPlaying: boolean;
  voiceSpeed: number;
  currentPosition: number;
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
  onPositionChange: (position: number) => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  isPlaying,
  voiceSpeed,
  currentPosition,
  onPlayPause,
  onSpeedChange,
  onPositionChange,
}) => {
  return (
    <div className='bg-white rounded-lg shadow-lg p-6'>
      <h3 className='text-lg font-semibold text-gray-900 mb-4'>
        Voice Controls
      </h3>

      {/* Play/Pause */}
      <div className='mb-6'>
        <button
          onClick={onPlayPause}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold ${
            isPlaying
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}>
          {isPlaying ? (
            <Pause className='h-5 w-5' />
          ) : (
            <Play className='h-5 w-5' />
          )}
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>

      {/* Speed Control */}
      <div className='mb-6'>
        <label className='block text-sm font-medium text-gray-700 mb-2'>
          <Volume2 className='inline h-4 w-4 mr-1' />
          Speed: {voiceSpeed}x
        </label>
        <input
          type='range'
          min='0.5'
          max='2'
          step='0.1'
          value={voiceSpeed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer'
        />
        <div className='flex justify-between text-xs text-gray-500 mt-1'>
          <span>0.5x</span>
          <span>1x</span>
          <span>2x</span>
        </div>
      </div>

      {/* Position Control */}
      <div className='mb-6'>
        <label className='block text-sm font-medium text-gray-700 mb-2'>
          Position: {Math.round(currentPosition)}%
        </label>
        <input
          type='range'
          min='0'
          max='100'
          value={currentPosition}
          onChange={(e) => onPositionChange(parseInt(e.target.value))}
          className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer'
        />
        <div className='flex justify-between text-xs text-gray-500 mt-1'>
          <span>Start</span>
          <span>End</span>
        </div>
      </div>

      {/* Quick Speed Buttons */}
      <div className='grid grid-cols-3 gap-2'>
        {[0.75, 1, 1.25].map((speed) => (
          <button
            key={speed}
            onClick={() => onSpeedChange(speed)}
            className={`py-2 px-3 text-sm rounded ${
              voiceSpeed === speed
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}>
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
};
