// Support for HTML content generation.

class HTML {
  constructor(content) {
    this.content = content;
  }
  toString() {
    return this.content;
  }
}

function escHtml(x) {
  if (x instanceof HTML) { return x; }
  return new HTML(String(x).replace(/[&<>"']/g, (x) => `&#${ x.charCodeAt(0) };`));
}

function html(statics, ...dynamics) {
  return new HTML(combine(statics, dynamics, escHtml));
}
html.join = function(arr, delim = '') {
  return new HTML(arr.map(escHtml).join(escHtml(delim)));
};

function combine({ raw }, dynamics, esc) {
  let str = '';
  const n = dynamics.length;
  for (let i = 0; i < n; ++i) {
    str += raw[i] + esc(dynamics[i]);
  }
  str += raw[n];
  return str;
}
