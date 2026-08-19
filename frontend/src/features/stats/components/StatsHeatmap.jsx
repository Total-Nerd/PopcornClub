import React from 'react';
import { useStatsStore } from '../store/useStatsStore';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const StatsHeatmap = () => {
  const { stats, mediaTypeFilter, heatmapTooltip, setHeatmapTooltip } = useStatsStore();

  const cellWidth = 11;
  const cellHeight = 11;
  const cellGap = 3;
  const headerHeight = 15;
  const labelWidth = 30;

  const heatmapData = (stats?.activity || []).map(day => {
    let val = day.total || 0;
    if (mediaTypeFilter === 'shows') val = day.tv || 0;
    else if (mediaTypeFilter === 'movies') val = day.movie || 0;
    return { ...day, activeVal: val };
  });

  if (heatmapData.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '16px 0' }}>
        No activity recorded.
      </div>
    );
  }

  const firstDayDate = new Date(heatmapData[0].date);
  const firstDayOfWeek = firstDayDate.getDay();
  const cells = [];
  
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({ pad: true, row: i, col: 0 });
  }

  let currentCol = 0;
  heatmapData.forEach((day, idx) => {
    const d = new Date(day.date);
    const row = d.getDay();
    if (idx > 0 && row === 0) {
      currentCol++;
    }
    cells.push({
      pad: false,
      row,
      col: currentCol,
      date: day.date,
      count: day.activeVal,
      tv: day.tv,
      movie: day.movie
    });
  });

  const totalCols = currentCol + 1;
  const svgWidth = labelWidth + totalCols * (cellWidth + cellGap);
  const svgHeight = headerHeight + 7 * (cellHeight + cellGap);

  const getCellColor = (count) => {
    if (count === 0) return 'rgba(255, 255, 255, 0.05)';
    if (count === 1) return 'rgba(16, 185, 129, 0.25)';
    if (count === 2) return 'rgba(16, 185, 129, 0.5)';
    if (count <= 4) return 'rgba(16, 185, 129, 0.75)';
    return 'rgba(16, 185, 129, 1.0)';
  };

  const weekdays = ['Sun', '', 'Tue', '', 'Thu', '', 'Sat'];
  const months = [];
  let lastMonth = -1;

  heatmapData.forEach((day) => {
    const d = new Date(day.date);
    const month = d.getMonth();
    if (month !== lastMonth) {
      const firstOfMonthCell = cells.find(c => c.date === day.date);
      if (firstOfMonthCell) {
        months.push({
          name: monthNames[month],
          col: firstOfMonthCell.col
        });
      }
      lastMonth = month;
    }
  });

  return (
    <div style={{ overflowX: 'auto', width: '100%', padding: '4px 0' }}>
      <svg width={svgWidth} height={svgHeight} style={{ minWidth: `${svgWidth}px`, overflow: 'visible' }}>
        {months.map((m, idx) => (
          <text
            key={idx}
            x={labelWidth + m.col * (cellWidth + cellGap)}
            y={10}
            fill="var(--text-muted)"
            fontSize="9px"
            fontWeight="500"
          >
            {m.name}
          </text>
        ))}

        {weekdays.map((w, idx) => (
          w ? (
            <text
              key={idx}
              x={5}
              y={headerHeight + idx * (cellHeight + cellGap) + 9}
              fill="var(--text-muted)"
              fontSize="9px"
              fontWeight="500"
            >
              {w}
            </text>
          ) : null
        ))}

        {cells.map((cell, idx) => {
          if (cell.pad) return null;
          const x = labelWidth + cell.col * (cellWidth + cellGap);
          const y = headerHeight + cell.row * (cellHeight + cellGap);
          
          const d = new Date(cell.date);
          const friendlyDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          const tooltipText = `${cell.count} watched on ${friendlyDate} (${cell.tv} shows, ${cell.movie} movies)`;

          return (
            <rect
              key={idx}
              x={x}
              y={y}
              width={cellWidth}
              height={cellHeight}
              rx={2}
              fill={getCellColor(cell.count)}
              style={{ transition: 'all 0.15s ease', cursor: 'pointer' }}
              className="heatmap-cell"
              onMouseEnter={(e) => {
                const rect = e.target.getBoundingClientRect();
                setHeatmapTooltip({
                  text: tooltipText,
                  x: rect.left + rect.width / 2,
                  y: rect.top - 10
                });
              }}
              onMouseLeave={() => setHeatmapTooltip(null)}
            />
          );
        })}
      </svg>
      {heatmapTooltip && (
        <div style={{
          position: 'fixed',
          left: heatmapTooltip.x,
          top: heatmapTooltip.y,
          transform: 'translate(-50%, -100%)',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '0.8rem',
          color: '#fff',
          fontWeight: '500',
          pointerEvents: 'none',
          zIndex: 10000,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}>
          {heatmapTooltip.text}
        </div>
      )}
    </div>
  );
};

export default StatsHeatmap;
