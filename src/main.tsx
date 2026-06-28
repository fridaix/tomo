import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 全局样式与设计 token
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
