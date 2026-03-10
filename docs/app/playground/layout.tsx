import type { ReactNode } from 'react';

// Playground uses its own full-screen layout — no docs sidebar
export default function PlaygroundLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
