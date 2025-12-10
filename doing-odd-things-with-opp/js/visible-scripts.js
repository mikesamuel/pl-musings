// Pretty print visible scripts
// Assumes prettyprint has been loaded.

(() => {
  if (typeof prettyPrintOne !== 'function') {
    // Don't spam console when network failue.
    notifyDocTestHarnessOfTestFailure('prettyPrintOne unavailable');
    return;
  }
  for (const script of document.querySelectorAll('script.visible')) {
    setTimeout(
      () => {
        let pre;
        if (script.classList.contains('hoisted') && script.id) {
          pre = document.querySelector(`pre#unhoist-${ script.id }`);
        }
        if (!pre) {
          pre = document.createElement('pre');
        }

        pre.className = `prettyprint lang-js ${ script.className }`;
        const id = script.id;
        if (id) {
          script.removeAttribute('id');
          pre.id = id;
        }
        const sourceText = script.textContent;
        pre.textContent = sourceText;
        if (!pre.parentNode) {
          script.parentNode.insertBefore(pre, script);
        }
        pre.innerHTML = prettyPrintOne(escHtml(sourceText), 'js');
        script.style.display = 'none';
      },
      0);
  }
})();
prettyPrint();
