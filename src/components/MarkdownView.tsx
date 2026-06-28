import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Image } from '@tiptap/extension-image';
import { useEffect } from 'react';

interface Props {
  source: string;
}

/** 只读的 markdown 渲染器（TipTap，非可编辑），用于阅读模式 / 历史预览 */
export default function MarkdownView({ source }: Props) {
  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit,
      Markdown,
      Table,
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false }),
    ],
    content: source,
    contentType: 'markdown',
  });

  useEffect(() => {
    if (editor && source !== editor.getMarkdown()) {
      editor.commands.setContent(source, { contentType: 'markdown' });
    }
  }, [source, editor]);

  return <EditorContent editor={editor} />;
}
