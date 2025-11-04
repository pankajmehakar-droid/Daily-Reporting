import React, { useState } from 'react';
import { ChevronDownIcon } from './icons';

interface CollapsibleSectionProps {
  title: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, icon: Icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 sm:p-6 text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center space-x-3">
            <Icon className="w-6 h-6 text-indigo-500" />
            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">{title}</h3>
        </div>
        <ChevronDownIcon
          className={`w-6 h-6 text-gray-500 dark:text-gray-400 transform transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700">
            {children}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;
