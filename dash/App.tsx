import { createSignal } from "solid-js";
import "./App.css";
import { Button } from "./components/ui/button";

function App() {
  const [count, setCount] = createSignal(0);

  return (
    <>
      <h1>kuhaku dashboard, to unite the universe</h1>
      <div class="card">
        <Button variant="outline" onClick={() => setCount((count) => count + 1)}>Click me {count()}</Button>
      </div>

    </>
  );
}

export default App;
