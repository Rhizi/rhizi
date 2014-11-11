
define(['view/internal'],
function(internal) {

var delete_button = internal.edit_tab.get('edge', '#deleteedge'),
    delete_callback = undefined;

delete_button.on('click', function() {
    if (delete_callback) {
        delete_callback();
    }
});

function show()
{
    internal.edit_tab.show('edge');
}

function hide()
{
    internal.edit_tab.hide();
}

function on_delete(f)
{
    delete_callback = f;
}

return {
    show: show,
    hide: hide,
    on_delete: on_delete,
};
});
"use strict"
