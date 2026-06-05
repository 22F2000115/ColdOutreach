import { useEffect, useRef } from 'react';

const TBtn = ({ label, cmd, val, title, disabled, onExec }) => (
  <button
    type="button"
    title={title || label}
    disabled={disabled}
    onMouseDown={(e) => { e.preventDefault(); onExec(cmd, val); }}
    style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-card)',
      color: 'var(--text-muted)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      padding: '4px 10px',
      borderRadius: 'var(--radius-sm)',
      fontSize: '0.8rem',
      fontWeight: 600,
      lineHeight: 1.4,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '4px',
      transition: 'all 0.15s ease',
      fontFamily: 'var(--font-body)',
      opacity: disabled ? 0.5 : 1
    }}
    onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
    onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.borderColor = 'var(--border-card)'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
  >
    {label}
  </button>
);

const Sep = () => <span style={{ width: '1px', height: '18px', background: 'var(--border-card)', margin: '0 6px', display: 'inline-block' }} />;

export default function RichEditor({ value, onChange, disabled }) {
  const editorRef = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (editorRef.current && !initialized.current) {
      editorRef.current.innerHTML = value || '';
      initialized.current = true;
    } else if (editorRef.current && initialized.current && editorRef.current.innerHTML !== value) {
      if (value !== undefined) {
        editorRef.current.innerHTML = value || '';
      }
    }
  }, [value]);

  const exec = (cmd, val = null) => {
    if (disabled) return;
    editorRef.current?.focus();
    if (cmd === 'createLink') {
      const url = prompt('Enter URL:');
      if (!url) return;
      val = url;
    }
    document.execCommand(cmd, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  return (
    <div>
      {!disabled && (
        <div className="rich-editor-toolbar">
          <TBtn label={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>} cmd="bold" title="Bold" disabled={disabled} onExec={exec} />
          <TBtn label={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>} cmd="italic" title="Italic" disabled={disabled} onExec={exec} />
          <TBtn label={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path><line x1="4" y1="21" x2="20" y2="21"></line></svg>} cmd="underline" title="Underline" disabled={disabled} onExec={exec} />
          <Sep />
          <TBtn label={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12h12M6 20V4m12 16V4"></path></svg>} cmd="formatBlock" val="h2" title="Heading" disabled={disabled} onExec={exec} />
          <TBtn label={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4v16M17 4v16M19 4H9.5a4.5 4.5 0 0 0 0 9H13"></path></svg>} cmd="formatBlock" val="p"  title="Paragraph" disabled={disabled} onExec={exec} />
          <Sep />
          <TBtn label={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>} cmd="insertUnorderedList" title="Bullet list" disabled={disabled} onExec={exec} />
          <TBtn label={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"></line><line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><path d="M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path></svg>} cmd="insertOrderedList" title="Numbered list" disabled={disabled} onExec={exec} />
          <Sep />
          <TBtn label={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>} cmd="createLink" title="Insert Link" disabled={disabled} onExec={exec} />
          <TBtn label={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16c-1-1-1-3 0-4l9-9c1-1 3-1 4 0l4 4c1 1 1 3 0 4L13 20"></path><line x1="22" y1="20" x2="13" y2="20"></line></svg>} cmd="removeFormat" title="Clear formatting" disabled={disabled} onExec={exec} />
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
