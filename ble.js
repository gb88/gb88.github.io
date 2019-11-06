/*
A minimal Web Bluetooth connection example

created 6 Aug 2018
by Tom Igoe
*/
var myDevice;
var myService = "65333333-a115-11e2-9e9a-0800200ca100"; // fill in a service you're looking for here
var myCharacteristic = "65333333-a115-11e2-9e9a-0800200ca102"; // fill in a characteristic from the service here
var state = 0;
var characteristic_obj;
var event_num;
var event_cnt;
var total_evt;
var asked_evt = false;
var asked_evt_num;
var progressive;
var timer;
var stop;
var myChart;

var config = {
	type: 'line',
	data: {
		labels: [],
		datasets: [{
			label: 'Ig',
			backgroundColor: "#ff8000",
			borderColor: "#ff8000",
			data: [

			],
			fill: false,
		}]
	},
	options: {
		responsive: true,
		title: {
			display: true,
			text: 'Ground Current(A)'
		},
		tooltips: {
			mode: 'index',
			intersect: false,
		},
		hover: {
			mode: 'nearest',
			intersect: true
		},
		scales: {
			xAxes: [{
				display: true,
				scaleLabel: {
					display: true,
					labelString: 'Date & Time'
				}
			}],
			yAxes: [{
				display: true,
				scaleLabel: {
					display: true,
					labelString: 'Value'
				}
			}]
		}
	}
};



			
		
function connect() {
    navigator.bluetooth.requestDevice({
            // filters: [myFilters]       // you can't use filters and acceptAllDevices together
            optionalServices: [myService],
            acceptAllDevices: true
        })
        .then(function(device) {
            // save the device returned so you can disconnect later:
            myDevice = device;
            console.log(device);
            // connect to the device once you find it:
            return device.gatt.connect();
        })
        .then(function(server) {
            // get the primary service:
            return server.getPrimaryService(myService);
        })
        .then(function(service) {
            // get the  characteristic:
            console.log(service.getCharacteristics())
            return service.getCharacteristics();
        })
        .then(function(characteristics) {
            // subscribe to the characteristic:
            for (c in characteristics) {
                console.log(characteristics[c].uuid)
                if (myCharacteristic == characteristics[c].uuid) {
                    characteristic_obj = characteristics[c];
                    characteristics[c].startNotifications()
                        .then(subscribeToChanges);
                    return characteristics[c];
                }
            }
        })
        .then(function(characteristic) {
			  stop = 0;
			  			var ctx = document.getElementById('canvas').getContext('2d');
			myChart = new Chart(ctx, config);
			  timer = setInterval(interval_timer, 1 * 1000);
            /*console.log(characteristic)
            var buffer = new Uint8Array(3);
            buffer[0] = 0xA2; //event count cmd
            buffer[1] = 0x00;
            buffer[2] = 0x05; //wait for 3 byte
            state = 1;
            console.log(buffer)
            characteristic.writeValue(buffer);*/
        })
        .catch(function(error) {
            // catch any errors:
            console.error('Connection failed!', error);
        });
}
function stop_timer()
{
	stop = 1;
	clearInterval(timer);
}
function interval_timer()
{
	 console.log("interval_timer");
	 //Richiesta act
	 var buffer = new Uint8Array(3);
	buffer[0] = 0xA2; //event count cmd
	buffer[1] = 0x00;
	buffer[2] = 0x05; //wait for 3 byte
	state = 1;
	console.log(buffer)
	characteristic_obj.writeValue(buffer);
}
// subscribe to changes from the meter:
function subscribeToChanges(characteristic) {
    console.log("subscribe")
    characteristic.oncharacteristicvaluechanged = handleData;
}

// handle incoming data:
function handleData(event) {
    // get the data buffer from the meter:
    console.log("get data")
    console.log(event)
    console.log(event_num)
    var buf = new Uint8Array(event.target.value.buffer);
    console.log(buf);
    if (state == 1) {
        console.log("First Request Answered")
        //TODO: check della risposta
        var buffer = new Uint8Array(5);
        buffer[0] = 0xA2; //event count cmd
		  buffer[1] = 0x00;
        buffer[2] = 93;
		  var result = CalcCrc(buffer, 3);
        buffer[3] = result[0]; //crc da calcolare
        buffer[4] = result[1]; //crc da calcolare
        state = 2;
		  console.log(buffer)
        characteristic_obj.writeValue(buffer);
    } else if (state == 2) {
		 //decodifica del dato
		  var date = Unix_timestamp(buf[4] + buf[3] * 256 + buf[2] * 256 * 256 + buf[1] * 256 * 256 * 256, 0).toString();
		  var current = ((buf[12] + buf[11] * 256 + buf[10] * 256 * 256 + buf[9] * 256 * 256 * 256) / 100).toString();	
		  console.log(date)
		  console.log(current)	
				config.data.labels.push(date);

				config.data.datasets.forEach(function(dataset) {
					dataset.data.push(current);
				});

				myChart.update();
			
			if(stop == 1)
			{
				stop = 0;
				disconnect();
			}
    }
}

// disconnect function:
function disconnect() {
    if (myDevice) {
        // disconnect:
        characteristic_obj.stopNotifications();
        myDevice.gatt.disconnect();
    }
}

function CalcCrc(buf, len) {
    var crc_value = new Uint8Array(2);
    var crc = 0xFFFF;
    for (var i = 0; i < len; i++) {
        crc = crc ^ buf[i]; // XOR byte into least sig. byte of crc

        for (var k = 8; k != 0; k--) { // Loop over each bit
            if ((crc & 0x0001) != 0) { // If the LSB is set
                crc = crc >> 1; // Shift right and XOR 0xA001
                crc = crc ^ 0xA001;
            } else {
                // Else LSB is not set
                crc = crc >> 1; // Just shift right
            }
        }
    }
    crc_value[0] = (crc & 0x0000ff00) >> 8; // crc
    crc_value[1] = (crc & 0x000000ff); // crc
    return crc_value;
}

function Unix_timestamp(t, dec) {
    var offset = new Date().getTimezoneOffset()
    var dt = new Date((t + offset * 60) * 1000);
    var hr = dt.getHours();
    var m = "0" + dt.getMinutes();
    var s = "0" + dt.getSeconds();
    return hr + ':' + m.substr(-2) + ':' + s.substr(-2) + '.' + dec;
}

function move(percent) {
    var elem = document.getElementById("myBar");
    elem.style.width = percent + "%";
    elem.innerHTML = percent + "%";
}