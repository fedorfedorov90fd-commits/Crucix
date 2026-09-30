console.log('sentiment-adapter.js загружен');
window.sentimentAdapter = { analyze: function(text) { return { score: 0, label: 'neutral' }; } };
console.log('sentiment-adapter.js готов');
