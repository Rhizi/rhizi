"use strict"

define(['jquery'], function($) {

    function assert(condition, message) {
        if (false == condition) {
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
        for ( var k in o) {
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
            throw { message: 'passwords do not match' }
        }
        if (password_first.length < 8) {
            throw { message: 'password too short - must be at least 8 charachters long' }
        }
    }

    function obj_take(name) {
        return function(obj) {
            return obj[name];
        };
    }

    return {
        array_diff: array_diff,
        assert: assert,
        getParameterByName: getParameterByName,
        form_common__rest_post: form_common__rest_post,
        input_validation__password: input_validation__password,
        obj_take: obj_take,
        set_from_array: set_from_array,
        set_from_object: set_from_object,
        set_diff: set_diff,
    };
});
