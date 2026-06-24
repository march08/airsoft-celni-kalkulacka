/// <reference types="vite/client" />
/// <reference types="vitest/config" />

import type { DehydratedState } from '@tanstack/react-query';

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare global {
  interface Window {
    __REACT_QUERY_STATE__?: DehydratedState;
  }
}
