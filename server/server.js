const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 3000;
const ALLOWED_ORIGIN = 'https://leetcode.com';

const sendResponse = (res,statusCode,message,origin = ALLOWED_ORIGIN,contentType = 'text/plain') => {
    res.writeHead(statusCode, {
        'Access-Control-Allow-Origin': origin,
        'Content-Type': contentType,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(message);
}

const logFilePath = path.join(__dirname,'server.log');
const writeLogMessage = (message, level = 'INFO') => {
    const now = new Date();
    const timeStamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString('en-GB')}`;    
    const entry = `[${timeStamp}] [${level}] ${message}\n`;
    try {
        fs.appendFileSync(logFilePath,entry);
    } catch (err) {
        console.error("failed to write log ",err);
        console.log("failed to log message..");
    }
}

const writeProblemToCSV = (data) => {
    const csvFilePath = path.join(__dirname, '..', 'data', 'problems.csv');
    const now = new Date();
    const timeStamp = now.toLocaleDateString('en-GB').split('/').join('-'); 
    const solvedProblem = data.problemNumber+"_"+data.problemName;
    const entry = `${timeStamp},${solvedProblem}\n`;
    
    try {
        fs.appendFileSync(csvFilePath,entry);
        writeLogMessage("Problem write into CSV.");
    } catch(err) {
        console.log("ERROR : Failed to write csv.")
        writeLogMessage("Failed to write to CSV.","ERROR");
    }
}

const server = http.createServer((req, res) => {
    if(req.method === 'OPTIONS') {
        sendResponse(res,204,'');
        return;
    }
    if(req.method === 'POST' && req.url === '/submit') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            console.log("Revceived data : ",body);
           
            try {
                const data = JSON.parse(body);
                writeLogMessage(`Data received from browser: ${data.problemNumber}-${data.problemName}`);
                writeProblemToCSV(data);
            } catch(err) {
                console.log("failed to parse json...");
                writeLogMessage("Invalid JSON received in request body.","ERROR");
                sendResponse(res,400,"Invalid JSON format. Could not parse body.")
                return;
            }
            sendResponse(res,200,"Data received sucessfully.");
        });
        return;
    }
    // fallback for other routes...
    sendResponse(res,404,"Route not found.");
});

server.listen(PORT, () => {
    writeLogMessage("server started on port: "+PORT);    
    console.log(`Server running at http://localhost:${PORT}`);
});

const handleShutdown = (signal) => {
    writeLogMessage(`Received ${signal} signal. Server shutting down.`);
    console.log("server shutting down....");
    process.exit(0);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

