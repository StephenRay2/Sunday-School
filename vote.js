const pollKey = 'sunday-school-topic-vote-v1';
const topics = [
    { id: 'calling', title: 'Jeremiah’s calling' },
    { id: 'covenant', title: 'Covenants and returning to God' },
    { id: 'worship', title: 'Worship, justice, and daily life' },
    { id: 'sabbath', title: 'Keeping the Sabbath' },
    { id: 'potter', title: 'The potter and the clay' },
    { id: 'courage', title: 'Courage through opposition' }
];

const form = document.querySelector('#vote-form');
const options = document.querySelector('#topic-options');
const submitButton = document.querySelector('#vote-submit');
const message = document.querySelector('#vote-message');
const results = document.querySelector('#vote-results');
const resultsList = document.querySelector('#results-list');
const resultsTotal = document.querySelector('#results-total');
const continueLink = document.querySelector('.vote-continue');

function getSavedVote() {
    try {
        const savedVote = window.localStorage.getItem(pollKey);
        if (!savedVote) return null;

        const vote = JSON.parse(savedVote);
        return topics.some((topic) => topic.id === vote.topicId) ? vote : null;
    } catch {
        message.textContent = 'Your browser could not access saved poll data. Please enable local storage to vote.';
        options.disabled = true;
        submitButton.disabled = true;
        return null;
    }
}

function showResults(vote) {
    const voteCounts = new Map(topics.map((topic) => [topic.id, 0]));
    voteCounts.set(vote.topicId, 1);
    const totalVotes = 1;

    const leaders = topics
        .map((topic, index) => ({ ...topic, count: voteCounts.get(topic.id), index }))
        .sort((first, second) => second.count - first.count || first.index - second.index)
        .slice(0, 3);

    resultsList.replaceChildren(...leaders.map((topic) => {
        const item = document.createElement('li');
        const label = document.createElement('span');
        const tally = document.createElement('span');
        label.textContent = topic.title;
        tally.textContent = `${topic.count} ${topic.count === 1 ? 'vote' : 'votes'} · ${Math.round(topic.count / totalVotes * 100)}%`;
        item.append(label, tally);
        return item;
    }));
    resultsTotal.textContent = `Total voters recorded on this browser: ${totalVotes}`;
    results.hidden = false;
    form.hidden = true;
    continueLink.focus({ preventScroll: true });
}

const savedVote = getSavedVote();
if (savedVote) showResults(savedVote);

form.addEventListener('submit', (event) => {
    event.preventDefault();
    const selectedTopic = new FormData(form).get('topic');
    if (!topics.some((topic) => topic.id === selectedTopic)) {
        message.textContent = 'Please choose a topic before submitting your vote.';
        return;
    }

    try {
        window.localStorage.setItem(pollKey, JSON.stringify({ topicId: selectedTopic }));
        showResults({ topicId: selectedTopic });
    } catch {
        message.textContent = 'Your vote could not be saved. Please enable local storage and try again.';
    }
});
