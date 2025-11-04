import React from 'react';
import { ChartDataPoint } from '../types';

const COLORS = [
  '#4f46e5', '#0ea5e9', '#10b981', '#f97316', 
  '#ec4899', '#8b5cf6', '#6366f1', '#38bdf8',
  '#f59e0b', '#ef4444', '#22c55e', '#a855f7',
];

const getCoordinatesForPercent = (percent: number) => {
  const x = Math.cos(2 * Math.PI * percent);
  const y = Math.sin(2 * Math.PI * percent);
  return [x, y];
};

interface PieChartProps {
  data: ChartDataPoint[];
  title: string;
  onSliceClick?: (label: string) => void; // New prop for click handler
  highlightedLabel?: string | null; // New prop to highlight a specific slice
}

const PieChart: React.FC<PieChartProps> = ({ data, title, onSliceClick, highlightedLabel }) => {
  if (!data || data.length === 0) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center h-full flex flex-col justify-center">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">No data available for this chart.</p>
        </div>
    );
  }

  const totalValue = data.reduce((acc, d) => acc + d.value, 0);
  let cumulativePercent = 0;

  const slices = data.map((d, index) => {
    const percent = d.value / totalValue;
    const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
    
    cumulativePercent += percent;
    const [endX, endY] = getCoordinatesForPercent(cumulativePercent);

    const largeArcFlag = percent > 0.5 ? 1 : 0;
    
    const pathData = [
      `M ${startX} ${startY}`, // Move
      `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, // Arc
      'L 0 0', // Line to center
    ].join(' ');

    return { pathData, color: COLORS[index % COLORS.length] };
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 h-full">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">{title}</h3>
      <div className="flex flex-col md:flex-row items-center justify-center gap-6">
        <div className="w-48 h-48 sm:w-56 sm:h-56 flex-shrink-0">
          <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }} aria-label={title} role="img">
            {slices.map((slice, index) => {
              const isHighlighted = data[index].label === highlightedLabel;
              return (
                <path 
                  key={index} 
                  d={slice.pathData} 
                  fill={slice.color}
                  className={`${onSliceClick ? 'cursor-pointer' : ''} transition-all duration-200 ${isHighlighted ? 'opacity-100 stroke-2 stroke-indigo-500' : 'opacity-80 hover:opacity-100'}`}
                  onClick={() => onSliceClick && onSliceClick(data[index].label)}
                >
                  <title>{`${data[index].label}: ${data[index].value.toLocaleString()} (${((data[index].value / totalValue) * 100).toFixed(1)}%)`}</title>
                </path>
              );
            })}
          </svg>
        </div>
        <div className="w-full md:w-auto">
          <ul className="space-y-2">
            {data.map((d, index) => {
              const isHighlighted = d.label === highlightedLabel;
              return (
                <li key={d.label} className={`flex items-center text-sm ${isHighlighted ? 'font-bold text-indigo-600 dark:text-indigo-400' : ''}`}>
                  <span
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></span>
                  <span className="text-gray-600 dark:text-gray-300 mr-2 font-medium">{d.label}:</span>
                  <span className="text-gray-800 dark:text-gray-100 font-semibold">{d.value.toLocaleString()}</span>
                  <span className="text-gray-500 dark:text-gray-400 ml-1">({((d.value / totalValue) * 100).toFixed(1)}%)</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PieChart;