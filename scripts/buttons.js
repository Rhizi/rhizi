$('.colorpicker').click(function(){Colorize();});

var chosencolor;

function Colorize(){
      $('.colorpicker').html("<table><tr><td class='td1'>person</td></tr><tr><td class='td2'>project</td></tr><tr><td class='td3'>question</td></tr><tr><td class='td4'>idea</td></tr></table>");
      $('.td1').css('background-color',customColor("person"));
  $('.td2').css('background-color',customColor("project"));
  $('.td3').css('background-color',customColor("skill"));
  $('.td4').css('background-color',customColor("deliverable"));
  $('.td5').css('background-color',customColor("objective"));

  $('.td1').click(function(){chosencolor="person"});
  $('.td2').click(function(){chosencolor="project"});
  $('.td3').click(function(){chosencolor="skill"});
  $('.td4').click(function(){chosencolor="deliverable"});
  $('.td5').click(function(){chosencolor="objective"});
}


$('.tutorial').click(function(){});

var key="#47989379";
 

$('.save').click(function(){

  var jsonsave='{"nodes":[';
  console.log(nodes);
  for(var i=0;i<nodes.length;i++){
    var node=nodes[i];
    jsonsave+='{"id":"'+node.id+'","type":"'+node.type+'","state":"'+"perm"+'","start":"'+node.start+'","end":"'+node.end+'"}';
    if(i!==nodes.length-1)jsonsave+=',';
  }
  jsonsave+='],"links":[';

  for(var j=0;j<links.length;j++){
    var link=links[j];
    jsonsave+='{"source":"'+link.source.id+'","target":"'+link.target.id+'","name":"'+link.name+'"}';
    if(j!==links.length-1)jsonsave+=",";
  }
  jsonsave+=']}';
  console.log(JSON.stringify(jsonsave));
  localStorage.setItem(key, JSON.stringify(jsonsave));

});

$('.load').click(function(){ 
  var acceptLoad=true;
  if (nodes.length>0){
    acceptLoad = confirm('All unsaved changes will be deleted, are you sure?');
  }

  if(acceptLoad){
    links=[];
    nodes=[];
    var data = JSON.parse(JSON.parse(localStorage.getItem(key)));
    console.log(data);
    for(var i=0; i<data["nodes"].length; i++){
      var node=data.nodes[i];
      graph.addNodeComplete(node.id,node.type,"perm",new Date(node.start),new Date(node.end));
    }

    for(var j=0; j<data["links"].length; j++){
      var link=data.links[j];
      graph.addLink(link.source,link.target,link.name,"perm");

     
    }
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




 




