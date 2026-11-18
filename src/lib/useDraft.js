import { useEffect, useRef, useState } from 'react';

/* Editable copy of a saved value. It only refreshes from the saved value when the person has not
   typed anything since the last refresh, so a save finishing in the background never wipes what
   they are typing in the next box. */
export function useDraft(value) {
  const [draft, setDraft] = useState(value);
  const base = useRef(value);
  useEffect(() => {
    setDraft((d) => (JSON.stringify(d) === JSON.stringify(base.current) ? value : d));
    base.current = value;
  }, [value]);
  return [draft, setDraft];
}
