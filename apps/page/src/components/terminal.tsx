import { CSSProperties, RefObject, useEffect, useMemo, useRef, useState } from 'react';

const styles = {
  window: {
    border: '1px solid black',
    borderRadius: '5px',
    width: '100%',
    maxHeight: '100vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    margin: '20px auto',
    backgroundColor: '#fff'
  } as CSSProperties,
  titleBar: {
    backgroundColor: '#333',
    color: '#fff',
    padding: '5px',
    textAlign: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  } as CSSProperties,
  title: {
    fontWeight: 'bold'
  } as CSSProperties,
  buttons: {
    display: 'flex',
    gap: '5px'
  } as CSSProperties,
  button: {
    backgroundColor: '#555',
    color: '#fff',
    border: 'none',
    borderRadius: '3px',
    width: '20px',
    height: '20px',
    cursor: 'pointer'
  } as CSSProperties,
  terminal: {
    fontFamily: 'monospace',
    whiteSpace: 'pre',
    flex: 1,
    padding: '10px',
    overflow: 'auto',
    maxHeight: 'calc(80vh - 50px)'
  } as CSSProperties
};

interface TerminalProps {
  title: string;
  terminalRef?: RefObject<HTMLDivElement>;
  fontColor?: string;
  backgroundColor?: string;
}

const Terminal = ({ title, terminalRef: externalRef, fontColor = '#0f0', backgroundColor = '#000' }: TerminalProps) => {
  const internalRef = useRef<HTMLDivElement>(null);
  const terminalRef = externalRef || internalRef;
  const [dimensions, setDimensions] = useState({ rows: 40, cols: 120 });

  useEffect(() => {
    const terminal = terminalRef.current;

    const updateDimensions = () => {
      if (terminal) {
        const tempElement = document.createElement('div');
        tempElement.style.position = 'absolute';
        tempElement.style.visibility = 'hidden';
        tempElement.style.whiteSpace = 'pre';
        tempElement.textContent = 'X';
        terminal.appendChild(tempElement);

        const charWidth = tempElement.getBoundingClientRect().width;
        const lineHeight = tempElement.getBoundingClientRect().height;

        terminal.removeChild(tempElement);

        const { clientWidth, clientHeight } = terminal;
        const cols = Math.floor(clientWidth / charWidth);
        const rows = Math.min(80, Math.floor(clientHeight / lineHeight));
        setDimensions({ rows, cols });
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (terminal) {
      resizeObserver.observe(terminal);
    }

    updateDimensions();

    return () => {
      resizeObserver.disconnect();
    };
  }, [terminalRef]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (terminal) {
      terminal.innerHTML = '';
      for (let i = 0; i < dimensions.rows; i++) {
        const row = document.createElement('div');
        row.textContent = '\xa0'.repeat(dimensions.cols);
        terminal.appendChild(row);
      }
    }
  }, [dimensions, terminalRef]);

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
