document.addEventListener('DOMContentLoaded', () => {
    // ── Config ──
    const THESPORTSDB_KEY = '1706802428';
    const LEAGUE_ID = '4406';
    const N8N_WEBHOOK_URL = 'https://n8ncurso2025-n8n.mos4xj.easypanel.host/webhook/74bc197f-65cf-499a-8bc9-781cf4aa7dd0';
    const DAYS_AHEAD = 4; // Busca partidos de hoy + 3 días más (vie-lun)

    // DOM Elements
    const welcomeUserEl = document.getElementById('welcome-user');
    const matchesContainer = document.getElementById('matches-container');
    const prodeForm = document.getElementById('prode-form');
    const submitBtn = document.getElementById('submit-btn');
    const submitText = document.getElementById('submit-text');
    const spinner = document.getElementById('submit-spinner');
    const modalOverlay = document.getElementById('modal-overlay');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalUserEl = document.getElementById('modal-user');

    const urlParams = new URLSearchParams(window.location.search);
    const playerName = urlParams.get('name') || urlParams.get('user') || '';
    const playerId = urlParams.get('player') || '';

    if (playerName) {
        welcomeUserEl.textContent = playerName;
        if (modalUserEl) modalUserEl.textContent = playerName;
    } else {
        welcomeUserEl.textContent = 'Jugador';
    }

    let matches = [];

    function fmtDate(d) { return d.toISOString().split('T')[0]; }
    function localTime(ts) {
        return new Date(ts).toLocaleTimeString('es-AR', {
            hour: '2-digit', minute: '2-digit', hour12: false,
            timeZone: 'America/Argentina/Buenos_Aires'
        });
    }
    function prettyDate(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('es-AR', {
            weekday: 'long', day: 'numeric', month: 'long',
            timeZone: 'America/Argentina/Buenos_Aires'
        });
    }

    // Fetch matches for today + next 3 days
    async function loadMatches() {
        const urls = [];
        for (let i = 0; i < DAYS_AHEAD; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            urls.push(`https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_KEY}/eventsday.php?d=${fmtDate(d)}&l=${LEAGUE_ID}`);
        }

        const responses = await Promise.all(urls.map(u => fetch(u).then(r => r.json())));
        let allEvents = [];
        responses.forEach(data => {
            if (data.events && Array.isArray(data.events)) allEvents = allEvents.concat(data.events);
        });

        const seen = new Set();
        allEvents = allEvents.filter(e => { if (seen.has(e.idEvent)) return false; seen.add(e.idEvent); return true; });
        allEvents = allEvents.filter(e => e.strStatus === 'NS' || e.strStatus === 'Not Started' || e.intHomeScore === null);
        allEvents.sort((a, b) => new Date(a.strTimestamp) - new Date(b.strTimestamp));

        matches = allEvents.map(e => ({
            id: e.idEvent, fixtureId: e.idEvent,
            teamA: e.strHomeTeam, teamB: e.strAwayTeam,
            teamA_badge: e.strHomeTeamBadge || '', teamB_badge: e.strAwayTeamBadge || '',
            teamA_short: e.strHomeTeam.substring(0, 3).toUpperCase(),
            teamB_short: e.strAwayTeam.substring(0, 3).toUpperCase(),
            time: localTime(e.strTimestamp), venue: e.strVenue || '',
            dateEvent: e.dateEvent
        }));
    }

    function renderMatches() {
        matchesContainer.innerHTML = '';
        if (!matches.length) {
            matchesContainer.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">No hay partidos programados para esta fecha.<br>¡Volvé más tarde!</p>';
            submitBtn.style.display = 'none';
            return;
        }

        // Player info card
        if (!playerName || !playerId) {
            const info = document.createElement('div');
            info.className = 'match-card';
            info.style.borderColor = 'rgba(212,175,55,.3)';
            let fields = '';
            if (!playerName) {
                fields += `
                    <div class="score-field" style="flex-direction:column;align-items:stretch;">
                        <span class="score-label" style="margin-bottom:6px;max-width:none;">TU NOMBRE</span>
                        <input type="text" id="input-player-name" class="score-input"
                               style="text-align:left;font-size:1rem;font-weight:500;" placeholder="Ej: Carlos" required>
                    </div>`;
            }
            if (!playerId) {
                fields += `
                    <div class="score-field" style="flex-direction:column;align-items:stretch;margin-top:10px;">
                        <span class="score-label" style="margin-bottom:6px;max-width:none;">TU CELULAR DE TELEGRAM</span>
                        <input type="tel" id="input-player-phone" class="score-input"
                               style="text-align:left;font-size:1rem;font-weight:500;" placeholder="Ej: 3875551234" required>
                        <span style="font-size:.7rem;color:var(--text-secondary,#8B9EC0);margin-top:4px;">
                            Tu número de celular con código de área, sin 0 ni 15
                        </span>
                    </div>`;
            }
            info.innerHTML = `
                <div class="match-header" style="justify-content:center;">
                    <span style="font-size:.85rem;font-weight:600;color:var(--text-secondary,#8B9EC0);">📝 TUS DATOS</span>
                </div>
                <div class="prediction-inputs">${fields}</div>`;
            matchesContainer.appendChild(info);
        }

        // Group matches by date
        const byDate = {};
        matches.forEach(m => {
            if (!byDate[m.dateEvent]) byDate[m.dateEvent] = [];
            byDate[m.dateEvent].push(m);
        });

        for (const [date, dayMatches] of Object.entries(byDate)) {
            // Date header
            const dateHeader = document.createElement('div');
            dateHeader.style.cssText = 'display:flex;align-items:center;gap:.5rem;margin:1.5rem 0 .75rem;padding-bottom:.5rem;border-bottom:1px solid rgba(116,172,223,.12);';
            dateHeader.innerHTML = `
                <div style="width:8px;height:8px;border-radius:50%;background:#34D399;"></div>
                <span style="font-size:.8rem;font-weight:600;color:var(--text-secondary,#8B9EC0);text-transform:uppercase;letter-spacing:.4px;">
                    ${prettyDate(date)}
                </span>`;
            matchesContainer.appendChild(dateHeader);

            dayMatches.forEach((match, i) => {
                const card = document.createElement('div');
                card.className = 'match-card';
                card.style.animationDelay = `${i * 0.1}s`;
                const badgeA = match.teamA_badge ? `<img src="${match.teamA_badge}" alt="${match.teamA}" class="team-badge" style="width:40px;height:40px;object-fit:contain;" onerror="this.style.display='none'">` : '<span class="team-flag">⚽</span>';
                const badgeB = match.teamB_badge ? `<img src="${match.teamB_badge}" alt="${match.teamB}" class="team-badge" style="width:40px;height:40px;object-fit:contain;" onerror="this.style.display='none'">` : '<span class="team-flag">⚽</span>';
                card.innerHTML = `
                    <div class="match-time" style="font-size:.75rem;color:var(--text-secondary,#8B9EC0);margin-bottom:.5rem;">🕐 ${match.time} hs${match.venue ? ' · ' + match.venue : ''}</div>
                    <div class="match-header">
                        <div class="match-team team-a"><span class="team-name">${match.teamA}</span>${badgeA}</div>
                        <span class="versus">VS</span>
                        <div class="match-team team-b">${badgeB}<span class="team-name">${match.teamB}</span></div>
                    </div>
                    <div class="prediction-inputs">
                        <div class="select-container">
                            <select class="winner-select" name="match_${match.fixtureId}" id="winner_${match.id}" required>
                                <option value="" disabled selected>¿Quién gana?</option>
                                <option value="${match.teamA}">Gana ${match.teamA}</option>
                                <option value="Ninguno (Empate)">Empate</option>
                                <option value="${match.teamB}">Gana ${match.teamB}</option>
                            </select>
                        </div>
                        <div class="scores-row">
                            <div class="score-field">
                                <span class="score-label" title="${match.teamA}">${match.teamA_short}</span>
                                <input type="number" class="score-input" name="match_${match.fixtureId}_goles1" id="scoreA_${match.id}" min="0" max="20" placeholder="0" required>
                            </div>
                            <div class="score-field">
                                <span class="score-label" title="${match.teamB}">${match.teamB_short}</span>
                                <input type="number" class="score-input" name="match_${match.fixtureId}_goles2" id="scoreB_${match.id}" min="0" max="20" placeholder="0" required>
                            </div>
                        </div>
                    </div>`;
                matchesContainer.appendChild(card);

                const sA = card.querySelector(`#scoreA_${match.id}`), sB = card.querySelector(`#scoreB_${match.id}`), w = card.querySelector(`#winner_${match.id}`);
                const sync = () => { if (sA.value !== '' && sB.value !== '') { const a=+sA.value, b=+sB.value; w.value = a>b ? match.teamA : b>a ? match.teamB : 'Ninguno (Empate)'; }};
                sA.addEventListener('input', sync);
                sB.addEventListener('input', sync);
            });
        }
    }

    // Submit
    prodeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true; spinner.style.display = 'block'; submitText.textContent = 'Enviando predicciones...';

        const finalName = playerName || (document.getElementById('input-player-name')?.value.trim() || '');
        const finalPhone = playerId || (document.getElementById('input-player-phone')?.value.trim() || '');

        if (!finalName) { showToast('Por favor, completá tu nombre.', 'error'); resetSubmitButton(); return; }
        if (!finalPhone) { showToast('Por favor, ingresá tu número de Telegram.', 'error'); resetSubmitButton(); return; }
        if (modalUserEl) modalUserEl.textContent = finalName;

        const payload = { player_id: finalPhone, player_name: finalName, player_phone: finalPhone, auto_register: true };
        let isValid = true;
        for (const m of matches) {
            const w = document.getElementById(`winner_${m.id}`), sA = document.getElementById(`scoreA_${m.id}`), sB = document.getElementById(`scoreB_${m.id}`);
            if (!w.value || sA.value === '' || sB.value === '') { isValid = false; break; }
            payload[`match_${m.fixtureId}`] = w.value;
            payload[`match_${m.fixtureId}_goles1`] = +sA.value;
            payload[`match_${m.fixtureId}_goles2`] = +sB.value;
        }
        if (!isValid) { showToast('Por favor, completá todas las predicciones.', 'error'); resetSubmitButton(); return; }

        try {
            const res = await fetch(N8N_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) showSuccessModal(); else throw new Error(res.status);
        } catch (err) {
            console.error('Error:', err);
            showToast('Error al enviar. Intentá de nuevo.', 'error');
        } finally { resetSubmitButton(); }
    });

    function resetSubmitButton() { submitBtn.disabled = false; spinner.style.display = 'none'; submitText.textContent = 'Enviar Mis Predicciones'; }
    function showSuccessModal() { modalOverlay.classList.add('active'); createConfetti(); }
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));

    function showToast(msg, type = 'success') {
        let c = document.querySelector('.toast-container');
        if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
        const t = document.createElement('div'); t.className = `toast ${type}`;
        t.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> <span>${msg}</span>`;
        c.appendChild(t); setTimeout(() => t.classList.add('show'), 50);
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 4000);
    }

    function createConfetti() {
        const emojis = ['🏆','⚽','⭐','🇦🇷','✨','🎈'];
        for (let i = 0; i < 40; i++) {
            const p = document.createElement('div'); p.textContent = emojis[Math.floor(Math.random()*emojis.length)];
            Object.assign(p.style, { position:'fixed', left:Math.random()*100+'vw', top:'-5vh', fontSize:Math.random()*20+20+'px', pointerEvents:'none', zIndex:'9999', transition:'transform 3s linear, opacity 3s ease' });
            document.body.appendChild(p);
            setTimeout(() => { p.style.transform = `translate(${(Math.random()-.5)*500}px, ${window.innerHeight+50}px) rotate(${Math.random()*720-360}deg)`; p.style.opacity = '0'; }, 100);
            setTimeout(() => p.remove(), 3000);
        }
    }

    loadMatches().then(() => renderMatches()).catch(() => {
        matchesContainer.innerHTML = '<p style="text-align:center;color:#F87171;padding:2rem;">No se pudieron cargar los partidos.<br>Revisá tu conexión e intentá de nuevo.</p>';
        submitBtn.style.display = 'none';
    });
});
