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
let img_url = null;

server.on("request", connection_handler);
function connection_handler(req, res) {
	console.log(`New Request for ${req.url} from ${req.socket.remoteAddress}`);

	if (req.url == '/') {
		const main = fs.createReadStream('html/main.html');
		res.writeHead(200, { 'Content-Type': 'text/html' });
		main.pipe(res);
	}
	else if (req.url == '/favicon.ico') {
		let img_stream = fs.createReadStream('images/favicon.ico');
		img_stream.on('ready', () => {
			res.writeHead(200, { 'Content-Type': 'image/x-icon' });
			img_stream.pipe(res);
		});
	}


	else if (req.url == '/login') {
		const client_id = credentials.client_id;
		const redirect_uri = 'http://localhost:3000/verify';
		const state = '1234567890ABCDEF' || Math.random().toString(16).slice(2);
		res.writeHead(302, {
			"Location": `https://api.imgur.com/oauth2/authorize?client_id=${client_id}&response_type=code&state=${state}`
		});
		res.end();
	}
	
	else if (req.url.startsWith('/submit')) {
		let url = (new URL.URL('http://localhost:3000/' + req.url));
		img_url = url.searchParams.get('image');

		getImageInfo(img_url, (whatanime_image_info) => {
			whatanime_image_info = JSON.parse(whatanime_image_info);
			if (fs.existsSync(authentication_cache)) {
				cached_auth = JSON.parse(fs.readFileSync(authentication_cache, {
					encoding: 'utf-8'
				}));
				cache_valid = true;
			} else {
				cache_valid = false;
			}
			if(cache_valid) {
				const token_endpoint = 'https://api.imgur.com/3/image';
				const options = {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
						"Authorization": "Bearer "+cached_auth.access_token
					}
				};
				let imgur_req = https.request(token_endpoint, options);
				imgur_req.on('error', (err) => { throw err; });
				imgur_req.once('response', (incoming_msg_stream) => {
					stream_to_message(incoming_msg_stream, (data) => {
						_data = JSON.parse(data);
						console.log("-------- API CALL : Response (Imgur) : ", _data);
						if(_data.status == 200) {
							res.writeHead(302, {
								'Content-Type': `text/html`
							});
							res.write(`Uploaded <a href='${_data.data.link}' target="_blank">${_data.data.title}</a>`);
							res.end();
						} else {
							res.writeHead(302, {
								'Location': `/login`
							});
							res.end();	
						}
					});
				});
				let post_data = {
					image: img_url,
					name: whatanime_image_info.docs[0].title_english,
					title: whatanime_image_info.docs[0].title_english
				};
				console.log("-------- API CALL : Request (Imgur) : ", post_data);
				imgur_req.end(querystring.stringify(post_data));
			} else {
				res.writeHead(302, {
					'Location': `/login`
				});
				res.end();	
			}
		})
	}

	else if (req.url.startsWith('/verify')) {

		let url = (new URL.URL('http://localhost:3000/' + req.url));
		const code = url.searchParams.get('code');
		const token_endpoint = 'https://api.imgur.com/oauth2/token';
		const options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		};
		let auth_req = https.request(token_endpoint, options);
		auth_req.on('error', (err) => { throw err; });
		auth_req.once('response', (incoming_msg_stream) => {
			stream_to_message(incoming_msg_stream, received_auth);
			res.writeHead(302, {
				'Location': `/`
			});
			res.end();
		});
		let post_data = querystring.stringify({
			code: code,
			client_id: credentials.client_id,
			client_secret: credentials.client_secret,
			grant_type: 'authorization_code'
		});
		console.log(post_data)
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
	console.log("-------- API CALL : Request (WhatAnime) : ", { url: url });
	let _req = https.request('https://trace.moe/api/search?url=' + url);
	_req.on('error', (err) => { throw err; });
	_req.once('response', (incoming_msg_stream) => {
		stream_to_message(incoming_msg_stream, (data) => {
			console.log("-------- API CALL : Response (WhatAnime) : ", JSON.parse(data));
			callback(data);
		});
	});
	_req.end();
}