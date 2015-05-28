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

define(['underscore', 'jquery'], function(_, $) {

    function assert(condition, message) {
        if (false === condition) {
            message = message || "Assertion failed";
            if (typeof Error !== "undefined") {
                throw new Error(message);
            }
            throw message; // Fallback
        }
    }

    function set_from_array(a) {
        var ret = {};
        for (var k = 0; k < a.length; ++k) {
            ret[a[k]] = 1;
        }
        return ret;
    }

    function set_from_object(o) {
        var ret = {}
        for (var k in o) {
            ret[k] = 1;
        }
        return ret;
    }

    function set_diff(sa, sb) {
        var ret = {
            a_b : [],
            b_a : []
        };
        var i;
        for (i in sa) {
            if (!(i in sb)) {
                ret.a_b.push(i);
            }
        }
        for (i in sb) {
            if (!(i in sa)) {
                ret.b_a.push(i);
            }
        }
        return ret;
    }

    function array_diff(aa, ab) {
        var sa = set_from_array(aa);
        var sb = set_from_array(ab);
        return set_diff(sa, sb);
    }

    function first_contained(list, candidates, default_result) {
        for (var k in candidates) {
            var list_item = list[k];
            if (_.contains(candidates, list_item)) {
                return list_item;
            }
        };
        return default_result;
    }

    // TODO: jquery BBQ: $.deparam.querystring().json;
    function getParameterByName(name) {
        name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
            results = regex.exec(location.search);
        return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
    }

    function form_common__rest_post(rest_path, data, success, error) {
        $.ajax({ type : "POST",
                 url : rest_path,
                 async : false,
                 cache : false,
                 data : JSON.stringify(data),
                 dataType : 'json',
                 contentType : "application/json; charset=utf-8",
                 success : success,
                 error: error
        });
    }

    function input_validation__password(password_first, password_second) {
        if (password_first != password_second) {
            throw { message: 'Passwords do not match' };
        }
        if (password_first.length < 8) {
            throw { message: 'Password too short - must be at least 8 charachters long' };
        }
    }

    function obj_take(name) {
        return function(obj) {
            return obj[name];
        };
    }

    /**
     * Mirrors the selectionStart property for input[type=text] but
     * usable on div[contentEditable=true] elements.
     */
    function selectionStart(element)
    {
        if (undefined !== element.selectionStart) {
            return element.selectionStart;
        }
        var selection = window.getSelection(),
            anchorNode = selection.anchorNode,
            anchorOffset = textChildOffset(element, anchorNode);
        return anchorOffset + selection.anchorOffset;
    }

    function textChildOffset(base, element)
    {
        function sum(a, b) { return a + b; };
        function up_to(list, element) {
            return list.slice(0, list.indexOf(element));
        }
        return reduce(up_to(text_children(base), element).map(obj_take('length')), 0, sum);
    }

    function text_children(element)
    {
        var text = [];
        walk(element, function(e) {
            if (3 === e.nodeType) {
                text.push(e);
            }
        });
        return text;
    }

    /**
     * Return the text child containing the text at @offset and the
     * corresponding offset within in.
     *
     * @param base root element
     * @param offset text offset within base element
     * @return {'element': text_element, 'offset': offset_in_text_element}
     **/
    function textChildForOffset(base, offset)
    {
        var sum = 0,
            child,
            child_offset,
            last = base,
            last_length = 0;

        walk(base, function(element) {
            if (3 === element.nodeType) {
                sum += element.length;
                if (sum > offset) {
                    child = element;
                    child_offset = offset + element.length - sum;
                    return false;
                }
                last = element;
                last_length = last.length;
            }
            return true;
        });
        if (undefined !== child) {
            return {'element': child, 'offset': child_offset};
        }
        return {'element': last, 'offset': last_length};
    }

    function walk(element, func)
    {
        var stack = [element],
            e,
            i;

        while (stack.length > 0) {
            e = stack.pop();
            if (false === func(e)) {
                return;
            }
            for (i = e.childNodes.length - 1; i >= 0 ; --i) {
                stack.push(e.childNodes[i]);
            }
        }
    }

    function setSelection(element, start, end)
    {
        var selection, range,
            start_obj, end_obj;

        if (undefined !== element.selectionStart && undefined !== element.selectionEnd) {
            element.selectionStart = start;
            element.selectionEnd = end;
        } else {
            range = document.createRange();
            start_obj = textChildForOffset(element, start);
            end_obj = textChildForOffset(element, end);
            range.setStart(start_obj.element, start_obj.offset);
            range.setEnd(start_obj.element, end_obj.offset);
            selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    /**
     * Mirros the value function on input[type=text] elements but
     * usable on divs or any other node that can have a textContent
     * child.
     */
    function value(element_raw, new_value)
    {
        if (undefined === new_value) {
            if (undefined !== element_raw.value) {
                return element_raw.value;
            }
            return element_raw.textContent;
        } else {
            if (undefined !== element_raw.value) {
                element_raw.value = new_value;
            } else {
                element_raw.textContent = new_value;
            }
        }
    }

    // Functional programming tools
    function reduce(list, initial, func)
    {
        var ret = initial;

        for (var i = 0 ; i < list.length; ++i) {
            ret = func(ret, list[i]);
        }
        return ret;
    }

    // String utilities
    function capitalize(word) {
        if (word.length == 0) return '';
        return word.slice(0, 1).toUpperCase() + word.slice(1, word.length);
    }

    // logging helpers
    function log_error(msg) {
        console.log('error: ' + msg);
    }

    return {
        array_diff: array_diff,
        assert: assert,
        getParameterByName: getParameterByName,
        form_common__rest_post: form_common__rest_post,
        input_validation__password: input_validation__password,
        obj_take: obj_take,
        reduce: reduce,
        value: value,
        set_from_array: set_from_array,
        set_from_object: set_from_object,
        set_diff: set_diff,
        first_contained: first_contained,
        setSelection: setSelection,
        selectionStart: selectionStart,

        capitalize: capitalize,

        log_error: log_error,
    };
});
