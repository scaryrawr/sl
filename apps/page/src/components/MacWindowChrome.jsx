import React from 'react';

const getMacButtonColor = (type, colorScheme) => {
  if (type === 'close') return '#ff5f56';
  if (type === 'minimize') return '#ffbd2e';
  if (type === 'maximize') return '#27c93f';
  return '#ccc';
};

const MacWindowChrome = ({ title, children, colorScheme = 'light', onMinimize, onMaximize, onClose }) => {
  const isDark = colorScheme === 'dark';
  return (
    <div style={{
      borderRadius: 8,
      boxShadow: isDark ? '0 2px 12px #0008' : '0 2px 12px #8882',
      background: isDark ? '#222' : '#f5f5f7',
      border: isDark ? '1px solid #444' : '1px solid #d1d1d1',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: 28,
        padding: '0 12px',
        background: isDark ? '#333' : '#e0e0e0',
        borderBottom: isDark ? '1px solid #444' : '1px solid #d1d1d1',
        userSelect: 'none',
      }}>
        <div style={{ display: 'flex', gap: 6, marginRight: 8 }}>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              background: getMacButtonColor('close', colorScheme),
              border: 'none',
              margin: 0,
              padding: 0,
              cursor: 'pointer',
            }}
          />
          <button
            aria-label="Minimize"
            onClick={onMinimize}
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              background: getMacButtonColor('minimize', colorScheme),
              border: 'none',
              margin: 0,
              padding: 0,
              cursor: 'pointer',
            }}
          />
          <button
            aria-label="Maximize"
            onClick={onMaximize}
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              background: getMacButtonColor('maximize', colorScheme),
              border: 'none',
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

export default MacWindowChrome;
