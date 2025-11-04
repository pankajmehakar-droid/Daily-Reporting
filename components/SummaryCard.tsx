
import React from 'react';

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon, color }) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex items-center space-x-4">
      <div className={`p-3 rounded-full bg-gray-100 dark:bg-gray-700 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{value}</p>
      </div>
    </div>
  );
};

export default SummaryCard;
