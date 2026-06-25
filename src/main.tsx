import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// uiwjs/react-md-editor 基础样式
import '@uiw/react-md-editor/markdown-editor.css';

// 全局样式与设计 token
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
