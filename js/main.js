const marqueediv = document.getElementById("marquee");

(function ($, window, undefined) {
  $.fn.marqueeify = function (options) {
    var settings = $.extend({
      horizontal: true,
      vertical: true,
      speed: 100, // In pixels per second
      container: $(this).parent(),
      bumpEdge: function () { }
    }, options);

    return this.each(function () {
      var containerWidth, containerHeight, elWidth, elHeight, move, getSizes,
        $el = $(this);

      getSizes = function () {
        containerWidth = settings.container.outerWidth();
        containerHeight = settings.container.outerHeight();
        elWidth = $el.outerWidth();
        elHeight = $el.outerHeight();
      };

      move = {
        right: function () {
          $el.animate({ left: (containerWidth - elWidth) }, {
            duration: ((containerWidth / settings.speed) * 1000), queue: false, easing: "linear", complete: function () {
              settings.bumpEdge();
              move.left();
            }
          });
        },
        left: function () {
          $el.animate({ left: 0 }, {
            duration: ((containerWidth / settings.speed) * 1000), queue: false, easing: "linear", complete: function () {
              settings.bumpEdge();
              move.right();
            }
          });
        },
        down: function () {
          $el.animate({ top: (containerHeight - elHeight) }, {
            duration: ((containerHeight / settings.speed) * 1000), queue: false, easing: "linear", complete: function () {
              settings.bumpEdge();
              move.up();
            }
          });
        },
        up: function () {
          $el.animate({ top: 0 }, {
            duration: ((containerHeight / settings.speed) * 1000), queue: false, easing: "linear", complete: function () {
              settings.bumpEdge();
              move.down();
            }
          });
        }
      };
      getSizes();
      if (settings.horizontal) {
        move.right();
      }
      if (settings.vertical) {
        move.down();
      }

      // Make that shit responsive!
      $(window).resize(function () {
        getSizes();
      });
    });
  };
})(jQuery, window);

var marqueeified = false;
function easterEgg() {
  $('.marquee').toggle();
  if (!marqueeified) {
    $('.marquee').marqueeify({
      speed: 150,
      bumpEdge: function () {
        var newColor = "hsl(" + Math.floor(Math.random() * 360) + ", 100%, 50%)";
        $('.marquee .logo').css('fill', newColor);
      }
    });
    marqueeified = true;
  }
};

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Apply custom file input styling
  bsCustomFileInput.init();
  
  // Get element references
  const flashButton = document.getElementById('flashButton');
  const firmwareFileSelect = document.getElementById('firmwareFileSelect');
  const customFirmwareInput = document.getElementById('customFirmwareInput');
  const downloadFirmwareButton = document.getElementById('downloadFirmwareButton');
  const configFileSelect = document.getElementById('configFileSelect');
  const backupFileInput = document.getElementById('backupFileInput');
  
  // Connect event listeners if elements exist
  if (flashButton) {
    flashButton.addEventListener('click', flashFirmware);
  }
  
  if (firmwareFileSelect) {
    firmwareFileSelect.addEventListener('change', handleFirmwareSelect);
  }
  
  if (customFirmwareInput) {
    customFirmwareInput.addEventListener('change', handleCustomFirmwareSelect);
  }
  
  if (downloadFirmwareButton) {
    downloadFirmwareButton.addEventListener('click', downloadFirmware);
  }
  
  if (configFileSelect) {
    configFileSelect.addEventListener('change', handleConfigSelect);
  }
  
  if (backupFileInput) {
    backupFileInput.addEventListener('change', handleBackupFileSelect);
  }
  
  // Initial state check
  if (firmwareFileSelect && firmwareFileSelect.value === '') {
    downloadFirmwareButton.classList.add('disabled');
  }
});

// Handle firmware dropdown selection
function handleFirmwareSelect() {
  const firmwareFileSelect = document.getElementById('firmwareFileSelect');
  const customFirmwareInput = document.getElementById('customFirmwareInput');
  const downloadFirmwareButton = document.getElementById('downloadFirmwareButton');
  
  // Reset custom firmware buffer
  rawFirmware = null;
  customFirmwareBuffer = null;
  
  if (firmwareFileSelect.value) {
    // Clear and disable the file input
    customFirmwareInput.value = '';
    customFirmwareInput.setAttribute('disabled', 'disabled');
    document.getElementById('customFirmwareLabel').textContent = 'Upload custom firmware';
    
    // Enable download button
    downloadFirmwareButton.classList.remove('disabled');
  } else {
    // Re-enable the file input
    customFirmwareInput.removeAttribute('disabled');
    
    // Disable download button (can't download what's not selected)
    downloadFirmwareButton.classList.add('disabled');
  }
}

// Handle custom firmware file selection
function handleCustomFirmwareSelect() {
  const file = document.getElementById('customFirmwareInput').files[0];
  const firmwareFileSelect = document.getElementById('firmwareFileSelect');
  const downloadFirmwareButton = document.getElementById('downloadFirmwareButton');
  
  if (file) {
    // If a file is selected, reset and disable the dropdown
    firmwareFileSelect.value = '';
    firmwareFileSelect.setAttribute('disabled', 'disabled');
    
    // Update the file label with the selected filename
    document.getElementById('customFirmwareLabel').textContent = file.name;
    
    // Disable download button for custom uploads
    downloadFirmwareButton.classList.add('disabled');
    
    // Read the file into memory
    const reader = new FileReader();
    reader.onload = function(e) {
      const firmwareData = new Uint8Array(e.target.result);
      
      try {
        // Unpack the firmware if needed (using function from fwpack.js)
        if (typeof unpack === 'function') {
          rawFirmware = unpack(firmwareData);
        } else {
          rawFirmware = firmwareData;
        }
        
        // Create a default version
        rawVersion = new Uint8Array(16).fill(0);
        const versionString = '2.01.26'; // Default version
        const versionEncoder = new TextEncoder();
        rawVersion.set(versionEncoder.encode(versionString));
        
        // Also store in the buffer for use by native flash method
        customFirmwareBuffer = rawFirmware;
        
        log(`Custom firmware loaded: ${file.name} (${rawFirmware.length} bytes)`);
        
        // Check size
        const current_size = rawFirmware.length;
        const max_size = 0xEFFF;
        const percentage = (current_size / max_size) * 100;
        log(`Firmware uses ${percentage.toFixed(2)}% of available memory (${current_size}/${max_size} bytes).`);
        
        if (current_size > max_size) {
          log("WARNING: Firmware is too large and WILL NOT WORK!");
        }
      } catch (error) {
        console.error('Error processing firmware:', error);
        log(`Error processing firmware: ${error.message}`);
        rawFirmware = null;
        customFirmwareBuffer = null;
      }
    };
    
    reader.onerror = function() {
      log('Error reading firmware file.');
      rawFirmware = null;
      customFirmwareBuffer = null;
    };
    
    reader.readAsArrayBuffer(file);
  } else {
    // If no file is selected, re-enable the dropdown
    firmwareFileSelect.removeAttribute('disabled');
    document.getElementById('customFirmwareLabel').textContent = 'Upload custom firmware';
  }
}

// Function to download the selected firmware
function downloadFirmware() {
  const firmwareFileSelect = document.getElementById('firmwareFileSelect');
  const selectedFirmware = firmwareFileSelect.value;
  
  if (!selectedFirmware) {
    log('Please select a firmware to download.');
    return;
  }
  
  const link = document.createElement('a');
  link.href = selectedFirmware;
  link.download = selectedFirmware.split('/').pop();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  log(`Downloading: ${selectedFirmware.split('/').pop()}`);
}

// Flash firmware to the radio - use the implementation from tool_patcher.js if available
async function flashFirmware() {
  // If the tool_patcher.js implementation is available and the legacy code was loaded
  if (typeof flash_init === 'function' && typeof flash_flashFirmware === 'function') {
    // Use the more robust implementation from tool_patcher.js
    if (document.getElementById('flashButton')) {
      document.getElementById('flashButton').classList.add('disabled');
    }
    
    // If we have custom firmware loaded, use that
    if (rawFirmware) {
      log('Using custom firmware...');
    } else {
      // Otherwise load from dropdown selection
      const selectedFirmware = document.getElementById('firmwareFileSelect').value;
      
      if (!selectedFirmware) {
        log('Error: Please select a firmware or upload a custom firmware file.');
        if (document.getElementById('flashButton')) {
          document.getElementById('flashButton').classList.remove('disabled');
        }
        return;
      }
      
      try {
        log(`Loading firmware: ${selectedFirmware.split('/').pop()}`);
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
          if (document.getElementById('flashButton')) {
            document.getElementById('flashButton').classList.remove('disabled');
          }
          rawFirmware = null;
          return;
        }
      } catch (error) {
        log(`Error loading firmware: ${error.message}`);
        if (document.getElementById('flashButton')) {
          document.getElementById('flashButton').classList.remove('disabled');
        }
        return;
      }
    }
    
    // Continue with the flash process...
    log('Connecting to the serial port...');
    const port = await connect();
    if (!port) {
      log('Failed to connect to the serial port.');
      if (document.getElementById('flashButton')) {
        document.getElementById('flashButton').classList.remove('disabled');
      }
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
      if (document.getElementById('flashButton')) {
        document.getElementById('flashButton').classList.remove('disabled');
      }
      // Clear rawFirmware if it was loaded from the selector
      if (document.getElementById('firmwareFileSelect').value) {
        rawFirmware = null;
        rawVersion = null;
      }
    }
  } else {
    // Use the simpler implementation as fallback
    const consoleElement = document.getElementById('console');
    const firmwareFileSelect = document.getElementById('firmwareFileSelect');
    
    // Clear previous console output
    consoleElement.value = 'Preparing to flash firmware...\n';
    
    // Use custom firmware if available, otherwise use selected firmware
    if (customFirmwareBuffer) {
      // Flash the custom firmware that's already loaded
      log('Using custom firmware from file upload');
      
      // Flash the firmware buffer directly
      if (typeof qsSerial !== 'undefined' && qsSerial.flashFirmware) {
        qsSerial.flashFirmware(customFirmwareBuffer,
          // Progress callback
          (progress) => {
            consoleElement.value = `Flashing: ${Math.round(progress * 100)}%\n` + consoleElement.value;
          },
          // Success callback
          () => {
            consoleElement.value = 'Firmware successfully flashed to radio!\n' + consoleElement.value;
          },
          // Error callback
          (error) => {
            consoleElement.value = `Error: ${error}\n` + consoleElement.value;
          }
        );
      } else {
        consoleElement.value += 'Error: Flash functionality not available. Make sure you are using a compatible browser.\n';
      }
      
      return;
    }
    
    // Handle firmware from dropdown
    const selectedFirmware = firmwareFileSelect.value;
    if (!selectedFirmware) {
      consoleElement.value = 'Error: Please select a firmware or upload a custom firmware file.\n';
      return;
    }
    
    // Fetch the firmware file from the server
    fetch(selectedFirmware)
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load firmware file');
        }
        return response.arrayBuffer();
      })
      .then(firmwareBuffer => {
        consoleElement.value += 'Firmware loaded successfully.\n';
        consoleElement.value += 'Searching for radio...\n';
        
        // Use the qsSerial module to flash the firmware
        if (typeof qsSerial !== 'undefined' && qsSerial.flashFirmware) {
          qsSerial.flashFirmware(new Uint8Array(firmwareBuffer),
            // Progress callback
            (progress) => {
              consoleElement.value = `Flashing: ${Math.round(progress * 100)}%\n` + consoleElement.value;
            },
            // Success callback
            () => {
              consoleElement.value = 'Firmware successfully flashed to radio!\n' + consoleElement.value;
            },
            // Error callback
            (error) => {
              consoleElement.value = `Error: ${error}\n` + consoleElement.value;
            }
          );
        } else {
          consoleElement.value += 'Error: Flash functionality not available. Make sure you are using a compatible browser.\n';
        }
      })
      .catch(error => {
        consoleElement.value += `Error: ${error.message}\n`;
      });
  }
}

// Config dropdown selection handler
function handleConfigSelect() {
  const configFileSelect = document.getElementById('configFileSelect');
  const backupFileInput = document.getElementById('backupFileInput');
  
  if (configFileSelect.value) {
    // Clear and disable the file input
    backupFileInput.value = '';
    backupFileInput.setAttribute('disabled', 'disabled');
    document.getElementById('backupFileLabel').textContent = 'Import backup';
    
    // Load the selected config
    loadPresetConfig();
  } else {
    // Re-enable the file input
    backupFileInput.removeAttribute('disabled');
    document.getElementById('writeConfigButton').classList.add('disabled');
  }
}

// Backup file selection handler
function handleBackupFileSelect() {
  const file = document.getElementById('backupFileInput').files[0];
  const configFileSelect = document.getElementById('configFileSelect');
  
  if (file) {
    // If a file is selected, reset and disable the dropdown
    configFileSelect.value = '';
    configFileSelect.setAttribute('disabled', 'disabled');
    
    // Update the file label with the selected filename
    document.getElementById('backupFileLabel').textContent = file.name;
    
    // Process the file
    loadConfigFile(file);
  } else {
    // If no file is selected, re-enable the dropdown
    configFileSelect.removeAttribute('disabled');
    document.getElementById('writeConfigButton').classList.add('disabled');
  }
}

// Utility function to log to console
function log(message, replace = false) {
  const consoleElement = document.getElementById('console');
  if (!consoleElement) return;
  
  if (replace && consoleElement.value.includes('\n')) {
    // Replace the last line
    const lines = consoleElement.value.split('\n');
    lines[0] = message;
    consoleElement.value = lines.join('\n');
  } else {
    // Add new line
    consoleElement.value = message + '\n' + consoleElement.value;
  }
}
