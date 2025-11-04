import React from 'react';
import { ChartDataPoint } from '../types';

const COLORS = [
  '#4f46e5', '#0ea5e9', '#10b981', '#f97316', 
  '#ec4899', '#8b5cf6', '#6366f1', '#38bdf8',
];

interface BarChartProps {
  data: ChartDataPoint[];
  title: string;
  onBarClick?: (originalLabel: string) => void; // New prop for click handler, passes originalLabel
  highlightedLabel?: string | null; // New prop to highlight a specific bar (expects originalLabel)
}

const BarChart: React.FC<BarChartProps> = ({ data, title, onBarClick, highlightedLabel }) => {
  if (!data || data.length === 0) {
    return null;
  }

  const maxValue = Math.max(...data.map(d => d.value), 0);
  const chartHeight = 300;
  const yAxisWidth = 50;
  const xAxisHeight = 50;

  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">{title}</h3>
      <div className="overflow-x-auto pb-4">
        <div style={{ minWidth: `${data.length * 60}px` }}>
          <svg
            width="100%"
            height={chartHeight + xAxisHeight}
            className="font-sans"
            aria-label={title}
            role="img"
          >
            <g transform={`translate(${yAxisWidth}, 0)`}>
              {/* Y-axis grid lines and labels */}
              {[...Array(5)].map((_, i) => {
                const y = chartHeight - (chartHeight / 4) * i;
                const value = (maxValue / 4) * i;
                return (
                  <g key={`y-axis-${i}`} className="text-gray-300 dark:text-gray-600">
                    <line
                      x1={-yAxisWidth}
                      x2="100%"
                      y1={y}
                      y2={y}
                      stroke="currentColor"
                      strokeDasharray="2,2"
                    />
                    <text
                      x={-8}
                      y={y + 4}
                      textAnchor="end"
                      className="text-xs fill-current text-gray-500 dark:text-gray-400"
                    >
                      {formatValue(value)}
                    </text>
                  </g>
                );
              })}

              {/* Bars and X-axis labels */}
              {data.map((d, i) => {
                const barWidth = 100 / data.length * 0.6; // 60% of available space
                const x = (100 / data.length) * i + (100 / data.length * 0.2); // Center bar
                const barHeight = maxValue > 0 ? (d.value / maxValue) * chartHeight : 0;
                const y = chartHeight - barHeight;
                // Highlight if originalLabel (DD/MM/YYYY) matches, or if no originalLabel, check main label
                const isHighlighted = highlightedLabel && ((d.originalLabel && d.originalLabel === highlightedLabel) || (!d.originalLabel && d.label === highlightedLabel));

                return (
                  <g key={d.label} className="group">
                    <title>{`${d.label}: ${d.value.toLocaleString()}`}</title>
                    <rect
                      x={`${x}%`}
                      y={y}
                      width={`${barWidth}%`}
                      height={barHeight}
                      fill={COLORS[i % COLORS.length]}
                      className={`transition-opacity duration-200 ${onBarClick ? 'cursor-pointer' : ''} ${isHighlighted ? 'opacity-100 ring-2 ring-offset-2 ring-indigo-500' : 'opacity-80 group-hover:opacity-100'}`}
                      rx="2"
                      onClick={() => onBarClick && d.originalLabel && onBarClick(d.originalLabel)}
                    />
                    <text
                      x={`calc(${x}% + ${barWidth / 2}%)`}
                      y={y - 8}
                      textAnchor="middle"
                      className="text-xs font-bold fill-current text-gray-800 dark:text-gray-100 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      aria-hidden="true"
                    >
                      {d.value.toLocaleString()}
                    </text>
                    <text
                      x={`calc(${x}% + ${barWidth / 2}%)`}
                      y={chartHeight + 20}
                      textAnchor="middle"
                      className="text-xs fill-current text-gray-500 dark:text-gray-400"
                    >
                      {d.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default BarChart;