const voterIdKey = 'sunday-school-voter-id-v1';
const topics = new Set(['calling', 'covenant', 'worship', 'sabbath', 'potter', 'courage']);

const form = document.querySelector('#vote-form');
const options = document.querySelector('#topic-options');
const submitButton = document.querySelector('#vote-submit');
const message = document.querySelector('#vote-message');
const results = document.querySelector('#vote-results');
const resultsList = document.querySelector('#results-list');
const resultsTotal = document.querySelector('#results-total');
const continueLink = document.querySelector('.vote-continue');
const resetButton = document.querySelector('#reset-votes');
let voterId;

function getVoterId() {
    try {
        let id = window.localStorage.getItem(voterIdKey);
        if (!id) {
            id = window.crypto.randomUUID();
            window.localStorage.setItem(voterIdKey, id);
        }
        return id;
    } catch {
        message.textContent = 'This poll needs browser storage to remember your anonymous voter ID. Please enable local storage.';
        options.disabled = true;
        submitButton.disabled = true;
        return null;
    }
}

function showResults(data) {
    resultsList.replaceChildren(...data.topics.map((topic) => {
        const item = document.createElement('li');
        const label = document.createElement('span');
        const tally = document.createElement('span');
        label.textContent = topic.title;
        tally.textContent = `${topic.votes} ${topic.votes === 1 ? 'vote' : 'votes'} · ${topic.percentage}%`;
        item.append(label, tally);
        return item;
    }));
    resultsTotal.textContent = `Total voters: ${data.totalVotes}`;
    results.hidden = false;
    form.hidden = true;
    continueLink.focus({ preventScroll: true });
}

async function loadResults() {
    try {
        const response = await fetch(`/api/results?voterId=${encodeURIComponent(voterId)}`);
        if (!response.ok) throw new Error(`Results request failed (${response.status}).`);
        const data = await response.json();
        if (data.voted) showResults(data);
    } catch {
        message.textContent = 'Could not connect to the poll server. Your vote has not been submitted.';
    }
}

voterId = getVoterId();
if (voterId) loadResults();

resetButton.addEventListener('click', async () => {
    const confirmed = window.confirm('Warning: this will permanently delete all poll votes and reset the results for everyone. This cannot be undone. Continue?');
    if (!confirmed) return;

    resetButton.disabled = true;
    try {
        const response = await fetch('/api/reset', {
            method: 'POST'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Reset request failed (${response.status}).`);
        window.alert('All votes have been reset.');
        window.location.reload();
    } catch (error) {
        window.alert(error.message || 'Could not reset votes. Please try again.');
        resetButton.disabled = false;
    }
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const topicId = new FormData(form).get('topic');
    if (!topics.has(topicId)) {
        message.textContent = 'Please choose a topic before submitting your vote.';
        return;
    }

    if (!voterId) return;
    submitButton.disabled = true;
    message.textContent = 'Submitting your vote…';
    try {
        const response = await fetch('/api/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voterId, topicId })
        });
        const data = await response.json();
        if (response.status === 409) {
            showResults(data.results);
            return;
        }
        if (!response.ok) throw new Error(data.error || `Vote request failed (${response.status}).`);
        showResults(data.results);
    } catch {
        message.textContent = 'Your vote could not be submitted. Please check your connection and try again.';
        submitButton.disabled = false;
    }
});
