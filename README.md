# IU2FRL Quansheng modding tool

This is an online flasher tool for the Quansheng UV-K5, UV-K6, UV-K5(8), and UV-5R Plus handheld radios. It works by connecting to your radio through a compatible programming cable using Web Serial API.

## Features

### Firmware Flasher Features

* Multiple Firmware Options: Choose from pre-configured firmware versions or upload your own custom firmware
* Firmware Download: Download firmware files to your PC for manual flashing or backup
* Automatic Version Detection: The tool automatically detects firmware versions and handles compatibility checks
* Bootloader Communication: Direct communication with the radio's bootloader for reliable flashing
* Progress Monitoring: Real-time progress updates during the flashing process
* Size Verification: Automatic verification of firmware size to ensure compatibility

### Radio Configurator Features

* Read Configuration: Read and display your radio's current configuration without modifying the firmware
* Write Configuration: Save modified settings back to your radio's EEPROM
* Automatic Backups: Option to automatically create backup files when reading configurations
* Configuration Presets: Load pre-configured settings specifically designed for different firmware versions
* Import/Export: Import configuration from backup files or export your current settings
* Radio Reboot: Automatically reboots the radio after writing configuration changes

## Requirements

* Chromium-based browser (Chrome, Edge, Opera) with Web Serial API support
* Appropriate drivers for your programming cable (typically CH340, CH341 or CP210X chips)
* Stable connection during flashing and configuration processes
* For firmware flashing: Radio must be in bootloader mode (hold PTT while powering on)
* For configuration: Radio must be in normal operating mode

## Credits

This project is derived from [UVTOOLS](https://github.com/egzumer/uvtools). I stripped all the non relevant parts and added some new features.
