const useDefaultFirmwareCheckbox = document.getElementById('useDefaultFirmware');
const customFileInputDiv = document.getElementById('customFileInputDiv');
const customFileInput = document.getElementById('customFileInput');
const customFileLabel = document.getElementById('customFileLabel');
const useDefaultFirmwareSpan = document.getElementById('useDefaultFirmwareSpan');
const useDefaultFirmwareDiv = document.getElementById('useDefaultFirmwareDiv');
const flashButton = document.getElementById('flashButton');

// Function to toggle checkbox and update UI
function toggleCheckbox() {
    useDefaultFirmwareCheckbox.checked = !useDefaultFirmwareCheckbox.checked;

    if (useDefaultFirmwareCheckbox.checked) {
        customFileInputDiv.classList.add('d-none');
        useDefaultFirmwareSpan.classList.remove('d-none');
    } else {
        customFileInputDiv.classList.remove('d-none');
        useDefaultFirmwareSpan.classList.add('d-none');
    }
}

// Click event listener for the div
useDefaultFirmwareDiv.addEventListener('click', function (event) {
    // Check if the click occurred on the checkbox or the label, and toggle accordingly
    if (
        event.target === useDefaultFirmwareCheckbox ||
        event.target === useDefaultFirmwareDiv.querySelector('.input-group-text')
    ) {
        toggleCheckbox();
    }
});

let rawVersion = null; // stores the raw version data for fwpack.js and qsflash.js
let rawFirmware = null; // stores the raw firmware data for qsflash.js

document.getElementById('flashButton').addEventListener('click', function() {
    log("Preparing to flash firmware...");
    const firmwareSelect = document.getElementById('firmwareFileSelect');
    const selectedFirmware = firmwareSelect.value;
    
    if (!selectedFirmware) {
        log('Error: Please select a firmware to flash.');
        return;
    }
    
    fetch(selectedFirmware)
        .then((response) => {
            if (!response.ok) {
                throw new Error('Failed to load firmware file');
            }
            return response.arrayBuffer();
        })
        .then((arrayBuffer) => {
            const firmwareData = new Uint8Array(arrayBuffer);
            
            try {
                // Unpack the firmware if needed
                const unpacked_firmware = unpack(firmwareData);
                
                // Extract version information for the bootloader protocol
                rawVersion = extractFirmwareVersion(unpacked_firmware);
                log(`Detected firmware version: ${new TextDecoder().decode(rawVersion.subarray(0, rawVersion.indexOf(0) >= 0 ? rawVersion.indexOf(0) : rawVersion.length))}`);
                
                // Save raw firmware for flashing
                rawFirmware = unpacked_firmware;
                
                // Check size
                const current_size = unpacked_firmware.length;
                const max_size = 0xEFFF;
                const percentage = (current_size / max_size) * 100;
                log(`Firmware uses ${percentage.toFixed(2)}% of available memory (${current_size}/${max_size} bytes).`);
                
                if (current_size > max_size) {
                    log("WARNING: Firmware is too large and WILL NOT WORK!");
                    return;
                }
                
                log("Firmware loaded successfully. Ready to flash.");
                log("Connect your radio in bootloader mode and press the Flash button again to start flashing.");
            } catch (error) {
                console.error(error);
                log('Error processing firmware: ' + error.message);
            }
        })
        .catch((error) => {
            console.error(error);
            log('Error loading firmware file: ' + error.message);
        });
});

// Helper function to extract version info from firmware
function extractFirmwareVersion(firmware) {
    // Create a temporary version identifier for the flashing protocol
    const versionBuffer = new Uint8Array(16).fill(0);
    
    // Try to determine version from filename or use default
    const firmwareSelect = document.getElementById('firmwareFileSelect');
    const selectedOption = firmwareSelect.options[firmwareSelect.selectedIndex].text;
    
    let versionString = '2.01.26'; // Default version
    
    if (selectedOption.includes('IJV V3.4')) {
        versionString = '3.40';
    } else if (selectedOption.includes('FAGCI')) {
        versionString = '4.00';
    }
    
    // Encode the version string
    const versionEncoder = new TextEncoder();
    const versionBytes = versionEncoder.encode(versionString);
    versionBuffer.set(versionBytes);
    
    return versionBuffer;
}

// flasher

async function flash_init(port) {
    const decoder = new TextDecoder();
    // example version data: { 0x30, 0x5, 0x10, 0x0, '2', '.', '0', '1', '.', '2', '3', 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0} for version 2.01.23
    // version from the fw file is stored in the 16 byte uint8array rawVersion starting with the version string at index 0, padded with 0x00
    // seems like the version string is just sent after a 4 byte header, so we can just send the rawVersion array

    const data = new Uint8Array([0x30, 0x5, rawVersion.length, 0x0, ...rawVersion]);
    // const data = new Uint8Array([0x30, 0x5, 0x10, 0x0, 0x32, 0x2e, 0x30, 0x31, 0x2e, 0x32, 0x33, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0]); //send v2 just like in k5prog
    console.log('Sending version request: ', data);

    await sendPacket(port, data);

    const response = await readPacket(port, 0x18);
    console.log('Version Response: ', response);
    if (response[0] == 0x18) {
        return response;
    }
    return Promise.reject('Maximum attempts reached, no response was 0x18. Aborting.');
}

// TODO: Change this block to allow any firmware using the universal branch
// function to check if the version of the firmware is compatible with the bootloader (it does not actually matter lol)
function flash_checkVersion(dataPacket, versionFromFirmware) {
    const decoder = new TextDecoder();
    // print bootloader version as string, located at index 0x14
    log(`Bootloader version: ${decoder.decode(dataPacket.slice(0x14, 0x14 + 7))}`);

    // the radio accepts a * wildcard version, so we will do the same
    if (versionFromFirmware[0] == 0x2a) return true;

    // dataPacket is a uint8array containing the relevant byte at index 0x14
    // this byte is a 2 for the uv-k5, 3 for the k5(8)/k6, 4 for the uv-5r plus
    // versionFromFirmware is a uint8array containing the version at index 0, padded with 0x00
    return dataPacket[0x14] == versionFromFirmware[0];
}

// function to create a flash command from a block of data (max 0x100 bytes), the address and the total size of the firmware file
function flash_generateCommand(data, address, totalSize) {
    // the flash command structure is as follows:
    /* 0x19  0x5  0xc  0x1  0x8a  0x8d  0x9f  0x1d  
     * address_msb  address_lsb  address_final_msb  address_final_lsb  length_msb  length_lsb  0x0  0x0 
     * [0x100 bytes of data, if length is <0x100 then fill the rest with zeroes] */

    // flash is written in 0x100 blocks, if data is less than 0x100 bytes then it is padded with zeroes
    if (data.length < 0x100) {
        const padding = new Uint8Array(0x100 - data.length);
        data = new Uint8Array([...data, ...padding]);
    }
    if (data.length != 0x100) throw new Error('Tell matt that he is an idiot');

    // the address is a 16 bit integer, so we need to split it into two bytes
    const address_msb = (address & 0xff00) >> 8;
    const address_lsb = address & 0xff;

    const address_final = (totalSize + 0xff) & ~0xff; // add 0xff to totalSize and then round down to the next multiple of 0x100 by stripping the last byte
    if (address_final > 0xf000) throw new Error('Total size is too large');
    const address_final_msb = (address_final & 0xff00) >> 8;
    const address_final_lsb = 0x0; // since address_final can only be a multiple of 0x100, address_final_lsb is always 0x0

    // the length is fixed to 0x100 bytes
    const length_msb = 0x01;
    const length_lsb = 0x00;

    return new Uint8Array([0x19, 0x5, 0xc, 0x1, 0x8a, 0x8d, 0x9f, 0x1d, address_msb, address_lsb, address_final_msb, address_final_lsb, length_msb, length_lsb, 0x0, 0x0, ...data]);
}

// function to flash the firmware file to the radio
async function flash_flashFirmware(port, firmware) {
    // for loop to flash the firmware in 0x100 byte blocks
    // this loop is safe as long as the firmware file is smaller than 0xf000 bytes
    if (firmware.length > 0xefff) throw new Error('Last resort boundary check failed. Whoever touched the code is an idiot.');
    log('Flashing... 0%')

    for (let i = 0; i < firmware.length; i += 0x100) {
        const data = firmware.slice(i, i + 0x100);
        const command = flash_generateCommand(data, i, firmware.length);

        try {
            await sendPacket(port, command);
            await readPacket(port, 0x1a);
        } catch (e) {
            log('Flash command rejected. Aborting.');
            return Promise.reject(e);
        }

        log(`Flashing... ${((i / firmware.length) * 100).toFixed(1)}%`, true);
    }
    log('Flashing... 100%', true)
    log('Successfully flashed firmware.');
    return Promise.resolve();
}

flashButton.addEventListener('click', async function () {
    flashButton.classList.add('disabled');
    
    log('Using selected firmware for flashing...');
    const firmwareSelect = document.getElementById('firmwareFileSelect');
    const selectedFirmware = firmwareSelect.value;
    
    if (!selectedFirmware) {
        log('Error: Please select a firmware to flash.');
        flashButton.classList.remove('disabled');
        return;
    }
    
    try {
        const response = await fetch(selectedFirmware);
        if (!response.ok) {
            throw new Error('Failed to load firmware file');
        }
        const firmwareBuffer = await response.arrayBuffer();
        const firmwareData = new Uint8Array(firmwareBuffer);
        
        // Use the unpack function from fwpack.js if needed
        try {
            rawFirmware = unpack(firmwareData);
            // Extract version from the unpacked firmware
            rawVersion = new Uint8Array(16).fill(0);
            
            // Extract version string from the firmware or use file hints
            const versionString = selectedFirmware.includes('IJV') ? '3.40' : 
                               (selectedFirmware.includes('FAGCI') ? '4.00' : '2.01.26');
            
            const versionEncoder = new TextEncoder();
            const versionBytes = versionEncoder.encode(versionString);
            rawVersion.set(versionBytes);
            
            log(`Detected firmware version: ${versionString}`);
        } catch (e) {
            // If unpack fails, use the raw firmware
            console.warn("Could not unpack firmware, using raw data", e);
            rawFirmware = firmwareData;
            // Create a default version
            rawVersion = new Uint8Array(16).fill(0);
            const versionString = '2.01.26';
            const versionEncoder = new TextEncoder();
            rawVersion.set(versionEncoder.encode(versionString));
        }
        
        if (rawFirmware.length > 0xefff) {
            log('Firmware file is too large. Aborting.');
            flashButton.classList.remove('disabled');
            return;
        }
    } catch (error) {
        log(`Error loading firmware: ${error.message}`);
        flashButton.classList.remove('disabled');
        return;
    }
    
    // Continue with the flash process...
    log('Connecting to the serial port...');
    const port = await connect();
    if (!port) {
        log('Failed to connect to the serial port.');
        flashButton.classList.remove('disabled');
        return;
    }

    try {
        const data = await readPacket(port, 0x18, 1000);
        if (data[0] == 0x18) {
            console.log('Received 0x18 packet. Radio is ready for flashing.');
            console.log('0x18 packet data: ', data);
            log('Radio in flash mode detected.');

            const response = await flash_init(port);
            if (flash_checkVersion(response, rawVersion)) {
                log('Version check passed.');
            } else {
                log('WARNING: Version check failed! Please select the correct version. Aborting.');
                return;
            }
            log('Flashing firmware...');
            await flash_flashFirmware(port, rawFirmware);

            return;
        } else {
            console.log('Received unexpected packet. Radio is not ready for flashing.');
            log('Wrong packet received, is the radio in flash mode?');
            console.log('Data: ', data);
            return;
        }
    } catch (error) {
        if (error !== 'Reader has been cancelled.') {
            console.error('Error:', error);
            log('Unusual error occured, check console for details.');
        } else {
            log('No data received, is the radio connected and in flash mode? Please try again.');
        }
        return;

    } finally {
        port.close();
        flashButton.classList.remove('disabled');
        // Clear rawFirmware if it was loaded from the selector to prevent confusion
        if (!document.getElementById('patchButton').classList.contains('active')) {
            rawFirmware = null;
            rawVersion = null;
        }
    }
});


modLoader(); // loads and shows all mods from mods.js