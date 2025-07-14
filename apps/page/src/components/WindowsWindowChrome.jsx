import React from 'react';

const WindowsWindowChrome = ({ title, children, colorScheme = 'light', onMinimize, onMaximize, onClose }) => {
  const isDark = colorScheme === 'dark';
  return (
    <div style={{
      borderRadius: 4,
      boxShadow: isDark ? '0 2px 12px #0008' : '0 2px 12px #8882',
      background: isDark ? '#222' : '#f3f3f3',
      border: isDark ? '1px solid #444' : '1px solid #b0b0b0',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: 32,
        padding: '0 8px',
        background: isDark ? '#2d2d2d' : '#e6e6e6',
        borderBottom: isDark ? '1px solid #444' : '1px solid #b0b0b0',
        userSelect: 'none',
      }}>
        <div style={{ flex: 1, color: isDark ? '#fff' : '#222', fontWeight: 600, fontSize: 14 }}>{title}</div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            aria-label="Minimize"
            onClick={onMinimize}
            style={{
              width: 28,
              height: 28,
              background: 'none',
              border: 'none',
              color: isDark ? '#fff' : '#222',
              fontSize: 18,
              cursor: 'pointer',
              borderRadius: 2,
            }}
          >
            _
          </button>
          <button
            aria-label="Maximize"
            onClick={onMaximize}
            style={{
              width: 28,
              height: 28,
              background: 'none',
              border: 'none',
              color: isDark ? '#fff' : '#222',
              fontSize: 16,
              cursor: 'pointer',
              borderRadius: 2,
            }}
          >
            
          </button>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              background: isDark ? '#c00' : '#e81123',
              border: 'none',
              color: '#fff',
              fontSize: 16,
              cursor: 'pointer',
              borderRadius: 2,
            }}
          >
            7
          </button>
        </div>
      </div>
      <div style={{ flex: 1, background: isDark ? '#111' : '#fff', minHeight: 100 }}>{children}</div>
    </div>
  );
};

export default WindowsWindowChrome;
