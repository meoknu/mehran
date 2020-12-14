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
			'Location': `https://dribbble.com/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&state=${state}&scope=public+upload`
		});
		res.end();
	}
	
	else if (req.url.startsWith('/submit')) {
		let url = (new URL.URL('http://localhost:3000/' + req.url));
		img_url = url.searchParams.get('image');

		// store image
		const file = fs.createWriteStream("images.jpg");
		const request = https.get(img_url, function(response) {
			response.pipe(file);
		});
		res.writeHead(200, { 'Content-Type': 'text/html' });

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
	
			console.log(whatanime_image_info.docs[0].title_english)
			if(cache_valid) {
				// posting image to user's accout
				
				// let post_data = {
				// 	image: fs.createReadStream('images.jpg'),
				// 	title: whatanime_image_info.docs[0].title
				// };

				var fContent = fs.readFileSync( 'images.jpg' );
				var boundary = '69b2c2b9c464731d'
				var content = "------"+boundary+"\r\n"
				+ "Content-Disposition: form-data; name=\"title\" \r\n"
				+ "\r\n"
				+ 'asdasd' + "\r\n"
				+ "------"+boundary+"\r\n"
				+ "Content-Disposition: form-data; name=\"image\"; filename=\"images.jpg\"\r\n"
				// + "Content-Type: image/jpg\r\n"
				// + "Content-Transfer-Encoding: utf-8\r\n"
				+ "\r\n"
				+ fContent + "\r\n"
				+ "------"+boundary+"--\r\n";

				const options = {
					host: 'api.dribbble.com',
					port: '443',
					path: '/v2/shots',
					method: 'POST',
					headers: {
						'Authorization': 'Bearer '+cached_auth.access_token,
						'Content-Type': 'multipart/form-data; boundary=----'+boundary,
						'Content-Length': Buffer.byteLength(content)
					}
				};
				let upload_req = https.request(options);
				upload_req.on('error', (err) => { throw err; });
				upload_req.once('response', (incoming_msg_stream) => {
					stream_to_message(incoming_msg_stream, (data) => {
						console.log("after uploading", data);
					});
					// res.writeHead(302, {
					// 	'Location': `/me`
					// });
					// res.end();
				});
				upload_req.end(content);
				

			} else {
				console.log("Must Login")
				// res.writeHead(302, {
				// 	'Location': `/login`
				// });
				// res.end();	
			}
	
			res.write(url.searchParams.get('image'));
			res.end();


		})






		// get access_token if available
		
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
					// if(parsedData.length) {
					// 	var image = parsedData[0].images.hidpi;
					// 	getImageInfo(image, (data) => {
					// 		parsedData[0].docs = JSON.parse(data);
					// 		res.writeHead(200, { 'Content-Type': 'application/json' });
					// 		res.write(JSON.stringify(parsedData));
					// 		res.end();
					// 	});
					// } else {
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.write(data);
						res.end();
					// }
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