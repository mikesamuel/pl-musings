// Formatting code for presenting test results to the user in HTML.

/** Convert a parse tree to HTML by inserting <span class="tnode"> */
function formatTNode(parseTree) {
  if (Array.isArray(parseTree)) {
    return html`<span class="tnode">${ html.join(parseTree.map(formatTNode), ', ') }</span>`;
  } else {
    return html`<span class="tleaf">${ parseTree.tok || parseTree }</span>`;
  }
}

function formatAst(ast) {
  if (ast && typeof ast === 'object' && !Array.isArray(ast)) {
    if (typeof ast.type === 'string' && Array.isArray(ast.children)) {
      let classes = 'ast';
      if (ast.type[0] === 'q') {
        classes += ' quasi';
      }
      classes += ` ast-type-${ ast.type }`;
      return html`<div class="${ classes }"><span class="type">${ ast.type }</span>${
          html.join(ast.children.map(formatAst), ' ')
      }</div>`;
    } else if (Array.isArray(ast.discards)) {
      return html`<div class="ast garbage"><span class="type">${ ast.type || 'garbage' }</span>${
          html.join(ast.discards.map(formatToken), ', ')
      }</div>`;
    }
  }
  return html`<span class="astleaf">${ ast.tok }</span>`;
}

function formatToken(x) {
  return html`<span class="token ${ x.synthetic ? 'synthetic' : '' }">
      ${ x && typeof x.tok === 'string' ? x.tok : x }
  </span>`;
}

function formatTokens(tokens, problem, kind) {
  return html`<div class="tokens ${ kind }">${
        html.join(tokens.map(formatToken), ', ')
      } ${ problem ? '*' : '' }</div>`
}

function formatProblems(problems) {
  return html`<table summary="problems" class="problem-list">
    ${ html.join(
       problems.map(({ left, right, message }) =>
         html`<tr><td>${ left }<td>${ right }<td>${ message }</tr>`),
       '') }
  </table>`;
}

/** Given text and a list of problems, returns HTML wiggly lines under problematic parts. */
function wiggles(text, problems) {
  // Get a list of non-overlapping, sorted regions.
  let positions = problems.map(({ left, right }) => ({ left, right }));
  // Sort positions so that we can consume from left to right.
  positions.sort(
    ({ left: al, right: ar }, { left: bl, right: br }) => (
      al < bl ? -1 : al == bl ? ar - br : 1
    ));
  for (let i = 0; i < positions.length; ++i) {
    let { left: al, right: ar } = positions[i];
    if (i + 1 < positions.length) {
      let { left: bl, right: br } = positions[i + 1];
      if (ar >= bl) {  // overlap or intersect
        positions[i + 1] = {  // merged
          left:  Math.min(al, bl),
          right: Math.max(ar, br),
        };
        positions[i] = null;  // filtered out later
      }
    }
  }
  positions = positions.filter(x => x !== null);

  let htmlChunks = [];
  let textIndex = 0;
  for (const { left, right } of positions) {
    htmlChunks.push(
      text.substring(textIndex, left),
      html`<span class="problem-tokens">${ padIfShort(text.substring(left, right)) }</span>`,
    );
    textIndex = right;
  }
  htmlChunks.push(text.substring(textIndex));

  return html.join(htmlChunks, '');
}

function padIfShort(s) {
  if (s.length >= 3) { return s; }
  return html`<span class="padded">${ s }</span>`;
}

/** Groups adjacent tokens that have the same part-of-speech. */
function groupPartsOfSpeech(taggedTokens) {
  const groups = [];
  for (const token of taggedTokens) {
    // Convert to simple JSON for comparison to want
    const el = { ...token, toJSON() { return this.tok } };
    if (groups.length) {
      const [gpos, group] = groups[groups.length - 1];
      if (token.pos === gpos) {
        group.push(el);
        continue;
      }
    }
    groups.push([token.pos, [el]]);
  }
  return groups;
}

function formatPartsOfSpeech(grouped) {
  let result = '';
  let cpos = 0;  // Insert space between non-adjacent tokens.
  for (const [pos, tokens] of grouped) {
    result = html`${ result }<span class="pos-${ pos }" title="${ pos }">`;
    for (const token of tokens) {
      const { tok, left, right, synthetic } = typeof token === 'string'
        // Worst case for wanted input
        ? { tok: token, left: NaN, right: NaN, synthetic: false }
        : token;
      const adj = left === cpos;
      cpos = right;

      result = html`${ result }${ adj ? '' : ' ' }${ synthetic ? html`<i>${ tok }</i>` : tok }`;
    }
    result = html`${ result }</span>`;
  }
  return result;
}

// A JSON replacer
function replaceTokenWithTokenText(key, value) {
  if (value && typeof value === 'object' && !Array.isArray(value)
      && typeof value.tok === 'string' && typeof value.left === 'number') {
    return value.tok;
  }
  return value;
}

// Define test predicates.

/** tests function lex */
function tl(
  input, want,
  {
    hasLexErrors = false,
    preparse = (x) => x
  } = {}
) {
  inlineJsonTest(
    input, { tokens: want, problem: hasLexErrors },
    {
      compute(x) {
        let problem = false;
        const tokens = Array.from(preparse(lex(
          x,
          {
            onLexError() {
              problem = true;
            }
          })));
        return { tokens, problem };
      },
      formatOutput({ tokens, problem }, kind) {
        return formatTokens(tokens, problem, kind);
      },
      jsonReplacer: replaceTokenWithTokenText,
    }
  );
}

/** test function parse */
function tp(input, want, { lexFn, parseFn, problems = [] } = {}) {
  const jsonReplacer = replaceTokenWithTokenText;
  inlineJsonTest(
    input, { parseTree: want, problems },
    {
      compute(x) {
        const parseTree = (parseFn || parse)(preparseTokens((lexFn || lex)(input)));
        const problems = checkParseTree(parseTree);
        return { parseTree, problems };
      },
      formatOutput(result, kind) {
        return html`<details>
  <summary>
    <span class="tree ${ kind }">${ formatTNode(result.parseTree) }</span>
  </summary>
  <div class="tree ${ kind }">${ JSON.stringify(result, jsonReplacer, 2) }</div>
</details>`;
      },
      formatInput(input, { problems }) {
        return wiggles(input, problems);
      },
      jsonReplacer,
    });
}

/**
 * test function wellformed.
 *
 * input - source text
 * want - array of problems like
 *    [ { left: 0, right: 10, message: 'Text relating to input.substring(0, 10)' }, ... ]
 */
function twf(input, want, { parseFn } = {}) {
  const jsonReplacer = replaceTokenWithTokenText;
  inlineJsonTest(
    input, want,
    {
      compute (x) {
        let problems = [];
        let rawTokens = lex(
          input,
          {
            onLexError(left, right, message) {
              problems.push({ left, right, message });
            },
            emitIgnorable: true,
          });
        const ignorable = /^(?:\s|[/][/*])/;
        const filteredTokens = function *() {
          for (const token of rawTokens) {
            if (!ignorable.test(token.tok)) {
              yield token;
            } else {
              if (!isWellformedToken(token.tok)) {
                problems.push({
                  left: token.left,
                  right: token.right,
                  message: `Malformed token`
                });
              }
            }
          }
        }();
        const parseTree = (parseFn || parse)(preparseTokens(filteredTokens));
        problems = [...problems, ...checkParseTree(parseTree)];
        return { parseTree, problems };
      },
      formatOutput({ parseTree, problems }, kind) {
        return html`
<details>
  <summary>
    ${ wiggles(input, problems) }
    (${ problems.length } problem${ problems.length !== 1 ? 's' : '' })
  </summary>
  <div class="tree ${ kind }">${ JSON.stringify(parseTree, jsonReplacer, 2) }</div>
  ${ formatProblems(problems) }
</details>`;
      },
      jsonReplacer,
    },
  );
}

function ta(input, want,
            { start = 'program', grammar } = {}) {
  const jsonReplacer = replaceTokenWithTokenText;
  inlineJsonTest(
    input, want,
    {
      compute(x) {
        const tokens = preparseTokens(lex(x));
        const parseTree = parse(tokens);
        const flatParseTree = flattenParseTreeToPseudoTokens(parseTree);
        const result = (grammar || toyLanguageGrammar)
            .apply(start, flatParseTree);
        return result ? result.ast : null;
      },
      formatOutput (ast, kind) {
        return html`
<details>
  <summary>
    ${ formatAst(ast && ast.length === 1 ? ast[0] : { type: 'forest', children: ast }) }
  </summary>
  <div class="tree ${ kind }">${ JSON.stringify(ast, jsonReplacer, 2) }</div>
</details>`
      },
      jsonReplacer,
    });
}

function tpos(input, want) {
  inlineJsonTest(
    input, want,
    {
      compute(x) {
        const tokens = preparseTokens(lex(input));
        const tagged = tagPartsOfSpeech(tokens);
        return groupPartsOfSpeech(tagged);
      },
      formatOutput(grouped, kind) {
        return html`
        <div class="parts-of-speech">
          <b>${ kind }</b>:
          ${ formatPartsOfSpeech(grouped) }
        </div>`;
      },
      jsonReplacer: replaceTokenWithTokenText,
    });
}
