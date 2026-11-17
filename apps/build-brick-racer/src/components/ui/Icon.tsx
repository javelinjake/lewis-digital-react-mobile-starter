import type { ReactNode } from 'react'

export type IconName
  = | 'home' | 'gear' | 'pencil' | 'dots' | 'plus' | 'back' | 'chevrons' | 'play' | 'pause' | 'restart'
    | 'camera' | 'flag' | 'list' | 'garage' | 'car' | 'undo' | 'redo' | 'trash' | 'copy' | 'rotate'
    | 'mirror' | 'check' | 'close' | 'eye' | 'lock' | 'wheel' | 'info' | 'help' | 'brick' | 'paint'
    | 'cube' | 'ruler' | 'arrow-left' | 'arrow-right' | 'arrow-up' | 'arrow-down' | 'loose' | 'warn' | 'target'

/** Small stroke/fill icons drawn for this app so no icon font or network is needed. 24x24, `currentColor`. */
const shapes: Record<IconName, ReactNode> = {
  'home': <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  'gear': (
    <>
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="2.4" />
      {[0, 45, 90, 135].map(a => <rect key={a} x="10.6" y="1.6" width="2.8" height="20.8" rx="1" transform={`rotate(${a} 12 12)`} />)}
    </>
  ),
  'pencil': <path d="m4 20 1-4.5L16.5 4a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L8.5 19zm2.5-2.2 1.2-.3L18 7.2 16.8 6 6.5 16.4z" />,
  'dots': (
    <>
      <circle cx="5" cy="12" r="2.2" />
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="19" cy="12" r="2.2" />
    </>
  ),
  'plus': <path d="M10.2 4h3.6v6.2H20v3.6h-6.2V20h-3.6v-6.2H4v-3.6h6.2z" />,
  'back': <path d="M11 5 4 12l7 7v-4.5h9v-5h-9z" />,
  'chevrons': <path d="m5 5 7 7-7 7H9l7-7-7-7zm8 0 7 7-7 7h4l7-7-7-7z" transform="translate(-2 0) scale(.9)" />,
  'play': <path d="M7 4.5v15l13-7.5z" />,
  'pause': (
    <>
      <rect x="6" y="4.5" width="4.2" height="15" rx="1" />
      <rect x="13.8" y="4.5" width="4.2" height="15" rx="1" />
    </>
  ),
  'restart': <path d="M12 4a8 8 0 1 0 7.5 10.8l-2.4-.8A5.5 5.5 0 1 1 12 6.5c1.4 0 2.6.5 3.6 1.4L13 10h7V3l-2.6 2.6A8 8 0 0 0 12 4z" />,
  'camera': <path d="M4 7h3l1.4-2h7.2L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm8 2.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />,
  'flag': <path d="M5 3h2v18H5zm3 1h10l-2 3.5L18 11H8z" />,
  'list': <path d="M3 5h3v3H3zm5 .5h13v2H8zM3 10.5h3v3H3zm5 .5h13v2H8zM3 16h3v3H3zm5 .5h13v2H8z" />,
  'garage': <path d="M2 9 12 3l10 6v12h-3V11H5v10H2zM7 13h10v2H7zm0 3h10v2H7zm0 3h10v2H7z" />,
  'car': <path d="M5.5 10 7 6h10l1.5 4H21a1 1 0 0 1 1 1v6h-2.2a2.8 2.8 0 0 1-5.6 0H9.8a2.8 2.8 0 0 1-5.6 0H2v-6a1 1 0 0 1 1-1zM8.4 8l-.8 2h8.8l-.8-2zM7 17.8a1.2 1.2 0 1 0 0 .01zm10 0a1.2 1.2 0 1 0 0 .01z" />,
  'undo': <path d="M9 5 3.5 10 9 15v-3.2c4.2-.3 6.8 1 8.5 4.2.4-5.2-2.3-9.2-8.5-9.4z" />,
  'redo': <path d="m15 5 5.5 5L15 15v-3.2c-4.2-.3-6.8 1-8.5 4.2-.4-5.2 2.3-9.2 8.5-9.4z" />,
  'trash': <path d="M9 3h6l1 2h4v2H4V5h4zm-3 6h12l-1 12H7zm3 2v8h2v-8zm4 0v8h2v-8z" />,
  'copy': <path d="M8 3h11a1 1 0 0 1 1 1v12h-2V5H8zM5 7h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm1 2v10h8V9z" />,
  'rotate': <path d="M12 5a7 7 0 0 0-6.3 4H3l3.5 4.2L10 9H7.6A5 5 0 1 1 7 12H5a7 7 0 1 0 7-7zm5.5 0h2.5v4h-4z" />,
  'mirror': <path d="M11 2h2v20h-2zM3 7l6 5-6 5zm18 0v10l-6-5z" />,
  'check': <path d="m4 12.5 2.4-2.4 3.6 3.6 7.6-7.6L20 8.5 10 18.5z" />,
  'close': <path d="m5.6 4 6.4 6.4L18.4 4 20 5.6 13.6 12l6.4 6.4-1.6 1.6-6.4-6.4L5.6 20 4 18.4 10.4 12 4 5.6z" />,
  'eye': <path d="M12 5c5 0 9 4.6 10 7-1 2.4-5 7-10 7S3 14.4 2 12c1-2.4 5-7 10-7zm0 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" />,
  'lock': <path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z" />,
  'wheel': (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3.4" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'info': <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 5h2.4v2.4h-2.4zm0 4.2h2.4V17h-2.4z" />,
  'help': <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm.2 4.4c2 0 3.5 1.2 3.5 3 0 1.4-.8 2.1-1.8 2.8-.8.5-1.1.9-1.1 1.6v.4H10.4v-.7c0-1.3.7-2 1.6-2.6.8-.5 1.2-.8 1.2-1.4 0-.6-.5-1-1.2-1-.8 0-1.3.5-1.5 1.3L8.5 10c.4-2.2 1.8-3.6 3.7-3.6zM10.4 16.3h2.4v2.2h-2.4z" />,
  'brick': <path d="M7 3h3v2h4V3h3v2h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2z" />,
  'paint': <path d="M12 2c5.5 0 10 3.6 10 8 0 3-2.4 4-4.5 4H15a2 2 0 0 0-1.4 3.4c.6.7.6 1.6 0 2.1-.5.4-1.1.5-1.6.5-5.5 0-10-4.5-10-9.5S6.5 2 12 2zM7.5 9.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm4-3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm5 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />,
  'cube': <path d="m12 2 9 5v10l-9 5-9-5V7zm0 2.3L5.8 7.7 12 11l6.2-3.3zM5 9.4v6.4l6 3.3v-6.4zm14 0-6 3.3v6.4l6-3.3z" />,
  'ruler': <path d="m3 16 11-11 5 5L8 21zm3.2 0 1.8 1.8 1-1-1.2-1.2 1-1 1.2 1.2 1-1-1.2-1.2 1-1 1.2 1.2 1-1L14 9z" />,
  'arrow-left': <path d="M14 5 6 12l8 7v-4.4h4v-5.2h-4z" />,
  'arrow-right': <path d="m10 5 8 7-8 7v-4.4H6v-5.2h4z" />,
  'arrow-up': <path d="m5 14 7-8 7 8h-4.4v4H9.4v-4z" />,
  'arrow-down': <path d="m5 10 7 8 7-8h-4.4V6H9.4v4z" />,
  'loose': <path d="M4 4h6v6H4zm10 10h6v6h-6zM12 12l-1.5-1.5M9 15l-4 4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeDasharray="2 2.4" />,
  'warn': <path d="m12 2 11 19H1zm-1.2 7h2.4v6h-2.4zm0 7.5h2.4v2.4h-2.4z" />,
  'target': (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="1.4" />
    </>
  ),
}

export function Icon({ name, size = 24, className = '', label }: { name: IconName, size?: number, className?: string, label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={`shrink-0 ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {shapes[name]}
    </svg>
  )
}
