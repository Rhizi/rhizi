"use strict"

$('.tutorial').click(function(){});

var key="#47989379";


$('.save').click(function(){
    var json = graph.save_to_json();
    console.log(json);
    localStorage.setItem(key, json);
});

$('.saveToFile').click(function() {
    var json = graph.save_to_json();
    console.log(json);
    location.href = 'data:text/json;base64,' + window.btoa(json);
});

$('.load').click(function(){
  var acceptLoad=true;

  if (nodes.length>0){
    acceptLoad = confirm('All unsaved changes will be deleted, are you sure?');
  }

  if(acceptLoad){
    links=[]; // TODO - not global
    nodes=[]; // TODO - not global
    var json_blob = localStorage.getItem(key)
    graph.load_from_json(json_blob);
  }

});

$('.deliverabletest').click(function(){
  deliverableTest();
});

$('.set-user').click(function() {
    $('.set-user').hide();
    $('.set-user-form').show();
    $('.set-user-form').submit(function() {
        var user = $('.set-user-input').val();
        graph.set_user(user);
        $('.set-user').html('user: ' + user);
        $('.set-user').show();
        $('.set-user-form').hide();
        $('.save-history').show();
    })
});

$('.save-history').click(function() {
    if (graph.history === undefined) {
        throw "History is undefined";
    }
    graph.history.save_to_file();
});
