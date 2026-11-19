import { useEffect, useRef, useState } from 'react';

export default function NewRelease({
  version,
  title = 'What is new',
  summary,
  features = [],
  storageScope,
}) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef(null);
  const storageKey = `billion:seen-release:${storageScope || 'browser'}`;

  useEffect(() => {
    let seenVersion = '';
    try {
      seenVersion = localStorage.getItem(storageKey) || '';
    } catch {
      seenVersion = '';
    }
    if (seenVersion !== version) setOpen(true);
  }, [storageKey, version]);

  useEffect(() => {
    if (!open) return undefined;
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function close() {
    try {
      localStorage.setItem(storageKey, version);
    } catch {
      // The release dialog can still be dismissed when storage is unavailable.
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="release-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-title"
        aria-describedby="release-description"
      >
        <div className="release-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l2.1 4.25L18.8 8l-3.4 3.31.8 4.69L12 13.85l-4.2 2.15.8-4.69L5.2 8l4.7-.75L12 3Z" />
            <path d="M5 20h14" />
          </svg>
        </div>
        <div className="release-version">Version {version}</div>
        <h2 id="release-title">{title}</h2>
        {summary && <p id="release-description">{summary}</p>}
        {features.length > 0 && (
          <ul className="release-feature-list">
            {features.map((feature) => (
              <li key={feature}>
                <span className="release-check" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l4 4L19 6" />
                  </svg>
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}
        <button ref={closeButtonRef} className="release-close" type="button" onClick={close}>
          Got it
        </button>
      </div>
    </div>
  );
}
