const http = require('http')

const server = http.createServer((req, res) => {
    console.log(req);
    res.writeHead(200,{'Content-Type': 'text/plain'});
    res.end("OK");
    
})

server.listen(3000, () => {
    console.log("listening on port 3000");
});

