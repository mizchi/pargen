import { TokenMap } from "./utils";

// ==== constants ====

export const nodeBaseDefault: Omit<NodeBase, "id" | "reshape" | "kind"> = {
  key: undefined,
  optional: false,
  skip: false,
};

export enum NodeKind {
  SEQ = 1,
  ATOM,
  REPEAT,
  TOKEN,
  STRING,
  OR,
  REF,
  EOF,
  PAIR,
  NOT,
  RECURSION,
}

export enum ErrorType {
  Not_IncorrectMatch,
  Pair_Unmatch,
  Eof_Unmatch,
  Token_Unmatch,
  Seq_Stop,
  Or_UnmatchAll,
  Repeat_RangeError,
  Atom_ParseError,
}

// ==== types ====
export type Node =
  | Seq
  | Token
  | Or
  | Repeat
  | Ref
  | Eof
  | Pair
  | Not
  | Recursion
  | Atom;

export type NodeBase = {
  id: string;
  kind: NodeKind;
  key?: string | void;
  optional?: boolean;
  /* Skip self as sequence result */
  skip?: boolean;
  /* Reshape result */
  reshape?: Parser;
};

export type Recursion = NodeBase & {
  kind: NodeKind.RECURSION;
};

export type Atom = NodeBase & {
  kind: NodeKind.ATOM;
  parse: AtomParser;
};

export type Eof = NodeBase & {
  kind: NodeKind.EOF;
};

export type Pair = NodeBase & {
  kind: NodeKind.PAIR;
  open: string;
  close: string;
};

export type Not = NodeBase & {
  kind: NodeKind.NOT;
  child: Node;
};

export type Seq = NodeBase & {
  kind: NodeKind.SEQ;
  children: Node[];
};

export type Ref = NodeBase & {
  kind: NodeKind.REF;
  ref: string;
};

export type Repeat = NodeBase & {
  kind: NodeKind.REPEAT;
  pattern: Node;
  min: number;
  max?: number | void;
};

export type Or = NodeBase & {
  kind: NodeKind.OR;
  patterns: Array<Seq | Token | Ref>;
};

export type Token = NodeBase & {
  kind: NodeKind.TOKEN;
  expr: string;
};

export type CacheMap = { [key: `${number}@${string}`]: ParseSuccess };
export type PackratCache = {
  export(): CacheMap;
  add(id: Node["id"], pos: number, result: any): void;
  get(id: Node["id"], pos: number): ParseResult | void;
};

export type InputNodeExpr<RefId extends number | string = number> =
  | Node
  | string
  | RefId;

export type ParseSuccess = {
  error: false;
  result: any;
  len: number;
};

export type ParseErrorBase = {
  error: true;
  pos: number;
  errorType: ErrorType;
  kind: NodeKind;
  result?: any;
  detail?: any;
};

export type ParseError =
  | (ParseErrorBase & {
      errorType: ErrorType.Repeat_RangeError;
    })
  | (ParseErrorBase & {
      errorType: ErrorType.Not_IncorrectMatch;
    })
  | (ParseErrorBase & {
      errorType: ErrorType.Pair_Unmatch;
    })
  | (ParseErrorBase & {
      errorType: ErrorType.Eof_Unmatch;
    })
  | (ParseErrorBase & {
      errorType: ErrorType.Token_Unmatch;
      detail?: string;
    })
  | (ParseErrorBase & {
      errorType: ErrorType.Seq_Stop;
    })
  | (ParseErrorBase & {
      errorType: ErrorType.Atom_ParseError;
    })
  | (ParseErrorBase & {
      errorType: ErrorType.Or_UnmatchAll;
      detail: {
        children: Array<ParseError[]>;
      };
    });

export type ParseResult = ParseSuccess | ParseError;

export type CompiledParser = (input: string, ctx: ParseContext) => ParseResult;
export type AtomParser = (
  opts: CompileContext<any, any>
) => (
  input: string,
  ctx: ParseContext
) => number | [output: any, len: number] | void;

export type RuleParser<T> = (
  node: T,
  opts: CompileContext<any, any>
) => (
  input: string,
  ctx: ParseContext
) => number | [output: any, len: number] | void;

export type ParseContext = {
  cache: PackratCache;
  pos: number;
  tokenMap: TokenMap<string>;
};

export type Parser<In = any, Out = any> = (
  input: In,
  ctx?: ParseContext,
  stack?: Array<Node>
) => Out;

// type InternalParser<In = any, Out = any> = (
//   input: In,
//   ctx: ParseContext,
//   stack: Array<Node>
// ) => Out;

export type RootParser = (input: string, ctx?: ParseContext) => ParseResult;

export type Builder<ID = number> = {
  def(refId: ID | symbol, node: InputNodeExpr, reshape?: Parser): ID;
  ref(refId: ID, reshape?: Parser): Ref;
  tok(expr: string, reshape?: Parser): Token;
  repeat(
    pattern: InputNodeExpr,
    minmax?: [min: number | void, max?: number | void],
    reshape?: Parser
  ): Repeat;
  repeat_seq(
    children: Array<InputNodeExpr | [key: string, ex: InputNodeExpr]>,
    minmax?: [min: number | void, max?: number | void],
    reshape?: Parser
  ): Repeat;
  or: (
    patterns: Array<Seq | Token | Ref | Or | Eof | string | ID | Recursion>,
    reshape?: Parser
  ) => Or;
  seq(
    children: Array<InputNodeExpr | [key: string, ex: InputNodeExpr]>,
    reshape?: Parser
  ): Seq;
  pair(pair: { open: string; close: string }, reshape?: Parser): Pair;
  not(child: InputNodeExpr, reshape?: Parser): Not;
  atom(fn: AtomParser): Atom;
  opt<T extends Node>(node: InputNodeExpr): T;
  skip_opt<T extends Node>(node: InputNodeExpr): T;
  param<T extends Node>(key: string, node: InputNodeExpr, reshape?: Parser): T;
  skip<T extends Node>(node: T | string): T;
  join(...expr: string[]): Token;
  eof(): Eof;
  ["!"]: (child: InputNodeExpr) => Not;
  ["*"](
    children: Array<InputNodeExpr | [key: string, ex: InputNodeExpr]>
  ): Repeat;
  ["+"](
    children: Array<InputNodeExpr | [key: string, ex: InputNodeExpr]>
  ): Repeat;
  R: Recursion;
};

export type PatternsMap = Record<string | symbol, CompiledParser | void>;
export type RulesMap<T> = Record<
  any,
  (node: T, opts: CompileContext<any, any>) => CompiledParser
>;

export type CompileContext<ID extends number, RefMap> = {
  composeTokens: boolean;
  patterns: PatternsMap;
  pairs: string[];
  refs: RefMap;
  rules: RulesMap<any>;
  // compile: Compiler;
  // refSet: Set<ID | symbol>;
};

export type Compiler = (
  node: Node,
  opts: { pairs: string[]; contextRoot: symbol }
) => RootParser;

export type RootCompiler<ID extends number> = (node: Node | ID) => RootParser;
