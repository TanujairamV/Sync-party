import React, { useEffect, useMemo, useRef } from 'react';

type RoomCodeInputProps = {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

const ROOM_CODE_LENGTH = 6;
const VALID_CHAR = /^[A-Z0-9]$/;
const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH);

const RoomCodeInput: React.FC<RoomCodeInputProps> = ({ value, onChange, disabled = false, autoFocus = false }) => {
  const normalizedValue = useMemo(() => normalize(value), [value]);
  const chars = useMemo(
    () => Array.from({ length: ROOM_CODE_LENGTH }, (_, index) => normalizedValue[index] || ''),
    [normalizedValue]
  );
  const inputRefs = useRef<Array<HTMLInputElement | null>>(Array(ROOM_CODE_LENGTH).fill(null));

  useEffect(() => {
    if (autoFocus && !disabled) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus, disabled]);

  const updateCode = (nextChars: string[], focusIndex?: number) => {
    const nextCode = nextChars.join('').replace(/\s+$/g, '');
    onChange(nextCode);
    if (typeof focusIndex === 'number') {
      requestAnimationFrame(() => {
        const clamped = Math.max(0, Math.min(ROOM_CODE_LENGTH - 1, focusIndex));
        inputRefs.current[clamped]?.focus();
      });
    }
  };

  const focusCell = (index: number) => {
    const safeIndex = Math.max(0, Math.min(ROOM_CODE_LENGTH - 1, index));
    inputRefs.current[safeIndex]?.focus();
  };

  const handleChange = (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const raw = event.target.value.toUpperCase();
    const filtered = raw.replace(/[^A-Z0-9]/g, '');
    const nextChars = [...chars];
    if (!filtered) {
      nextChars[index] = '';
      updateCode(nextChars);
      return;
    }

    let writeIndex = index;
    for (const char of filtered) {
      if (writeIndex >= ROOM_CODE_LENGTH) break;
      nextChars[writeIndex] = char;
      writeIndex += 1;
    }

    updateCode(nextChars, writeIndex >= ROOM_CODE_LENGTH ? ROOM_CODE_LENGTH - 1 : writeIndex);
  };

  const handleKeyDown = (index: number) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const key = event.key;

    if (key === 'Backspace') {
      event.preventDefault();
      const nextChars = [...chars];
      if (nextChars[index]) {
        nextChars[index] = '';
        updateCode(nextChars, index);
      } else if (index > 0) {
        nextChars[index - 1] = "";
        updateCode(nextChars, index - 1);
      }
      return;
    }

    if (key === 'Delete') {
      event.preventDefault();
      const nextChars = [...chars];
      nextChars[index] = '';
      updateCode(nextChars, index);
      return;
    }

    if (key === 'ArrowLeft') {
      event.preventDefault();
      focusCell(index - 1);
      return;
    }

    if (key === 'ArrowRight') {
      event.preventDefault();
      focusCell(index + 1);
      return;
    }

    if (key.length === 1 && !VALID_CHAR.test(key.toUpperCase())) {
      event.preventDefault();
    }
  };

  const handlePaste = (index: number) => (event: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    event.preventDefault();
    const pasted = event.clipboardData.getData('text');
    const normalized = normalize(pasted);
    if (!normalized) return;

    const nextChars = [...chars];
    let writeIndex = index;
    for (const char of normalized) {
      if (writeIndex >= ROOM_CODE_LENGTH) break;
      nextChars[writeIndex] = char;
      writeIndex += 1;
    }

    updateCode(nextChars, writeIndex >= ROOM_CODE_LENGTH ? ROOM_CODE_LENGTH - 1 : writeIndex);
  };

  return (
    <div className="room-code-input" aria-label="Room code input">
      {chars.map((character, index) => (
        <div key={index} className="room-code-cell">
          <input
            ref={(el) => {inputRefs.current[index] = el;}}
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            maxLength={1}
            value={character}
            disabled={disabled}
            onChange={handleChange(index)}
            onKeyDown={handleKeyDown(index)}
            onPaste={handlePaste(index)}
            aria-label={`Room code character ${index + 1}`}
          />
        </div>
      ))}
    </div>
  );
};

export default RoomCodeInput;
