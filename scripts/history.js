// Once upon a time we shall have a versioned property graph from which history
// will be one extractable aspect, much like a git for graphs. Now we just have
// a plain list of events for a specific user.

// Enums and chrome don't play along well. Object.freeze I guess? actually rhizi code cuases
// exceptions but that shouldn't break the console, as evidenced by the '__commandLineAPI is not defined'
// error below.
//
// Uncaught TypeError: Can't add property addednodes, object is not extensible rhizicore.js:4
// Uncaught TypeError: Can't add property text, object is not extensible textanalysis.js:3
// Uncaught TypeError: Can't add property key, object is not extensible buttons.js:5
// Uncaught ReferenceError: sentence is not defined robot.js:11
// Resource interpreted as Font but transferred with MIME type application/font-sfnt: "http://localhost:8000/external/Lato300.ttf". jquery.js:2
// > document
// ReferenceError: __commandLineAPI is not defined
//var ActionEnum = Enum();

define('history', ['jquery', 'FileSaver', 'consts', 'signal'],
    function($, saveAs, consts, signal) {

/* user - username (string)
 * svg - svg element for catching zoom events (jquery DOMNode wrapper)
 */
function History(user, svg) {
    var that = this;
    this.records = [];
    this.user = user;
    signal.slot(consts.APPLIED_GRAPH_DIFF, function(obj) {
        return that.record_graph_diff(obj)
    });
    signal.slot(consts.KEYSTROKES, function(obj) {
        return that.record_keystrokes(obj);
    });
    // XXX create zoom behavior - then proof to event name change
    $(window).on('wheel', function(obj) {
        return that.record_zoom(obj);
    });
}

var ACTION_KEYSTROKES = 'ACTION_KEYSTROKES';
var ACTION_GRAPH_DIFF = 'ACTION_GRAPH_DIFF';

var KEYSTROKE_WHERE_TEXTANALYSIS = 'KEYSTROKE_WHERE_TEXTANALYSIS';
var KEYSTROKE_WHERE_DOCUMENT = 'KEYSTROKE_WHERE_DOCUMENT';
var KEYSTROKE_WHERE_EDIT_NODE = 'KEYSTROKE_WHERE_EDIT_NODE';

History.prototype.record = function(d)
{
    if (d === undefined || d.action === undefined) {
        throw "Invalid arguments";
    }
    d['user'] = this.user;
    d['timestamp'] = new Date();
    this.records.push(d);
};

History.prototype.record_zoom = function(d)
{
    console.log('history record zoom');
    console.log(d);
    return true;
}

History.prototype.save_to_file = function()
{
    var json = JSON.stringify(this.records, function (k, v) { return v; }, 2);

    saveAs(new Blob([json], {type: 'application/json'}), 'history.json');
};

History.prototype.clear_history = function()
{
    this.records = [];
}

History.prototype.record_graph_diff = function(obj)
{
    this.record({
        action: ACTION_GRAPH_DIFF,
        nodes: {add: obj.nodes && obj.nodes.add, remove: obj.nodes && obj.nodes.remove,
                change: obj.nodes && obj.nodes.change},
        links: {add: obj.links && obj.links.add, remove: obj.links && obj.links.remove,
                change: obj.links && obj.links.change},
                });
}

History.prototype.record_keystrokes = function(obj)
{
    var where = obj.where,
        keys = obj.keys;

    if (where === undefined || keys === undefined || keys.length === undefined ||
        keys.length <= 0) {
        throw "Invalid arguments";
    }
    keys = keys.filter(function(k) { return k !== undefined; });
    if (keys.length == 0) {
        return;
    }
    this.record({action: ACTION_KEYSTROKES,
        'keys': keys,
        'where': where
    });
}

return {
    History:History,
    KEYSTROKE_WHERE_TEXTANALYSIS:KEYSTROKE_WHERE_TEXTANALYSIS,
    KEYSTROKE_WHERE_DOCUMENT:KEYSTROKE_WHERE_DOCUMENT,
    KEYSTROKE_WHERE_EDIT_NODE:KEYSTROKE_WHERE_EDIT_NODE
};
}); // define
