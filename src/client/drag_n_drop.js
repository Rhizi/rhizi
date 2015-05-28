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

define(['jquery', 'rz_core'], function($, rz_core) {

function init() {
console.log('rhizi: init drag-n-drop');
    $(document).on('drop', function(e) {
        e.stopPropagation();
        e.preventDefault();
        var files = e.originalEvent.dataTransfer.files;
        var file = files[files.length - 1];
        var fr = new FileReader();
        fr.onload = function() {
            if (fr.readyState != 2) {
                console.log('drop: error: reading from file failed');
            } else {
                console.log('loading dropped file');
                rz_core.load_from_json(fr.result);
            }
        }
        fr.readAsText(file);
        return false;
    });
    $(document).on('dragover', function (e) {
        e.stopPropagation();
        e.preventDefault();
        return false;
    });
};

function prevent_default_drop_behavior() {
    $(document).on("drop", function(e) {
        e.stopPropagation();
        e.preventDefault();
        return false;
    });
    $(document).on('dragover', function (e) {
        e.stopPropagation();
        e.preventDefault();
        return false;
    });
}
return {
    'init': init,
    'prevent_default_drop_behavior': prevent_default_drop_behavior
};

}); // define
