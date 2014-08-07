var sentence="";
/*sentence+=" #Rhizibot is showing you a #tutorial|";
sentence+="#Rhizi visualizes data with #Graphs and #relationships|";
sentence+="#links and #nodes have #context and #meaning|";

sentence+="#entities and #concepts are #nodes|";
sentence+="We built this entire graph in 30 seconds, try it out yourself!";*/



sentence+='Hi, Rhizibot here! Let me show you how to create networks|';
sentence+='#Rhizi is really fast at generating #Graphs|';
sentence+='Use the "#" hashtag to before writing to create a node|';
sentence+='#Hello|';
sentence+='#John|';
sentence+='Use commas if what you want to write has multiple words|';
sentence+='#"John Smith"|';
sentence+='#"Beauty and the beast"|';
sentence+='Nodes can be connected using words|';
sentence+='#John is a friend of #Tim|';
sentence+='#"Beauty and the beast" is film by #Disney|';
sentence+='Use "and" to connect multiple things together|';
sentence+='#John likes #Apples and #Oranges and #Pistachio|';
sentence+='You can choose the node type by using right arrow or left arrow|';
sentence+='#Rhizi is useful for #"Mapping ideas" and "#"Creating info graphics" and #"Organising knowledge"|';

var counter=0;
var sentencecounter=0;
var robot;
var speed=1;
$('.logo').click(function(){

setTimeout( Robot, 1000 );


});

/*var answer = confirm ("Would you like a tutorial?")
if (answer)
setTimeout( Robot, 100 );*/




function Robot(){
    
      
    if(counter<=sentence.length){
      var text=$('#textanalyser').val();
         counter++;
      if(sentence.charAt(counter)!=="|"){
      $('#textanalyser').val(text+sentence.charAt(counter));
        //if(Math.random()>0.9)graph.editType("x","temp",nodetypes[Math.round(Math.random()*4)]);

        if(sentence.charAt(counter)==="#"){
          sentencecounter++;
          window.setTimeout( Robot, 30/speed+Math.random()*160/speed );
        }else{
          window.setTimeout( Robot, 50/speed+Math.round(Math.random()*100/speed) );
        }
    }else{
      var e = jQuery.Event("keypress");
      e.which = 13; 
      e.keyCode = 13;
      $("#textanalyser").trigger(e);
          window.setTimeout( Robot, 650/speed );
    }
    }else{
        window.clearInterval(robot);
    }
    

      
 
}




