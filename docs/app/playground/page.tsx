import type { Metadata } from 'next';
import { loadPlaygroundExamples } from '@/lib/playground';
import { PlaygroundClient } from './playground.client';

export const metadata: Metadata = {
  title: 'Playground — Campaign Cart SDK',
  description: 'Interactively explore Campaign Cart SDK data attributes with a live preview.',
};

export default function PlaygroundPage() {
  const examples = loadPlaygroundExamples();
  return <PlaygroundClient examples={examples} />;
}
