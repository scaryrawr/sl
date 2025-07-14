import React from 'react';

const LinuxWindowChrome = ({ title, children, colorScheme = 'light', onMinimize, onMaximize, onClose }) => {
  const isDark = colorScheme === 'dark';
  return (
    <div style={{
      borderRadius: 6,
      boxShadow: isDark ? '0 2px 12px #0008' : '0 2px 12px #8882',
      background: isDark ? '#232629' : '#eaeaea',
      border: isDark ? '1px solid #444' : '1px solid #b0b0b0',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: 30,
        padding: '0 10px',
        background: isDark ? '#31363b' : '#d3dae3',
        borderBottom: isDark ? '1px solid #444' : '1px solid #b0b0b0',
        userSelect: 'none',
      }}>
        <div style={{ display: 'flex', gap: 4, marginRight: 8 }}>
          <button
            aria-label="Minimize"
            onClick={onMinimize}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              background: isDark ? '#f8c44c' : '#f8c44c',
              border: '1px solid #b0b0b0',
              margin: 0,
              padding: 0,
              cursor: 'pointer',
            }}
          />
          <button
            aria-label="Maximize"
            onClick={onMaximize}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              background: isDark ? '#5fcf65' : '#5fcf65',
              border: '1px solid #b0b0b0',
              margin: 0,
              padding: 0,
              cursor: 'pointer',
            }}
          />
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              background: isDark ? '#e06c75' : '#e06c75',
              border: '1px solid #b0b0b0',
              margin: 0,
              padding: 0,
              cursor: 'pointer',
            }}
          />
        </div>
        <div style={{ flex: 1, textAlign: 'center', color: isDark ? '#fff' : '#222', fontWeight: 500, fontSize: 13 }}>
          {title}
        </div>
        <div style={{ width: 40 }} />
      </div>
      <div style={{ flex: 1, background: isDark ? '#111' : '#fff', minHeight: 100 }}>{children}</div>
    </div>
  );
};

export default LinuxWindowChrome;
