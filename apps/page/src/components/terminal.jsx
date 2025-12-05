import { useLayoutEffect, useMemo, useRef } from 'react';

// Approximate character dimensions for 16px monospace font
const CHAR_WIDTH_ESTIMATE = 9.6;
const CHAR_HEIGHT_ESTIMATE = 19;

const styles = {
  window: {
    border: '1px solid black',
    borderRadius: '5px',
    width: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    margin: '20px auto',
    backgroundColor: '#fff',
    // Fixed height to prevent layout shift
    height: 'calc(80vh - 40px)'
  },
  titleBar: {
    backgroundColor: '#333',
    color: '#fff',
    padding: '5px',
    textAlign: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0
  },
  title: {
    fontWeight: 'bold'
  },
  buttons: {
    display: 'flex',
    gap: '5px'
  },
  button: {
    backgroundColor: '#555',
    color: '#fff',
    border: 'none',
    borderRadius: '3px',
    width: '20px',
    height: '20px',
    cursor: 'pointer'
  },
  terminal: {
    fontFamily: 'monospace',
    whiteSpace: 'pre',
    flex: 1,
    padding: '10px',
    overflow: 'hidden',
    minHeight: 0 // Allow flex child to shrink
  }
};

const Terminal = ({ title, terminalRef: externalRef, fontColor = '#0f0', backgroundColor = '#000' }) => {
  const internalRef = useRef(null);
  const terminalRef = externalRef || internalRef;
  const dimensionsRef = useRef(null);
  const initializedRef = useRef(false);

  // Use useLayoutEffect to measure and build rows synchronously before paint
  useLayoutEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const measureAndUpdate = () => {
      // Create temp element to measure actual character size
      const tempElement = document.createElement('div');
      tempElement.style.position = 'absolute';
      tempElement.style.visibility = 'hidden';
      tempElement.style.whiteSpace = 'pre';
      tempElement.style.font = 'inherit';
      tempElement.textContent = 'X';
      terminal.appendChild(tempElement);

      const charWidth = tempElement.getBoundingClientRect().width || CHAR_WIDTH_ESTIMATE;
      const lineHeight = tempElement.getBoundingClientRect().height || CHAR_HEIGHT_ESTIMATE;

      terminal.removeChild(tempElement);

      const { clientWidth, clientHeight } = terminal;
      const cols = Math.floor(clientWidth / charWidth);
      const rows = Math.min(80, Math.floor(clientHeight / lineHeight));
      
      const prev = dimensionsRef.current;
      // Only rebuild if dimensions actually changed
      if (!prev || prev.rows !== rows || prev.cols !== cols) {
        dimensionsRef.current = { rows, cols };
        
        // Build rows directly in the same synchronous block
        terminal.innerHTML = '';
        for (let i = 0; i < rows; i++) {
          let row = document.createElement('div');
          row.textContent = '\xa0'.repeat(cols);
          terminal.appendChild(row);
        }
      }
      
      initializedRef.current = true;
    };

    measureAndUpdate();

    const resizeObserver = new ResizeObserver(() => {
      // Skip resize events during initial render
      if (initializedRef.current) {
        measureAndUpdate();
      }
    });
    resizeObserver.observe(terminal);

    return () => {
      resizeObserver.disconnect();
    };
  }, [terminalRef]);

  const terminalStyle = useMemo(
    () => ({
      ...styles.terminal,
      color: fontColor,
      backgroundColor: backgroundColor
    }),
    [fontColor, backgroundColor]
  );

  return (
    <div style={styles.window}>
      <div style={styles.titleBar}>
        <span style={styles.title}>{title}</span>
        <div style={styles.buttons}>
          <button style={styles.button}>_</button>
          <button style={styles.button}>□</button>
          <button style={styles.button}>×</button>
        </div>
      </div>
      <div ref={terminalRef} style={terminalStyle}></div>
    </div>
  );
};

export default Terminal;
