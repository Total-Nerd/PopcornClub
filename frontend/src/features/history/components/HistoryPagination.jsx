import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useHistoryStore } from '../store/useHistoryStore';

const HistoryPagination = () => {
  const { 
    page, totalPages, totalCount, limit, setFilter, 
    pageInput, setPageInput, handlePageJumpSubmit 
  } = useHistoryStore();

  const handlePageJumpKeyDown = (e) => {
    if (e.key === 'Enter') {
      handlePageJumpSubmit();
    }
  };

  if (totalCount === 0) return null;

  return (
    <div className="pagination-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginTop: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Showing <strong>{totalCount === 0 ? 0 : (page - 1) * limit + 1}</strong> - <strong>{Math.min(page * limit, totalCount)}</strong> of <strong>{totalCount}</strong> entries
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          <span>Show:</span>
          <select
            value={limit}
            onChange={(e) => setFilter('limit', parseInt(e.target.value, 10))}
            className="input-field"
            style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer', background: 'var(--overlay-medium)', border: '1px solid var(--border-color)', color: 'var(--text-main)', height: '34px', boxSizing: 'border-box' }}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          <span>Go to:</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={handlePageJumpKeyDown}
            onBlur={handlePageJumpSubmit}
            className="input-field"
            style={{ width: '60px', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', textAlign: 'center', background: 'var(--overlay-medium)', border: '1px solid var(--border-color)', color: 'var(--text-main)', height: '34px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setFilter('page', Math.max(page - 1, 1))}
            disabled={page === 1}
            className="pagination-btn"
            style={{ padding: '6px 12px', fontSize: '0.85rem', height: '34px', boxSizing: 'border-box' }}
          >
            <ChevronLeft size={16} />
            Prev
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 4px', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)' }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setFilter('page', Math.min(page + 1, totalPages))}
            disabled={page === totalPages}
            className="pagination-btn"
            style={{ padding: '6px 12px', fontSize: '0.85rem', height: '34px', boxSizing: 'border-box' }}
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryPagination;
