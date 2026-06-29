import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor as TiptapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { api } from '../api';
import { RichTable } from '../extensions/RichTable';
import EditorToolbar from './EditorToolbar';
import MarkdownView from './MarkdownView';
import './Editor.css';

interface EditorProps {
  value: string;
  onChange: (value?: string) => void;
  mode: 'read' | 'edit';
}

/** 共享扩展配置：阅读和编辑用同一套，保证渲染一致 */
function buildExtensions() {
  return [
    StarterKit,
    Markdown.configure({ indentation: { style: 'space', size: 2 } }),
    RichTable.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    Image.configure({ inline: false }),
  ];
}

export default function Editor({ value, onChange, mode }: EditorProps) {
  const [uploading, setUploading] = useState(false);
  // 标记内容是否由编辑器自身改动触发，避免 onChange→props→setContent 的回环
  const internalUpdate = useRef(false);

  const editor = useEditor(
    {
      extensions: buildExtensions(),
      editable: mode === 'edit',
      content: value,
      // 初始内容按 markdown 解析
      contentType: 'markdown',
      editorProps: {
        attributes: {
          class: 'tomo-prose',
        },
        handlePaste: (_view, event) => {
          const files = Array.from(event.clipboardData?.files ?? []);
          if (files.some((f) => f.type.startsWith('image/'))) {
            event.preventDefault();
            void uploadFiles(files);
            return true;
          }
          return false;
        },
        handleDrop: (_view, event) => {
          const files = Array.from(
            (event as DragEvent).dataTransfer?.files ?? []
          );
          if (files.some((f) => f.type.startsWith('image/'))) {
            event.preventDefault();
            void uploadFiles(files);
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        internalUpdate.current = true;
        onChange(editor.getMarkdown());
      },
    },
    [mode]
  );

  // 外部 value 变化（切换文档、恢复历史版本）时同步进编辑器
  useEffect(() => {
    if (!editor) return;
    if (internalUpdate.current) {
      // 这次变化来自编辑器自身，跳过，重置标记
      internalUpdate.current = false;
      return;
    }
    const current = editor.getMarkdown();
    if (current !== value) {
      editor.commands.setContent(value, { contentType: 'markdown' });
    }
  }, [value, editor]);

  // 上传一批图片并在光标处插入
  const uploadFiles = async (files: File[]) => {
    if (!editor) return;
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    setUploading(true);
    try {
      for (const file of images) {
        try {
          const result = await api.upload(file);
          const alt = file.name.replace(/\.[^.]+$/, '') || 'image';
          editor.chain().focus().setImage({ src: result.url, alt }).run();
        } catch {
          editor
            .chain()
            .focus()
            .insertContent(`\n> ⚠️ 图片「${file.name}」上传失败\n`)
            .run();
        }
      }
    } finally {
      setUploading(false);
    }
  };

  if (mode === 'read') {
    return (
      <article className="tomo-reader">
        <MarkdownView source={value} />
      </article>
    );
  }

  return (
    <div className="tomo-editor-wrapper">
      {editor && <EditorToolbar editor={editor as TiptapEditor} />}
      <EditorContent editor={editor} className="tomo-editor" />
      {uploading && <div className="tomo-upload-toast">图片上传中…</div>}
    </div>
  );
}
