
$('.tutorial').click(function(){});

var key="#47989379";


$('.save').click(function(){

  var d = {"nodes":[], "links":[]};
  console.log(nodes);
  for(var i = 0 ; i < nodes.length ; i++){
    var node = nodes[i];
    d['nodes'].push({
      "id":node.id,
      "type":node.type,
      "state":"perm",
      "start":node.start,
      "end":node.end,
      "status": node.status
                      });
  }
  for(var j=0 ; j < links.length ; j++){
    var link = links[j];
    d['links'].push({
      "source":link.source.id,
      "target":link.target.id,
      "name":link.name
    });
  }
  console.log(JSON.stringify(d));
  localStorage.setItem(key, JSON.stringify(d));
});

$('.load').click(function(){
  var acceptLoad=true;
  if (nodes.length>0){
    acceptLoad = confirm('All unsaved changes will be deleted, are you sure?');
  }

  if(acceptLoad){
    links=[];
    nodes=[];
    var data = JSON.parse(localStorage.getItem(key));
    console.log(data);
    for(var i=0; i<data["nodes"].length; i++){
      var node=data.nodes[i];
      graph.addNodeComplete(node.id,node.type,"perm",new Date(node.start),new Date(node.end),node.status);
    }

    for(var j=0; j<data["links"].length; j++){
      var link=data.links[j];
      graph.addLink(link.source,link.target,link.name,"perm");
    }
    graph.recenterZoom();
    graph.update();
  }

});

  $('.deliverabletest').click(function(){
    deliverableTest();
  });

function fetchNode(id){
  for( x in nodes){
    if(x.id===id){
      console.log("found");
      return x;
    }
  }
  return null;
}
