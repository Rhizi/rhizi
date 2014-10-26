var jsdom = require("jsdom").jsdom;
var window = jsdom().parentWindow;

window.__myObject = { foo: "bar" };

var scriptEl = window.document.createElement("script");
scriptEl.src = "../tests/anotherScript.js";
window.console.log = console.log;
window.document.body.appendChild(scriptEl);
