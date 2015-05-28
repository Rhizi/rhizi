/*
    This file is part of rhizi, a collaborative knowledge graph editor.
    Copyright (C) 2014-2015  Rhizi

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

"use strict"
// Once upon a time we shall have a versioned property graph from which history
// will be one extractable aspect, much like a git for graphs. Now we just have
// a plain list of events for a specific user.

// Enums and chrome don't play along well. Object.freeze I guess? actually rhizi code cuases
// exceptions but that shouldn't break the console, as evidenced by the '__commandLineAPI is not defined'
// error below.
//
// Uncaught TypeError: Can't add property addednodes, object is not extensible rz_core.js:4
// Uncaught TypeError: Can't add property text, object is not extensible textanalysis.js:3
// Uncaught TypeError: Can't add property key, object is not extensible buttons.js:5
// Uncaught ReferenceError: sentence is not defined robot.js:11
// Resource interpreted as Font but transferred with MIME type application/font-sfnt: "http://localhost:8000/external/Lato300.ttf". jquery.js:2
// > document
// ReferenceError: __commandLineAPI is not defined
//var ActionEnum = Enum();

define(['jquery', 'FileSaver', 'consts', 'rz_bus'],
    function($, saveAs, consts, rz_bus) {

/* user - username (string)
 * svg - svg element for catching zoom events (jquery DOMNode wrapper)
 */
function History(user, graph, transform_element) {
    var that = this;
    this.records = [];
    this.user = user;
    this.transform_element = transform_element;
    graph.diffBus.onValue(function (obj) {
        return that.record_graph_diff(obj)
    });
    rz_bus.ui_key.onValue(that.record_keystrokes.bind(that));
    rz_bus.ui_input.onValue(that.record_input.bind(that));
    // XXX create zoom behavior - then proof to event name change
    $(window).on('wheel.history', function(obj) {
        that.record_zoom(obj);
        return true;
    });
}

var ACTION_KEYSTROKES = 'ACTION_KEYSTROKES';
var ACTION_INPUT = 'ACTION_INPUT';
var ACTION_GRAPH_DIFF = 'ACTION_GRAPH_DIFF';
var ACTION_ZOOM = 'ACTION_ZOOM';

var KEYSTROKE_WHERE_TEXTANALYSIS = 'KEYSTROKE_WHERE_TEXTANALYSIS';
var KEYSTROKE_WHERE_DOCUMENT = 'KEYSTROKE_WHERE_DOCUMENT';
var KEYSTROKE_WHERE_EDIT_NODE = 'KEYSTROKE_WHERE_EDIT_NODE';

History.prototype.record = function(action, d)
{
    if (d === undefined || action === undefined) {
        throw "Invalid arguments";
    }
    d['action'] = action;
    d['user'] = this.user;
    d['timestamp'] = new Date();
    this.records.push(d);
    $('.history-timeline').html('<pre>' + JSON.stringify(d) + '</pre>');
};

function svg_extract_translate_and_scale(e)
{
    // See: http://stackoverflow.com/questions/10349811/how-to-manipulate-translate-transforms-on-a-svg-element-with-javascript-in-chrom
    // Using the regexp option right now, did only firefox testing 36
    var transform = e.attributes['transform'];

    if (undefined === transform) {
        return;
    }

    var str = transform.value,
        parts  = /translate\(\s*([^\s,)]+)[ ,]([^\s,)]+)/.exec(str),
        scale = /scale\(\s*([^\s)]+)\)/.exec(str);

    if (scale) {
        var x = parts[1], y = parts[2];
        return {scale:+scale[1], translate: [+x, +y]};
    } else {
        return {scale:1.0, translate: [0.0, 0.0]};
    }
}

History.prototype.record_zoom = function(d)
{
    if (this.transform_element === undefined) {
        // FIXME why is it undefined? set in constructor above
        return;
    }
    var transform = svg_extract_translate_and_scale(this.transform_element);

    if (transform === undefined) {
        //console.log('record_zoom: bug: transform_element has no transform attribute');
        //FIXME: broken for now, don't spam console
        return;
    }
    this.record(ACTION_ZOOM, {transform: transform});
}

History.prototype.save_to_file = function()
{
    var json = JSON.stringify(this.records, function (k, v) { return v; }, 2);

    saveAs(new Blob([json], {type: 'application/json'}), 'history.json');
};

History.prototype.clear = function()
{
    this.records = [];
}

History.prototype.record_graph_diff = function(obj)
{
    this.record(ACTION_GRAPH_DIFF, {
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
        console.log("invalid arguments");
        return;
    }
    keys = keys.filter(function(k) { return k !== undefined; });
    if (keys.length == 0) {
        return;
    }
    this.record(ACTION_KEYSTROKES, {
        keys: keys,
        where: where
    });
}

History.prototype.record_input = function(obj)
{
    var where = obj.where,
        input = obj.input;

    if (where === undefined || input === undefined || input.length === undefined || typeof input !== 'string') {
        console.log('invalid arguments');
        return;
    }
    this.record(ACTION_INPUT, {where: where, input: input});
}

return {
    History:History,
    KEYSTROKE_WHERE_TEXTANALYSIS:KEYSTROKE_WHERE_TEXTANALYSIS,
    KEYSTROKE_WHERE_DOCUMENT:KEYSTROKE_WHERE_DOCUMENT,
    KEYSTROKE_WHERE_EDIT_NODE:KEYSTROKE_WHERE_EDIT_NODE
};
}); // define
