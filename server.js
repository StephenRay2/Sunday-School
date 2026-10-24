const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const dataDirectory = path.join(root, '.poll-data');
const votesFile = path.join(dataDirectory, 'votes.json');
const port = Number(process.env.PORT || 8765);
const topics = [
    { id: 'calling', title: 'Jeremiah’s calling' },
    { id: 'covenant', title: 'Covenants and returning to God' },
    { id: 'worship', title: 'Worship, justice, and daily life' },
    { id: 'sabbath', title: 'Keeping the Sabbath' },
    { id: 'potter', title: 'The potter and the clay' },
    { id: 'courage', title: 'Courage through opposition' }
];
const topicIds = new Set(topics.map((topic) => topic.id));
const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png'
};

function sendJson(response, status, body) {
    response.writeHead(status, {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
    });
    response.end(JSON.stringify(body));
}

function readVotes() {
    fs.mkdirSync(dataDirectory, { recursive: true });
    if (!fs.existsSync(votesFile)) return {};

    const parsed = JSON.parse(fs.readFileSync(votesFile, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Poll data must be a JSON object.');
    }
    for (const [voterId, topicId] of Object.entries(parsed)) {
        if (!isValidVoterId(voterId) || !topicIds.has(topicId)) {
            throw new Error('Poll data contains an invalid vote.');
        }
    }
    return parsed;
}

function writeVotes(votes) {
    fs.mkdirSync(dataDirectory, { recursive: true });
    const temporaryFile = `${votesFile}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryFile, `${JSON.stringify(votes, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporaryFile, votesFile);
}

function isValidVoterId(value) {
    return typeof value === 'string'
        && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getResults(votes) {
    const counts = new Map(topics.map((topic) => [topic.id, 0]));
    const totalVotes = Object.keys(votes).length;
    for (const topicId of Object.values(votes)) {
        counts.set(topicId, counts.get(topicId) + 1);
    }

    return {
        voted: true,
        totalVotes,
        topics: topics
            .map((topic, index) => ({
                ...topic,
                votes: counts.get(topic.id),
                percentage: totalVotes === 0 ? 0 : Math.round(counts.get(topic.id) / totalVotes * 100),
                index
            }))
            .sort((first, second) => second.votes - first.votes || first.index - second.index)
            .slice(0, 3)
            .map(({ index, ...topic }) => topic)
    };
}

function readRequestBody(request) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        request.on('data', (chunk) => {
            size += chunk.length;
            if (size > 4096) {
                reject(Object.assign(new Error('Request body is too large.'), { status: 413 }));
                request.destroy();
                return;
            }
            chunks.push(chunk);
        });
        request.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            } catch {
                reject(Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }));
            }
        });
        request.on('error', reject);
    });
}

function serveStatic(requestPath, response) {
    const relativePath = requestPath === '/' ? 'index.html' : requestPath.slice(1);
    const filePath = path.resolve(root, relativePath);
    if (!filePath.startsWith(`${root}${path.sep}`) || relativePath.split('/').some((part) => part.startsWith('.'))) {
        response.writeHead(404).end('Not found');
        return;
    }

    fs.stat(filePath, (error, stats) => {
        if (error || !stats.isFile()) {
            response.writeHead(404).end('Not found');
            return;
        }
        response.writeHead(200, {
            'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
            'X-Content-Type-Options': 'nosniff'
        });
        fs.createReadStream(filePath).pipe(response);
    });
}

const server = http.createServer(async (request, response) => {
    let requestUrl;
    try {
        requestUrl = new URL(request.url, 'http://localhost');
    } catch {
        sendJson(response, 400, { error: 'Invalid request URL.' });
        return;
    }

    try {
        if (requestUrl.pathname === '/api/results' && request.method === 'GET') {
            const voterId = requestUrl.searchParams.get('voterId');
            if (!isValidVoterId(voterId)) {
                sendJson(response, 400, { error: 'A valid voter ID is required.' });
                return;
            }
            const votes = readVotes();
            if (!Object.hasOwn(votes, voterId)) {
                sendJson(response, 200, { voted: false });
                return;
            }
            sendJson(response, 200, getResults(votes));
            return;
        }

        if (requestUrl.pathname === '/api/vote' && request.method === 'POST') {
            const body = await readRequestBody(request);
            if (!body || !isValidVoterId(body.voterId) || !topicIds.has(body.topicId)) {
                sendJson(response, 400, { error: 'A valid voter ID and topic are required.' });
                return;
            }
            const votes = readVotes();
            if (Object.hasOwn(votes, body.voterId)) {
                sendJson(response, 409, { error: 'This browser has already voted.', results: getResults(votes) });
                return;
            }
            votes[body.voterId] = body.topicId;
            writeVotes(votes);
            sendJson(response, 201, { results: getResults(votes) });
            return;
        }

        if (requestUrl.pathname === '/api/reset' && request.method === 'POST') {
            writeVotes({});
            sendJson(response, 200, { reset: true });
            return;
        }

        if (requestUrl.pathname.startsWith('/api/')) {
            sendJson(response, 404, { error: 'API endpoint not found.' });
            return;
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
            return;
        }
        serveStatic(decodeURIComponent(requestUrl.pathname), response);
    } catch (error) {
        console.error('Poll request failed:', error);
        if (!response.headersSent) sendJson(response, error.status || 500, {
            error: error.status ? error.message : 'The poll server encountered an error.'
        });
    }
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Sunday School poll server listening on http://localhost:${port}`);
});
