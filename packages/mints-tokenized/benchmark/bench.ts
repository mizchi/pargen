// import { transform } from '@mizchi/mints';
import { transform } from "../src/index";
import ts from "typescript";
import fs from "fs";
import path from "path";
import esbuild from "esbuild";
import { parseTokens } from "../src/tokenizer";
import { createTransformer } from "../node/node_main";
// import { printPerfResult } from "@mizchi/pargen/src";
// import { formatError } from "../src/_testHelpers";
// import prettier from "prettier";

const code0 = fs.readFileSync(
  path.join(__dirname, "cases/example0.ts"),
  "utf-8"
);

const code1 = fs.readFileSync(
  path.join(__dirname, "cases/example1.ts"),
  "utf-8"
);
// pargen
const code2 = fs.readFileSync(
  path.join(__dirname, "cases/example2.ts"),
  "utf-8"
);

// pargen
const code3 = fs.readFileSync(
  path.join(__dirname, "cases/example3.ts"),
  "utf-8"
);

// pargen
const code4 = fs.readFileSync(
  path.join(__dirname, "cases/example4.ts"),
  "utf-8"
);

// pargen
// const code5 = fs.readFileSync(
//   path.join(__dirname, "cases/example5.ts"),
//   "utf-8"
// );

function tsc(input: string) {
  return ts.transpileModule(input, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.Latest,
    },
  }).outputText;
}

function esbuild_(input: string) {
  return esbuild.transformSync(input, {
    loader: "ts",
  }).code;
}

function mints(input: string) {
  const out = transform(input);
  if (typeof out === "object") {
    throw out;
  }
  return out as string;
}

const transformer = createTransformer();
async function mints_para(input: string) {
  const out = await transformer.transform(input);
  if (typeof out === "object") {
    throw out;
  }
  return out as string;
}

// function mintsMultithread(input: string) {
//   for (const i of parseTokens(input)) {
//   }
//   // const out = transform(input);
//   // if (typeof out === "object") {
//   //   throw out;
//   // }
//   // return out as string;
// }

export async function main() {
  const compilers = [tsc, mints, mints_para, esbuild_];

  // warmup
  esbuild_("const x:number = 1");

  // const targets = [code1, code2, code3];
  const targets = [
    // x
    code0,
    code1,
    code2,
    code3,
    code4,
    // code5,
  ];

  for (const code of targets) {
    const caseName = "example" + targets.indexOf(code);
    console.log("---------", caseName);
    for (const compiler of compilers) {
      // console.log("[pre]", preprocessLight(code));
      const N = 3;
      const results: number[] = [];
      for (let i = 0; i < N; i++) {
        const now = Date.now();
        const out = await compiler(code);
        // console.log(`[${i}]`, Date.now() - now);
        results.push(Date.now() - now);
      }
      console.log(
        `[${compiler.name}]`,
        "ave:" + Math.floor(results.reduce((s, n) => s + n, 0) / results.length)
        // results
      );

      // if (process.env.NODE_ENV === "perf" && compiler === compileMints) {
      //   printPerfResult();
      // }
    }
  }
  transformer.terminate();
}
main().catch(console.error);
