const path = require('path')

console.log(path.dirname(__filename)); // console dirname

console.log(path.basename(__filename)); // console filename

console.log(path.extname(__filename)); // console extension

console.log(path.parse(__filename)); // console root, dir, basename, extension, filename

console.log(path.join(__dirname, 'test', 'hello.txt')); // console join path

console.log(path.resolve(__dirname, 'test', 'hello.txt')); // console resolve path

console.log(path.relative('test/hello.txt', 'test/world/hello.txt')); // console relative path

console.log(path.isAbsolute('test/hello.txt')); // console check if path is absolute

console.log(path.normalize('test//hello.txt')); // console normalize path

console.log(path.sep); // console separator

console.log(path.delimiter); // console delimiter

console.log(path.format({ root: '/root', dir: 'test', base: 'hello.txt' })); // console format object to path

console.log(path.toNamespacedPath('test/hello.txt')); // console convert path to namespaced path

// console.log(path.fromNamespacedPath('test/hello.txt')); // console convert namespaced path to path

console.log(path.win32.resolve('test\\hello.txt')); // console resolve path on windows