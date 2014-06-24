
function myGraph(el) {

    ///FUNCTIONS
    this.addNode = function (id,type,state) {
      var node=findNode(id,null);
      if(node !== undefined) {

      }else{
        nodes.push({"id":id,"type":type,"state":state});
        update();
      }
    }

    this.removeNode = function (id,state) {
      var i = 0;
      var n = findNode(id,state);
      while (i < links.length) {
        if ((links[i]['source'] === n)||(links[i]['target'] == n)) links.splice(i,1);
        else i++;
      }
      var index = findNodeIndex(id,state);
      if(index !== undefined) {
        nodes.splice(index, 1);
        update();
      }
    }

    this.addLink = function (sourceId, targetId, name) {
      var sourceNode = findNode(sourceId,null);
      var targetNode = findNode(targetId,null);

      if((sourceNode !== undefined) && (targetNode !== undefined)) {
        links.push({"source": sourceNode, "target": targetNode, "name": name});
        update();
      }else{
      }
    }

    this.editLink = function (sourceId, targetId,newname) {
      var link= findLink(sourceId, targetId, newname);
      if(link !== undefined) {
        link.name=newname;
        update();
      }else{
      }
    }

    this.editLinkTarget = function (sourceId, targetId,newTarget) {
      var link= findLink(sourceId, targetId, null);
      if(link !== undefined ) {
        link.target=findNode(newTarget,null);
        update();
      }else{

      }
    }

    this.editName = function (id,type,newname) {
      var index = findNode(id,type);
      if((index !== undefined)){
       index.id=newname;
       update();
     }
   }



   this.editType = function (id,state,newtype) {
    var index = findNode(id,state);
    if((index !== undefined)){
     index.type=newtype;
     update();
   }
 }

 this.editState = function (id,state,newstate) {
  var index = findNode(id,state);
  if((index !== undefined)){
   index.state=newstate;
   update();
 }
}

this.findCoordinates = function(id, type){
  var index = findNode(id,type);
  if((index !== undefined)){
   $('.typeselection').css('top',index.y-90);
   $('.typeselection').css('left',index.x-230);
 }
}



var findLink = function (sourceId, targetId, name) {
  for (var i=0; i < links.length; i++) {
    if (links[i].source.id === sourceId && links[i].target.id === targetId){
      return links[i];
    }
  }
}


var findNode = function (id,state) {
      //id=id.toLowerCase();
      for (var i=0; i < nodes.length; i++) {
        if (nodes[i].id === id || nodes[i].state === state)
          return nodes[i]
      };
    }

    var findNodeIndex = function (id,state) {
      for (var i=0; i < nodes.length; i++) {
        if (nodes[i].id === id || nodes[i].state === state)
          return i
      };
    }



    ///GRAPH BUILDER
    var w = $(el).innerWidth(),
    h = $(el).innerHeight();

    var color = d3.scale.category20();

    var vis = this.vis = d3.select(el).append("svg:svg")
    .attr("width", w)
    .attr("height", h)
    .append("g")
    .call(d3.behavior.zoom().center([w/2,h/2]).on("zoom", zoom))
    .append("g");

    vis.append("rect")
    .attr("class", "overlay")
    .attr("width", w)
    .attr("height", h);


    var force = d3.layout.force()
    .gravity(.08)
    .distance(120)
    .charge(-600)
    .size([w, h]);

    var nodes = force.nodes(),
    links = force.links();

   


    var update = function () {

      vis.selectAll("*").remove();
      var link = vis.selectAll(".link")
      .data(links);

      vis.append("svg:defs").selectAll("marker")
    .data(["end"])      // Different link/path types can be defined here
  .enter().append("svg:marker")    // This section adds in the arrows
    .attr("id", String)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 23)
    .attr("refY", -1.8)
    .attr("markerWidth", 5)
    .attr("markerHeight", 5)
    .attr("orient", "auto")
    .style("fill", "#aaa")
    .append("svg:path")
    .attr("d", "M0,-5L10,0L0,5");

      link.enter().append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("class", "link")
      .attr("marker-end", "url(#end)");


      var linktext = vis.selectAll(".linklabel").data(links);
      linktext.enter()
      .append("text")
      .attr("class", "linklabel")
      .attr("text-anchor", "middle")
      .text(function(d) { if(d.name.length<14)return d.name; else return d.name.substring(0,11)+"..."; })
      .on("click",function(d,i) {editLink(d,i);});

      link.exit().remove();




      var node = vis.selectAll(".node")
      .data(nodes, function(d) { return d.id;});

      var nodeEnter = node.enter()
      .append("g").call(force.drag);

      var nodetext=nodeEnter.insert("text")
      .attr("class", "nodetext")
      .attr("dx", 20)
      .attr("dy", ".35em")
      .text(function(d) {if(d.state==="temp")return d.id+"|"; else{if(d.id.length<14)return d.id; else return d.id.substring(0,11)+"...";}})
      .on("click",function(d,i) {editNode(d,i);showInfo(d,i);});

      var circle= nodeEnter.insert("circle")
      .attr("class", "circle")
      .attr("r", function(d) { if(d.state==="temp" && d.type!=="empty") return '16px'; else return customSize(d.type); })
      .style("fill", function(d) { return customColor(d.type); })
      .style("stroke-width", function(d){if(d.state==="temp" && d.type!=="empty") return "3px"; else return "1.5px";})
      .style("box-shadow", function(d){ if(d.state==="temp")return "0 0 40px #FFFF8F"; else return "0 0 0px #FFFF8F";})
      .on("click",function(d,i) {showInfo(d,i);});

      node.exit().remove();

      //d3.select("body").on("mousedown", mousedown);

      function transform(d) {
        return "translate(" + d.x + "," + d.y + ")";
      }

      function getCentroid(selection) {
        var element = selection.node(),
        bbox = element.getBBox();
        return [bbox.x + bbox.width/2, bbox.y + bbox.height/2];
      }

      var boxedin=false;
      force.on("tick", function() {
        

      if(boxedin){
        circle.attr("cx", function(d) { return d.x = Math.max(14, Math.min(w - 14, d.x)); })
           .attr("cy", function(d) { return d.y = Math.max(114, Math.min(h - 14, d.y)); });

        nodetext.attr("transform",transform);
      }else{
        node.attr("transform",transform);
      }

        
        link.attr("d", function(d) {
          var dx = d.target.x - d.source.x,
          dy = d.target.y - d.source.y,
          dr = Math.sqrt(dx * dx + dy * dy);
          return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
          });


        linktext.attr("transform", function(d) {
          return "translate(" + (d.source.x + d.target.x) / 2 + ","
            + (d.source.y + d.target.y) / 2 + ")"; });
          });
    

      force.nodes(nodes)
      .links(links)
      .start();

    }

    update();
  }


  graph = new myGraph(document.body);

var addednodes=[];


   function zoom() {
      //vis.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
    }


  function showInfo(d,i){
    if(d.type==="deliverable"){
      $('.info').html('<form id="editbox"><label>name:</label><input id="editboxname"/><label>description:</label><input id="editdescription"/><label>URL:</label><input id="editurl"/><label>Start date:</label><input id="editstartdate"/><label>End date:</label><input id="editenddate"/><button>edit</button></form>');
    }else{
      $('.info').html('<form id="editbox"><label>name:</label><input id="editboxname"/><label>description:</label><input id="editdescription"/><label>URL:</label><input id="editurl"/><button>edit</button></form>');
   
    }
    $('#editboxname').val(d.id);
    $('#editdescription').val(d.type);
    $('#editurl').val('www.'+d.id+'.com');
    //switchtype start date end date
  }

  function mousedown(){
    $('.editinfo').css('top',-100);
    $('.editinfo').css('left',0);
     d3.event.stopPropagation();
  }

  function AddedUnique(newnode){
            truth=true;
            for(var p=0;p<addednodes.length;p++){
              if(addednodes[p]===newnode){
                truth=false;
      }
    }
    return truth;
  }

  

  function editNode(d,i){
    var oldname=d.id;
    $('.editinfo').css('top',d.y-12);
    $('.editinfo').css('left',d.x+18);
    $('#editname').val(oldname);

    $('#editform').submit(function () {
    if(AddedUnique($('#editname').val())){
      $('.editinfo').css('top',-100);
      $('.editinfo').css('left',0);
      graph.editName(oldname,"whatever",$('#editname').val());
      var index=addednodes.indexOf(oldname);
      addednodes[index]=$('#editname').val();
      console.log(addednodes[index]);
    }else{
      var choice=$('#editname').val();
      $('#editname').val(choice+"(2)");
    }
    return false;
    });

  }

  function editLink(d,i){
    var dx=(d.source.x + d.target.x) / 2;
    var dy=(d.source.y + d.target.y) / 2; 
    var oldname=d.name;
    $('.editlinkinfo').css('top',dy-17);
    $('.editlinkinfo').css('left',dx-18);
    $('#editlinkname').val(oldname);

    $('#editlinkform').submit(function () {
      graph.editLink(d.source.id,d.target.id,$('#editlinkname').val());
      $('.editlinkinfo').css('top',-100);
      $('.editlinkinfo').css('left',0);
      return false;
    });

  }


  function customColor(type){
   var color;
   switch(type){
    case "person":
    color='#FCB924';
    break;
    case "project":
    color='#009DDC';
    break;
    case "skill":
    color='#62BB47';
    break;
    case "deliverable":
    color='#E03A3E';
    break;
    case "objective":
    color='#933E99';
    break;
    case "empty":
    color="#080808";
    break;
    case 6:
    color="#fff";
    break;
  }
  return color;
}

function customSize(type){
	var size;
	switch(type){
		case "person":
		size=12;
		break;
		case "project":
		size=12;
		break;
		case "skill":
		size=12;
		break;
		case "deliverable":
		size=12;
		break;
		case "objective":
		size=12;
		break;
		case "empty":
		size=9;
		break;
		case 6:
		size=0x30334C;
		break;
	}
	return size;
}















