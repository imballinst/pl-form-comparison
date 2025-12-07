import { useState } from "preact/hooks";
import "./App.css";

export function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto py-12">
        <h1 className="text-4xl font-bold mb-8">pl-form-comparison</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Welcome to your Preact + Shadcn project!
        </p>

        <div className="card border rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Counter</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCount((c) => c + 1)}
              className="btn btn-primary px-6 py-2"
            >
              Count is {count}
            </button>
            <button
              onClick={() => setCount(0)}
              className="btn btn-secondary px-6 py-2"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>Edit the components in the src folder to get started!</p>
        </div>
      </main>
    </div>
  );
}
