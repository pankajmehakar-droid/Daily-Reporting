import React, { useState, useRef, useEffect } from 'react';
import { User, HighlightItem } from '../types';
import { addHighlight } from '../services/dataService';
import { XIcon, LoaderIcon, UploadIcon, AlertTriangleIcon, PlusIcon, TrashIcon } from './icons';

interface UploadedItem {
  id: string; // Unique ID for React keys and management
  file: File | null;
  preview: string | null;
  description: string;
}

interface HighlightUploadModalProps {
  currentUser: User;
  onClose: () => void;
  onUploadSuccess: () => void;
}

const HighlightUploadModal: React.FC<HighlightUploadModalProps> = ({ currentUser, onClose, onUploadSuccess }) => {
  const [itemsToUpload, setItemsToUpload] = useState<UploadedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New states for paste functionality
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [pastedTextContent, setPastedTextContent] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);


  // Auto-add an initial empty item if none exist
  useEffect(() => {
    if (itemsToUpload.length === 0) {
      addItem();
    }
  }, [itemsToUpload.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const addItem = () => {
    setItemsToUpload(prev => [
      ...prev,
      { id: Date.now().toString() + Math.random(), file: null, preview: null, description: '' }, // Add random for unique IDs
    ]);
    setError(null); // Clear error when adding a new item
  };

  const removeItem = (id: string) => {
    setItemsToUpload(prev => prev.filter(item => item.id !== id));
    setError(null); // Clear error if removing an item might resolve it
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setError(null);
        const reader = new FileReader();
        reader.onloadend = () => {
          setItemsToUpload(prev =>
            prev.map(item =>
              item.id === id ? { ...item, file, preview: reader.result as string } : item
            )
          );
        };
        reader.readAsDataURL(file);
      } else {
        setError('Please select a valid image file (e.g., JPG, PNG, GIF).');
        setItemsToUpload(prev =>
          prev.map(item =>
            item.id === id ? { ...item, file: null, preview: null } : item
          )
        );
      }
    } else {
      setItemsToUpload(prev =>
        prev.map(item =>
          item.id === id ? { ...item, file: null, preview: null } : item
        )
      );
    }
    event.target.value = ''; // Clear file input value to allow re-selection of the same file
  };

  const handleDescriptionChange = (event: React.ChangeEvent<HTMLTextAreaElement>, id: string) => {
    setItemsToUpload(prev =>
      prev.map(item =>
        item.id === id ? { ...item, description: event.target.value } : item
      )
    );
  };

  const handleProcessPaste = () => {
    setPasteError(null);
    if (!pastedTextContent.trim()) {
      setPasteError('No content pasted. Please paste your table data into the text area.');
      return;
    }

    const newItems: UploadedItem[] = [];
    const rows = pastedTextContent.split('\n').filter(row => row.trim() !== '');

    if (rows.length === 0) {
      setPasteError('Could not parse any valid rows from the pasted content.');
      return;
    }

    rows.forEach(row => {
      const columns = row.split('\t').map(col => col.trim()); // Split by tab for Excel format
      const description = columns.join(' - '); // Concatenate columns for description

      if (description) {
        newItems.push({
          id: Date.now().toString() + Math.random(), // Unique ID
          file: null,
          preview: null,
          description: description,
        });
      }
    });

    if (newItems.length > 0) {
      setItemsToUpload(prev => [...prev, ...newItems]);
      setError(null); // Clear any general error that might be showing
      setShowPasteInput(false);
      setPastedTextContent('');
      // Optionally, show a success message for paste operation
      setError(`Successfully added ${newItems.length} highlight item(s) from paste.`);
      setTimeout(() => setError(null), 5000);
    } else {
      setPasteError('No valid highlight items could be extracted from the pasted content.');
    }
  };

  const handleCancelPaste = () => {
    setShowPasteInput(false);
    setPastedTextContent('');
    setPasteError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // An item is valid if it has an image preview OR a non-empty description
    const validItems = itemsToUpload.filter(item => item.preview || item.description.trim());
    if (validItems.length === 0) {
      setError('Please provide at least one image or text description for your highlight.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const highlightItems: HighlightItem[] = validItems.map(item => ({
        imageUrl: item.preview || undefined, // Set to undefined if no preview
        description: item.description.trim(),
      }));

      await addHighlight({
        items: highlightItems,
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Upload Highlights</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close modal">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
          <div className="p-6 space-y-6 overflow-y-auto">
            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm flex items-start gap-2" role="alert">
                <AlertTriangleIcon className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Paste from Excel Section */}
            {showPasteInput ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                <h4 className="text-md font-semibold text-blue-800 dark:text-blue-200 mb-3">Paste from Excel</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  Copy rows from an Excel or Google Sheet table and paste them here. Each row will become a new text highlight item. Columns will be joined by ' - '.
                </p>
                <textarea
                  value={pastedTextContent}
                  onChange={(e) => setPastedTextContent(e.target.value)}
                  rows={5}
                  className="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Paste your table data here..."
                  aria-label="Paste table data from Excel"
                  disabled={isSubmitting}
                ></textarea>
                {pasteError && (
                  <p className="text-sm text-red-500 dark:text-red-400 mt-2 flex items-center gap-1">
                    <AlertTriangleIcon className="w-4 h-4 flex-shrink-0" /> {pasteError}
                  </p>
                )}
                <div className="mt-4 flex justify-end gap-3">
                  <button type="button" onClick={handleCancelPaste} className="btn btn-secondary" disabled={isSubmitting}>
                    Cancel
                  </button>
                  <button type="button" onClick={handleProcessPaste} className="btn btn-blue" disabled={isSubmitting || !pastedTextContent.trim()}>
                    Process Paste
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setShowPasteInput(true)}
                  className="btn btn-secondary flex items-center gap-2"
                  disabled={isSubmitting}
                  aria-label="Paste multiple highlight items from Excel"
                >
                  <PlusIcon className="w-5 h-5" /> Paste from Table
                </button>
              </div>
            )}

            {/* Individual Highlight Items */}
            {itemsToUpload.map((item, index) => (
              <div key={item.id} className="relative bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                {itemsToUpload.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label="Remove item"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
                <h4 className="text-md font-semibold text-gray-800 dark:text-gray-100 mb-3">Highlight Item {index + 1}</h4>
                
                {/* Image Upload Area */}
                <div
                  className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400"
                  onClick={() => {
                    const inputElement = document.getElementById(`file-upload-${item.id}`);
                    if (inputElement) {
                      inputElement.click();
                    }
                  }}
                  aria-label={`Upload image for item ${index + 1}`}
                >
                  <div className="space-y-1 text-center">
                    {item.preview ? (
                      <img src={item.preview} alt="Preview" className="mx-auto h-32 w-auto object-contain" />
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
                    <input
                      id={`file-upload-${item.id}`}
                      name={`file-upload-${item.id}`}
                      type="file"
                      className="sr-only"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, item.id)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Description Text Area */}
                <div className="mt-4">
                  <label htmlFor={`description-${item.id}`} className="label-style">Description (Optional)</label>
                  <textarea
                    id={`description-${item.id}`}
                    name={`description-${item.id}`}
                    value={item.description}
                    onChange={(e) => handleDescriptionChange(e, item.id)}
                    rows={3}
                    className="mt-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Add a description for this highlight item..."
                    disabled={isSubmitting}
                  ></textarea>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addItem}
              className="btn btn-secondary w-full flex items-center justify-center gap-2 mt-4"
              disabled={isSubmitting}
              aria-label="Add another highlight item"
            >
              <PlusIcon className="w-5 h-5" /> Add Another Item
            </button>
          </div>
          <div className="flex justify-end gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 flex-shrink-0">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || itemsToUpload.filter(item => item.preview || item.description.trim()).length === 0} className="btn btn-indigo flex items-center gap-2">
              {isSubmitting && <LoaderIcon className="w-4 h-4" />}
              {isSubmitting ? 'Uploading...' : 'Upload Highlights'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HighlightUploadModal;