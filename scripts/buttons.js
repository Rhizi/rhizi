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

$('#textanalyser').submit(function(){return false;});
$('.tutorial').click(function(){});





