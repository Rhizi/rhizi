
function checkSwitch(checkswitch) {



    if (checkswitch.checked) {

        $('#gantbox').fadeOut(300);
        $('.missingdates').fadeOut(300);
        graphstate = "GRAPH";
        var fake_e = {};
    	fake_e.alpha = 0.1;
    	tick(fake_e);

        //boxedin=false;

    } else {
        $('#gantbox').fadeIn(300);
        $('.missingdates').fadeIn(300);
        graphstate = "GANTT";
        var fake_e = {};
    	fake_e.alpha = 0.1;
    	tick(fake_e);


        initAxis();

        $('#gantbox').scrollLeft(scrollValue);
        //boxedin=true;
    }

    




}


$('#gantbox').scroll(function () {
	scrollValue=$('#gantbox').scrollLeft();
	$('.debug').html(scrollValue);
    var fake_e = {};
    fake_e.alpha = 0.0;
    tick(fake_e);
});




function initAxis() {

    $('#gantbox').html("");


    var w,h = $("#gantbox").innerHeight() - 80;

    var bar_height = 20;
    var row_height = bar_height + 10;
    var vertical_padding = 150
    var bar_start_offset = 40;
    var h = 15 * row_height + vertical_padding;

   
    var min = deliverables[0].startdate;
    var max = deliverables[0].enddate;

    for (var i = 0; i < deliverables.length; i++) {
        var deliv = deliverables[i];
        if (min > deliv.startdate) min = deliv.startdate;
        if (end < deliv.enddate) end = deliv.enddate;
    }
    min = new Date(); ///with min
    max = new Date(max);
    console.log("min "+min+" max "+max);

    ///update interval
    var timeDiff = Math.abs(max.getTime() - min.getTime());
    var diffDays = timeDiff / (1000 * 3600 * 24);
    w=Math.round(diffDays*15-100);
    graphinterval = w / diffDays;


    var svg = d3.select("#gantbox")
        .append("svg")
        .attr("width", w)
        .attr("height", h);

    var paddingLeft = 150;
    var paddingTop = 120;

    var xScale = d3.time.scale()
        .domain([min, max]).nice()
        .range([paddingLeft, w]);

    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient("bottom");

    // Lines
    var line = svg.append("g")
        .selectAll("line")
        .data(xScale.ticks(40))
        .enter().append("line")
        .attr("x1", xScale)
        .attr("x2", xScale)
        .attr("y1", paddingTop + 30)
        .attr("y2", h - 50)
        .style("stroke", "#ccc");

    var y = function (i) {
        return i * row_height + paddingTop + bar_start_offset;
    }

    labelY = function (i) {
        return i * row_height + paddingTop + bar_start_offset + 13;
    }

    // Company bars
    var bar = svg.selectAll("rect")
        .data(function (d) {
            return Math.random() * 5;
        });

    bar.enter().append("rect")
        .attr("y", -100)
        .attr("x", -1000)
        .attr("width", 100)
        .attr("height", bar_height)
        .attr("class", "company-bar")
        .on("mouseover", function (d) {
            d3.select(this).style("fill", "#F5AF00");
            getCompanyData(String(d.uid))
        })
        .on("mouseout", function () {
            d3.select(this).style("fill", "#fc0");
        });



    var label = svg.selectAll("text")
        .data(deliverables, function (key) {
            return key.id
        });;

    label.enter().append("text")
        .attr("class", "bar-label")
        // .attr("text-anchor","end")
        .attr("x", paddingLeft - 10)
        .attr("y", function (d, i) {
            return labelY(i);
        })
        .text(function (d) {
            d.id
        });



    // Bottom Axis
    var btmAxis = svg.append("g")
        .attr("transform", "translate(0," + (h - 25) + ")")
        .attr("class", "axis")
        .call(xAxis);

    // Top Axis
    var topAxis = svg.append("g")
        .attr("transform", "translate(0," + paddingTop + ")")
        .attr("class", "axis")
        .call(xAxis);

}