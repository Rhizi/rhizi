/*
 Craziness to deal with the bolted on module systems that we use:
 In browser: require.js, it uses a global function named 'define'
 On server for tests: Node, it provides a module definition time object named 'exports'
*/
(function(factory) {
    if (typeof define != 'undefined') {
        define('util', factory);
    } else {
        if (typeof exports == 'object') {
            var obj = factory();
            for (var i in obj) {
                exports[i] = obj[i];
            }
        }
    }
})(function() {
return {

set_from_array: function (a) {
    var ret = {};
    for (var k = 0 ; k < a.length ; ++k) {
        ret[a[k]] = 1;
    }
    return ret;
},

set_from_object: function(o) {
    var ret = {}
    for (var k in o) {
        ret[k] = 1;
    }
    return ret;
},

set_diff: function(sa, sb) {
    var ret = {a_b:[], b_a:[]};
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
},

array_diff: function(aa, ab) {
    var sa = set_from_array(aa);
    var sb = set_from_array(ab);
    return set_diff(sa, sb);
},

}});
