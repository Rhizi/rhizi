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

var base = require('./base');

var data = [
["#a hello there #b", ["a", "b"], [["a", "b", "hello there"]],
["#a hello there2 #ba", ["a", "ba"], ["a", "ba", "hello there2"]]],
["#c and #d like #e", ["c", "d", "e"], [["c", "e", "like"], ["d", "e", "like"]]],
// issue 86
["#f and #g and #h are cool", ["f", "g", "h", "f and g and h are cool"], [["f", "f and g and h are cool", ""], ["g", "f and g and h are cool", ""], ["h", "f and g and h are cool", ""]]],
["#i likes #j and #k", ["i", "j", "k"], ["i", "j", "likes"], ["i", "k", "likes"]],
["#q likes #r but doesn't like #l", ["q", "r", "l"], []],
];
/*
#t and #u like #v
#w #x #y
sometimes #z and #ab aren't friends
I like to work with #a
*/

base.run_tests({
    done: function (errors, window) {
        debugger;
        var analyzeSentence = window.require('textanalysis.ui').analyzeSentence;
        if (process.argv.length > 2) {
            analyzeSentence(process.argv.slice(2).join(" "), true);
            base.dump_graphviz(window.require('rz_core').force);
        } else {
            for (var k = 0; k < data.length; ++k) {
                var sentence = data[k][0];
                var expected_nodes = data[k][1];
                var expected_links = data[k][2];
                base.reset(window);
                console.log('analyzing ' + sentence);
                analyzeSentence(sentence, true);
                var nodes = base.nodes(window);
                var links = base.links(window);
                if (nodes != expected_nodes) {
                    console.log('expected: ' + expected_nodes);
                    console.log('got:      ' + nodes.join('|'));
                }
                if (links != expected_links) {
                    console.log('expected: ' + expected_links);
                    console.log('got:      ' + links);
                }
                base.dump_graphviz(window.require('rz_core').force);
            }
        }
        process.exit();
    }
});
