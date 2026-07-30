const API_BASE = "http://localhost:7860";

// All fetch calls route through API_BASE for CORS-safe cross-origin requests
function apiFetch(path, options = {}) {
    return fetch(`${API_BASE}${path}`, options);
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

    if (searchBtn) searchBtn.addEventListener('click', () => handleSearch());
    if (searchInput) searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
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

        gamesGrid.innerHTML = games.map(game => `
            <div class="game-card" data-url="${game.url}">
                <img class="card-poster" src="${game.cover || '/static/images/placeholder.svg'}" alt="${game.title}" loading="lazy" onerror="this.onerror=null; this.src='/static/images/placeholder.svg';">
                <div class="card-content">
                    <h3 class="card-title">${game.title}</h3>
                    <span class="card-date">${game.date || 'FitGirl Repack'}</span>
                    <div class="card-footer">
                        <button class="btn-get"><i class="fa-solid fa-download"></i> View & Download</button>
                        <a href="${game.url}" target="_blank" rel="noopener noreferrer" class="btn-fitgirl" onclick="event.stopPropagation()">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> FitGirl
                        </a>
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners to cards
        document.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', () => {
                const gameUrl = card.getAttribute('data-url');
                openGameModal(gameUrl);
            });
        });
    }

    async function openGameModal(gameUrl) {
        gameModal.classList.remove('hidden');
        modalBody.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Loading game details & FuckingFast mirrors...</p>
            </div>
        `;

        try {
            const res = await apiFetch(`/api/game?url=${encodeURIComponent(gameUrl)}`);
            const data = await res.json();
            if (data.success && data.game) {
                const g = data.game;
                modalBody.innerHTML = `
                    <div class="modal-detail-grid">
                        <div>
                            <img class="modal-poster" src="${g.cover || '/static/images/placeholder.svg'}" alt="${g.title}" onerror="this.onerror=null; this.src='/static/images/placeholder.svg';">
                        </div>
                        <div class="modal-info">
                            <h2>${g.title}</h2>
                            <div class="tags-row">
                                <span class="tag-badge"><i class="fa-solid fa-hard-drive"></i> Repack Size: ${g.repack_size}</span>
                                <span class="tag-badge"><i class="fa-solid fa-layer-group"></i> ${g.parts_count} FuckingFast Parts</span>
                            </div>
                            <ul class="features-list">
                                ${g.features && g.features.length > 0
                        ? g.features.map(f => `<li>${f}</li>`).join('')
                        : '<li>Verified lossless FitGirl Repack</li><li>Fast installation and MD5 integrity verification</li>'}
                            </ul>

                            <div class="modal-actions-row">
                                <button id="startDownloadBtn" class="btn-primary glow-btn" data-url="${g.url}" data-title="${g.title}">
                                    <i class="fa-solid fa-copy"></i> Extract Links & Copy All ${g.parts_count} Parts
                                </button>
                                <a href="${g.url}" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-fitgirl-modal">
                                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Open on FitGirl
                                </a>
                            </div>
                        </div>
                    </div>
                `;

                document.getElementById('startDownloadBtn').addEventListener('click', (e) => {
                    const title = e.currentTarget.getAttribute('data-title');
                    const url = e.currentTarget.getAttribute('data-url');
                    startDownloadProcess(title, url, g.fuckingfast_links);
                });
            } else {
                modalBody.innerHTML = `<p style="color: red; text-align: center;">Could not load game details.</p>`;
            }
        } catch (e) {
            modalBody.innerHTML = `<p style="color: red; text-align: center;">Network error while fetching game details.</p>`;
        }
    }

    async function startDownloadProcess(title, gameUrl, links) {
        gameModal.classList.add('hidden');
        downloadDrawer.classList.remove('hidden');
        drawerGameTitle.innerText = title;
        drawerStatusText.innerText = "Extracting direct download links...";

        const total = links ? links.length : 0;
        progressBar.style.width = "0%";
        progressCounter.innerText = `0 / ${total} Parts Extracted`;
        progressPercentBadge.innerText = "0%";
        currentPartText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Resolving FuckingFast links (this may take a minute)...`;
        terminalLogs.innerHTML = `<div class="log-line text-muted">> Sending ${total} links to extraction API...</div>`;

        copyClipboardBtn.disabled = true;
        downloadTxtBtn.disabled = true;
        browserBatchBtn.disabled = true;
        extractedLinksCache = [];

        try {
            // Use the synchronous /api/extract_links endpoint (Vercel-compatible)
            const res = await apiFetch('/api/extract_links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    game_title: title,
                    game_url: gameUrl,
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
