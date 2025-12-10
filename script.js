document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map-placeholder', {zoomControl:false}).setView([42.8746, 74.5698], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    let marker = null;
    let controller = null;
    let clickTimeout = null;

    const statusEl = document.getElementById('status');

    function showStatus(text) {
        statusEl.textContent = text;
        statusEl.classList.remove('status-hidden');
    }
    function hideStatus() {
        statusEl.classList.add('status-hidden');
    }

    // debounce short clicks to avoid spamming requests
    const DEBOUNCE_MS = 150;

    map.on('click', (e) => {
        if (clickTimeout) clearTimeout(clickTimeout);
        clickTimeout = setTimeout(() => {
            handleMapClick(e.latlng);
        }, DEBOUNCE_MS);
    });

    async function handleMapClick(latlng) {
        const {lat, lng} = latlng;

        // Cancel previous in-flight request
        if (controller) {
            try { controller.abort(); } catch (err) {}
            controller = null;
        }
        controller = new AbortController();
        const signal = controller.signal;

        // Immediately provide visual feedback: move view and show temporary marker/popup
        if (marker) map.removeLayer(marker);
        marker = L.marker([lat, lng]).addTo(map);
        marker.bindPopup('Searching…').openPopup();
        showStatus('Searching…');

        // Use Nominatim reverse endpoint
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`;

        try {
            const resp = await fetch(url, { method: 'GET', signal });
            if (!resp.ok) {
                throw new Error('Network response not OK: ' + resp.status);
            }
            const data = await resp.json();

            const display = data.display_name || 'No address found';
            // update marker popup
            if (marker) {
                marker.setPopupContent(display);
                marker.openPopup();
            }
        } catch (err) {
            // If the fetch was aborted, we silently ignore (user clicked again)
            if (err.name === 'AbortError') {
                // aborted — nothing to show
                return;
            }
            // show error message in popup
            const msg = (err && err.message) ? err.message : 'Error';
            if (marker) {
                marker.setPopupContent('Ошибка: ' + msg);
                marker.openPopup();
            }
            console.error('Reverse geocode failed:', err);
        } finally {
            hideStatus();
            controller = null;
        }
    }
});
