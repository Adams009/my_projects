const http = require('http')

// const server = http.createServer((req, res) => {
//     console.log(req);
//     res.writeHead(200,{'Content-Type': 'text/plain'});
//     res.end("OK");
    
// })

// server.listen(3000, () => {
//     console.log("listening on port 3000");
// });

const server = http.createServer((req, res) => {
    const url = req.url
    if (url === '/') {
        res.writeHead(200,{'Content-Type': 'text/plain'});
        res.end("Welcome to the HomePage");
    } else if (url === '/register') {
        res.writeHead(200,{'Content-Type': 'text/plain'});
        res.end("Welcome to the Register Page");
    } else {
        res.writeHead(404,{'Content-Type': 'text/plain'});
        res.end("Page Not Found");
    }
})

server.listen(3000, () => {
    console.log("listening on port 3000");
});

