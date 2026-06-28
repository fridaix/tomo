import { type Editor } from '@tiptap/react';
import { useEffect, useState } from 'react';
import './EditorToolbar.css';

interface Props {
  editor: Editor;
}

export default function EditorToolbar({ editor }: Props) {
  // 订阅 editor 选区/状态变化，让按钮高亮实时更新
  const [, force] = useState(0);
  useEffect(() => {
    const rerender = () => force((n) => n + 1);
    editor.on('selectionUpdate', rerender);
    editor.on('transaction', rerender);
    return () => {
      editor.off('selectionUpdate', rerender);
      editor.off('transaction', rerender);
    };
  }, [editor]);

  const is = (name: string, attrs?: Record<string, unknown>) =>
    editor.isActive(name, attrs);

  const inTable = editor.isActive('table');

  return (
    <div className="tomo-tb">
      <div className="tomo-tb-group">
        <Btn active={is('heading', { level: 1 })} title="标题 1"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Btn>
        <Btn active={is('heading', { level: 2 })} title="标题 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
        <Btn active={is('heading', { level: 3 })} title="标题 3"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Btn>
      </div>

      <div className="tomo-tb-sep" />

      <div className="tomo-tb-group">
        <Btn active={is('bold')} title="粗体"
          onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
        <Btn active={is('italic')} title="斜体"
          onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
        <Btn active={is('strike')} title="删除线"
          onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Btn>
        <Btn active={is('code')} title="行内代码"
          onClick={() => editor.chain().focus().toggleCode().run()}>{'<>'}</Btn>
      </div>

      <div className="tomo-tb-sep" />

      <div className="tomo-tb-group">
        <Btn active={is('bulletList')} title="无序列表"
          onClick={() => editor.chain().focus().toggleBulletList().run()}>•</Btn>
        <Btn active={is('orderedList')} title="有序列表"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</Btn>
        <Btn active={is('taskList')} title="任务列表"
          onClick={() => editor.chain().focus().toggleTaskList().run()}>☑</Btn>
        <Btn active={is('blockquote')} title="引用"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</Btn>
        <Btn active={is('codeBlock')} title="代码块"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{'{ }'}</Btn>
      </div>

      <div className="tomo-tb-sep" />

      {/* 表格 */}
      {!inTable ? (
        <Btn title="插入表格"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }>
          ⊞ 表格
        </Btn>
      ) : (
        <div className="tomo-tb-group">
          <Btn title="上方插入行"
            onClick={() => editor.chain().focus().addRowBefore().run()}>⤒行</Btn>
          <Btn title="下方插入行"
            onClick={() => editor.chain().focus().addRowAfter().run()}>⤓行</Btn>
          <Btn title="左侧插入列"
            onClick={() => editor.chain().focus().addColumnBefore().run()}>⇤列</Btn>
          <Btn title="右侧插入列"
            onClick={() => editor.chain().focus().addColumnAfter().run()}>⇥列</Btn>
          <Btn title="删除行"
            onClick={() => editor.chain().focus().deleteRow().run()}>✕行</Btn>
          <Btn title="删除列"
            onClick={() => editor.chain().focus().deleteColumn().run()}>✕列</Btn>
          <Btn title="删除表格" danger
            onClick={() => editor.chain().focus().deleteTable().run()}>删表格</Btn>
        </div>
      )}
    </div>
  );
}

function Btn({
  children,
  onClick,
  active,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      className={`tomo-tb-btn${active ? ' is-active' : ''}${danger ? ' is-danger' : ''}`}
      // 用 mousedown 防止点按钮时编辑器失焦丢选区
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      {children}
    </button>
  );
}
