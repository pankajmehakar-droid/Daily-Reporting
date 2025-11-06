import React, { useState, useRef } from 'react';
import { User } from '../types';
import { addHighlight } from '../services/dataService';
import { XIcon, LoaderIcon, UploadIcon, AlertTriangleIcon } from './icons';

interface HighlightUploadModalProps {
  currentUser: User;
  onClose: () => void;
  onUploadSuccess: () => void;
}

const HighlightUploadModal: React.FC<HighlightUploadModalProps> = ({ currentUser, onClose, onUploadSuccess }) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
      if (file) {
        setError('Please select a valid image file (e.g., JPG, PNG, GIF).');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePreview) {
      setError('Please select an image to upload.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await addHighlight({
        imageUrl: imagePreview,
        uploadedBy: currentUser.staffName,
      });
      onUploadSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Upload Highlight Image</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close modal">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto">
            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm flex items-center gap-2" role="alert">
                <AlertTriangleIcon className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}
            
            <div
              className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="space-y-1 text-center">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="mx-auto h-48 w-auto object-contain" />
                ) : (
                  <>
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="flex text-sm text-gray-600 dark:text-gray-400">
                      <p className="pl-1">Click to upload an image</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-500">PNG, JPG, GIF up to 10MB</p>
                  </>
                )}
                 <input ref={fileInputRef} id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 flex-shrink-0">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || !imagePreview} className="btn btn-indigo flex items-center gap-2">
              {isSubmitting && <LoaderIcon className="w-4 h-4" />}
              {isSubmitting ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HighlightUploadModal;