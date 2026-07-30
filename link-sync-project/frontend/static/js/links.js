// This file contains the frontend logic for fetching links from Firestore and handling user interactions.

document.addEventListener('DOMContentLoaded', function() {
    const gameButtons = document.querySelectorAll('.game-button');
    const messageBox = document.getElementById('message-box');
    const copyButton = document.getElementById('copy-button');
    const downloadButton = document.getElementById('download-button');

    gameButtons.forEach(button => {
        button.addEventListener('click', function() {
            const gameSlug = this.dataset.slug;
            fetchLinks(gameSlug);
        });
    });

    copyButton.addEventListener('click', function() {
        const linksText = document.getElementById('links-text').innerText;
        navigator.clipboard.writeText(linksText).then(() => {
            showMessage('Links copied to clipboard!');
        });
    });

    downloadButton.addEventListener('click', function() {
        const linksText = document.getElementById('links-text').innerText;
        const blob = new Blob([linksText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'links.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showMessage('links.txt downloaded!');
    });

    function fetchLinks(gameSlug) {
        fetch(`/api/links/${gameSlug}`)
            .then(response => response.json())
            .then(data => {
                displayLinks(data.links);
            })
            .catch(error => {
                showMessage('Error fetching links: ' + error.message);
            });
    }

    function displayLinks(links) {
        const linksText = document.getElementById('links-text');
        linksText.innerText = links.join('\n');
        showMessage('Links fetched successfully!');
    }

    function showMessage(message) {
        messageBox.innerText = message;
        setTimeout(() => {
            messageBox.innerText = '';
        }, 3000);
    }
});