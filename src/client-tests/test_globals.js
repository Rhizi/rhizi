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
var util = require('../src/util');

var count;

function object_length(obj) {
    var count = 0;
    for (var k in obj) {
        count += 1;
    }
    return count;
}

var win_before;
var win_after;

base.run_tests({
    created: function(errors, window) {
        count = object_length(window);
        console.log('before fields count: ' + count);
        win_before = util.set_from_object(window);
    },
    done:function (errors, window) {
        var new_count = object_length(window);
        console.log('after fields count: ' + new_count);
        console.log('new fields count: ' + (new_count - count));
        win_after = util.set_from_object(window);
        console.log(util.set_diff(win_after, win_before).a_b.join(','));
    }
});
