// the configurator tool works very similar to the patcher, where individual config sections are treated by mod-like instances with a read and write function

const readConfigButton = document.getElementById('readConfigButton');
const writeConfigButton = document.getElementById('writeConfigButton');
const configContainer = document.getElementById('configContainer');
const automaticBackupCheckbox = document.getElementById('automaticBackupCheckbox');

async function eeprom_init(port) {
    // packet format: uint16 ID, uint16 length, uint32 timestamp
    // send hello packet to init communication
    // the 4 bytes are a timestamp for the session and need to be appended to each following packet
    // we simply set the timestamp to 0xffffffff
    const packet = new Uint8Array([0x14, 0x05, 0x04, 0x00, 0xff, 0xff, 0xff, 0xff]);
    await sendPacket(port, packet);
    const response = await readPacket(port, 0x15);
    const decoder = new TextDecoder();
    const version = new Uint8Array(response.slice(4, 4+16)); // string contains some garbage after null, so we have to clean it up with indexof
    log(`Radio connected: Version ${decoder.decode(version.slice(0, version.indexOf(0)))}`);
}

async function eeprom_read(port, address, size = 0x80) {
    // packet format: uint16 ID, uint16 length, uint16 address, uint8 size, uint8 padding, uint32 timestamp
    // size can be up to 0x80 bytes
    const address_msb = (address & 0xff00) >> 8;
    const address_lsb = address & 0xff;

    const packet = new Uint8Array([0x1b, 0x05, 0x08, 0x00, address_lsb, address_msb, size, 0x00, 0xff, 0xff, 0xff, 0xff]);

    await sendPacket(port, packet);
    const response = await readPacket(port, 0x1c);

    // reply format: uint16 ID, uint16 length, uint16 offset, uint8 size, uint8 padding, uint8[128] data
    // extract data from response using size
    if (response[6] !== size) {
        throw ('eeprom read reply has wrong size.');
    }
    const data = new Uint8Array(response.slice(8));
    return data;
}

async function eeprom_reboot(port) {
    // packet format: uint16 ID
    const packet = new Uint8Array([0xdd, 0x05]);
    log('Rebooting radio...');
    await sendPacket(port, packet);
} 

let rawEEPROM = new Uint8Array(0x2000);

readConfigButton.addEventListener('click', async function () {
    readConfigButton.classList.add('disabled');

    port = null;
    try {
        log('Connecting to the serial port...');
        port = await connect();
        if (!port) {
            log('Failed to connect to the serial port.');
            readConfigButton.classList.remove('disabled');
            return;
        }
        // initialize communication
        await eeprom_init(port);

        // read full eeprom, size is 0x2000 bytes
        log('Reading configuration... 0%');
        for (let i = 0; i < 0x2000; i += 0x80) {
            const data = await eeprom_read(port, i);
            rawEEPROM.set(data, i);
            log(`Reading configuration... ${((i / 0x2000) * 100).toFixed(1)}%`, true);
        }
        log('Reading configuration... 100%.', true);
        log('Configuration read successfully.');
        
        // save to file if backup is enabled
        if (automaticBackupCheckbox.checked) {
            log('Saving backup file...');
            const blob = new Blob([rawEEPROM], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'uvmod_configurator_backup.bin';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }



    } catch (error) {
        console.error('Error:', error);
        log(`Unusual error occurred: ${error.message}. Check console for details.`);
    } finally {
        if (port) {
            port.close();
        }
        readConfigButton.classList.remove('disabled');
    }
});


// initialize configurator
{
    log("Please read config from device or load a backup file.");
}

// Add these functions at the end of the file

// Load a predefined configuration
async function loadPresetConfig() {
    const configFileSelect = document.getElementById('configFileSelect');
    const selectedConfig = configFileSelect.value;
    const writeConfigButton = document.getElementById('writeConfigButton');
    
    if (!selectedConfig) {
        log('Please select a configuration to load.');
        return;
    }
    
    try {
        log(`Loading preset configuration: ${selectedConfig}...`);
        const response = await fetch(selectedConfig);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch configuration (HTTP ${response.status})`);
        }
        
        const configBuffer = await response.arrayBuffer();
        rawEEPROM = new Uint8Array(configBuffer);
        
        if (rawEEPROM.length !== 0x2000) {
            log(`Warning: Configuration size is ${rawEEPROM.length} bytes, expected 8192 bytes.`);
        }
        
        log('Configuration loaded successfully.');
        writeConfigButton.classList.remove('disabled');
        
    } catch (error) {
        console.error('Error loading configuration:', error);
        log(`Error loading configuration: ${error.message}`);
        writeConfigButton.classList.add('disabled');
    }
}

// Load configuration from file input
function loadConfigFile(file) {
    const writeConfigButton = document.getElementById('writeConfigButton');
    
    if (!file) {
        log('No file selected.');
        writeConfigButton.classList.add('disabled');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            rawEEPROM = new Uint8Array(e.target.result);
            if (rawEEPROM.length !== 0x2000) {
                log(`Warning: Imported file size is ${rawEEPROM.length} bytes, expected 8192 bytes.`);
            }
            log(`Configuration imported from ${file.name}.`);
            writeConfigButton.classList.remove('disabled');
        } catch (error) {
            console.error('Error processing file:', error);
            log(`Error processing file: ${error.message}`);
            writeConfigButton.classList.add('disabled');
        }
    };
    
    reader.onerror = function() {
        log('Error reading file.');
        writeConfigButton.classList.add('disabled');
    };
    
    reader.readAsArrayBuffer(file);
}

async function eeprom_write(port, address, data) {
    // packet format: uint16 ID, uint16 length, uint16 address, uint8 size, uint8 padding, uint8[] data, uint32 timestamp
    const size = data.length;
    if (size > 0x80) {
        throw ('eeprom write packet too large, max is 128 bytes');
    }
    
    const address_msb = (address & 0xff00) >> 8;
    const address_lsb = address & 0xff;
    
    // Calculate total packet length: 8 bytes header + data length + 4 bytes timestamp
    const totalLength = 8 + size + 4;
    
    const packet = new Uint8Array(totalLength);
    packet[0] = 0x1d; // ID
    packet[1] = 0x05;
    packet[2] = (totalLength - 4) & 0xFF; // Length LSB
    packet[3] = ((totalLength - 4) >> 8) & 0xFF; // Length MSB
    packet[4] = address_lsb;
    packet[5] = address_msb;
    packet[6] = size;
    packet[7] = 0x00; // padding
    
    // Copy data into packet
    packet.set(data, 8);
    
    // Add timestamp at the end
    packet[totalLength - 4] = 0xff;
    packet[totalLength - 3] = 0xff;
    packet[totalLength - 2] = 0xff;
    packet[totalLength - 1] = 0xff;
    
    await sendPacket(port, packet);
    
    // Wait for acknowledgment
    const response = await readPacket(port, 0x1e);
    return response;
}

// Add write configuration functionality
writeConfigButton.addEventListener('click', async function() {
    writeConfigButton.classList.add('disabled');
    
    port = null;
    try {
        log('Connecting to the serial port...');
        port = await connect();
        if (!port) {
            log('Failed to connect to the serial port.');
            writeConfigButton.classList.remove('disabled');
            return;
        }
        
        // initialize communication
        await eeprom_init(port);
        
        // Write EEPROM data in chunks of 0x80 bytes
        log('Writing configuration... 0%');
        for (let i = 0; i < 0x2000; i += 0x80) {
            const dataChunk = rawEEPROM.slice(i, i + 0x80);
            await eeprom_write(port, i, dataChunk);
            log(`Writing configuration... ${((i / 0x2000) * 100).toFixed(1)}%`, true);
        }
        log('Writing configuration... 100%.', true);
        log('Configuration written successfully.');
        
        // Reboot the radio to apply changes
        await eeprom_reboot(port);
        
    } catch (error) {
        console.error('Error:', error);
        log(`Unusual error occurred: ${error.message}. Check console for details.`);
    } finally {
        if (port) {
            port.close();
        }
        writeConfigButton.classList.remove('disabled');
    }
});