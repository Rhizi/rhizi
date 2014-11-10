/*
 * Signal/slot (i.e. blackboard pattern) for rhizi.
 *
 * This is a thin wrapper over jquery right now.
 * But just keeping it here to make any future change of implementation slightly
 * easier.
 */

define(['jquery'], function($) {
    function slot(name, handler) {
        $(window).on(name, function(e, args) {
            handler(args);
        });
    };
    function signal(name, obj) {
        $(window).trigger(name, obj);
    }
    return {
        'slot': slot,
        'signal': signal
    };
})
