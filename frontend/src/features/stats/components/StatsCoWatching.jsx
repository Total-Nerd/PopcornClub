import React from 'react';
import { useStatsStore } from '../store/useStatsStore';
import { formatWatchTime } from '../utils';

const StatsCoWatching = () => {
  const { stats, watchedTogetherChartType } = useStatsStore();
  
  if (!stats?.watchedTogether) return null;

  const { aloneMinutes, with: withUsers } = stats.watchedTogether;
  
  let total = aloneMinutes;
  withUsers.forEach(u => total += u.minutes);
  
  if (total === 0) return <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '16px 0' }}>No watch data available.</div>;

  const topWith = withUsers.slice(0, 4);
  const others = withUsers.slice(4).reduce((sum, u) => sum + u.minutes, 0);
  
  const data = [
    { label: 'Alone', value: aloneMinutes, color: 'var(--accent)' }
  ];
  
  const colors = ['#60a5fa', '#34d399', '#fb7185', '#fcd34d', '#a78bfa'];
  topWith.forEach((u, i) => {
    data.push({ label: u.username, value: u.minutes, color: colors[i % colors.length] });
  });
  if (others > 0) {
    data.push({ label: 'Others', value: others, color: '#94a3b8' });
  }

  if (watchedTogetherChartType === 'pie') {
    let cumulativePercent = 0;
    const getCoordinatesForPercent = (percent) => {
      const x = Math.cos(2 * Math.PI * percent);
      const y = Math.sin(2 * Math.PI * percent);
      return [x, y];
    };

    let paths = [];
    data.forEach((slice, idx) => {
      const slicePercent = slice.value / total;
      if (slicePercent === 0) return;
      if (slicePercent === 1) {
        paths.push(<circle key={idx} cx="0" cy="0" r="1" fill={slice.color} />);
        return;
      }
      
      const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
      cumulativePercent += slicePercent;
      const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
      const largeArcFlag = slicePercent > 0.5 ? 1 : 0;
      const pathData = `M ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} L 0 0`;
      
      paths.push(<path key={idx} d={pathData} fill={slice.color} title={`${slice.label}: ${formatWatchTime(slice.value)}`} />);
    });

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        <svg viewBox="-1.2 -1.2 2.4 2.4" style={{ width: '120px', height: '120px', transform: 'rotate(-90deg)', overflow: 'visible' }}>
          {paths}
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {data.map((d, i) => d.value > 0 && (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: d.color }}></div>
                <span style={{ color: '#fff', fontWeight: '500' }}>{d.label}</span>
              </div>
              <span style={{ color: 'var(--text-muted)' }}>{Math.round((d.value/total)*100)}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  } else {
    // Horizontal Bar Chart
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '10px' }}>
        <div style={{ width: '100%', height: '24px', borderRadius: '12px', overflow: 'hidden', display: 'flex' }}>
          {data.map((d, i) => d.value > 0 && (
            <div 
              key={i} 
              title={`${d.label}: ${formatWatchTime(d.value)}`}
              style={{ height: '100%', width: `${(d.value / total) * 100}%`, background: d.color, borderRight: i < data.length - 1 ? '2px solid var(--bg-card)' : 'none' }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.8rem' }}>
          {data.map((d, i) => d.value > 0 && (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: d.color }}></div>
              <span style={{ color: 'var(--text-muted)' }}>{d.label} ({Math.round((d.value/total)*100)}%)</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
};

export default StatsCoWatching;
