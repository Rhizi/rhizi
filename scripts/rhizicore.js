//CORE VARIABLES
var addednodes = [];

var graphstate = "GRAPH";
var graphinterval = 0;

var boxedin = false;

var deliverables = [];

var boxedin, nodetext, linktext, link, links, node, nodes, circle;

var scrollValue = 0;


function myGraph(el) {

    ///FUNCTIONS
    this.addNode = function (id, type, state) {
        var start = 0,
            end = 0;
        var node = findNode(id, null);
        if (node !== undefined) {
            graph.editState(id, null, "temp");
        } else {
            nodes.push({
                "id": id,
                "type": type,
                "state": state,
                "start": start,
                "end": end
            });

        }
        update();
    }

    this.addNodeComplete = function (id, type, state, start, end) {
        var node = findNode(id, null);
        if (node !== undefined) {
            graph.editState(id, null, "temp");
        } else {
            nodes.push({
                "id": id,
                "type": type,
                "state": state,
                "start": start,
                "end": end
            });

        }
        update();
    }

    this.removeNode = function (id, state) {
        var i = 0;
        var n = findNode(id, state);
        while (i < links.length) {
            if ((links[i]['source'] === n) || (links[i]['target'] == n)) links.splice(i, 1);
            else i++;
        }
        var index = findNodeIndex(id, state);
        if (index !== undefined) {
            nodes.splice(index, 1);
            update();
        }
    }

    this.highlightNode = function (id, state) {
        var i = 0,
            j = 0;
        var n = findNode(id, state);
        var adjacentnode;

        this.removeHighlight();
        //highlight node
        if (n !== undefined && n.state!=="chosen" && n.state!=="temp") {
            n.state = "chosen";

            while (i < links.length) {
                if (links[i]['source'] === n){
                    adjacentnode=findNode(links[i]['target'].id,null);
                    if(adjacentnode.state!=="temp")adjacentnode.state = "exit";
                    links[i]['state'] = "exit";
                }
                if(links[i]['target'] === n) {
                    adjacentnode=findNode(links[i]['source'].id,null);
                    if(adjacentnode.state!=="temp")adjacentnode.state = "enter";
                    links[i]['state'] = "enter";
                } 
                i++;
            }
            update();

        }

    }

    this.removeHighlight = function(){
      var k=0;
       while (k < nodes.length) {
                if(nodes[k]['state'] === "enter" || nodes[k]['state'] === "exit" || nodes[k]['state'] === "chosen"){
                    nodes[k]['state'] = "perm";
                }
                k++;
            }
      var j=0;
        //highlight all connections
            while (j < links.length) {
                links[j]['state'] = "perm";
                j++;
            }
        update();
    }

    this.addLink = function (sourceId, targetId, name, state) {
        var sourceNode = findNode(sourceId, null);
        var targetNode = findNode(targetId, null);

        if ((sourceNode !== undefined) && (targetNode !== undefined)) {
            links.push({
                "source": sourceNode,
                "target": targetNode,
                "name": name,
                "state": state
            });
            update();
        } else {

        }
    }

    this.editLink = function (sourceId, targetId, newname) {
        var link = findLink(sourceId, targetId, newname);
        if (link !== undefined) {
            link.name = newname;
            update();
        } else {}
    }

    this.editLinkTarget = function (sourceId, targetId, newTarget) {
        var link = findLink(sourceId, targetId, null);
        if (link !== undefined) {
            link.target = findNode(newTarget, null);
            update();
        } else {

        }
    }

    this.editName = function (id, type, newname) {
        var index = findNode(id, type);
        if ((index !== undefined)) {
            index.id = newname;
            update();
        }
    }

    this.editDates = function (id, type, start, end) {
        var index = findNode(id, type);
        if ((index !== undefined)) {
            index.start = start;
            index.end = end;
            update();
        }
    }



    this.editType = function (id, state, newtype) {
        var index = findNode(id, state);
        if ((index !== undefined)) {
            index.type = newtype;
            update();
        }
    }

    this.editState = function (id, state, newstate) {
        var index = findNode(id, state);
        if ((index !== undefined)) {
            index.state = newstate;
            update();
        }
    }

    this.findCoordinates = function (id, type) {
        var index = findNode(id, type);
        if ((index !== undefined)) {
            $('.typeselection').css('top', index.y - 90);
            $('.typeselection').css('left', index.x - 230);
        }
    }



    var findLink = function (sourceId, targetId, name) {
        for (var i = 0; i < links.length; i++) {
            if (links[i].source.id === sourceId && links[i].target.id === targetId) {
                return links[i];
            }
        }
    }


    var findNode = function (id, state) {
        //id=id.toLowerCase();
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].id === id || nodes[i].state === state)
                return nodes[i]
        };
    }

    var findNodeIndex = function (id, state) {
        for (var i = 0; i < nodes.length; i++) {
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
        .call(d3.behavior.zoom().center([w / 2, h / 2]).on("zoom", zoom))
        .append("g");

   


    var force = d3.layout.force()
        .distance(120)
        .charge(-600)
        .size([w, h]);

    nodes = force.nodes();
    links = force.links();




    var update = function () {

        vis.selectAll("*").remove();
        link = vis.selectAll(".link")
            .data(links);

         vis.append("rect")
        .attr("class", "overlay")
        .attr("width", w)
        .attr("height", h)
        .on("click", function() {
        mousedown();
        });

        vis.append("svg:defs").selectAll("marker")
            .data(["end"]) // Different link/path types can be defined here
            .enter().append("svg:marker") // This section adds in the arrows
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
            .attr("class", function(d){
              
                  if(d.state === "enter"){return "enterlink";}
                  else if(d.state === "exit"){return "exitlink";}
                  else return "link";
              
            })
            .attr("marker-end", "url(#end)");


        linktext = vis.selectAll(".linklabel").data(links);
        linktext.enter()
            .append("text")
            .attr("class", "linklabel")
            .attr("text-anchor", "middle")
            .text(function (d) {
                if (d.name.length < 25) return d.name;
                else return d.name.substring(0, 14) + "...";
            })
            .on("click", function (d, i) {
                editLink(d, i);
            });

        link.exit().remove();




        node = vis.selectAll(".node")
            .data(nodes, function (d) {
                return d.id;
            });

        var nodeEnter = node.enter()
            .append("g").call(force.drag);

        nodetext = nodeEnter.insert("text")
            .attr("class", "nodetext")
            .attr("dx", 20)
            .attr("dy", ".35em")
            .text(function (d) {
                if (d.state === "temp") return d.id + "|";
                else {
                    if (d.id.length < 14) return d.id;
                    else return d.id.substring(0, 11) + "...";
                }
            })
            .on("click", function (d, i) {
                editNode(d, i);
                showInfo(d, i);
            });

        circle = nodeEnter.insert("circle")
            .attr("class", "circle")
            .attr("r", function (d) {
                if (d.state === "temp" && d.type !== "empty") return '16px';
                else return customSize(d.type);
            })
            .style("fill", function (d) {
                return customColor(d.type);
            })
            .style("stroke", function (d) {
                if(d.state === "chosen"){
                  return "#EDE275";
                }
                if(d.state === "enter"){
                  return "#EDE275";
                }if(d.state === "exit"){
                  return "#EDE275";
                }else{ return "#fff";}
            })
            .style("stroke-width", function (d) {
                if (d.state === "temp" && d.type !== "empty" || d.state==="chosen") return "3px";
                else return "1.5px";
            })
            .style("box-shadow", function (d) {
                if (d.state === "temp") return "0 0 40px #FFFF8F";
                else return "0 0 0px #FFFF8F";
            })
            .on("click", function (d, i) {
                showInfo(d, i);
            });

        node.exit().remove();

        //d3.select("body").on("mousedown", mousedown);



        force.on("tick", tick);



        //update deliverables
        deliverables = [];
        for (var i = 0; i < nodes.length; i++) {
            var current = nodes[i];
            if (current.type === "deliverable") {
                deliverables.push({
                    "id": nodes[i].id,
                    "startdate": nodes[i].start,
                    "enddate": nodes[i].end
                });
            }
            //Do something
        }


        force.nodes(nodes)
            .links(links)
            .start();

    }

    update();
}


graph = new myGraph(document.body);


function tick(e) {
    //console.log(e);

    function transform(d) {
        if (graphstate === "GRAPH" || d.type === "deliverable") {
            if (d.state === "temp") {
                if (d.type === "empty") {

                    d.x = 180;
                    d.y = 150;

                } else {
                    if (addednodes.length % 2 === 0) {
                        d.x = 180;
                        d.y = 150;
                    } else {
                        d.x = 300;
                        d.y = 150;

                    }
                }
                return "translate(" + d.x + "," + d.y + ")";
            } else {
                return "translate(" + d.x + "," + d.y + ")";
            }
        } else {
            return "translate(0,0)";
        }
        return "translate(" + d.x + "," + d.y + ")";
    }
    

    function getCentroid(selection) {
        var element = selection.node(),
            bbox = element.getBBox();
        return [bbox.x + bbox.width / 2, bbox.y + bbox.height / 2];
    }


    if (graphstate === "GANTT") {
        var k = 20 * e.alpha;
        var today = new Date();
        var missingcounter = 0;
        nodes.forEach(function (d, i) {

            if ((d.start === 0 || d.end === 0) ){
                d.x = 450 + missingcounter * 100;
                d.y = window.innerWidth / 2;
                if (missingcounter >= 6) {
                    d.x = 450 + (missingcounter - 6) * 100;
                    d.y = window.innerWidth / 2 + 50;
                }
                missingcounter++;
            } else {
                //var min= 150+graphinterval*Math.ceil(Math.abs(d.start.getTime() - today.getTime()) / (1000 * 3600 * 24)) - $('.gantbox').scrollLeft();
                //var max= 150+graphinterval*Math.ceil(Math.abs(d.end.getTime() - d.start.getTime()) / (1000 * 3600 * 24)) - $('.gantbox').scrollLeft();
                //d.x = min+Math.sin(today.getTime()/1000*Math.PI*2/10)*max;
                d.x = 150 + graphinterval * Math.ceil(Math.abs(d.start.getTime() - today.getTime()) / (1000 * 3600 * 24)) - $('#gantbox').scrollLeft();
                d.y = 150 + d.start.getHours() * 17;
            }
            if(d.state==="chosen"){
              scrollValue=d.x;
            }

        });
    } else {
      /*nodes.forEach(function (d, i) {
          if(d.state==="chosen"){
          d.x=window.innerWidth/2;
          d.y=window.innerHeight/2;
        }
        });*/



        var k = 15 * e.alpha;
        links.forEach(function (d, i) {
            d.source.x -= k;
            d.target.x += k;
            d.source.y -= k / 3;
            d.target.y += k / 3;
        });
    }


    if (boxedin) {
        circle.attr("cx", function (d) {
                return d.x = Math.max(14, Math.min(w - 14, d.x));
            })
            .attr("cy", function (d) {
                return d.y = Math.max(114, Math.min(h - 14, d.y));
            });

        nodetext.attr("transform", transform);
    } else {
        node.attr("transform", transform);
    }


    link.attr("d", function (d) {

        if (graphstate === "GRAPH") {
            var dx = d.target.x - d.source.x,
                dy = d.target.y - d.source.y,
                dr = Math.sqrt(dx * dx + dy * dy);
            return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
        } else if (graphstate === "GANTT") {
          if(d.state=== "enter" || d.state=== "exit"){
            var dx = d.target.x - d.source.x,
            dy = d.target.y - d.source.y,
            dr = Math.sqrt(dx * dx + dy * dy)*5;
            return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
            }else{

            return "M" + 0 + "," + 0 + "A" + dr + "," + dr + " 0 0,1 " + 0 + "," + 0;
            }
        }

    });


    linktext.attr("transform", function (d) {
        if (graphstate === "GRAPH") {
            return "translate(" + (d.source.x + d.target.x) / 2 + "," + (d.source.y + d.target.y) / 2 + ")";
        } else {
            return "translate(0,0)";
        }
    });

}


function deliverableTest() {
    for (var i = 0; i < 140; i++) {
        var end = randomDate(new Date(), new Date("01-01-2018"));
        var start = randomDate(new Date(), end);
        graph.addNodeComplete("Task " + i, "deliverable", "perm", start, end);
    }

    for (var i = 0; i < 140; i++) {
        var endindex = Math.floor(Math.random() * i);
        var startindex = Math.floor(Math.random() * i);
        if(nodes[endindex].start>nodes[startindex].start){
          graph.addLink("Task " + startindex, "Task " + endindex, " ", "perm");
        }else{
          graph.addLink("Task " + endindex, "Task " + startindex, " ", "perm");
        }
    }

    function randomDate(start, end) {
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    }
}




function zoom() {
    //vis.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}


function showInfo(d, i) {

    graph.highlightNode(d.id,null);

    if (d.type === "deliverable") {
        $('.info').html('<form id="editbox"><label>description:</label><input id="editdescription"/><label>URL:</label><input id="editurl"/><label>Start date:</label><input id="editstartdate"/><label>End date:</label><input id="editenddate"/><button>Save</button></form><div id="deletenode"><button>Delete</button></div>');
    } else {
        $('.info').html('<form id="editbox"><label>description:</label><input id="editdescription"/><label>URL:</label><input id="editurl"/><button>Save</button></form><div id="deletenode"><button>Delete</button></div>');


    }
    $("#editenddate").datepicker({
        inline: true,
        showOtherMonths: true,
        dayNamesMin: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    });

    $("#editstartdate").datepicker({
        inline: true,
        showOtherMonths: true,
        dayNamesMin: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    });

    $('#editdescription').val(d.type);

    $('#editurl').val('www.' + d.id + '.com');

    if (d.type === "deliverable") {
        $('#editstartdate').val(d.start);
        $('#editenddate').val(d.end);
    }

    $("#editbox").submit(function () {
        if (d.type === "deliverable") graph.editDates(d.id, null, new Date($("#editstartdate").val()), new Date($("#editenddate").val()));
        return false;
    });

    $("#deletenode").click(function () {
        if (confirm('This node and all its connections will be deleted, are you sure?')) {
            graph.removeNode(d.id, null);
        }
    });
}

function mousedown() {
    $('.editinfo').css('top', -100);
    $('.editinfo').css('left', 0);
    $('.editlinkinfo').css('top', -100);
    $('.editlinkinfo').css('left', 0);
    d3.event.stopPropagation();
    graph.removeHighlight();
}

function AddedUnique(newnode) {
    truth = true;
    for (var p = 0; p < addednodes.length; p++) {
        if (addednodes[p] === newnode) {
            truth = false;
        }
    }
    return truth;
}



function editNode(d, i) {
    var oldname = d.id;
    $('.editinfo').css('top', d.y - 12);
    $('.editinfo').css('left', d.x + 18);
    $('#editname').val(oldname);

    $('#editform').submit(function () {
        if (AddedUnique($('#editname').val())) {
            $('.editinfo').css('top', -100);
            $('.editinfo').css('left', 0);
            graph.editName(oldname, "whatever", $('#editname').val());
            var index = addednodes.indexOf(oldname);
            addednodes[index] = $('#editname').val();
            console.log(addednodes[index]);
        } else {
            var choice = $('#editname').val();
            $('#editname').val(choice + "(2)");
        }
        return false;
    });

}

function editLink(d, i) {
    var dx = (d.source.x + d.target.x) / 2;
    var dy = (d.source.y + d.target.y) / 2;
    var oldname = d.name;
    $('.editlinkinfo').css('top', dy - 17);
    $('.editlinkinfo').css('left', dx - 18);
    $('#editlinkname').val(oldname);

    $('#editlinkform').submit(function () {
        graph.editLink(d.source.id, d.target.id, $('#editlinkname').val());
        $('.editlinkinfo').css('top', -100);
        $('.editlinkinfo').css('left', 0);
        return false;
    });

}


function customColor(type) {
    var color;
    switch (type) {
    case "person":
        color = '#FCB924';
        break;
    case "project":
        color = '#009DDC';
        break;
    case "skill":
        color = '#62BB47';
        break;
    case "deliverable":
        color = '#E03A3E';
        break;
    case "objective":
        color = '#933E99';
        break;
    case "empty":
        color = "#080808";
        break;
    case 6:
        color = "#fff";
        break;
    }
    return color;
}

function customSize(type) {
    var size;
    switch (type) {
    case "person":
        size = 12;
        break;
    case "project":
        size = 12;
        break;
    case "skill":
        size = 12;
        break;
    case "deliverable":
        size = 12;
        break;
    case "objective":
        size = 12;
        break;
    case "empty":
        size = 9;
        break;
    case 6:
        size = 0x30334C;
        break;
    }
    return size;
}