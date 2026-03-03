import { useEffect, useState } from 'react';

const TYPING_SPEED_MS = 70;
const PAUSE_AT_END_MS = 2500;
const DELETING_SPEED_MS = 40;
const PAUSE_AFTER_DELETE_MS = 400;

/**
 * Returns a placeholder string that cycles through phrases with a typewriter effect.
 * Example: "Search for 'AirPods'..." → types out → deletes → "Search for 'Keys'..." etc.
 */
export function useTypewriterPlaceholder(phrases: string[]): string {
  const [displayText, setDisplayText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (phrases.length === 0) return;

    const phrase = phrases[phraseIndex];
    const fullText = `Search for '${phrase}'...`;

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (displayText.length < fullText.length) {
            setDisplayText(fullText.slice(0, displayText.length + 1));
          } else {
            setIsDeleting(true);
          }
        } else {
          if (displayText.length > 0) {
            setDisplayText(displayText.slice(0, -1));
          } else {
            setIsDeleting(false);
            setPhraseIndex((prev) => (prev + 1) % phrases.length);
          }
        }
      },
      isDeleting
        ? displayText.length === 0
          ? PAUSE_AFTER_DELETE_MS
          : DELETING_SPEED_MS
        : displayText.length === fullText.length
          ? PAUSE_AT_END_MS
          : TYPING_SPEED_MS
    );

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, phraseIndex, phrases]);

  return displayText || 'Search items...';
}
