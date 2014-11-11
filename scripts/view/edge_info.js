"use strict"

define(['view/internal'],
function(internal) {

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
    var e = internal.edit_tab.get('edge', '#deleteedge');

    e.on('click', f);
}

return {
    show: show,
    hide: hide,
    on_delete: on_delete,
};
});
