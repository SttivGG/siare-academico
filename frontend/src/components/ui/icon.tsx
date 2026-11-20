import type { SVGProps } from "react";
const paths = {
  home: "m3 10 9-7 9 7v11h-6v-7H9v7H3Z",
  book: "M12 5C8 2 4 3 2 4v15c3-2 7-2 10 0 3-2 7-2 10 0V4c-2-1-6-2-10 1Zm0 0v14",
  file: "M5 3h9l5 5v13H5Zm9 0v5h5M8 12h8m-8 4h6",
  study: "m3 8 9-5 9 5-9 5Zm4 3v7c3 2 7 2 10 0v-7m4-3v9",
  shield: "m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Zm-4 9 3 3 5-6",
  sessions: "M3 4h18v13H3Zm5 17h8m-4-4v4",
  admin: "M4 21v-7h5v7m6 0V3h5v18M4 7h5m6 4h5",
  menu: "M4 6h16M4 12h16M4 18h16",
  account: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a8 8 0 0 1 16 0v3",
  arrow: "m9 5 7 7-7 7",
} as const;
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) { return <svg {...props} aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>; }
