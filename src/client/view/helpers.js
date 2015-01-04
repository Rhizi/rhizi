"use strict"

define(function() {
function customColor(type) {
    var color;
    switch (type) {
        case "person":
            color = '#FCB924'; //blue
            break;
        case "club":
            color = '#ee3654'; //magenta
            break;
        case "skill":
            color = '#fad900'; //yellow
            break;
        case "third-internship-proposal":
            color = '#33c2e0'; //cyan
            break;
        case "internship":
            color = '#ff8b11'; //orange
            break;
        case "interest":
            color = '#8b3ab0'; //purple
            break;
        case "project":
            color = "#40C200"; //green
            break;
        case "empty":
            color = "#919095"; //mid-grey
            break;
        case "chainlink":
            color = "#363636"; //dark-grey
            break;
        default:
            console.log('bug: unknown type ' + type);
            color = '#d4d4d9'; //mid-light grey
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
        case "club":
            size = 12;
            break;
        case "skill":
            size = 12;
            break;
        case "third-internship-proposal":
            size = 12;
            break;
        case "internship":
            size = 12;
            break;
        case "interest":
            size = 12;
            break;
        case "empty":
            size = 9;
            break;
        case "chainlink":
            size = 8;
            break;
        default:
            size = 9;
            break;
    }
    return size;
}


return {
    customSize: customSize,
    customColor: customColor,
};
});
