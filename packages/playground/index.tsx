/* @jsx h */
import { h, render } from "preact";
import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { wrap } from "comlink";
import type { Api } from "./worker";
// @ts-ignore
import Worker from "./worker?worker";
const api = wrap<Api>(new Worker());

const initialCode = `/* @jsx h */
import { h, render } from "https://cdn.skypack.dev/preact";

// support enum
enum Keys {
  A = 1,
  B
}

// support jsx
function App() {
  return <div>Hello World</div>;
}
render(<App />, document.body);

// types
const x: number = 1;
function square(x: number): number {
  return x ** 2;
}

type T = any;
declare const _hidden: number;

class Point<Num extends number = number> {
  private z: Num = 0;
  // constructor(private x: Num, private y: Num) {}
}

console.log(new Point<1 | 2>(1, 2));
`;

let timeout: any = null;

console.log("[main] start", performance.now());

const loading = fetch("/snapshot.bin")
  .then((r) => r.blob())
  .then((b) => b.arrayBuffer());
loading.then((snapshot) =>
  console.log("[main] snapshot loaded", performance.now(), snapshot)
);
// @ts-ignore
import { createTransform } from "../mints-tokenized/dist/browser";

function App() {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState("");
  const [buildTime, setBuildTime] = useState(0);
  const ref = useRef<HTMLIFrameElement>(null);
  const [transform, setTransform] = useState<
    null | ((input: string) => string)
  >(null);

  useEffect(() => {
    loading.then((snapshot) => {
      setTransform(createTransform(snapshot));
      console.log("[main] start", performance.now());
    });
  }, []);

  useEffect(() => {
    // if (transform == null) return;
    try {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(async () => {
        timeout = null;
        const now = Date.now();
        const out = await api.transform(code);
        // const out = await transform(code);
        // debugger;
        if (out.error) {
          setOutput(JSON.stringify(out, null, 2));
        } else {
          setBuildTime(Date.now() - now);
          setOutput(out);
        }
      }, 500);
    } catch (err) {
      console.error(err);
    }
  }, [code, setCode, setOutput, setBuildTime, transform]);
  const onClickRun = useCallback(() => {
    if (ref.current == null) return;
    const encoded = btoa(unescape(encodeURIComponent(output)));
    const blob = new Blob(
      [
        `<!DOCTYPE html>
<html>
  <head>
  </head>
  <body>
  <script type=module>
    console.log("start in ifarme");
    import("data:text/javascript;base64,${encoded}");
  </script>
  </body>
</html>`,
      ],
      { type: "text/html" }
    );

    // const iframe = document.querySelector("iframe");
    // if (ref.current) {
    ref.current.src = URL.createObjectURL(blob);
    // }
  }, [output, ref]);
  return (
    <div style={{ display: "flex", width: "100vw", hegiht: "100vh" }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          height: "100%",
          flexDirection: "column",
        }}
      >
        <div style={{ height: "100%", width: "100%", paddingLeft: 15 }}>
          <h3>Mints Playground (WIP: 5kb typescript compiler)</h3>
          <div>
            by{" "}
            <a href="https://twitter.com/mizchi" style={{ color: "#89f" }}>
              @mizchi
            </a>
          </div>
        </div>
        <div style={{ flex: 1, padding: 10 }}>
          <textarea
            style={{ paddingLeft: 10, width: "45vw", height: "80vh" }}
            value={code}
            onInput={(ev: any) => {
              console.log("changed", ev.target.value);
              setCode(ev.target.value);
            }}
          />
        </div>
      </div>
      <div style={{ flex: 1, height: "100%" }}>
        <div style={{ height: "20vh", width: "45vw", position: "relative" }}>
          <button
            onClick={onClickRun}
            style={{
              padding: 5,
              position: "absolute",
              right: 0,
              top: 0,
              // background: "gray",
              // color: "white",
            }}
          >
            Run
          </button>
          <iframe
            sandbox="allow-scripts"
            ref={ref}
            style={{ width: "100%", height: "100%", background: "white" }}
          />
        </div>
        <div style={{ flex: 1, paddingTop: 10 }}>
          <div>BuildTime: {buildTime}ms</div>
          <pre>
            <code style={{ whiteSpace: "pre-wrap" }}>{output}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}

render(<App />, document.body);
