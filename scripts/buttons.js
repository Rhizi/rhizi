"use strict"

define('buttons', ['jquery', 'FileSaver', 'rhizicore'], function ($, saveAs, RZ) {
$('.tutorial').click(function(){});

var key="#47989379";


$('.save').click(function(){
    var json = RZ.graph.save_to_json();
    console.log(json);
    localStorage.setItem(key, json);
});

$('.saveToFile').click(function() {
    var json = RZ.graph.save_to_json();
    var filename = 'graph.json';
    var blob = new Blob([json], {type: 'application/json'});
    console.log('saving ' + json.length + ' bytes to ' + filename);
    saveAs(blob, filename);
});

var really_load = function() {
  if (!RZ.graph.empty()) {
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
                RZ.graph.load_from_json(result);
            }
        }
    })(file);
    reader.readAsText(file, "text/javascript");
});

$('.local-storage-load').click(function(){
  if (!really_load()) {
      return;
  }
  var json_blob = localStorage.getItem(key)
  RZ.graph.load_from_json(json_blob);
});

$('.set-user').click(function() {
    $('.set-user').hide();
    $('.set-user-form').show();
    $('.set-user-form').submit(function() {
        var user = $('.set-user-input').val();
        RZ.graph.set_user(user);
        $('.set-user').html('user: ' + user);
        $('.set-user').show();
        $('.set-user-form').hide();
        $('.save-history').show();
        return false;
    })
});

$('.save-history').click(function() {
    if (RZ.graph.history === undefined) {
        throw "History is undefined";
    }
    RZ.graph.history.save_to_file();
});
return {'buttons': 'nothing here'};
}); // define
