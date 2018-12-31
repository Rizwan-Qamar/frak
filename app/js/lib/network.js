'use strict'

const Network = {
    ports: {
        main: 3000,
        play: 3001
    },
    servers: {
        main: null,
        play: null
    },
    connectedServers: [],
    addServers: (servers = []) => { // [{ip,name}]
        for (let toAdd in servers) {
            let exists;
            for (let existing in Network.connectedServers) {
                if (Network.connectedServers[existing].ip === servers[toAdd].ip) exists = true;
            }
            if (!exists) {
                console.log('Network: new local server found', servers[toAdd]);
                Network.connectedServers.push(servers[toAdd]);
                Network.checkServer(servers[toAdd]);
            }
        }
    },
    checkServer: (server) => {
        got(`http://${server.ip}:${Network.ports.main}`, {
            timeout: 1000,
            headers: {
                'client': DB.get('localip')
            }
        }).then(res => {
            let body = JSON.parse(res.body);

            for (let existing in Network.connectedServers) {
                if (Network.connectedServers[existing].ip === server.ip) {
                    Network.connectedServers[existing].movies = body.movies;
                    Network.connectedServers[existing].shows = body.shows;
                }
            }

            setTimeout(() => Network.checkServer(server), 10000);
        }).catch(() => {
            for (let existing in Network.connectedServers) {
                if (Network.connectedServers[existing].ip === server.ip) {
                    Network.connectedServers.splice(existing, 1);
                    console.log('Network: %s disconnected', server.name);
                }
            }
        });
    },
    buildMainServer: () => {
        //build json
        let movies = DB.get('local_movies');
        let shows = DB.get('local_shows');

        let json = {
            movies: movies,
            shows: shows,
            server: {
                ip: DB.get('localip'),
                name: process.env.COMPUTERNAME
            }
        };

        // only one main server running at a time
        if (Network.servers.main) {
            Network.servers.main.close();
            Network.servers.main = null;
        }

        //serve json
        Network.servers.main = http.createServer((req, res) => {
            // on GET, register the client and send back the json api
            if (req.method === 'GET') {
                //req.headers.client is the client IP
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.write(JSON.stringify(json));
                res.end();
                
                Network.addServers([{ip: req.headers.client}]);

            // on POST, serve the file to a new server and send back the url
            } else if (req.method === 'POST') {
                let body = '';
                req.on('data', (data) => {
                    body += data;
                });
                req.on('end', () => {
                    let file = JSON.parse(body);

                    // only one play server running at a time (TODO: allow 1 per client)
                    if (Network.servers.play) {
                        Network.servers.play.close();
                        Network.servers.play = null;
                    }

                    // serve the file
                    Network.servers.play = http.createServer((req2, res2) => {
                        res2.writeHead(200, {
                            'Content-Type': 'video/mp4',
                            'Content-Length': file.size
                        });
                        let readStream = fs.createReadStream(file.path);
                        readStream.pipe(res2);
                    }).listen(Network.ports.play);

                    console.log('Serving \'%s\' on port %d (requested by %s)', file.filename, Network.ports.play, req.headers.client);

                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.write(JSON.stringify({
                        file: file,
                        url: `http://${json.server.ip}:${Network.port.play}`
                    }));
                    res.end();
                });
            }
        });

        Network.servers.main.listen(Network.ports.main);
        console.log('Local server running on port %d', Network.ports.main);
        Network.findPeers();
    },
    findPeers: () => {
        let ip = DB.get('localip');
        let baseIp = ip.match(/\d+\.\d+\.\d+\./)[0];
        let ips = [];

        for (let i = 1; i < 255; i++) ips.push(baseIp+i);

        Promise.all(ips.map(ip => {
          return new Promise((resolve, reject) => {
            got('http://'+ip+':3000', {
                timeout: 500,
                headers: {
                    'client': DB.get('localip')
                }
            }).then(res => {
                let data = JSON.parse(res.body);
                resolve(data.server);
            }).catch(() => resolve());
          });
        })).then((responses) => {
            responses = responses.filter(n => n); // remove empty from array
            responses = responses.filter(n => n.ip !== ip); // remove this machine
            Network.addServers(responses);
        }).catch(console.error);
    }
};