import MDEditor from '@uiw/react-md-editor';
import './Editor.css';

interface EditorProps {
  value: string;
  onChange: (value?: string) => void;
  mode: 'read' | 'edit';
}

export default function Editor({ value, onChange, mode }: EditorProps) {
  if (mode === 'read') {
    return (
      <article className="tomo-reader" data-color-mode="light">
        <MDEditor.Markdown source={value} />
      </article>
    );
  }

  return (
    <div className="tomo-editor-wrapper" data-color-mode="light">
      <MDEditor
        className="tomo-editor"
        value={value}
        onChange={onChange}
        height="auto"
        preview="edit"
        visibleDragbar={false}
        textareaProps={{ placeholder: '开始写点什么…' }}
      />
    </div>
  );
}
