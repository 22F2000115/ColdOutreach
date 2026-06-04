import React, { useEffect, useRef } from 'react';

export default function RichEditor({ value, onChange, disabled }) {
  const editorRef = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (editorRef.current && !initialized.current) {
      editorRef.current.innerHTML = value || '';
      initialized.current = true;
    } else if (editorRef.current && initialized.current && editorRef.current.innerHTML !== value) {
      // Allow external value updates (e.g., when switching campaigns or saving/resetting)
      // but only if the content is actually different to avoid cursor jump issues.
      if (value !== undefined) {
        editorRef.current.innerHTML = value || '';
      }
    }
  }, [value]);

  const exec = (cmd, val = null) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const TBtn = ({ label, cmd, val, title }) => (
    <button
      type="button"
      title={title || label}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); exec(cmd, val); }}
      style={{
        background: 'none', border: 'none', color: 'var(--muted-foreground)',
        cursor: disabled ? 'not-allowed' : 'pointer', padding: '3px 8px', borderRadius: '4px',
        fontSize: '0.82rem', fontWeight: 700, lineHeight: 1.4,
        transition: 'color 0.15s, background 0.15s', fontFamily: 'var(--font-body)'
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--foreground)'; } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted-foreground)'; } }}
    >
      {label}
    </button>
  );

  const Sep = () => <span style={{ width: '1px', height: '16px', background: 'var(--border-mid)', margin: '0 3px', display: 'inline-block' }} />;

  return (
    <div>
      {!disabled && (
        <div className="rich-editor-toolbar">
          <TBtn label="B" cmd="bold" title="Bold" />
          <TBtn label="I" cmd="italic" title="Italic" />
          <TBtn label="U" cmd="underline" title="Underline" />
          <Sep />
          <TBtn label="H2" cmd="formatBlock" val="h2" title="Heading" />
          <TBtn label="P"  cmd="formatBlock" val="p"  title="Paragraph" />
          <Sep />
          <TBtn label="• List" cmd="insertUnorderedList" title="Bullet list" />
          <TBtn label="1. List" cmd="insertOrderedList" title="Numbered list" />
          <Sep />
          <button
            type="button"
            title="Insert Link"
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault();
              const url = prompt('Enter URL:');
              if (url) exec('createLink', url);
            }}
            style={{
              background: 'none', border: 'none', color: 'var(--muted-foreground)',
              cursor: disabled ? 'not-allowed' : 'pointer', padding: '3px 8px', borderRadius: '4px',
              fontSize: '0.82rem', fontWeight: 700, lineHeight: 1.4,
              fontFamily: 'var(--font-body)', transition: 'color 0.15s, background 0.15s'
            }}
            onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--foreground)'; } }}
            onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted-foreground)'; } }}
          >
            Link
          </button>
          <TBtn label="Clear" cmd="removeFormat" title="Clear formatting" />
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        className="rich-editor-area"
        style={disabled ? { background: 'var(--muted)', cursor: 'not-allowed', border: '1px solid var(--border)' } : {}}
        onInput={() => { if (editorRef.current && !disabled) onChange(editorRef.current.innerHTML); }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Tab') {
            e.preventDefault();
            document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
          }
        }}
      />
    </div>
  );
}
