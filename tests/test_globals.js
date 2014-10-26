var base = require('./base');
var util = require('../scripts/util');

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
