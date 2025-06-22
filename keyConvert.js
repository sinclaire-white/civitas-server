const fs = require('fs');
const key = fs.readFileSync('./civitas-1443f-firebase-adminsdk-fbsvc-d5e10cc4c0.json', 'utf8');
const base64 = Buffer.from(key).toString('base64');
console.log(base64)