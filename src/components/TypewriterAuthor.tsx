import React, { useEffect, useState } from 'react';

export const TypewriterAuthor: React.FC = () => {
  const [text, setText] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(resolve, ms);
        timers.push(id);
      });

    async function runSequence() {
      const step1 = 'Made i';
      const step3 = 'Pomiary: Artur Wierzbicki';

      // Krok 1: Szybkie wpisywanie "Made i"
      for (let i = 1; i <= step1.length; i++) {
        if (cancelled) return;
        setText(step1.slice(0, i));
        await wait(55);
      }

      // Krok 2: Krótka pauza (300 ms) i szybkie kasowanie litera po literze do zera
      await wait(300);
      for (let i = step1.length - 1; i >= 0; i--) {
        if (cancelled) return;
        setText(step1.slice(0, i));
        await wait(40);
      }

      await wait(120);

      // Krok 3: Szybkie wystukanie "Pomiary: Artur Wierzbicki"
      for (let i = 1; i <= step3.length; i++) {
        if (cancelled) return;
        setText(step3.slice(0, i));
        await wait(45);
      }
    }

    void runSequence();

    const blinkId = window.setInterval(() => {
      setCursorVisible((v) => !v);
    }, 520);

    return () => {
      cancelled = true;
      timers.forEach((id) => clearTimeout(id));
      clearInterval(blinkId);
    };
  }, []);

  return (
    <span className="font-mono-tabular text-[11px] sm:text-xs text-emerald-300 font-medium inline-flex items-center">
      <span>{text}</span>
      <span
        aria-hidden="true"
        className={`inline-block w-[6px] h-[12px] ml-0.5 bg-emerald-300 transition-opacity duration-75 ${
          cursorVisible ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </span>
  );
};
