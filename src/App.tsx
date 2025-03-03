import { createSignal } from "solid-js";
import "./App.css";

function App() {
  const [count, setCount] = createSignal(0);

  return (
    <>
      <h1>kuhaku dashboard, to unite the universe</h1>
      <div class="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count()}
        </button>
      </div>
    </>
  );
}

export default App;
