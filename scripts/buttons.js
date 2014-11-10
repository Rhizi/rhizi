"use strict"

define(['jquery', 'FileSaver', 'rz_core'], function ($, saveAs, rz_core) {
$('.tutorial').click(function(){});

var key="#47989379";


$('.save a').click(function(){
    var json = rz_core.graph.save_to_json();
    console.log('saving to local storage ' + json.length + ' bytes');
    localStorage.setItem(key, json);
});

$('.saveToFile a').click(function() {
    var json = rz_core.graph.save_to_json();
    var filename = 'graph.json';
    var blob = new Blob([json], {type: 'application/json'});
    console.log('saving ' + json.length + ' bytes to ' + filename);
    saveAs(blob, filename);
});

var really_load = function() {
  if (!rz_core.graph.empty()) {
    return confirm('All unsaved changes will be deleted, are you sure?');
  }
  return true;
}

$('.file-load').on('change', function(event) {
    var file = event.target.files[0];
    var reader;

    if (!really_load()) {
        return;
    }
    if (file === undefined) {
        return;
    }
    console.log(file);
    reader = new FileReader();
    reader.onload = (function(theFile) {
        return function(e) {
            var result = e.target.result;
            if (e.target.readyState === FileReader.DONE) {
                console.log('done reading ' + theFile.name);
                console.log('got #' + result.length + ' bytes in ' + typeof(result));
                rz_core.load_from_json(result);
            }
        }
    })(file);
    reader.readAsText(file, "text/javascript");
});

$('.local-storage-load a').click(function(){
  if (!really_load()) {
      return;
  }
  var json_blob = localStorage.getItem(key)
  rz_core.load_from_json(json_blob);
});

$('a.set-user').click(function() {
    $('.set-user').hide();
    $('.set-user-form').show();
    $('.set-user-form').submit(function() {
        var user = $('.set-user-input').val();
        rz_core.graph.set_user(user);
        $('.set-user').html('user: ' + user);
        $('.set-user').show();
        $('.set-user-form').hide();
        $('.save-history').show();
        return false;
    })
});

$('a.save-history').click(function() {
    if (rz_core.graph.history === undefined) {
        throw "History is undefined";
    }
    rz_core.graph.history.save_to_file();
});
return {'buttons': 'nothing here'};
}); // define
