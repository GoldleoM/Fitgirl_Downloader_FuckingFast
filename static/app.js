// Normalize API base URL (remove any trailing slashes)
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ""
    : "https://fitboy-backend.vercel.app".replace(/\/+$/, "");

function formatApiUrl(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return API_BASE ? `${API_BASE}${cleanPath}` : cleanPath;
}

function formatCoverUrl(url) {
    if (!url || url === 'None') return '/static/images/placeholder.svg';
    if (url.startsWith('/api/')) return formatApiUrl(url);
    if (url.startsWith('/static/')) return formatApiUrl(url);
    return url;
}

// All fetch calls route through formatApiUrl for clean, redirect-free requests
function apiFetch(path, options = {}) {
    return fetch(formatApiUrl(path), options);
}

function initApp() {
    const gamesGrid = document.getElementById('gamesGrid');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const catalogTitle = document.getElementById('catalogTitle');

    // Modals
    const gameModal = document.getElementById('gameModal');
    const closeModal = document.getElementById('closeModal');
    const modalBody = document.getElementById('modalBody');

    // Drawer
    const downloadDrawer = document.getElementById('downloadDrawer');
    const closeDrawer = document.getElementById('closeDrawer');
    const drawerGameTitle = document.getElementById('drawerGameTitle');
    const drawerStatusText = document.getElementById('drawerStatusText');
    const progressBar = document.getElementById('progressBar');
    const progressCounter = document.getElementById('progressCounter');
    const progressPercentBadge = document.getElementById('progressPercentBadge');
    const currentPartText = document.getElementById('currentPartText');
    const terminalLogs = document.getElementById('terminalLogs');
    const copyClipboardBtn = document.getElementById('copyClipboardBtn');
    const downloadTxtBtn = document.getElementById('downloadTxtBtn');
    const browserBatchBtn = document.getElementById('browserBatchBtn');

    let currentJobId = null;
    let pollInterval = null;
    let extractedLinksCache = [];

    const btnPopular = document.getElementById('btnPopular');
    const btnLatest = document.getElementById('btnLatest');
    const searchSuggestions = document.getElementById('searchSuggestions');

    // Live Search Suggestions State
    let suggestDebounceTimer = null;
    let activeSuggestionIdx = -1;
    let currentSuggestionsList = [];

    function hideSuggestions() {
        if (searchSuggestions) {
            searchSuggestions.classList.add('hidden');
            searchSuggestions.innerHTML = '';
        }
        activeSuggestionIdx = -1;
        currentSuggestionsList = [];
    }

    function updateActiveSuggestion(items) {
        items.forEach((it, idx) => {
            if (idx === activeSuggestionIdx) {
                it.classList.add('active');
                it.scrollIntoView({ block: 'nearest' });
            } else {
                it.classList.remove('active');
            }
        });
    }

    function selectSuggestion(item) {
        hideSuggestions();
        if (searchInput) searchInput.value = item.title;
        openGameModal(item.url, item.slug, item.cover);
    }

    async function fetchSuggestions(query) {
        if (!query || query.length < 2) {
            hideSuggestions();
            return;
        }

        try {
            const res = await apiFetch(`/api/suggest?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.success && data.suggestions && data.suggestions.length > 0) {
                currentSuggestionsList = data.suggestions;
                renderSuggestions(data.suggestions, query);
            } else {
                hideSuggestions();
            }
        } catch (e) {
            hideSuggestions();
        }
    }

    function renderSuggestions(suggestions, query) {
        if (!searchSuggestions) return;
        activeSuggestionIdx = -1;

        searchSuggestions.innerHTML = suggestions.map((item, idx) => {
            const isResolved = item.resolved;
            const badgeClass = isResolved ? 'available' : 'unavailable';
            const badgeText = isResolved ? '<i class="fa-solid fa-bolt"></i> 1-Click Ready' : '<i class="fa-solid fa-cloud"></i> Repack';
            const coverUrl = formatCoverUrl(item.cover);
            
            return `
            <div class="suggestion-item" data-index="${idx}" data-url="${item.url}" data-slug="${item.slug}">
                <img class="suggestion-thumb" src="${coverUrl}" alt="${item.title}" onerror="this.onerror=null; this.src='/static/images/placeholder.svg';">
                <div class="suggestion-info">
                    <div class="suggestion-title" title="${item.title}">${item.title}</div>
                    <div class="suggestion-meta">
                        <span><i class="fa-solid fa-hard-drive"></i> ${item.repack_size || 'N/A'}</span>
                        <span><i class="fa-solid fa-layer-group"></i> ${item.parts_count || 0} Parts</span>
                    </div>
                </div>
                <span class="suggestion-badge ${badgeClass}">${badgeText}</span>
            </div>
            `;
        }).join('') + `
        <div class="suggestion-footer-tip">
            <span><i class="fa-solid fa-keyboard"></i> Use ↑↓ to navigate</span>
            <span>Press <strong>Enter ↵</strong> to search all</span>
        </div>
        `;

        searchSuggestions.classList.remove('hidden');

        // Add click listeners to items
        searchSuggestions.querySelectorAll('.suggestion-item').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.getAttribute('data-index'), 10);
                if (currentSuggestionsList[idx]) {
                    selectSuggestion(currentSuggestionsList[idx]);
                }
            });
        });
    }

    // Search Input Event Listeners
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (suggestDebounceTimer) clearTimeout(suggestDebounceTimer);
            if (val.length < 2) {
                hideSuggestions();
                return;
            }
            suggestDebounceTimer = setTimeout(() => {
                fetchSuggestions(val);
            }, 200);
        });

        searchInput.addEventListener('keydown', (e) => {
            const isHidden = !searchSuggestions || searchSuggestions.classList.contains('hidden');
            
            if (e.key === 'ArrowDown' && !isHidden) {
                e.preventDefault();
                const items = searchSuggestions.querySelectorAll('.suggestion-item');
                if (items.length > 0) {
                    activeSuggestionIdx = (activeSuggestionIdx + 1) % items.length;
                    updateActiveSuggestion(items);
                }
            } else if (e.key === 'ArrowUp' && !isHidden) {
                e.preventDefault();
                const items = searchSuggestions.querySelectorAll('.suggestion-item');
                if (items.length > 0) {
                    activeSuggestionIdx = (activeSuggestionIdx - 1 + items.length) % items.length;
                    updateActiveSuggestion(items);
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (!isHidden && activeSuggestionIdx >= 0 && currentSuggestionsList[activeSuggestionIdx]) {
                    selectSuggestion(currentSuggestionsList[activeSuggestionIdx]);
                } else {
                    hideSuggestions();
                    handleSearch();
                }
            } else if (e.key === 'Escape') {
                hideSuggestions();
            }
        });
    }

    // Dismiss suggestions on click outside
    document.addEventListener('click', (e) => {
        if (searchInput && searchSuggestions && !searchInput.contains(e.target) && !searchSuggestions.contains(e.target)) {
            hideSuggestions();
        }
    });

    // Filter toggle listeners
    if (btnPopular) {
        btnPopular.addEventListener('click', () => {
            btnPopular.classList.add('active');
            if (btnLatest) btnLatest.classList.remove('active');
            loadPopular();
        });
    }

    if (btnLatest) {
        btnLatest.addEventListener('click', () => {
            btnLatest.classList.add('active');
            if (btnPopular) btnPopular.classList.remove('active');
            loadCatalog();
        });
    }

    if (searchBtn) searchBtn.addEventListener('click', () => {
        hideSuggestions();
        handleSearch();
    });

    if (closeModal) closeModal.addEventListener('click', () => {
        if (gameModal) gameModal.classList.add('hidden');
    });

    if (closeDrawer) closeDrawer.addEventListener('click', () => {
        if (downloadDrawer) downloadDrawer.classList.add('hidden');
        if (pollInterval) clearInterval(pollInterval);
    });

    // Guide Tab Switching
    document.querySelectorAll('.guide-tab').forEach(tabBtn => {
        tabBtn.addEventListener('click', () => {
            document.querySelectorAll('.guide-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

            tabBtn.classList.add('active');
            const targetTab = tabBtn.getAttribute('data-tab');
            const contentElem = document.getElementById(`tab-${targetTab}`);
            if (contentElem) contentElem.classList.remove('hidden');
        });
    });

    // --- Copy URLs: client-side clipboard via navigator.clipboard ---
    copyClipboardBtn.addEventListener('click', async () => {
        if (extractedLinksCache && extractedLinksCache.length > 0) {
            // Use cached links directly — works everywhere including Vercel
            const linksText = extractedLinksCache.join('\n');
            try {
                await navigator.clipboard.writeText(linksText);
                const origText = copyClipboardBtn.innerHTML;
                copyClipboardBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                copyClipboardBtn.style.background = 'var(--gradient-purple)';
                setTimeout(() => {
                    copyClipboardBtn.innerHTML = origText;
                    copyClipboardBtn.style.background = '';
                }, 2500);
                alert(`📋 ${extractedLinksCache.length} direct URLs copied to Clipboard!\n\nYou can now paste them into FDM, JDownloader 2, IDM, or Motrix.`);
                return;
            } catch (clipErr) {
                // Fallback: try server-side copy (local server only)
                console.warn('navigator.clipboard failed, trying server fallback:', clipErr);
            }
        }

        // Fallback: try server endpoint (works on local server with Windows clip)
        try {
            const res = await apiFetch('/api/copy_clipboard', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                // If server returned links, also cache them
                if (data.links && data.links.length > 0) {
                    extractedLinksCache = data.links;
                    // Try client-side clipboard with the returned links
                    try {
                        await navigator.clipboard.writeText(data.links.join('\n'));
                    } catch (_) { /* server already copied via clip */ }
                }
                const origText = copyClipboardBtn.innerHTML;
                copyClipboardBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                copyClipboardBtn.style.background = 'var(--gradient-purple)';
                setTimeout(() => {
                    copyClipboardBtn.innerHTML = origText;
                    copyClipboardBtn.style.background = '';
                }, 2500);
                alert('📋 Direct URLs copied to Clipboard!\n\nYou can now paste them into FDM, JDownloader 2, IDM, or Motrix.');
            } else {
                alert('Error: ' + data.error);
            }
        } catch (e) {
            alert('Failed to copy to clipboard');
        }
    });

    // --- Save links.txt: client-side Blob download ---
    downloadTxtBtn.addEventListener('click', () => {
        if (extractedLinksCache && extractedLinksCache.length > 0) {
            // Generate file client-side from cached links
            const blob = new Blob([extractedLinksCache.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'download_links.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            // Fallback: try server endpoint (local server with file)
            window.open(`${API_BASE}/api/download_txt`, '_blank');
        }
    });

    browserBatchBtn.addEventListener('click', () => {
        if (!extractedLinksCache || extractedLinksCache.length === 0) {
            alert('No links available to download.');
            return;
        }

        const total = extractedLinksCache.length;
        const msg = `Starting download of all ${total} parts directly in your browser.\n\n` +
            `IMPORTANT: If Chrome/Edge shows a prompt asking "Allow downloading multiple files?", click ALLOW so all parts download!`;

        if (confirm(msg)) {
            const origText = browserBatchBtn.innerHTML;
            browserBatchBtn.disabled = true;

            extractedLinksCache.forEach((link, idx) => {
                setTimeout(() => {
                    browserBatchBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Downloading (${idx + 1}/${total})...`;

                    const iframe = document.createElement('iframe');
                    iframe.style.display = 'none';
                    iframe.src = link;
                    document.body.appendChild(iframe);

                    setTimeout(() => {
                        try { document.body.removeChild(iframe); } catch (e) { }
                    }, 45000);

                    if (idx === total - 1) {
                        setTimeout(() => {
                            browserBatchBtn.innerHTML = '<i class="fa-solid fa-check"></i> All Started!';
                            browserBatchBtn.style.background = 'var(--gradient-purple)';
                            setTimeout(() => {
                                browserBatchBtn.disabled = false;
                                browserBatchBtn.innerHTML = origText;
                                browserBatchBtn.style.background = '';
                            }, 4000);
                        }, 1000);
                    }
                }, idx * 1200); // 1.2s delay between parts to avoid browser throttling
            });
        }
    });

    const paginationContainer = document.getElementById('paginationContainer');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageNumbers = document.getElementById('pageNumbers');

    let currentMode = 'popular';
    let currentPage = 1;
    let totalPages = 1;

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) goToPage(currentPage - 1);
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (currentPage < totalPages) goToPage(currentPage + 1);
        });
    }

    function goToPage(p) {
        if (currentMode === 'popular') {
            loadPopular(p);
        } else if (currentMode === 'latest') {
            loadCatalog(p);
        }
        window.scrollTo({ top: gamesGrid.offsetTop - 100, behavior: 'smooth' });
    }

    function renderPagination(page, maxPages) {
        currentPage = page;
        totalPages = maxPages;

        if (!paginationContainer) return;

        if (totalPages <= 1) {
            paginationContainer.classList.add('hidden');
            return;
        }

        paginationContainer.classList.remove('hidden');
        if (prevPageBtn) prevPageBtn.disabled = (currentPage <= 1);
        if (nextPageBtn) nextPageBtn.disabled = (currentPage >= totalPages);

        let btnsHtml = '';
        let startP = Math.max(1, currentPage - 2);
        let endP = Math.min(totalPages, startP + 4);
        if (endP - startP < 4) {
            startP = Math.max(1, endP - 4);
        }

        for (let i = startP; i <= endP; i++) {
            const activeClass = i === currentPage ? 'active' : '';
            btnsHtml += `<button class="page-num-btn ${activeClass}" data-page="${i}">${i}</button>`;
        }
        if (pageNumbers) pageNumbers.innerHTML = btnsHtml;

        document.querySelectorAll('.page-num-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = parseInt(btn.getAttribute('data-page'));
                goToPage(p);
            });
        });
    }

    async function loadPopular(page = 1, isRetry = false) {
        currentMode = 'popular';
        if (btnPopular) btnPopular.classList.add('active');
        if (btnLatest) btnLatest.classList.remove('active');

        catalogTitle.innerHTML = `<i class="fa-solid fa-fire"></i> Top Repacks of the Year (Page ${page})`;
        gamesGrid.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Loading Top 150 Repacks of the Year (Page ${page})...</p>
            </div>
        `;
        try {
            const res = await apiFetch(`/api/popular?page=${page}&per_page=16`);
            const data = await res.json();
            if (data.success && data.results && data.results.length > 0) {
                renderGames(data.results);
                renderPagination(data.page, data.total_pages);
            } else if (!isRetry) {
                setTimeout(() => loadPopular(page, true), 1200);
            } else {
                renderGames(data.results || []);
            }
        } catch (e) {
            if (!isRetry) {
                setTimeout(() => loadPopular(page, true), 1200);
            } else {
                gamesGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: red;">Failed to load popular repacks.</p>`;
            }
        }
    }

    async function loadCatalog(page = 1) {
        currentMode = 'latest';
        if (btnLatest) btnLatest.classList.add('active');
        if (btnPopular) btnPopular.classList.remove('active');

        catalogTitle.innerHTML = `<i class="fa-solid fa-clock"></i> Latest Repacks (Page ${page})`;
        gamesGrid.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Loading Latest Repacks (Page ${page})...</p>
            </div>
        `;
        try {
            const res = await apiFetch(`/api/catalog?page=${page}`);
            const data = await res.json();
            if (data.success) {
                renderGames(data.catalog);
                renderPagination(page, 10);
            }
        } catch (e) {
            gamesGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: red;">Failed to load catalog from server.</p>`;
        }
    }

    async function handleSearch() {
        const query = searchInput.value.trim();
        if (!query) {
            if (currentMode === 'latest') return loadCatalog(1);
            return loadPopular(1);
        }

        if (paginationContainer) paginationContainer.classList.add('hidden');
        catalogTitle.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Search Results for "${query}"`;
        gamesGrid.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Searching FitGirl Repacks library...</p>
            </div>
        `;

        try {
            const res = await apiFetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.success) {
                renderGames(data.results);
            }
        } catch (e) {
            gamesGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: red;">Search request failed.</p>`;
        }
    }

    function renderGames(games) {
        if (!games || games.length === 0) {
            gamesGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No repacks found matching your search.</p>`;
            return;
        }

        gamesGrid.innerHTML = games.map(game => {
            const isResolved = game.resolved && ((game.direct_links && game.direct_links.length > 0) || (game.direct_links_count && game.direct_links_count > 0));
            const statusBadge = isResolved
                ? `<span class="badge-status badge-available"><i class="fa-solid fa-circle-check"></i> Links Available</span>`
                : `<span class="badge-status badge-unavailable"><i class="fa-solid fa-clock"></i> Links Not Available</span>`;

            return `
            <div class="game-card" data-url="${game.url}" data-slug="${game.slug || ''}">
                <img class="card-poster" src="${formatCoverUrl(game.cover)}" alt="${game.title}" loading="lazy" onerror="this.onerror=null; this.src='/static/images/placeholder.svg';">
                <div class="card-content">
                    <h3 class="card-title">${game.title}</h3>
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                        <span class="card-date">${game.date || 'FitGirl Repack'}</span>
                        ${statusBadge}
                    </div>
                    <div class="card-footer">
                        <button class="btn-get"><i class="fa-solid ${isResolved ? 'fa-bolt' : 'fa-eye'}"></i> ${isResolved ? 'Instant Download' : 'View Repack'}</button>
                        <a href="${game.url}" target="_blank" rel="noopener noreferrer" class="btn-fitgirl" onclick="event.stopPropagation()">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> FitGirl
                        </a>
                    </div>
                </div>
            </div>
            `;
        }).join('');

        // Add event listeners to cards
        document.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', () => {
                const gameUrl = card.getAttribute('data-url');
                const gameSlug = card.getAttribute('data-slug');
                const cardImg = card.querySelector('.card-poster')?.getAttribute('src') || '';
                openGameModal(gameUrl, gameSlug, cardImg);
            });
        });
    }

    async function openGameModal(gameUrl, gameSlug = '', cardPosterSrc = '') {
        gameModal.classList.remove('hidden');

        // Show initial loading modal using the already-loaded card poster for zero flicker
        const initialPoster = formatCoverUrl(cardPosterSrc || `/api/game_cover?url=${encodeURIComponent(gameUrl)}`);
        modalBody.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Loading game details & mirrors from database...</p>
            </div>
        `;

        try {
            const queryParam = gameSlug ? `slug=${encodeURIComponent(gameSlug)}` : `url=${encodeURIComponent(gameUrl)}`;
            const res = await apiFetch(`/api/game?${queryParam}`);
            const data = await res.json();
            if (data.success && data.game) {
                const g = data.game;
                const isResolved = g.resolved && g.direct_links && g.direct_links.length > 0;
                const partsCount = (g.direct_links && g.direct_links.length > 0) ? g.direct_links.length : (g.parts_count || (g.fuckingfast_links ? g.fuckingfast_links.length : 0));

                let finalCover = g.cover || cardPosterSrc;
                if (!finalCover || finalCover === 'None') {
                    finalCover = `/api/game_cover?url=${encodeURIComponent(g.url || gameUrl)}`;
                } else if (finalCover.startsWith('http') && !finalCover.startsWith('/api/image_proxy') && !finalCover.startsWith('/api/game_cover') && finalCover.indexOf('vercel.app/api/') === -1) {
                    finalCover = `/api/image_proxy?url=${encodeURIComponent(finalCover)}`;
                }
                finalCover = formatCoverUrl(finalCover);

                const alertBox = isResolved ? `
                    <div class="status-alert-box available">
                        <i class="fa-solid fa-circle-check"></i>
                        <div>
                            <strong>Direct Download Links Available in Database!</strong>
                            <p>All ${partsCount} direct download parts are pre-extracted in Firestore. Click below for instant 1-click download with zero wait time.</p>
                        </div>
                    </div>
                ` : `
                    <div class="status-alert-box unavailable">
                        <i class="fa-solid fa-cloud-arrow-down"></i>
                        <div>
                            <strong>Direct 1-Click Links Not Cached in Cloud Yet</strong>
                            <p>Copy the raw part links below and extract direct links in seconds on your PC using the standalone <strong>FitBoy Local Link Extractor (.exe)</strong> (zero dependencies / no installation).</p>
                        </div>
                    </div>
                `;

                modalBody.innerHTML = `
                    <div class="modal-detail-grid">
                        <div>
                            <img class="modal-poster" src="${finalCover}" alt="${g.title}" onerror="if(this.src.indexOf('/api/game_cover')===-1){this.src='/api/game_cover?url=${encodeURIComponent(g.url || gameUrl)}';}else{this.onerror=null;this.src='/static/images/placeholder.svg';}">
                        </div>
                        <div class="modal-info">
                            <h2>${g.title}</h2>
                            <div class="tags-row">
                                <span class="tag-badge"><i class="fa-solid fa-hard-drive"></i> Repack Size: ${g.repack_size || 'N/A'}</span>
                                <span class="tag-badge"><i class="fa-solid fa-layer-group"></i> ${partsCount} Parts in Database</span>
                                ${isResolved ? `<span class="tag-badge" style="background:rgba(0,255,135,0.15); color:#00ff87; border:1px solid rgba(0,255,135,0.4);"><i class="fa-solid fa-bolt"></i> Links Available</span>` : `<span class="tag-badge" style="background:rgba(255,170,0,0.12); color:#ffaa00; border:1px solid rgba(255,170,0,0.3);"><i class="fa-solid fa-clock"></i> Links Not Available</span>`}
                            </div>
                            
                            ${alertBox}

                            <ul class="features-list">
                                ${g.features && g.features.length > 0
                        ? g.features.map(f => `<li>${f}</li>`).join('')
                        : '<li>Verified lossless FitBoy Repack</li><li>Fast installation and MD5 integrity verification</li>'}
                            </ul>

                            <div class="modal-actions-row">
                                ${isResolved ? `
                                    <button id="startDownloadBtn" class="btn-primary glow-btn" data-url="${g.url}" data-slug="${g.slug || ''}" data-title="${g.title}">
                                        <i class="fa-solid fa-bolt"></i> Instant 1-Click Download (${partsCount} Direct Parts)
                                    </button>
                                ` : `
                                    <button id="copyRawLinksBtn" class="btn-primary glow-btn" data-title="${g.title}">
                                        <i class="fa-solid fa-copy"></i> Copy Raw FuckingFast Links (${partsCount} Parts)
                                    </button>
                                    <a href="https://github.com/GoldleoM/Fitgirl_Local_Link_Extractor/releases/tag/v1.0.1" target="_blank" rel="noopener noreferrer" class="btn-accent-download">
                                        <i class="fa-brands fa-github"></i> Download Local Extractor (.exe)
                                    </a>
                                `}
                                <a href="${g.url}" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-fitgirl-modal">
                                    <i class="fa-solid fa-arrow-up-right-from-square"></i> FitGirl Page
                                </a>
                            </div>
                        </div>
                    </div>
                `;

                // Handle copy raw links button
                const copyRawBtn = document.getElementById('copyRawLinksBtn');
                if (copyRawBtn && g.fuckingfast_links && g.fuckingfast_links.length > 0) {
                    copyRawBtn.addEventListener('click', async () => {
                        try {
                            await navigator.clipboard.writeText(g.fuckingfast_links.join('\n'));
                            const orig = copyRawBtn.innerHTML;
                            copyRawBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied to Clipboard!';
                            copyRawBtn.style.background = 'var(--gradient-purple)';
                            setTimeout(() => {
                                copyRawBtn.innerHTML = orig;
                                copyRawBtn.style.background = '';
                            }, 2500);
                            alert(`📋 ${g.fuckingfast_links.length} FuckingFast links copied to clipboard!\n\nPaste them into the FitBoy Local Link Extractor (.exe) to instantly generate download_links.txt locally!`);
                        } catch (e) {
                            alert(`Could not copy to clipboard: ${e.message}`);
                        }
                    });
                }

                // Handle start download button
                const startBtn = document.getElementById('startDownloadBtn');
                if (startBtn) {
                    startBtn.addEventListener('click', (e) => {
                        const title = e.currentTarget.getAttribute('data-title');
                        const url = e.currentTarget.getAttribute('data-url');
                        const slug = e.currentTarget.getAttribute('data-slug');
                        startDownloadProcess(title, url, g.fuckingfast_links, slug);
                    });
                }
            } else {
                modalBody.innerHTML = `<p style="color: red; text-align: center;">Could not load game details.</p>`;
            }
        } catch (e) {
            modalBody.innerHTML = `<p style="color: red; text-align: center;">Network error while fetching game details.</p>`;
        }
    }

    async function startDownloadProcess(title, gameUrl, links, gameSlug = '') {
        gameModal.classList.add('hidden');
        downloadDrawer.classList.remove('hidden');
        drawerGameTitle.innerText = title;
        drawerStatusText.innerText = "Loading download links...";

        const total = links ? links.length : 0;
        progressBar.style.width = "0%";
        progressCounter.innerText = `0 / ${total} Parts Extracted`;
        progressPercentBadge.innerText = "0%";
        currentPartText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking database & resolving links...`;
        terminalLogs.innerHTML = `<div class="log-line text-muted">> Fetching direct links for '${title}'...</div>`;

        copyClipboardBtn.disabled = true;
        downloadTxtBtn.disabled = true;
        browserBatchBtn.disabled = true;
        extractedLinksCache = [];

        try {
            const res = await apiFetch('/api/extract_links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    game_title: title,
                    game_url: gameUrl,
                    slug: gameSlug,
                    links: links
                })
            });
            const data = await res.json();

            if (data.success || (data.direct_links && data.direct_links.length > 0)) {
                const extCount = data.extracted_count || data.direct_links.length;
                extractedLinksCache = data.direct_links;

                // Update UI to completed state
                drawerStatusText.innerText = `Completed! ${extCount} direct links ready.`;
                progressBar.style.width = "100%";
                progressPercentBadge.innerText = "100%";
                progressCounter.innerText = `${extCount} / ${total} Parts Extracted`;
                currentPartText.innerHTML = `<i class="fa-solid fa-check" style="color: #00ff87;"></i> All ${extCount} parts successfully extracted!`;

                // Render logs
                if (data.logs && data.logs.length > 0) {
                    terminalLogs.innerHTML = data.logs.map(l => {
                        const isSucc = l.includes('Extracted part') || l.includes('✔') || l.includes('Pipeline finished');
                        return `<div class="log-line ${isSucc ? 'succ' : ''}">${l}</div>`;
                    }).join('');
                }

                copyClipboardBtn.disabled = false;
                downloadTxtBtn.disabled = false;
                browserBatchBtn.disabled = false;

                // Auto-copy to clipboard
                try {
                    await navigator.clipboard.writeText(extractedLinksCache.join('\n'));
                    terminalLogs.innerHTML += `<div class="log-line succ">> 📋 All ${extCount} direct links automatically copied to Clipboard!</div>`;
                    terminalLogs.innerHTML += `<div class="log-line" style="color: #00f2fe;">> 💡 Use FDM, JDownloader 2, IDM, or click "Save links.txt" / "Download in Browser"</div>`;
                } catch (clipErr) {
                    terminalLogs.innerHTML += `<div class="log-line">> Links ready. Click "Copy URLs" to copy to clipboard.</div>`;
                }

                terminalLogs.scrollTop = terminalLogs.scrollHeight;
            } else {
                drawerStatusText.innerText = "Extraction failed: " + (data.error || 'Unknown error');
                currentPartText.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: red;"></i> ${data.error || 'Could not extract download links.'}`;

                if (data.logs && data.logs.length > 0) {
                    terminalLogs.innerHTML = data.logs.map(l =>
                        `<div class="log-line">${l}</div>`
                    ).join('');
                }
            }
        } catch (e) {
            drawerStatusText.innerText = "Network error during extraction";
            currentPartText.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: red;"></i> Request failed. Check your connection and try again.`;
            terminalLogs.innerHTML += `<div class="log-line" style="color: red;">> Error: ${e.message}</div>`;
        }
    }

    // Trigger initial load after all functions are defined
    loadPopular();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
