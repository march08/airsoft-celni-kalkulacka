/// <reference types="vite/client" />
/// <reference types="vitest/config" />

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
