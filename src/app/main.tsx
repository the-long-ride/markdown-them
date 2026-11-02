import './tauri-api';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Missing root element');
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => {
    if (
      event.key === 'F5' ||
      ((event.ctrlKey || event.metaKey) && (event.key === 'r' || event.key === 'R'))
    ) {
      event.preventDefault();
      window.location.reload();
    }
  });
}

createRoot(root).render(<App />);
