import { createFileRoute } from "@tanstack/react-router";
import { Upload, LineChart, Map } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Well Injection Analysis" },
      {
        name: "description",
        content:
          "Tools for analyzing well injection data, performance, and reservoir response.",
      },
      { property: "og:title", content: "Well Injection Analysis" },
      {
        property: "og:description",
        content:
          "Tools for analyzing well injection data, performance, and reservoir response.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const modules = [
  {
    icon: Upload,
    title: "Data Upload",
    description: "Import injection rates, pressures, and well test data.",
  },
  {
    icon: LineChart,
    title: "Analysis",
    description: "Hall plots, injectivity index, and falloff analysis.",
  },
  {
    icon: Map,
    title: "Visualization",
    description: "Map and chart well performance across the field.",
  },
];

function Index() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center px-6 py-4">
          <span className="text-lg font-semibold tracking-tight text-foreground">
            Well Injection Analysis
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Analyze well injection performance with confidence
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          A workspace for injection data, diagnostics, and visualization.
          Modules below are placeholders for upcoming functionality.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {modules.map((mod) => (
            <div
              key={mod.title}
              className="rounded-xl border border-border bg-card p-6"
            >
              <mod.icon className="h-6 w-6 text-primary" />
              <h2 className="mt-4 text-base font-semibold text-card-foreground">
                {mod.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {mod.description}
              </p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-4 text-sm text-muted-foreground">
          Well Injection Analysis — project scaffold
        </div>
      </footer>
    </div>
  );
}
