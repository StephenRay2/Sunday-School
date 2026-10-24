# Sunday School site and poll

Run the site and anonymous topic poll with Node.js 18 or newer:

```sh
node server.js
```

Open <http://localhost:8765>. Set the `PORT` environment variable to use a different port.

Votes are kept in `.poll-data/votes.json`, which is created on the first vote and excluded from Git. Back up or remove that file to preserve or reset the poll. Keep the server running for the event; this JSON-backed version is intended for one server instance and a small poll, not multiple server instances. Deploy the Node server on a host with persistent disk—the static GitHub Pages site alone cannot accept or save votes.

The anonymous ID is stored in each browser's local storage. The server accepts one vote per ID, but this does not verify a person's identity: clearing browser data or using another device allows another vote.

## Resetting votes

On a laptop or desktop, the **Reset all votes** button appears in the bottom-right corner of the poll. It asks you to confirm that every vote will be deleted, then clears the shared poll if confirmed. Anyone who can access the poll can use this reset button.
