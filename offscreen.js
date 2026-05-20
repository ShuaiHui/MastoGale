// Offscreen document script for playing notifications audio in Manifest V3

chrome.runtime.onMessage.addListener((message) => {
	if (message.target === 'offscreen' && message.action === 'play-audio') {
		const audio = new Audio(message.src);
		audio.volume = message.volume !== undefined ? message.volume : 1;
		audio.play().catch((err) => {
			console.error('Offscreen document failed to play audio:', err);
		});
	}
});
