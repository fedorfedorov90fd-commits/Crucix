console.log('heat-timeline.js загружен');
function initHeatTimeline() {
    var panel = document.getElementById('timeline-panel');
    if (!panel) return;
    var track = document.getElementById('timeline-track');
    if (!track) return;
    var html = '';
    for (var i = 0; i < 30; i++) {
        var intensity = Math.random();
        var height = Math.round(20 + intensity * 60);
        var color = intensity > 0.7 ? '#ef4444' : intensity > 0.4 ? '#f59e0b' : '#22c55e';
        html += '<div class="timeline-bar" style="height:' + height + 'px;background:' + color + ';"></div>';
    }
    track.innerHTML = html;
    panel.style.display = 'block';
}
window.initHeatTimeline = initHeatTimeline;
console.log('heat-timeline.js готов');
