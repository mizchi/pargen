// import { TokenMap } from "./utils";

import {
  ANY,
  ATOM,
  EOF,
  ERROR_Atom_ParseError,
  ERROR_Eof_Unmatch,
  ERROR_Not_IncorrectMatch,
  ERROR_Or_UnmatchAll,
  ERROR_Regex_Unmatch,
  ERROR_Repeat_RangeError,
  ERROR_Seq_NoStackOnPop,
  ERROR_Seq_StackLeft,
  ERROR_Seq_Stop,
  ERROR_Seq_UnmatchStack,
  ERROR_Token_Unmatch,
  NOT,
  OR,
  REF,
  REGEX,
  REPEAT,
  SEQ,
  SEQ_OBJECT,
  TOKEN,
} from "./constants";

export const defaultReshape: Reshape<any, any> = <T>(i: T): T => i;

// basic parser rule

export type RuleBase = {
  id: number;
  kind: number;
};

export type SerializedRuleBody = [
  id: number,
  flags: number,
  keyPtr: number,
  reshapePtr: number
];

export type Atom = RuleBase & {
  kind: typeof ATOM;
  parse: InternalParser;
};

export type SerializedAtom = [
  kind: typeof EOF,
  parsePtr: number,
  ...body: SerializedRuleBody
];

export type Any<T = any> = RuleBase & {
  kind: typeof ANY;
  len: number;
  reshape?: (tokens: string[]) => T;
};

// Atom can not serialize
// export type SerializedEof = [kind: typeof EOF, ...body: SerializedRuleBody];

export type Eof = RuleBase & {
  kind: typeof EOF;
};

// Atom can not serialize
export type SerializedEof = [kind: typeof EOF, ...body: SerializedRuleBody];

export type Not = RuleBase & {
  kind: typeof NOT;
  patterns: Rule[];
};

export type SerializedNot = [
  kind: typeof NOT,
  childPtr: number,
  ...body: SerializedRuleBody
];

// export const STACK_PUSH = 0;
export type SeqChildParams = {
  key?: string;
  opt?: boolean;
  skip?: boolean;
  push?: boolean;
  pop?: (
    a: ParseSuccess["results"],
    b: ParseSuccess["results"],
    ctx: ParseContext
  ) => boolean;
};

export type SeqChildRule = RuleBase & SeqChildParams;

export type Seq<T = string, U = string> = RuleBase & {
  kind: typeof SEQ;
  children: SeqChildRule[];
  reshape?: (results: T[], ctx: ParseContext) => U;
};

export type SeqObject<T = any, U = any> = RuleBase & {
  kind: typeof SEQ_OBJECT;
  children: SeqChildRule[];
  reshape?: (results: T, ctx: ParseContext) => U;
};

export type SerializedSeq = [
  kind: typeof SEQ,
  childrenPtr: number,
  ...body: SerializedRuleBody
];

export type Ref = RuleBase & {
  kind: typeof REF;
  ref: number;
};

export type SerializedRef = [
  kind: typeof REF,
  ref: number,
  ...body: SerializedRuleBody
];

export type Repeat<T = string, U = T, R = U[]> = RuleBase & {
  kind: typeof REPEAT;
  pattern: Rule;
  min: number;
  max?: number | void;
  reshapeEach?: (results: T[], ctx: ParseContext) => U;
  reshape?: (results: U[], ctx: ParseContext) => R;
};

export type SerializedRepeat = [
  kind: typeof REPEAT,
  patternPtr: number,
  min: number,
  max: number,
  ...body: SerializedRuleBody
];

export type Or = RuleBase & {
  kind: typeof OR;
  // heads: Rule[];
  patterns: Array<Seq | Token | Ref | Regex>;
};

export type SerializedOr = [
  kind: typeof OR,
  patternsPtr: number,
  ...body: SerializedRuleBody
];

export type Token<T = string> = RuleBase & {
  kind: typeof TOKEN;
  expr: string;
  reshape?: (raw: string) => T;
};

export type SerializedToken = [kind: typeof TOKEN, exprPtr: string];

export type Regex<T = string> = RuleBase & {
  kind: typeof REGEX;
  expr: string | RegExp;
  reshape?: (raw: string) => T;
};

export type SerializedRegex = [
  kind: typeof REGEX,
  exprPtr: number,
  ...body: SerializedRuleBody
];

export type SerializedRule =
  | SerializedSeq
  // | SerializedSeqStruct // WIP
  | SerializedToken
  | SerializedOr
  | SerializedRepeat
  | SerializedRef
  | SerializedEof
  | SerializedNot
  | SerializedAtom
  | SerializedRegex;

export type Rule =
  | Seq
  | SeqObject
  | Token
  | Or
  | Repeat
  | Ref
  | Eof
  | Not
  | Atom
  | Regex
  | Any;

// ==== public interface

export type RootCompilerOptions = {
  end?: boolean;
};
export type RootCompiler = (
  node: Rule | number,
  opts?: RootCompilerOptions
) => RootParser;

export type RootParser = (
  tokens: string[],
  pos?: number
) => ParseSuccess | (ParseError & { tokens: string[] });

export type InputNodeExpr = Rule | string | number;

export type DefinitionMap = Map<number, Rule>;

export type Compiler = {
  parsers: ParserMap;
  definitions: DefinitionMap;
  data: any;
};

export type ParserMap = Map<number, InternalParser>;
export type ParseContext = {
  root: number | string;
  tokens: string[];
  cache: Map<string, ParseResult>;
  currentError: ParseError | null;
};

export type InternalParser = (ctx: ParseContext, pos: number) => ParseResult;
export type ParseResult = ParseSuccess | ParseError;

export type Reshape<In = any, Out = any> = (
  input: In,
  ctx?: ParseContext
) => Out;

export type ParseSuccess = {
  error: false;
  pos: number;
  len: number;
  results: Array<number | any>;
};

type RepeatRangeError = {
  errorType: typeof ERROR_Repeat_RangeError;
};

type NotIncorrectMatch = {
  errorType: typeof ERROR_Not_IncorrectMatch;
  matched: ParseSuccess;
};

type EofUnmatch = {
  errorType: typeof ERROR_Eof_Unmatch;
};

type TokenUnmatch = {
  errorType: typeof ERROR_Token_Unmatch;
  expect: string;
  got: string;
};

type RegexUnmatch = {
  errorType: typeof ERROR_Regex_Unmatch;
  expect: string;
  got: string;
};

type SeqStop = {
  errorType: typeof ERROR_Seq_Stop;
  index: number;
  childError: ParseError;
};

type SeqNoStack = {
  errorType: typeof ERROR_Seq_NoStackOnPop;
  index: number;
};
type SeqStackLeft = {
  errorType: typeof ERROR_Seq_StackLeft;
};

type SeqUnmatchStack = {
  errorType: typeof ERROR_Seq_UnmatchStack;
  index: number;
};

type UnmatchAll = {
  errorType: typeof ERROR_Or_UnmatchAll;
  errors: Array<ParseError>;
};

type AtomError = {
  errorType: typeof ERROR_Atom_ParseError;
  childError: ParseError;
};

export type ParseErrorData =
  | RepeatRangeError
  | NotIncorrectMatch
  | EofUnmatch
  | TokenUnmatch
  | RegexUnmatch
  | SeqStop
  | SeqUnmatchStack
  | SeqNoStack
  | SeqStackLeft
  | AtomError
  | UnmatchAll;

export type ParseErrorBase = {
  error: true;
  rootId: number;
  pos: number;
};

export type ParseError = ParseErrorData & ParseErrorBase;
