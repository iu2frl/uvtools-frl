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

function downloadFirmware() {
  const firmwareSelect = document.getElementById('firmwareFileSelect');
  const selectedFirmware = firmwareSelect.value;

  if (!selectedFirmware) {
    alert('Please select a firmware to download.');
    return;
  }

  const link = document.createElement('a');
  link.href = selectedFirmware;
  link.download = selectedFirmware.split('/').pop();
  link.click();
}

function flashFirmware() {
  const firmwareSelect = document.getElementById('firmwareFileSelect');
  const selectedFirmware = firmwareSelect.value;
  const consoleElement = document.getElementById('console');

  if (!selectedFirmware) {
    consoleElement.value = 'Error: Please select a firmware to flash.';
    return;
  }

  consoleElement.value = 'Preparing to flash firmware...\n';

  // Fetch the firmware file
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

// Add these functions to handle the mutual exclusivity
document.addEventListener('DOMContentLoaded', function () {
  const configFileSelect = document.getElementById('configFileSelect');
  const backupFileInput = document.getElementById('backupFileInput');
  const writeConfigButton = document.getElementById('writeConfigButton');

  // When jQuery is initialized, apply bs-custom-file-input for better file input UI
  bsCustomFileInput.init();

  // Connect flash button to the flashFirmware function
  document.getElementById('flashButton').addEventListener('click', flashFirmware);
});

// Handle dropdown selection change
function handleConfigSelect() {
  const configFileSelect = document.getElementById('configFileSelect');
  const backupFileInput = document.getElementById('backupFileInput');
  const writeConfigButton = document.getElementById('writeConfigButton');

  if (configFileSelect.value) {
    // Clear and disable the file input
    backupFileInput.value = '';
    backupFileInput.setAttribute('disabled', 'disabled');
    document.getElementById('backupFileLabel').textContent = 'Import backup';

    // Load the selected config and enable write button
    loadPresetConfig();
  } else {
    // Re-enable the file input
    backupFileInput.removeAttribute('disabled');
    writeConfigButton.classList.add('disabled');
  }
}

function handleBackupFileSelect() {
  const file = document.getElementById('backupFileInput').files[0];
  const configFileSelect = document.getElementById('configFileSelect');
  const writeConfigButton = document.getElementById('writeConfigButton');

  if (file) {
    // If a file is selected, reset and disable the dropdown
    configFileSelect.value = '';
    configFileSelect.setAttribute('disabled', 'disabled');

    // Update the file label with the selected filename
    document.getElementById('backupFileLabel').textContent = file.name;

    // Process the file - this function should be defined in tool_configurator.js
    loadConfigFile(file);
  } else {
    // If no file is selected, re-enable the dropdown
    configFileSelect.removeAttribute('disabled');
    writeConfigButton.classList.add('disabled');
  }
}

// Add this to the script section

// Global variable to store custom firmware
let customFirmwareBuffer = null;

document.addEventListener('DOMContentLoaded', function() {
  const firmwareFileSelect = document.getElementById('firmwareFileSelect');
  const customFirmwareInput = document.getElementById('customFirmwareInput');
  const flashButton = document.getElementById('flashButton');
  const downloadFirmwareButton = document.getElementById('downloadFirmwareButton');

  // Apply custom file input styling
  bsCustomFileInput.init();

  // Connect flash button to the flashFirmware function
  flashButton.addEventListener('click', flashFirmware);
  
  // Initial state check
  if (firmwareFileSelect.value === '') {
    downloadFirmwareButton.classList.add('disabled');
  }
});

// Handle firmware dropdown selection
function handleFirmwareSelect() {
  const firmwareFileSelect = document.getElementById('firmwareFileSelect');
  const customFirmwareInput = document.getElementById('customFirmwareInput');
  const downloadFirmwareButton = document.getElementById('downloadFirmwareButton');
  
  // Reset custom firmware buffer
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
      customFirmwareBuffer = new Uint8Array(e.target.result);
      log(`Custom firmware loaded: ${file.name} (${customFirmwareBuffer.length} bytes)`);
    };
    
    reader.onerror = function() {
      log('Error reading firmware file.');
      customFirmwareBuffer = null;
    };
    
    reader.readAsArrayBuffer(file);
  } else {
    // If no file is selected, re-enable the dropdown
    firmwareFileSelect.removeAttribute('disabled');
    document.getElementById('customFirmwareLabel').textContent = 'Upload custom firmware';
  }
}

// Modified download firmware function
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
}

// Modified flash firmware function to handle both dropdown and custom file
function flashFirmware() {
  const firmwareFileSelect = document.getElementById('firmwareFileSelect');
  const selectedFirmware = firmwareFileSelect.value;
  const consoleElement = document.getElementById('console');
  
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

// Utility function to log to console
function log(message, replace = false) {
  const consoleElement = document.getElementById('console');
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
