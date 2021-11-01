// import { Regex } from "./../../pargen/src/types";
import {
  ATOM,
  Compiler,
  EOF,
  ERROR_Eof_Unmatch,
  ERROR_Not_IncorrectMatch,
  ERROR_Or_UnmatchAll,
  ERROR_Pair_Unmatch,
  ERROR_Regex_Unmatch,
  ERROR_Repeat_RangeError,
  ERROR_Seq_Stop,
  ERROR_Token_Unmatch,
  InternalParser,
  NOT,
  OR,
  PAIR_CLOSE,
  PAIR_OPEN,
  ParseContext,
  ParseError,
  ParseErrorData,
  ParseResult,
  ParseSuccess,
  REF,
  REGEX,
  REPEAT,
  Repeat,
  Reshape,
  Rule,
  SEQ,
  TOKEN,
} from "./types";
// import {
//   // buildRangesToString,
//   createRegexMatcher,
//   createStringMatcher,
// } from "./utils";

// const USE_RANGE = Symbol();

export const success = <T = any>(
  pos: number,
  len: number,
  results: (number | T)[]
) => {
  return {
    error: false,
    pos,
    len,
    results,
  } as ParseSuccess;
};

export function fail<ErrorData extends ParseErrorData>(
  pos: number,
  rootId: number,
  errorData: ErrorData
): ParseError {
  return {
    error: true,
    rootId,
    // rule,
    pos,
    ...errorData,
  };
}

// parse with cache
export function compileFragment(
  rule: Rule,
  compiler: Compiler,
  rootId: number
): InternalParser {
  const internalParser = compileFragmentInternal(rule, compiler, rootId);
  // generic cache
  const parser: InternalParser = (ctx, pos) => {
    const beforeStack = ctx.openStack.slice();
    const parsed = ctx.cache.getOrCreate(rule.id, pos, () =>
      internalParser(ctx, pos)
    );
    // restore stack on parse error
    if (parsed.error) {
      ctx.openStack = beforeStack;
      // TODO: Refactor to Format error
      if (
        parsed.error &&
        [
          ERROR_Token_Unmatch,
          ERROR_Regex_Unmatch,
          ERROR_Eof_Unmatch,
          ERROR_Not_IncorrectMatch,
        ].includes(parsed.errorType)
      ) {
        ctx.currentError ??= parsed;
        if (ctx.currentError.pos < parsed.pos) {
          ctx.currentError = parsed;
        }
      }
    }
    return parsed;
  };
  return parser;
}

function compileFragmentInternal(
  rule: Rule,
  compiler: Compiler,
  rootId: number
): InternalParser {
  switch (rule.kind) {
    case TOKEN: {
      let expr = rule.expr;
      return (ctx, pos) => {
        const token = ctx.tokens[pos];
        const matched = token === expr;
        if (!matched) {
          if (rule.optional) {
            return success(pos, 0, []);
          } else {
            return fail(pos, rootId, {
              errorType: ERROR_Token_Unmatch,
            });
          }
        }
        return success(pos, 1, [rule.reshape ? rule.reshape(token) : pos]);
      };
    }
    case REGEX: {
      let expr = rule.expr;
      const re = new RegExp(`^${expr}$`, "u");
      return (ctx, pos) => {
        const token = ctx.tokens[pos];
        const matched = re.test(token);
        if (!matched) {
          if (rule.optional) {
            return success(pos, 1, []);
          } else {
            return fail(pos, rootId, {
              errorType: ERROR_Regex_Unmatch,
              expr: expr,
            });
          }
        }
        return success(pos, 1, [rule.reshape ? rule.reshape(token) : pos]);
      };
    }
    case EOF: {
      return (ctx, pos) => {
        const ended = pos === ctx.tokens.length;
        // console.log("ended", pos, { ended, token: ctx.tokens[pos] });
        if (ended) {
          return success(pos, 1, []);
        }
        return fail(pos, rootId, {
          errorType: ERROR_Eof_Unmatch,
        });
      };
    }
    case NOT: {
      const parsers = rule.patterns.map((pat) =>
        compileFragment(pat, compiler, rootId)
      );
      return (ctx, pos) => {
        for (const parseChild of parsers) {
          const result = parseChild(ctx, pos);
          if (result.error) {
            continue;
          } else {
            return fail(pos, rootId, {
              errorType: ERROR_Not_IncorrectMatch,
            });
          }
        }
        return success(pos, 0, []);
      };
    }
    case REF: {
      return (ctx, pos) => {
        const resolved = compiler.parsers.get(rule.ref);
        return resolved!(ctx, pos);
      };
    }
    case ATOM: {
      return (ctx, pos) => {
        return rule.parse(ctx, pos);
      };
    }

    case SEQ: {
      let isObjectMode = false;
      const parsers = rule.children.map((c) => {
        const parse = compileFragment(c, compiler, rootId);
        if (c.key) isObjectMode = true;
        // if (c.skip) hasSkip = true;
        return { parse, node: c };
      });
      return (ctx, pos) => {
        let cursor = pos;
        if (isObjectMode) {
          const resultObj: any = {};
          for (const parser of parsers) {
            const parsed = parser.parse(ctx, cursor);
            if (parsed.error) {
              if (parser.node.optional) continue;
              return fail(cursor, rootId, {
                errorType: ERROR_Seq_Stop,
                childError: parsed,
                index: parsers.indexOf(parser),
              });
            }
            if (parser.node.key && !parser.node.skip) {
              const reshaped = parsed.results;
              resultObj[parser.node.key] = reshaped;
            }
            cursor += parsed.len;
          }
          return success(pos, cursor - pos, [resultObj]);
        } else {
          let results: any[] = [];
          for (const parser of parsers) {
            const parseResult = parser.parse(ctx, cursor);
            if (parseResult.error) {
              if (parser.node.optional) continue;
              return fail(cursor, rootId, {
                errorType: ERROR_Seq_Stop,
                childError: parseResult,
                index: parsers.indexOf(parser),
              });
            }
            if (!parser.node.skip) {
              results.push(...parseResult.results);
            }
            cursor += parseResult.len;
          }
          if (rule.reshape) {
            const resolvedTokens = results.map((r) =>
              typeof r === "number" ? ctx.tokens[r] : r
            );
            results = rule.reshape(resolvedTokens, ctx) as any;
          }
          return success(pos, cursor - pos, results);
        }
      };
    }
    case OR: {
      const compiledPatterns = rule.patterns.map((p) => {
        return {
          parse: compileFragment(p, compiler, rootId),
          node: p,
        };
      });
      return (ctx, pos) => {
        const errors: ParseError[] = [];
        for (const next of compiledPatterns) {
          const parsed = next.parse(ctx, pos);
          if (parsed.error === true) {
            if (rule.optional) {
              return success(pos, 0, []);
            }
            errors.push(parsed);
            continue;
          }
          return parsed as ParseResult;
        }

        return fail(pos, rootId, {
          errorType: ERROR_Or_UnmatchAll,
          errors,
        });
      };
    }

    case REPEAT: {
      const parser = compileFragment(rule.pattern, compiler, rootId);
      return (ctx, pos) => {
        const repeat = rule as Repeat;
        const results: (string | number | any)[] = [];
        let cursor = pos;
        while (true) {
          const parseResult = parser(ctx, cursor);
          if (parseResult.error === true) break;
          if (parseResult.len === 0) throw new Error(`ZeroRepeat`);
          results.push(...parseResult.results);
          cursor += parseResult.len;
        }
        // size check
        if (
          results.length < repeat.min ||
          // @ts-ignore
          (repeat.max && results.length > repeat.max)
        ) {
          return fail(pos, rootId, {
            errorType: ERROR_Repeat_RangeError,
          });
        }
        return success(pos, cursor - pos, results);
      };
    }
    // WIP
    // case PAIR_OPEN: {
    //   const parser = compileFragment(rule.pattern, compiler, rootId);
    //   return (ctx, pos) => {
    //     const parsed = parser(ctx, pos);
    //     // push stack
    //     if (!parsed.error) {
    //       ctx.openStack.push(parsed.results);
    //     }
    //     return parsed;
    //   };
    // }
    // case PAIR_CLOSE: {
    //   const parser = compileFragment(rule.pattern, compiler, rootId);
    //   return (ctx, pos) => {
    //     const parsed = parser(ctx, pos);
    //     // push stack
    //     if (!parsed.error) {
    //       const lastItem = ctx.openStack.slice(-1)[0];
    //       if (lastItem === parsed.result) {
    //         ctx.openStack.pop();
    //         return parsed;
    //       } else {
    //         return fail(rule, pos, rootId, {
    //           errorType: ERROR_Pair_Unmatch,
    //         });
    //       }
    //     }
    //     return parsed;
    //   };
    // }
    default: {
      throw new Error();
    }
  }
}
