$(function() {
$(document).on('drop', function(e) {
        e.stopPropagation();
        e.preventDefault();
        console.log('document drop');
        var files = e.originalEvent.dataTransfer.files;
        var file = files[files.length - 1];
        var fr = new FileReader();
        fr.onload = function() {
            if (fr.readyState != 2) {
                console.log('error reading from file');
            } else {
                console.log(fr.result);
                graph.load_from_json(fr.result);
            }
        }
        fr.readAsText(file);
});
$(document).on('dragover', function (e) 
{
      e.stopPropagation();
      e.preventDefault();
});
document.bloated = true;
});
