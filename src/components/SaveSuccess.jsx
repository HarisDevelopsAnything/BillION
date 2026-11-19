import { useEffect, useRef, useState } from 'react';
import lottie from 'lottie-web';
import animationData from '../assets/bill-save-animation.json';

export default function SaveSuccess({ open, invoiceNo, onDone }) {
  const hostRef = useRef(null);
  const doneRef = useRef(onDone);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!open) {
      setClosing(false);
      return undefined;
    }
    setClosing(false);
  }, [open]);

  useEffect(() => {
    if (!open || closing || !hostRef.current) return undefined;
    const animation = lottie.loadAnimation({
      container: hostRef.current,
      renderer: 'svg',
      loop: false,
      autoplay: true,
      animationData,
    });
    const timer = window.setTimeout(() => setClosing(true), 1800);
    return () => {
      window.clearTimeout(timer);
      animation.destroy();
    };
  }, [open, closing]);

  useEffect(() => {
    if (!closing) return undefined;
    const timer = window.setTimeout(() => doneRef.current?.(), 300);
    return () => window.clearTimeout(timer);
  }, [closing]);

  if (!open) return null;
  return (
    <div className={`save-success-backdrop${closing ? ' closing' : ''}`} role="dialog" aria-modal="true" aria-label={`Invoice ${invoiceNo || ''} saved`}>
      <div className="save-success-card">
        <div ref={hostRef} className="save-success-animation" aria-hidden="true" />
        <div className="save-success-text">Bill saved</div>
        {invoiceNo && <div className="save-success-invoice">Invoice {invoiceNo}</div>}
      </div>
    </div>
  );
}
