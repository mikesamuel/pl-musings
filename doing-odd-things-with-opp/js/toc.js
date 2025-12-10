(function populateTableOfContents() {
  console.group('table of contents');
  try {
    const toc = document.getElementById('toc');
    let embedLevel = 2;
    const lis = html.join(Array.from(document.querySelectorAll('h2, h3, h4')).map(
      (hdr) => {
	if (hdr.classList.contains('no-toc')) {
	  return '';
	}
        let { textContent, id } = hdr;
        const level = +hdr.nodeName.substring(1);  // 2 for 'h2'
        if (!id) {
          let prefix = textContent.toLowerCase().replace(/\W+/g, '-') || 'autoid';
          id = prefix;
          let disambiguated = false
          for (let num = 0; document.getElementById(id); ++num) {
            id = `${ prefix }-${ num }`;
            disambiguated = true;
          }
          if (disambiguated) {
            console.warn(`TOC: disambiguated ${ prefix }`);
          }

          hdr.id = id;
          console.log(`Auto-id ${ id }`);
          if (typeof window.notifyDocTestHarnessOfTestFailure === 'function') {
            window.notifyDocTestHarnessOfTestFailure(`TOC: auto-assigned id ${ id }`);
          }
        }

        // While we're at it, make headers linkable.
        const a = document.createElement('a');
        a.className = 'headerLink';
        a.textContent = '\u00b6';  // paragraph symbol
        a.href = `#${ id }`;
        if (navigator.clipboard) {
          // On click, copy URL to clipbboard and tell user.
          a.onclick = () => {
            navigator.clipboard.writeText(a.href).then(() => {
              a.textContent = 'copied to clipboard';
              setTimeout(
                () => a.textContent = '\u00b6',
                500);
            });
            return false;
          };
        }
        hdr.appendChild(a);

        let markup = html`<li><a href="#${ id }">${ textContent }</a>`;
        while (embedLevel < level) {
          markup = html`<ul>${ markup }`;
          ++embedLevel;
        }
        while (embedLevel > level) {
          markup = html`</ul>${ markup }`;
          --embedLevel;
        }

        return markup;
      }), '');
    toc.innerHTML = lis;
  } finally {
    console.groupEnd();
  }
}());
