'use strict';

const fs = require('graceful-fs');

module.exports = (() => {
    const logsFolder = 'logs';
    if (!fs.existsSync(logsFolder)) fs.mkdirSync(logsFolder);
    
    return require('simple-node-logger').createRollingFileLogger({
        logDirectory: logsFolder, // Folder should exist before run
        fileNamePattern: 'roll-<DATE>.log',
        dateFormat: 'DD-MM-YYYY',
        level: 'all'
    });
})();