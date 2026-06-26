import { useRef, useState } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { api } from '../api';
import './Editor.css';

interface EditorProps {
  value: string;
  onChange: (value?: string) => void;
  mode: 'read' | 'edit';
}

export default function Editor({ value, onChange, mode }: EditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);

  // 在光标处插入文本（取不到光标就追加到末尾）
  const insertAtCursor = (snippet: string) => {
    const textarea = wrapperRef.current?.querySelector('textarea');
    if (textarea) {
      const start = textarea.selectionStart ?? value.length;
      const end = textarea.selectionEnd ?? value.length;
      const next = value.slice(0, start) + snippet + value.slice(end);
      onChange(next);
    } else {
      onChange(value + snippet);
    }
  };

  // 上传一批图片文件并插入 markdown
  const uploadFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    setUploading(true);
    try {
      for (const file of images) {
        try {
          const result = await api.upload(file);
          const alt = file.name.replace(/\.[^.]+$/, '') || 'image';
          insertAtCursor(`\n![${alt}](${result.url})\n`);
        } catch {
          insertAtCursor(`\n> ⚠️ 图片「${file.name}」上传失败\n`);
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    if (files.some((f) => f.type.startsWith('image/'))) {
      e.preventDefault();
      void uploadFiles(files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer.files);
    if (files.some((f) => f.type.startsWith('image/'))) {
      e.preventDefault();
      void uploadFiles(files);
    }
  };

  if (mode === 'read') {
    return (
      <article className="tomo-reader" data-color-mode="light">
        <MDEditor.Markdown source={value} />
      </article>
    );
  }

  return (
    <div
      className="tomo-editor-wrapper"
      data-color-mode="light"
      ref={wrapperRef}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <MDEditor
        className="tomo-editor"
        value={value}
        onChange={onChange}
        height="auto"
        preview="edit"
        visibleDragbar={false}
        textareaProps={{ placeholder: '开始写点什么…（可粘贴或拖入图片）' }}
      />
      {uploading && <div className="tomo-upload-toast">图片上传中…</div>}
    </div>
  );
}
