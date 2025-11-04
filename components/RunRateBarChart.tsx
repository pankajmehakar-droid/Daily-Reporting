import React from 'react';

interface RunRateBarChartProps {
  monthlyTarget: number;
  mtdAchievement: number;
  dailyRunRate: number;
  label: string;
  unit: string;
}

const RunRateBarChart: React.FC<RunRateBarChartProps> = ({ monthlyTarget, mtdAchievement, dailyRunRate, label, unit }) => {
  const chartHeight = 150;
  const barWidth = 30; // Fixed width for each bar
  const spacing = 10;
  const maxValue = Math.max(monthlyTarget, mtdAchievement + dailyRunRate, 0);

  const calculateBarHeight = (value: number) => (maxValue > 0 ? (value / maxValue) * chartHeight : 0);

  const targetHeight = calculateBarHeight(monthlyTarget);
  const achievementHeight = calculateBarHeight(mtdAchievement);
  const runRateHeight = calculateBarHeight(dailyRunRate);

  return (
    <div className="flex flex-col items-center p-4">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{label} ({unit})</h4>
      <svg width={barWidth * 3 + spacing * 2} height={chartHeight + 30} className="font-sans">
        <g transform="translate(0, 20)"> {/* Offset for labels */}
          {/* Y-axis baseline */}
          <line x1="0" y1={chartHeight} x2={barWidth * 3 + spacing * 2} y2={chartHeight} stroke="currentColor" strokeWidth="1" className="text-gray-300 dark:text-gray-600"/>

          {/* Monthly Target Bar */}
          <rect
            x={0}
            y={chartHeight - targetHeight}
            width={barWidth}
            height={targetHeight}
            fill="#4f46e5"
            rx="2"
          >
             <title>{`Monthly Target: ${monthlyTarget.toLocaleString()} ${unit}`}</title>
          </rect>
          <text x={barWidth / 2} y={chartHeight + 15} textAnchor="middle" className="text-xs fill-current text-gray-500 dark:text-gray-400">Target</text>


          {/* MTD Achievement Bar */}
          <rect
            x={barWidth + spacing}
            y={chartHeight - achievementHeight}
            width={barWidth}
            height={achievementHeight}
            fill="#10b981"
            rx="2"
          >
            <title>{`MTD Achievement: ${mtdAchievement.toLocaleString()} ${unit}`}</title>
          </rect>
          <text x={barWidth + spacing + barWidth / 2} y={chartHeight + 15} textAnchor="middle" className="text-xs fill-current text-gray-500 dark:text-gray-400">Achieved</text>

          {/* Daily Run Rate Bar */}
          <rect
            x={barWidth * 2 + spacing * 2}
            y={chartHeight - runRateHeight}
            width={barWidth}
            height={runRateHeight}
            fill="#0ea5e9"
            rx="2"
          >
            <title>{`Daily Run Rate: ${dailyRunRate.toLocaleString()} ${unit}`}</title>
          </rect>
          <text x={barWidth * 2 + spacing * 2 + barWidth / 2} y={chartHeight + 15} textAnchor="middle" className="text-xs fill-current text-gray-500 dark:text-gray-400">Run Rate</text>
        </g>
      </svg>
    </div>
  );
};

export default RunRateBarChart;