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

define(function() {

    var description = {
        person: 'A person in CRI - student or teacher',
        club: 'A shared club or project within the CRI',
        skill: 'Ability or expertise you possess',
        interest: 'Scientific skill or domain expertise you wish you had',
        internship: "Title of first or second internship you've done"
    };

    // TODO: enums, sometime
    return {
        KEYSTROKE_WHERE_EDIT_NODE: 'keystroke_where_edit_node',
        KEYSTROKE_WHERE_DOCUMENT: 'keystroke_where_document',
        KEYSTROKE_WHERE_TEXTANALYSIS: 'keystroke_where_textanalysis',
        INPUT_WHERE_TEXTANALYSIS: 'input_where_textanalysis',
        description: description,
        NEW_NODE_NAME: 'new node',

        // Our database cannot encode zero length names, so we never (unless, bug) send those
        EMPTY_LINK_NAME: 'untitled',

        // Virtual Keycodes i.e. event.keyCode / event.key
        // https://dvcs.w3.org/hg/dom3events/raw-file/tip/html/DOM3-Events.html#keys-keyvalues
        VK_UP: 38,
        VK_DOWN: 40,
        VK_ESCAPE: 27,
        VK_TAB: 9,
        VK_SPACE: 32,
        VK_ENTER: 13,

        // Layout constants
        link_text_short_length: 14,
        concentric_top_width: 200,
        concentric_ring_distance_minimum: 200,
    };
});
