define(['jquery'], function($) {

var sentence="";
/*sentence+=" #Rhizibot is showing you a #tutorial|";
sentence+="#Rhizi visualizes data with #Graphs and #relationships|";
sentence+="#links and #nodes have #context and #meaning|";

sentence+="#entities and #concepts are #nodes|";
sentence+="We built this entire graph in 30 seconds, try it out yourself!";*/

sentence+='##Rhizi is a tool for creating interactive #Networks|';
sentence+='Create #Networks by writing #Sentences|';
sentence+='like a #Tweet you can put a #Hashtag in your #Sentences|';
sentence+='#Hello|';
sentence+='#John|';
sentence+='Put your text between #Commas to use #"Multiple words"|';
sentence+='#"John Smith"|';
sentence+='#"Beauty and the beast"|';
sentence+='Use the word #And to #"Connect multiple things together"|';
sentence+='#John likes #Apples and #Oranges and #Pistachio|';
//sentence+='Choose the #"node type" by using the #"TAB key"|';
sentence+='#Click on any #Node to change and modify it|';
sentence+='#Play around and have #Fun!|';

var robot = function (element, sentence) {
    var r = {
        speed: 1,
        counter: 0,
        sentence: sentence,
        sentencecounter: 0,
        element: element || $('#textanalyser')};
    r.next_event = function () {
        if(r.counter <= r.sentence.length) {
            var text = r.element.val();
            r.counter++;
            if (r.sentence.charAt(r.counter) !== "|") {
                r.element.val(text + r.sentence.charAt(r.counter));
                if ('oninput' in document.documentElement) {
                    r.element.trigger('input', {});
                }
                //if(Math.random()>0.9)graph.editType("x","temp",nodetypes[Math.round(Math.random()*4)]);
                if (r.sentence.charAt(r.counter)==="#") {
                  r.sentencecounter++;
                  r.timeout_id = window.setTimeout( r.next_event, 30/r.speed+Math.random()*160/r.speed );
                } else {
                  r.timeout_id = window.setTimeout( r.next_event, 50/r.speed+Math.round(Math.random()*100/r.speed) );
                }
            } else {
                var e = jQuery.Event("keypress");
                e.which = 13;
                e.keyCode = 13;
                $("#textanalyser").trigger(e);
                window.setTimeout( r.next_event, 650/r.speed );
            }
        } else {
            window.clearInterval(r.timeout_id);
        }
    }
    return r;
}

$('.logo').click(function(){
    setTimeout( robot(undefined, sentence).next_event, 1000 );
});

/*var answer = confirm ("Would you like a tutorial?")
if (answer)
setTimeout( Robot, 100 );*/

}); // define
