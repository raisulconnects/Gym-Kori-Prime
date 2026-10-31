import { usePreferences } from '../preferences/PreferencesContext';

const PETAL_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** The painted bunting along the top of the screen in the Rickshaw Art theme. */
export function ThemeBand() {
  const { theme } = usePreferences();
  if (theme !== 'rickshaw') return null;
  return (
    <svg aria-hidden="true" className="block h-[22px] w-full shrink-0">
      <defs>
        <pattern id="rickshaw-band" width="22" height="22" patternUnits="userSpaceOnUse">
          <rect width="22" height="22" fill="#FFC914" />
          <path d="M0 0L11 14L22 0Z" fill="#A80F3C" />
          <circle cx="11" cy="18" r="2.5" fill="#12235A" />
        </pattern>
      </defs>
      <rect width="100%" height="22" fill="url(#rickshaw-band)" />
    </svg>
  );
}

/** The painted flower or stitched lotus in the corner of a main card. */
export function ThemeMotif() {
  const { theme } = usePreferences();
  if (theme === 'rickshaw') {
    return (
      <svg aria-hidden="true" width="104" height="104" viewBox="-55 -55 110 110" className="absolute top-0.5 right-0.5">
        <g fill="#FF7AA8" stroke="#FFF6D6" strokeWidth="1.5">
          {PETAL_ANGLES.map((angle) => (
            <ellipse key={angle} rx="10" ry="24" cy="-26" transform={`rotate(${angle})`} />
          ))}
        </g>
        <circle r="13" fill="#FFC914" stroke="#12235A" strokeWidth="2" />
        <circle r="5" fill="#12235A" />
      </svg>
    );
  }
  if (theme === 'kantha') {
    return (
      <svg aria-hidden="true" width="112" height="90" viewBox="-60 -80 120 96" className="absolute top-2 right-1.5">
        <g fill="none" stroke="#A61C28" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round">
          <path d="M0 8C-16 -14 -16 -40 0 -66C16 -40 16 -14 0 8Z" />
          <path d="M0 8C-34 0 -40 -26 -32 -50C-14 -40 -4 -16 0 8Z" />
          <path d="M0 8C34 0 40 -26 32 -50C14 -40 4 -16 0 8Z" />
          <path d="M0 8C-44 12 -56 -6 -56 -24C-34 -24 -12 -10 0 8Z" stroke="#1F2A6B" />
          <path d="M0 8C44 12 56 -6 56 -24C34 -24 12 -10 0 8Z" stroke="#1F2A6B" />
        </g>
      </svg>
    );
  }
  return null;
}
