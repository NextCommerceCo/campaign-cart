import type { Metadata } from "next";
import { loadPlaygroundExamples } from "@/lib/playground";
import { PlaygroundClient } from "./playground.client";

export const metadata: Metadata = {
  title: "Campaign Cart SDK",
  description:
    "Try Campaign Cart SDK examples live in the browser. Edit HTML and see the result instantly.",
};

export default function PlaygroundPage() {
  const examples = loadPlaygroundExamples();
  return <PlaygroundClient examples={examples} />;
}
