const path = require('path')

console.log(path.dirname(__filename)); // console dirname

console.log(path.basename(__filename)); // console filename

console.log(path.extname(__filename)); // console extension

console.log(path.parse(__filename)); // console root, dir, basename, extension, filename

console.log(path.join(__dirname, 'test', 'hello.txt')); // console join path
