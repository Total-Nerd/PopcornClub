import React from 'react';
import { useStatsStore } from '../store/useStatsStore';

const StatsLineChart = () => {
  const { stats, mediaTypeFilter } = useStatsStore();
  const data = stats?.timeline || [];

  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', height: '160px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
        No data available for this timeline.
      </div>
    );
  }

  const chartPoints = data.map(item => {
    let val = item.total || 0;
    if (mediaTypeFilter === 'shows') val = item.shows || 0;
    else if (mediaTypeFilter === 'movies') val = item.movies || 0;
    return val;
  });

  const maxVal = Math.max(...chartPoints, 5);
  
  const width = 600;
  const height = 180;
  const paddingLeft = 35;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const coordinates = data.map((item, idx) => {
    const val = mediaTypeFilter === 'all' ? (item.total || 0) : (mediaTypeFilter === 'shows' ? (item.shows || 0) : (item.movies || 0));
    const x = paddingLeft + (data.length > 1 ? (idx / (data.length - 1)) : 0.5) * chartWidth;
    const y = paddingTop + (1 - (val / maxVal)) * chartHeight;
    return { x, y, label: item.label, value: val };
  });

  let linePath = '';
  let areaPath = '';

  if (coordinates.length > 0) {
    if (coordinates.length === 1) {
      linePath = `M ${coordinates[0].x - 10} ${coordinates[0].y} L ${coordinates[0].x + 10} ${coordinates[0].y}`;
      areaPath = `M ${coordinates[0].x - 10} ${height - paddingBottom} L ${coordinates[0].x - 10} ${coordinates[0].y} L ${coordinates[0].x + 10} ${coordinates[0].y} L ${coordinates[0].x + 10} ${height - paddingBottom} Z`;
    } else {
      linePath = `M ${coordinates[0].x} ${coordinates[0].y}`;
      areaPath = `M ${coordinates[0].x} ${height - paddingBottom} L ${coordinates[0].x} ${coordinates[0].y}`;

      for (let i = 1; i < coordinates.length; i++) {
        linePath += ` L ${coordinates[i].x} ${coordinates[i].y}`;
        areaPath += ` L ${coordinates[i].x} ${coordinates[i].y}`;
      }
      
      areaPath += ` L ${coordinates[coordinates.length - 1].x} ${height - paddingBottom} Z`;
    }
  }

  const gridTicks = [0, maxVal * 0.5, maxVal].map(v => Math.round(v));
  const labelFilterStep = Math.max(1, Math.floor(data.length / 6));

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {gridTicks.map((tick, idx) => {
          const y = paddingTop + (1 - (tick / maxVal)) * chartHeight;
          return (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 8}
                y={y + 3}
                textAnchor="end"
                fill="var(--text-muted)"
                fontSize="9px"
                fontWeight="600"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {areaPath && (
          <path
            d={areaPath}
            fill="url(#chart-area-grad)"
            style={{ transition: 'all 0.3s ease' }}
          />
        )}

        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: 'all 0.3s ease' }}
          />
        )}

        {coordinates.map((pt, idx) => {
          const showLabel = idx % labelFilterStep === 0 || idx === coordinates.length - 1;
          return (
            <g key={idx}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r="3.5"
                fill="var(--accent)"
                stroke="var(--bg-card)"
                strokeWidth="1.5"
                style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
              >
                <title>{`${pt.value} views (${pt.label})`}</title>
              </circle>

              {showLabel && (
                <text
                  x={pt.x}
                  y={height - 6}
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize="9px"
                  fontWeight="500"
                >
                  {pt.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default StatsLineChart;
