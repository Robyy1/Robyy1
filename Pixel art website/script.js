let container = document.querySelector(".container");
let gridButton = document.getElementById("submit-grid");
let clearGridButton = document.getElementById("clear-grid");
let gridWidth = document.getElementById("width-range");
let gridHeight = document.getElementById("height-range");
let eraseBtn= document.getElementById("submit-grid");
let paintBtn = document.getElementById("submit-grid");
let widthValue = document.getElementById("width-value");
let heightValue = document.getElementById("height-value");

let events = {
    mouse: {
        down: "mousedown",
        move: "mousemove",
        up: "mouseup"
    },
    touch: {
        down: "touhstart",
        move: "touchmove",
        up: "touchend"
    }
};

let deviceType = "";

let draw = false;
let erase = false;

const isTouchDevice = () =>{
    try{
        document.createEvent("TouchEvent");
        deviceType = "touch";
        return true;
    } catch (e){
        deviceType = "mouse";
        return false;
    }
};

isTouchDevice();

gridButton.addEventListener("click", )