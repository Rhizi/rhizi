"use strict"

var typeindex = 0;
var nodetypes = ["person", "project", "skill", "deliverable", "objective"];
var suggestionChange=false;
var sentenceStack = [];
var typeStack = [];

var ExecutionStack = [];

var lastnode;

var sugg = {}; // suggestions for autocompletion of node names

var ANALYSIS_NODE_START = 'ANALYSIS_NODE_START';
var ANALYSIS_LINK = 'ANALYSIS_LINK';

function autoSuggestAddName(name)
{
    /* note that name can contain spaces - this is ok. We might want to limit this though? */
    if(name.split(" ").length > 1) {
        sugg['"' + name + '"'] = 1;
    } else {
        sugg[name] = 1;
    }
}

function autocompleteCallback(request, response_callback)
{
    var ret = [];
    if (request.term === "" || request.term) {
        for (var name in sugg) {
            if (name.indexOf(request.term) == 0) {
                ret.push(name);
            }
        }
    }
    response_callback(ret);
}

/*
 * textAnalyser2
 *
 * Input:
 *  @newtext - new sentence
 *  @finalize - is this an intermediate editing state or are we editing the graph
 *
 * Output:
 *  none
 *
 * Side effect:
 *  updating graph (global)
 *
 * Implementation notes:
 *  There is no well defined grammer. The translation goes from obvious to not
 *  so much for more complex sentences involving more then two nodes (two '#'
 *  marks).
 *
 */
var textAnalyser2 = function (newtext, finalize) {
    var segment = [],
        subsegment = [],
        sentence = [];
    var newlinks = [];
    var newnodes = [];
    var linkindex = 0;
    var nodeindex = 0;
    var orderStack = [];
    var quoteword = "";
    var ANDcase = false;
    var ANDcount = 0;
    var prefix = "";
    var ret = {'nodes': [], 'links': []};
    var m;
    var word;
    var completeSentence;
    var typesetter, abnormalGraph;
    var verb;
    var l, n, j;
    var link_hash = {};
    var yell_bug = false; // TODO: fix both issues

    function addNode(id, type, state) {
        ret.nodes.push({'id':id, 'type':type, 'state':state});
    }
    function addLink(src, dst, name, state) {
        if (!src || !dst) {
            if (yell_bug) {
                console.log('bug - adding link (' + src + ', ' + dst + ')');
            }
            return;
        }
        if (link_hash[src] && link_hash[src][dst]) {
            if (yell_bug) {
                console.log('bug - adding link twice (' + src + ', ' + dst + ')');
            }
            return;
        }
        if (!link_hash[src]) {
            link_hash[src] = {};
        }
        link_hash[src][dst] = 1;
        ret.links.push({'sourceId':src, 'targetId':dst, 'name':name ? name.trim() : "", 'state':state});
    }

    //Sentence Sequencing
    //Build the words and cuts the main elements
    segment = newtext.split("#");
    for (j = 0; j < segment.length; j++) {
        if (j !== 0) sentence.push("#");
        subsegment = segment[j].split(" ");
        if (subsegment.length === 0) {
            sentence.push(" ");
        }
        for (var k = 0; k < subsegment.length; k++) {
            if (subsegment[k] !== " " && subsegment[k] !== "") {
                if (subsegment[k].charAt(0) === '"') {
                    quoteword = "";
                    do {
                        quoteword += subsegment[k] + " ";
                        if(subsegment[k].charAt(subsegment[k].length-1) !== '"')k++;
                    } while (k < subsegment.length && subsegment[k].charAt(subsegment[k].length - 1) !== '"');
                     if(subsegment[k])if(subsegment[k]!==quoteword.replace(/ /g, ""))quoteword += subsegment[k];
                    sentence.push(quoteword.replace(/"/g, ""));
                } else {
                    sentence.push(subsegment[k]);
                }
            }
        }
    }

    //BUILD NEW NODE AND LINK ARRAYS WITH ORDER OF APPEARENCE
    for (m = 0; m < sentence.length; m++) {
        switch (sentence[m]) {
        case "#":
            orderStack.push("START");
            break;
        case "and":
        case "+":
        case ",":
        case "&":
            sentence[m]=" and ";
            ANDcount++;
            //orderStack.push("AND");
        default:
            if (orderStack[orderStack.length - 1] === "START") {
                orderStack.push("NODE");
                newnodes.push(sentence[m]);
                linkindex++;
            } else if (orderStack[orderStack.length - 1] === "NODE") {
                orderStack.push("LINK");
                if (!newlinks[linkindex]) {
                    newlinks[linkindex] = sentence[m] + " ";
                } else {
                    newlinks[linkindex] += sentence[m] + " ";
                }
            } else {
                if (!newlinks[linkindex]) {
                    newlinks[linkindex] = sentence[m] + " ";
                } else {
                    newlinks[linkindex] += sentence[m] + " ";
                }
            }
            if (newnodes.length === 0) {
                prefix += (prefix.length > 0 ? ' ' : '') + sentence[m];
            }
            break;
        }
    }

    //PREFIX not null case - put complete sentence in first link.
    if (prefix) {
        newlinks[1] = prefix + " " + newnodes[0] +
        (newlinks[1] !== undefined || newnodes[1] !== undefined ?
        " " : "")
        + (newlinks[1] !== undefined ? newlinks[1] : "")
        + (newnodes[1] !== undefined ? newnodes[1] : "");
    }

    //WRITE COMPLETE SENTENCE
    linkindex = 0;
    nodeindex = 0;
    word = "";
    completeSentence = prefix.length > 0 ? String(prefix) + " " : "";
    for (m = 0; m < orderStack.length; m++) {
        if (orderStack[m] === "NODE") {
            word += " (" + newnodes[nodeindex] + ") ";
            if(newnodes[nodeindex].split(" ").length>1){
                completeSentence += '"'+newnodes[nodeindex]+'"' + " ";
            }else{
                completeSentence += newnodes[nodeindex] + " ";
            }
            nodeindex++;
        } else if (orderStack[m] === "LINK") {
            linkindex++;
            word += " -->" + newlinks[linkindex] + " --> ";
            completeSentence += newlinks[linkindex];
        }
    }

    //REBUILD GRAPH
    linkindex = 0;
    nodeindex = 0;

    //CHANGE TO PERMANENT STATE AND UPDATE SUGGESTIONLIST
    typesetter = "";
    if (finalize === true) {
        typesetter = "perm";
        for (var n = 0; n < newnodes.length; n++) {
            autoSuggestAddName(newnodes[n]);
        }
    } else {
        typesetter = "temp";
    }

    //ADD SURROUNDING BUBBLE
    if (orderStack.length > 0) {
        addNode("", "bubble","temp");
    }

    abnormalGraph = (newlinks.length - ANDcount) >= 3;

    //0-N ORDER STACK
    for (m = 0; m < orderStack.length - 1; m++) {
        switch (orderStack[m]) {
            case "START":
                if (!typeStack[nodeindex]) {
                    typeStack[nodeindex] = nodetypes[typeindex];
                }
                break;
            case "NODE":
                addNode(newnodes[nodeindex], typeStack[nodeindex], typesetter);
                if (!abnormalGraph) {
                    addLink(newnodes[nodeindex - 1], newnodes[nodeindex],
                            newlinks[linkindex], typesetter);
                }
                nodeindex++;
                break;
            case "LINK":
                linkindex++;
                break;
        }
    }

    //FINAL N ORDER
    switch (orderStack[orderStack.length - 1]) {
        case "START":
            typeStack[nodeindex]=nodetypes[typeindex];
            addNode("new node", typeStack[nodeindex], "temp");
            if (!abnormalGraph) {
                addLink(newnodes[nodeindex - 1], "new node", newlinks[linkindex], "temp");
                ANDconnect("new node");
            }
            ret.state = ANALYSIS_NODE_START;
            break;
        case "NODE":
            typeStack[nodeindex]=nodetypes[typeindex];
            addNode(newnodes[nodeindex], typeStack[nodeindex], typesetter);
            if (!abnormalGraph) {
                addLink(newnodes[nodeindex - 1], newnodes[nodeindex], newlinks[linkindex], typesetter);
                ANDconnect(newnodes[nodeindex]);
            }
            break;
        case "LINK":
            linkindex++;
            addNode("new node", "empty", "temp");
            if (!abnormalGraph) {
                addLink(newnodes[nodeindex - 1], "new node", newlinks[linkindex], "temp");
                ANDconnect("new node");
            }
            ret.state = ANALYSIS_LINK;
            break;
    }

    //EXTERNAL AND CONNECTION CHECKING
    verb = "";
    function ANDconnect(node) {
          for(var x=0;x<newlinks.length;x++){
            if(newlinks[x])if(newlinks[x].replace(/ /g,"")!=="and"){
                verb=newlinks[x];
                for(var y=0; y<x ;y++){
                    addLink(newnodes[y], node, verb, typesetter);
                    for(var z=x; z<newnodes.length ;z++){
                        addLink(newnodes[y], newnodes[z], verb, typesetter);
                    }
                }
                
            }
        }
    }

    /*console.log(sentence);
    console.log(completeSentence);
    console.log(orderStack);*/

    //STAR CASE
    verb = "";
    if (abnormalGraph) {
        for (l = 1; l < newlinks.length; l++) {
            if (newlinks[l])
                if (newlinks[l].replace(/ /g, "") !== "and") {
                    verb = newlinks[l];
                }
        }
        addNode(completeSentence, "chainlink", typesetter);
        for (n = 0; n < newnodes.length; n++) {
            addLink(newnodes[n], completeSentence, "", typesetter);
        }
    }

    ret.drop_conjugator_links = ANDcount < linkindex;

    //FOR THE EXTERNAL ARROW-TYPE CHANGER
    lastnode = newnodes[nodeindex];

    ret.applyToGraph = function(graph) {
        window.ret = ret;
        var comp = graph.compareSubset('temp', ret.nodes.filter(
            function(node) {
                return !graph.hasNode(node.id, "perm");
            }).map(function (node) {
                return node.id;
            }), ret.links.map(
            function (link) {
                return [link.sourceId.toLowerCase(), link.targetId.toLowerCase()];
            }
        ));
        var k, n;
        if (comp.graph_same && !finalize) {
            if (comp.old_id && comp.new_id) {
                graph.editName(comp.old_id, null, comp.new_id);
            }
        } else {
            //REINITIALISE GRAPH (DUMB BUT IT WORKS)
            graph.removeNodes("temp");
            graph.removeLinks("temp");
            for (k in ret.nodes) {
                n = ret.nodes[k];
                graph.addNode(n.id, n.type, n.state);
            }
            for (k in ret.links) {
                var l = ret.links[k];
                graph.addLink(l.sourceId, l.targetId, l.name, l.state, ret.drop_conjugator_links);
            }
        }
        //UPDATE GRAPH ONCE
        graph.update(!finalize && comp.graph_same);
    }

    return ret;
}
