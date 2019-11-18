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

var event_list = [
    "Events Clear",
    "Gnd Inst Overcurrent",
    "Gnd Timed1 Overcurrent",
    "Gnd Timed2 Overcurrent",
    "Breaker Discrepancy",
    "Mechanical Operation",
    "Digital Input 1 Deactive",
    "Digital Input 1 Active",
    "Digital Input 2 Deactive",
    "Digital Input 2 Active",
    "Digital Input 3 Deactive",
    "Digital Input 3 Active",
    "Breaker Status Opened",
    "Breaker Status Closed",
    "Remote Reset",
    "Remote Trip Set",
    "Trip De-Energized",
    "Aux1 De-Energized",
    "Aux2 De-Energized",
    "Trip Energized",
    "Aux1 Energized",
    "Aux2 Energized",
    "Trip Remote De-Energized",
    "Aux1 Remote De-Energized",
    "Aux2 Remote De-Energized",
    "Trip Remote Energized",
    "Aux1 Remote Energized",
    "Aux2 Remote Energized",
    "Default Setpoint",
    "Setpoint Stored",
    "Setpoint Discrepancy",
    "Password Changed",
    "Model Changed",
    "Test BLE",
    "Trip Data Lost",
    "Trip Data Restored",
    "Calibration Time Data Lost",
    "Calibration Data Lost",
    "Power Loss",
    "Aux Power Restored",
    "Maintenance Data Cleared",
    "Maintenance Data Lost",
    "Maintenance Data Restored",
    "Status Lost",
    "BLE Failure",
    "ADC Failure",
    "Flash Busy",
    "Out of Service",
];
function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        vars[key] = value;
    });
    return vars;
}
function connect() {
		var device_name = getUrlVars()['d']
		alert(device_name)
		navigator.bluetooth.requestDevice({
            // filters: [myFilters]       // you can't use filters and acceptAllDevices together
				 filters: [{name: device_name}],
            optionalServices: [myService],
          //  acceptAllDevices: true
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
            console.log(characteristic)
            var buffer = new Uint8Array(3);
            buffer[0] = 0xE1; //event count cmd
            buffer[1] = 0x00;
            buffer[2] = 0x03; //wait for 3 byte
            state = 1;
            console.log(buffer)
            characteristic.writeValue(buffer);
        })
        .catch(function(error) {
            // catch any errors:
            console.error('Connection failed!', error);
        });
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
        var buffer = new Uint8Array(3);
        buffer[0] = 0xE1; //event count cmd
        buffer[1] = 0x08;
        buffer[2] = 0x7F; //crc da calcolare
        state = 2;
        characteristic_obj.writeValue(buffer);
    } else if (state == 2) {
        //risposta conto eventi
        /*
        1 0xE1
        2 event num
        1 max event for requ
        2 crc
        */
        //todo gestire caso eventi nulli
        var el = document.getElementById("list");
        el.innerHTML = '';
        progressive = 0;
        var node = document.createElement("li");
        node.setAttribute('class', 'table-header');
        var prog = document.createElement("div");
        prog.setAttribute('class', 'col col-1');
        prog.innerText = "#";
        node.appendChild(prog);
        var number = document.createElement("div");
        number.setAttribute('class', 'col col-2');
        number.innerText = "Number";
        node.appendChild(number);
        var type = document.createElement("div");
        type.setAttribute('class', 'col col-3');
        type.innerText = "Type";
        node.appendChild(type);
        var date = document.createElement("div");
        date.setAttribute('class', 'col col-4');
        date.innerText = "Date";
        node.appendChild(date);
        var current = document.createElement("div");
        current.setAttribute('class', 'col col-5');
        current.innerText = "Ig";
        node.appendChild(current);
        el.appendChild(node);

        event_num = buf[2];
        event_cnt = 1;
        total_evt = event_num;
        //document.getElementById("event_count").innerHTML = buf[2].toString();
        var buffer = new Uint8Array(3);
        buffer[0] = 0xE2; //event count cmd
        buffer[1] = 0x00;
        buffer[2] = 0x07; //crc da calcolare
        state = 3;
        asked_evt = true;
        characteristic_obj.writeValue(buffer);
    } else if (state == 3) {
        if (event_num > 1) {
            var buffer = new Uint8Array(7);
            buffer[0] = 0xE2; //chiedo 2 eventi
            buffer[1] = event_cnt >> 8;
            buffer[2] = event_cnt;
            buffer[3] = (event_cnt + 1) >> 8;
            buffer[4] = event_cnt + 1;
            var result = CalcCrc(buffer, 5);
            buffer[5] = result[0]; //crc da calcolare
            buffer[6] = result[1]; //crc da calcolare
            state = 4;
            asked_evt_num = 2;
            event_cnt += 2;
            event_num -= 2;
            characteristic_obj.writeValue(buffer);
        } else if (event_num == 1) {
            var buffer = new Uint8Array(7);
            buffer[0] = 0xE2; //chiedo 1 eventi
            buffer[1] = event_cnt >> 8;
            buffer[2] = event_cnt;
            buffer[3] = (event_cnt) >> 8;
            buffer[4] = event_cnt;
            var result = CalcCrc(buffer, 5);
            buffer[5] = result[0]; //crc da calcolare
            buffer[6] = result[1]; //crc da calcolare
            state = 4;
            asked_evt_num = 1;
            event_cnt += 1;
            event_num -= 1;
            characteristic_obj.writeValue(buffer);
        }

    } else if (state == 4) {
        move(Math.round((event_cnt - 1) / total_evt * 100))
        var step = 0;
        if (asked_evt == true) {
            for (i = 0; i < asked_evt_num; i++) {
                progressive++;
                console.log("decode_evt")
                var number = (buf[7 + step] + buf[8 + step] * 256).toString();
                var type = (buf[9 + step] + buf[10 + step] * 256); //.toString();
                var date = Unix_timestamp(buf[11 + step] + buf[12 + step] * 256 + buf[13 + step] * 256 * 256 + buf[14 + step] * 256 * 256 * 256, (buf[15 + step] + buf[16 + step] * 256).toString());
                var current = ((buf[19 + step] + buf[20 + step] * 256 + buf[21 + step] * 256 * 256 + buf[22 + step] * 256 * 256 * 256) / 100).toString();
                var el = document.getElementById("list");
                var node = document.createElement("li");
                node.setAttribute('class', 'table-row');

                var col0 = document.createElement("div");
                col0.setAttribute('class', 'col col-1');
                col0.setAttribute('data-label', '#');
                col0.innerText = progressive;
                node.appendChild(col0);

                var col1 = document.createElement("div");
                col1.setAttribute('class', 'col col-2');
                col1.setAttribute('data-label', 'Number');
                col1.innerText = number;
                node.appendChild(col1);

                var col2 = document.createElement("div");
                col2.setAttribute('class', 'col col-3');
                col2.setAttribute('data-label', 'Type');
                col2.innerText = event_list[type - 1];
                node.appendChild(col2);

                var col3 = document.createElement("div");
                col3.setAttribute('class', 'col col-4');
                col3.setAttribute('data-label', 'Date');
                col3.innerText = date;
                node.appendChild(col3);

                var col4 = document.createElement("div");
                col4.setAttribute('class', 'col col-5');
                col4.setAttribute('data-label', 'Ig');
                col4.innerText = current;
                node.appendChild(col4);


                el.appendChild(node);
                step += 16;
            }
        }
        //risposta conto eventi
        /*
        1 0xE1
        2 event num
        1 max event for requ
        2 crc
        */
        if (event_num != 0) {
            var buffer = new Uint8Array(3);
            buffer[0] = 0xE2; //event count cmd
            buffer[1] = 0x00;
            buffer[2] = 0x07; //crc da calcolare
            state = 3;
            characteristic_obj.writeValue(buffer);
        } else {
            console.log("Disconnected")
            //disconnect
            asked_evt = false;
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