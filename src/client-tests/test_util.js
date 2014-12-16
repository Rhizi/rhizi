function new_deffer() {
    var deffer = {
        cb: null,
        call_cb: false,
    };
    deffer.done = function(cb) {
        deffer.cb = cb;
        if (deffer.call_cb) {
            // warning: going down callstack - should probably use setInterval
            deffer.call_cb = false; // first do this to avoid endless recursion
            return deffer.cb();
        }
    };
    deffer.on_done = function() {
        if (this.cb) {
            this.call_cb = false;
            this.cb();
        } else {
            this.call_cb = true;
        }
    };
    return deffer;
}

function addScript(window, name) {
    var scriptEl = window.document.createElement("script");
    scriptEl.src = name;
    var deffer = new_deffer();
    deffer.load_next = function(script) {
        var sec_deffer = new_deffer();
        addScript(window, script).done(
            function() { sec_deffer.on_done(); })
        return sec_deffer;
    }
    function onload_cb() {
        console.log('addScript: loaded ' + name);
        deffer.on_done();
    }
    scriptEl.onload = onload_cb;
    window.document.body.appendChild(scriptEl);
    return deffer;
}

exports.addScript = addScript;
