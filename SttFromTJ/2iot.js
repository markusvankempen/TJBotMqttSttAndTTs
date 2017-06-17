/*********************************************************************

markus van Kempen - mvk@ca.ibm.com

Sends mqtt message to IoT and Waits for commands to controls the 
TJ servo motor and led 

version 20170613 
Note: Stand alone MQTT control no need for Conversion of TJBot Lib
**********************************************************************/
var iotf = require("./");
var config = require("./device.json");
//var ws281x = require('rpi-ws281x-native');
var rpiDhtSensor = require('rpi-dht-sensor');
var exec = require('child_process').exec;
const TJBot = require('tjbot');

var sttconfig = require('./config');

// obtain our credentials from config.js
var credentials = sttconfig.credentials;

// these are the hardware capabilities that our TJ needs for this recipe
var hardware = ['led', 'microphone', 'speaker', 'servo'];

// these are the hardware capabilities that our TJ needs for this recipe
//var hardware = ['led', 'microphone', 'speaker'];
var newHOTWORD = "TJ";
// set up TJBot's configuration
var tjConfig = {
    log: {
        level: 'verbose'
    },
  robot: {
        gender: 'male',
        name: newHOTWORD
    },
    listen: {
        language: 'en-US'
    },
    speak: {
        language: 'en-US'
    }

};

// instantiate our TJBot!
var tj = new TJBot(hardware, tjConfig, credentials);

// full list of colors that TJ recognizes, e.g. ['red', 'green', 'blue']
var tjColors = tj.shineColors();



/***********************************************************************
* Setup
***********************************************************************/

//var dht = new rpiDhtSensor.DHT11(4);
var dht = new rpiDhtSensor.DHT22(4);
var readout = dht.read();
var NUM_LEDS = 1;        // Number of LEDs
//ws281x.init(NUM_LEDS);   // initialize LEDs 
//var color = new Uint32Array(NUM_LEDS); 
//ws281x.render(color);
//var tjled   = new TJBot(['led'], {log: {level: 'debug'}}, {});
//var tjservo = new TJBot(['servo'], {log: {level: 'debug'}}, {});


//var mincycle = 500; var maxcycle = 2300 ;
//var dutycycle = mincycle;

// Init board, setup software PWM on pin 26.
//var Gpio = require('pigpio').Gpio;
//var motor = new Gpio(7, {mode: Gpio.OUTPUT});

var deviceClient = new iotf.IotfDevice(config);

// none fancy sleep function
function sleep( sleepDuration ){
    var now = new Date().getTime();
    while(new Date().getTime() < now + sleepDuration){ /* do nothing */ } 
}

//setting the log level to trace. By default its 'warn'
deviceClient.log.setLevel('debug');

console.log("TJBot WIOT controler program");

console.log('Wave check and Led on');
setLED("on");
tj.raiseArm();
tj.wave();
readout = dht.read();
console.log('Temperature: ' + readout.temperature.toFixed(2) + 'C, ' +
        'humidity: ' + readout.humidity.toFixed(2) + '%');

deviceClient.connect();

deviceClient.on('connect', function(){ 
    var i=0;

    console.log("connected");
    setInterval(function function_name () {
	readout = dht.read();
	mystr = ',"temperature":' +readout.temperature.toFixed(2)+', "humidity": ' + readout.humidity.toFixed(2);
    	i++;
    	deviceClient.publish('dht', 'json', '{"value":'+i+mystr+'}', 2);
    },5000);
});

deviceClient.on('reconnect', function(){ 
	console.log("Reconnected!!!");
});

deviceClient.on('disconnect', function(){
  console.log('Disconnected from IoTF');
});

deviceClient.on('error', function (argument) {
	console.log(argument);
});



deviceClient.on("command", function (commandName,format,payload,topic) {
   
console.log("Command:", commandName);
console.log("payload = "+JSON.parse(payload));
myjson = JSON.parse(payload);
//console.log("payload = "+JSON.stringify(payload));

   if(commandName === "armFORWARD") {
      console.log("armForward = 2000");    
 //     motor.servoWrite(2000); //open
 	tj.lowerArm();
    } else if(commandName === "armUP") {
      console.log("armUP = 1000 ");
//      motor.servoWrite(1000); //open
	tj.raiseArm();


    } else if(commandName === "armBACK") {
   console.log("armBACK = 500") ;  
   // motor.servoWrite(500); //open
	 tj.armBack();
    } else if(commandName === "armMOVE") {
        console.log("armMove");
        console.log("armMove value = "+myjson.d.motorSpin);
        //motor.servoWrite(myjson.d.motorSpin); //open

    } else if(commandName === "armWAVE") {
     console.log("armWave");
tj.wave();
/*
     motor.servoWrite(1200);
     sleep(300)
     motor.servoWrite(2000);
     sleep(400);
     motor.servoWrite(1200);
     sleep(300)
     motor.servoWrite(2000);
     sleep(400);
     motor.servoWrite(1200);
*/

}else if( commandName === "tjSPEAK") {
          tj.speak(myjson.d.words);
}else if( commandName === "tjHOTWORD") {
	  console.log("Setting HOTWORD to >>> "+ myjson.d.hotword)
           newHOTWORD = myjson.d.hotword;		
	   tjConfig.robot.name = myjson.d.hotword;	
           tj = new TJBot(hardware, tjConfig, credentials);

}else if( commandName === "ledON") {
          setLED("on");
}else if( commandName === "ledOFF") {
          setLED("off");
}else if( commandName === "ledRED") {
          setLED("red");
}else if( commandName === "ledGREEN") {
          setLED("green");
}else if( commandName === "ledBLUE") {
          setLED("blue");
}else if( commandName === "ledSET") {
  console.log("Set LED to  (GGRRBB) = "+myjson.d.color +" value = "+myjson.d.value);
          setLED("led",myjson.d.color,myjson.d.value);
}else {
          console.log("Command not supported.. " + commandName);
    }
});

var a=0;
tj.listen(function(msg) {
// listen for hotword
//    if (msg.startsWith(tj.configuration.robot.name))

  mystr = ',"words": "' + msg +'", "botname": "' + tj.configuration.robot.name +'"'
        a++;
        deviceClient.publish('tjlisten', 'json', '{"counter":'+a+mystr+'}', 2);
  if(a >25)
  {
    tjConfig.robot.name = newHOTWORD;

	// maybe time to reinitialise
    tj = new TJBot(hardware, tjConfig, credentials);


  }	
})

function setLED(value,mycolor,myvalue) {
    if (value == "on") {
	tj.shine('white');
    //    color[0] = 0xffffff ;
    } else if (value == "blue"){
	tj.shine('blue');
       // color[0] = 0x0000ff ;
    } else if (value == "red"){
	tj.shine('red');
        //color[0] = 0x00ff00 ;
    } else if (value == "green"){
	tj.shine('green');
       // color[0] = 0xff0000 ;
    } else if (value == "led"){
	tj.shine(myvalue);      
 // color[0] = mycolor ;
    }else {
	tj.shine('off');
        //color[0] = 0x000000 ;
    }
   // ws281x.render(color);
}


