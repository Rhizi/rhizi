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

define('rz_bus',
       ['consts', 'Bacon'],
function(consts,   Bacon)
{
    "use strict";

    var ui_key_bus = new Bacon.Bus(),
        ui_input_bus = new Bacon.Bus();

    return {
        ui_key: ui_key_bus,
        ui_input: ui_input_bus,
    };
});
