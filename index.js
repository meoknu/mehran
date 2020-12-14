/*
=-=-=-=-=-=-=-=-=-=-=-=-
Album Art Search
=-=-=-=-=-=-=-=-=-=-=-=-
Student ID:
Comment (Required):

=-=-=-=-=-=-=-=-=-=-=-=-
*/

const http = require('http');
const https = require('https');
const fs = require('fs');
const querystring = require('querystring');
const URL = require('url');
const credentials = require('./auth/credentials.json');
const { parse } = require('path');
const port = 3000;
const server = http.createServer();
const authentication_cache = './auth/authentication-res.json';
let cache_valid = false;

server.on("request", connection_handler);
function connection_handler(req, res) {
	console.log(`New Request for ${req.url} from ${req.socket.remoteAddress}`);

	if (req.url == '/') {
		const main = fs.createReadStream('html/main.html');
		res.writeHead(200, { 'Content-Type': 'text/html' });
		main.pipe(res);
	}
	else if (req.url == '/login') {
		const client_id = credentials.client_id;
		const redirect_uri = 'http://localhost:3000/verify';
		const state = '1234567890ABCDEF' || Math.random().toString(16).slice(2);
		res.writeHead(302, {
			'Location': `https://dribbble.com/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&state=${state}`
		});
		res.end();
	}
	else if (req.url == '/favicon.ico') {
		let img_stream = fs.createReadStream('images/favicon.ico');
		img_stream.on('ready', () => {
			res.writeHead(200, { 'Content-Type': 'image/x-icon' });
			img_stream.pipe(res);
		});
	}
	else if (req.url == '/images/banner.jpg') {
		let img_stream = fs.createReadStream('images/banner.jpg');
		img_stream.on('ready', () => {
			res.writeHead(200, { 'Content-Type': 'image/x-icon' });
			img_stream.pipe(res);
		});
	}
	else if (req.url.startsWith('/album-art/')) {
		res.writeHead(200, { 'Content-Type': 'text/html' });
		res.write("REPLACE WITH IMAGE");
		res.end();
	}
	else if (req.url.startsWith('/search')) {
		let url = (new URL.URL('http://localhost:3000/' + req.url));
		res.writeHead(200, { 'Content-Type': 'text/html' });
		res.write(url.searchParams);
		res.end();
	}
	else if (req.url.startsWith('/weather')) {
		let url = (new URL.URL('http://localhost:3000/' + req.url));
		var weatherData;
		const location = url.searchParams.get('location');
		const weather_api = `https://www.metaweather.com/api/location/search/?query=${location}`;
		https.get(weather_api, (resp) => {
			let data = '';
			resp.on('data', (chunk) => {
				data += chunk;
			});
			resp.on('end', () => {
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.write(data);
				res.end();
			});
		}).on("error", (err) => {
			console.log(err);
			weatherData = err
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.write('<h1>Error</h1>');
			res.end();
		});
	}
	else if (req.url.startsWith('/me')) {
		if (fs.existsSync(authentication_cache)) {
			cached_auth = JSON.parse(fs.readFileSync(authentication_cache, {
				encoding: 'utf-8'
			}));
			cache_valid = true;
		}
		console.log('cached_auth:', cached_auth);
		if (cache_valid) {
			let _req = https.request('https://api.dribbble.com/v2/user/shots?access_token=' + cached_auth.access_token);
			_req.on('error', (err) => { throw err; });
			_req.once('response', (incoming_msg_stream) => {
				stream_to_message(incoming_msg_stream, (data) => {
					var parsedData = JSON.parse(data);
					console.log(parsedData.message == 'Bad credentials.');
					if (parsedData.message == 'Bad credentials.') {
						res.writeHead(302, {
							'Location': `/`
						});
						res.end();
						return;
					}
					if(parsedData.length) {
						var image = parsedData[0].images.hidpi;
						getImageInfo(image, (data) => {
							parsedData[0].docs = JSON.parse(data);
							res.writeHead(200, { 'Content-Type': 'application/json' });
							res.write(JSON.stringify(parsedData));
							res.end();
						});
					} else {
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.write(data);
						res.end();
					}
				});
			});
			_req.end();
		}
		else {
			res.writeHead(302, {
				'Location': `/login`
			});
			res.end();
		}
	}
	else if (req.url.startsWith('/verify')) {
		let url = (new URL.URL('http://localhost:3000/' + req.url));
		const code = url.searchParams.get('code');
		const token_endpoint = 'https://dribbble.com/oauth/token';
		const options = {
			method: 'POST'
		};
		let auth_req = https.request(token_endpoint, options);
		auth_req.on('error', (err) => { throw err; });
		auth_req.once('response', (incoming_msg_stream) => {
			stream_to_message(incoming_msg_stream, received_auth);
			res.writeHead(302, {
				'Location': `/me`
			});
			res.end();
		});
		let post_data = querystring.stringify({
			code: code,
			client_id: credentials.client_id,
			client_secret: credentials.client_secret,
			redirect_uri: 'http://localhost:3000/verify'
		});
		auth_req.end(post_data);
	}
	else {
		res.writeHead(404);
		res.end();
	}
}

server.on("listening", listening_handler);
function listening_handler() {
	console.log(`Now Listening on Port ${port}`);
}

server.listen(port);

function create_access_token_cache(dribbble_auth) {
	let data = JSON.stringify(dribbble_auth);
	fs.writeFileSync(authentication_cache, data);
}

function received_auth(auth_message) {
	console.log('auth_message:', auth_message);
	let dribbble_auth = JSON.parse(auth_message);
	create_access_token_cache(dribbble_auth);
}

function stream_to_message(stream, callback) {
	let body = '';
	stream.on('data', (chunk) => body += chunk);
	stream.on('end', () => callback(body));
}

function getImageInfo(url, callback) {
	let _req = https.request('https://trace.moe/api/search?url=' + url);
	_req.on('error', (err) => { throw err; });
	_req.once('response', (incoming_msg_stream) => {
		stream_to_message(incoming_msg_stream, (data) => {
			callback(data);
		});
	});
	_req.end();
}