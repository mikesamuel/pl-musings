// Some test harness code for HTML pages that want to
// test an experimental implementation inline in a way
// that tests are available as part of the document.
//
// Depends on html.js, prettify


// Define a test harness so we can inline test results.
function debug(statics, ...dynamics) {
  console.log(combine(statics, dynamics, (x) => JSON.stringify(x, null, 2)));
}

let failureCount = 0;
let testCount = 0;

(function () {
  const oldWindowOnerror = window.onerror;
  window.onerror = function (...onErrorArgs) {
    ++failureCount;
    ++testCount;
    updateTestCount();
    if (typeof oldWindowOnerror === 'function') {
      oldWindowOnerror.apply(this, onErrorArgs);
    }
  };
}());

function prettifyPrintTestInput(input) {
  if (typeof prettyPrintOne === 'function') {
    return new HTML(prettyPrintOne(String(escHtml(input))));
  }
  return input;
}

// Collect tests so we can run them after we've defined the machinery
// they depend upon.
let deferredTests = [];
function deferTest(f) {
  if (deferredTests !== null) {
    deferredTests.push(f);
  } else {
    setTimeout(f, 0);
  }
}

function runDeferredTests() {
  const toRun = [...(deferredTests || [])];
  deferredTests = null;
  return Promise.all(toRun.map((f) => new Promise(
    (resolve, reject) => {
      setTimeout(() => {
        try {
          f();
        } catch (ex) {
          reject(ex);
          return;
        }
        resolve(null);
      }, 0);
    }
  ))).finally(() => {
    setTimeout(
      () => {
        if (location.hash === '#' + FAILING_TEST_DOMID) {
          document.getElementById('teststatus').click();
        } else if (location.hash) {
          const el = document.getElementById(location.hash.substring(1));
          if (el) {
            el.scrollIntoView();
          }
        }
      },
      0);
  });
}

function test(f) {
  // Delay running the test until the scripts that define the lexer
  // and parser run.
  deferTest(
    () => {
      let pass = true;
      try {
        pass = !!f();
      } catch (ex) {
        pass = false;
        // By consistently issuing an error on test failure,
        // this integrates with the Selenium tests since
        // ./test-harness instruments console.error.
        console.error(ex);
      }

      if (!pass) {
        ++failureCount;
      }
      ++testCount;
      setTimeout(updateTestCount, 0);
    });
}

// Test harness for lexer
function inlineJsonTest(
  input, want,
  {
    compute,
    formatOutput,
    formatInput = (x) => x,
    jsonReplacer = null,
  }) {
  const div = document.createElement('div');
  div.className = 'testcase';
  if (document.currentScript) {
    document.currentScript.parentNode.insertBefore(div, document.currentScript);
  } else {
    document.body.appendChild(div);
  }

  test(
    () => {
      console.group(input);
      try {
        const got = compute(input);
        let feedback = html`
<button type="button" class="copy-to-tio">&#x1f4cb;</button>
<div class="input">${ prettifyPrintTestInput(formatInput(input, got)) }</div>
${ formatOutput(got, 'actual') }`;
        const wantJSON = JSON.stringify(want, jsonReplacer);
        const gotJSON = JSON.stringify(got, jsonReplacer);
        console.log(`want ${ wantJSON }`);
        const passed = wantJSON === gotJSON;
        if (!passed) {
          console.log(`got  ${ gotJSON }`);
          div.className += ' fail';
          feedback = html`
<details><summary>${ feedback }</summary>
${ formatOutput(want, 'expected') }
</details>`;
          console.error(`failed on ${ input }`);
          div.id = allocateDomIdForFirstFailingTest();
        }
        div.innerHTML = feedback;
        const copyButton = div.querySelector('button.copy-to-tio');
        if (typeof populateTryItOut === 'function') {
          copyButton.onclick = populateTryItOut.bind(null, input);
        } else {
          copyButton.style.display = 'none';
        }
        return passed;
      } finally {
        console.groupEnd();
      }
    });
}

function updateTestCount() {
  const teststatus = document.getElementById('teststatus');
  teststatus.textContent = `${ failureCount } / ${ testCount } failed`;
  teststatus.className = failureCount ? 'failures' : '';
  if (domIdForFirstFailingTest) {
    teststatus.href = `#${ domIdForFirstFailingTest }`;
    teststatus.onclick = () => {
      // When the user clicks on the "1 / 12 failing" link, make
      // sure the browser can scroll to something visible.
      let failureNode = document.getElementById(domIdForFirstFailingTest);
      for (; failureNode; failureNode = failureNode.parentNode) {
        if (failureNode.open === false) {  // <details> have .open
          failureNode.open = true;
        }
      }
    };
  }

  if (failureCount) {
    document.body.classList.add('has-failures');
  } else {
    document.body.classList.remove('has-failures');
  }
}

const FAILING_TEST_DOMID = 'failingtest';
let domIdForFirstFailingTest = null;
function allocateDomIdForFirstFailingTest() {
  if (domIdForFirstFailingTest === null) {
    return domIdForFirstFailingTest = FAILING_TEST_DOMID;
  }
  return null;
}
