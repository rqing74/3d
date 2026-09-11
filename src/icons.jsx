import React from "react";

export default function Icon({ name, size = 20, ...props }) {
  const paths = {
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M4 16v6h16v-6" />
      </>
    ),
    cube: (
      <>
        <path d="m12 3 9 5v9l-9 5-9-5V8Z" />
        <path d="m3 8 9 5 9-5M12 13v9" />
      </>
    ),
    logo: (
      <>
        <path d="m12 2 10 5-10 6-6-3 10-6M2 7v12l10 5 10-6V12l-10 6-6-3V9" />
      </>
    ),
    vase: (
      <>
        <path d="M7 3h10c-1 4-3 5-3 8 0 4 5 6 4 10H6c-1-4 4-6 4-10 0-3-2-4-3-8Z" />
        <path d="m7 4 8-1M9 7l7-3M10 10l5-3M9 14l5-4M7 17l8-4M6 20l10-4M10 21l7-3M14 21l4-1" />
      </>
    ),
    twist: (
      <>
        <path d="M7 3h10c-1 5-4 6-3 10l4 8H6l4-8c1-4-2-5-3-10Z" />
        <path d="m7 3 10 18M11 3l6 18M7 21l8-18M10 21l5-18" />
      </>
    ),
    pause: (
      <>
        <path d="M8 5v14M16 5v14" strokeWidth="3.5" />
      </>
    ),
    play: <path d="m8 4 12 8-12 8Z" fill="currentColor" stroke="none" />,
    reset: (
      <>
        <path d="M4 9a8 8 0 1 1 0 7M4 3v6h6" />
      </>
    ),
    front: (
      <>
        <rect x="3" y="4" width="18" height="14" rx="1" />
        <path d="M8 21h8M12 18v3" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 17l10 5 10-5" />
      </>
    ),
    settings: (
      <>
        <path d="M3 6h6m4 0h8M3 12h12m4 0h2M3 18h2m4 0h12" />
        <circle cx="11" cy="6" r="2" />
        <circle cx="17" cy="12" r="2" />
        <circle cx="7" cy="18" r="2" />
      </>
    ),
    temp: (
      <>
        <path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Z" />
        <path d="M12 8v9" />
        <circle cx="12" cy="18" r="1.5" />
      </>
    ),
    heat: (
      <>
        <path d="M3 18h18M5 21h14M6 14c-4-4 4-5 0-9M12 14c-4-4 4-5 0-11M18 14c-4-4 4-5 0-9" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 26"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] || paths.cube}
    </svg>
  );
}
