import React from 'react';
import { UploadIcon } from './icons';
import { User } from '../types';

interface FileUploadButtonProps {
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileName: string;
  user: User;
}

const FileUploadButton: React.FC<FileUploadButtonProps> = ({ onChange, fileName, user }) => {
  if (user.role !== 'admin') {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 flex items-center gap-3 z-20">
      {fileName && (
        <div className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm px-4 py-2 rounded-full shadow-lg">
          <p className="truncate max-w-[150px] sm:max-w-xs">
            <span className="font-semibold hidden sm:inline">Loaded: </span>
            {fileName}
          </p>
        </div>
      )}
      <div>
        <input
          type="file"
          id="csv-upload"
          className="hidden"
          accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={onChange}
        />
        <label
          htmlFor="csv-upload"
          className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold p-4 rounded-full shadow-lg cursor-pointer transition-transform transform hover:scale-105 flex items-center justify-center"
          aria-label="Upload XLSX file"
        >
          <UploadIcon className="w-6 h-6" />
        </label>
      </div>
    </div>
  );
};

export default FileUploadButton;