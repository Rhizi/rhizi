"use strict"

define(function() {

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

    return {
        set_from_array : set_from_array,
        set_from_object : set_from_object,
        set_diff : set_diff,
        array_diff : array_diff
    };
});
