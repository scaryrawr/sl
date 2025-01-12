import { useEffect, useRef, useState } from 'react';

const Terminal = ({ title, terminalRef: externalRef }) => {
  const internalRef = useRef(null);
  const terminalRef = externalRef || internalRef;
  const [dimensions, setDimensions] = useState({ rows: 40, cols: 120 });

  useEffect(() => {
    const terminal = terminalRef.current;

    const updateDimensions = () => {
      if (terminal) {
        // Create a temporary element to measure character dimensions
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
        const rows = Math.min(80, Math.floor(clientHeight / lineHeight)); // Max 80 lines
        setDimensions({ rows, cols });
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(terminal);

    updateDimensions(); // Initial call to set dimensions

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (terminal) {
      terminal.innerHTML = ''; // Clear existing content
      for (let i = 0; i < dimensions.rows; i++) {
        let row = document.createElement('div');
        row.textContent = '\xa0'.repeat(dimensions.cols);
        terminal.appendChild(row);
      }
    }
  }, [dimensions]);

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
      <div ref={terminalRef} style={styles.terminal}></div>
    </div>
  );
};

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
  },
  titleBar: {
    backgroundColor: '#333',
    color: '#fff',
    padding: '5px',
    textAlign: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
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
    backgroundColor: '#000',
    color: '#0f0',
    overflow: 'auto',
    maxHeight: 'calc(80vh - 50px)' // Adjust max height to fit within the window
  }
};

export default Terminal;
