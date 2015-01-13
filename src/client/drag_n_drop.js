define(['jquery', 'rz_core'], function($, rz_core) {

function init() {
console.log('rhizi: init drag-n-drop');
$(document).on('drop', function(e) {
    e.stopPropagation();
    e.preventDefault();
    var files = e.originalEvent.dataTransfer.files;
    var file = files[files.length - 1];
    var fr = new FileReader();
    fr.onload = function() {
        if (fr.readyState != 2) {
            console.log('drop: error: reading from file failed');
        } else {
            console.log('loading dropped file');
            rz_core.load_from_json(fr.result);
        }
    }
    fr.readAsText(file);
    return false;
});
$(document).on('dragover', function (e) 
{
    e.stopPropagation();
    e.preventDefault();
    return false;
});
};

function prevent_default_drop_behavior() {
    $(document).on("drop", function(e) {
        e.stopPropagation();
        e.preventDefault();
        return false;
    });
    $(document).on('dragover', function (e) {
        e.stopPropagation();
        e.preventDefault();
        return false;
    });
}
return {
    'init': init,
    'prevent_default_drop_behavior': prevent_default_drop_behavior
};

}); // define
