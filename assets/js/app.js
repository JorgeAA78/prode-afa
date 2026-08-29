document.addEventListener('DOMContentLoaded', () => {
    // ── Config ──
    const THESPORTSDB_KEY = '1706802428';
    const LEAGUE_ID = '4406'; // Argentinian Primera Division
    const N8N_WEBHOOK_URL = 'https://n8ncurso2025-n8n.mos4xj.easypanel.host/webhook/74bc197f-65cf-499a-8bc9-781cf4aa7dd0';

    // DOM Elements
    const welcomeUserEl = document.getElementById('welcome-user');
    const matchesContainer = document.getElementById('matches-container');
    const prodeForm = document.getElementById('prode-form');
    const submitBtn = document.getElementById('submit-btn');
    const submitText = document.getElementById('submit-text');
    const spinner = document.getElementById('submit-spinner');
    
    // Modal Elements
    const modalOverlay = document.getElementById('modal-overlay');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalUserEl = document.getElementById('modal-user');

    // 1. Parse URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const playerId = urlParams.get('player') || '';
    const username = urlParams.get('name') || urlParams.get('user') || 'Jugador';
    
    welcomeUserEl.textContent = username;
    if (modalUserEl) modalUserEl.textContent = username;

    // Store fetched matches globally
    let matches = [];

    // ── Date helpers ──
    function fmtDate(d) {
        return d.toISOString().split('T')[0];
    }

    function localTime(tsString) {
        const d = new Date(tsString);
        return d.toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'America/Argentina/Buenos_Aires'
        });
    }

    // 2. Fetch matches from TheSportsDB
    async function loadMatches() {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const urls = [
            `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_KEY}/eventsday.php?d=${fmtDate(today)}&l=${LEAGUE_ID}`,
            `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_KEY}/eventsday.php?d=${fmtDate(tomorrow)}&l=${LEAGUE_ID}`
        ];

        try {
            const responses = await Promise.all(urls.map(u => fetch(u).then(r => r.json())));
            let allEvents = [];

            responses.forEach(data => {
                if (data.events && Array.isArray(data.events)) {
                    allEvents = allEvents.concat(data.events);
                }
            });

            // Deduplicate by idEvent
            const seen = new Set();
            allEvents = allEvents.filter(e => {
                if (seen.has(e.idEvent)) return false;
                seen.add(e.idEvent);
                return true;
            });

            // Filter: only not started
            allEvents = allEvents.filter(e =>
                e.strStatus === 'NS' || e.strStatus === 'Not Started' || e.intHomeScore === null
            );

            // Sort by timestamp
            allEvents.sort((a, b) => new Date(a.strTimestamp) - new Date(b.strTimestamp));

            // Map to our match format
            matches = allEvents.map(e => ({
                id: e.idEvent,
                fixtureId: e.idEvent,
                teamA: e.strHomeTeam,
                teamB: e.strAwayTeam,
                teamA_badge: e.strHomeTeamBadge || '',
                teamB_badge: e.strAwayTeamBadge || '',
                teamA_short: e.strHomeTeam.substring(0, 3).toUpperCase(),
                teamB_short: e.strAwayTeam.substring(0, 3).toUpperCase(),
                time: localTime(e.strTimestamp),
                venue: e.strVenue || '',
                dateEvent: e.dateEvent
            }));

            return matches;
        } catch (err) {
            console.error('Error fetching matches from TheSportsDB:', err);
            throw err;
        }
    }

    // 3. Render Matches dynamically
    function renderMatches() {
        matchesContainer.innerHTML = '';

        if (matches.length === 0) {
            matchesContainer.innerHTML = `
                <p style="text-align: center; color: var(--text-secondary); padding: 2rem;">
                    No hay partidos programados para hoy ni mañana.<br>¡Volvé más tarde!
                </p>`;
            submitBtn.style.display = 'none';
            return;
        }
        
        matches.forEach((match, index) => {
            const card = document.createElement('div');
            card.className = 'match-card';
            card.style.animationDelay = `${index * 0.1}s`;

            // Build badge HTML (use image if available, emoji fallback)
            const badgeA = match.teamA_badge
                ? `<img src="${match.teamA_badge}" alt="${match.teamA}" class="team-badge" onerror="this.style.display='none'">`
                : `<span class="team-flag">⚽</span>`;
            const badgeB = match.teamB_badge
                ? `<img src="${match.teamB_badge}" alt="${match.teamB}" class="team-badge" onerror="this.style.display='none'">`
                : `<span class="team-flag">⚽</span>`;
            
            card.innerHTML = `
                <div class="match-time">🕐 ${match.time} hs${match.venue ? ' · ' + match.venue : ''}</div>
                <div class="match-header">
                    <div class="match-team team-a">
                        <span class="team-name">${match.teamA}</span>
                        ${badgeA}
                    </div>
                    <span class="versus">VS</span>
                    <div class="match-team team-b">
                        ${badgeB}
                        <span class="team-name">${match.teamB}</span>
                    </div>
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
                </div>
            `;
            
            matchesContainer.appendChild(card);
            
            // Auto-select winner when scores are entered
            const scoreAInput = card.querySelector(`#scoreA_${match.id}`);
            const scoreBInput = card.querySelector(`#scoreB_${match.id}`);
            const winnerSelect = card.querySelector(`#winner_${match.id}`);
            
            const updateWinnerFromScores = () => {
                const valA = scoreAInput.value;
                const valB = scoreBInput.value;
                
                if (valA !== '' && valB !== '') {
                    const scoreA = parseInt(valA, 10);
                    const scoreB = parseInt(valB, 10);
                    
                    if (scoreA > scoreB) {
                        winnerSelect.value = match.teamA;
                    } else if (scoreB > scoreA) {
                        winnerSelect.value = match.teamB;
                    } else {
                        winnerSelect.value = 'Ninguno (Empate)';
                    }
                }
            };
            
            scoreAInput.addEventListener('input', updateWinnerFromScores);
            scoreBInput.addEventListener('input', updateWinnerFromScores);
        });
    }

    // 4. Form Submission to n8n Webhook
    prodeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        submitBtn.disabled = true;
        spinner.style.display = 'block';
        submitText.textContent = 'Enviando predicciones...';
        
        // Build payload matching n8n webhook expected format
        const payload = {
            player_id: playerId
        };

        let isValid = true;
        
        for (const match of matches) {
            const winnerSelect = document.getElementById(`winner_${match.id}`);
            const scoreAInput = document.getElementById(`scoreA_${match.id}`);
            const scoreBInput = document.getElementById(`scoreB_${match.id}`);
            
            const winner = winnerSelect.value;
            const scoreAVal = scoreAInput.value;
            const scoreBVal = scoreBInput.value;
            
            if (!winner || scoreAVal === '' || scoreBVal === '') {
                isValid = false;
                break;
            }
            
            // Use field names that match what n8n expects
            payload[`match_${match.fixtureId}`] = winner;
            payload[`match_${match.fixtureId}_goles1`] = parseInt(scoreAVal, 10);
            payload[`match_${match.fixtureId}_goles2`] = parseInt(scoreBVal, 10);
        }
        
        if (!isValid) {
            showToast('Por favor, completá todas las predicciones y marcadores.', 'error');
            resetSubmitButton();
            return;
        }
        
        console.log('Enviando predicciones:', payload);
        
        try {
            const response = await fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                showSuccessModal();
            } else {
                throw new Error(`Servidor respondió con código ${response.status}`);
            }
        } catch (error) {
            console.error('Error al enviar predicciones:', error);
            showToast('Error al enviar las predicciones. Intentá de nuevo.', 'error');
        } finally {
            resetSubmitButton();
        }
    });

    // ── Helper functions ──
    function resetSubmitButton() {
        submitBtn.disabled = false;
        spinner.style.display = 'none';
        submitText.textContent = 'Enviar Mis Predicciones';
    }

    function showSuccessModal() {
        modalOverlay.classList.add('active');
        createConfetti();
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modalOverlay.classList.remove('active');
        });
    }

    function showToast(message, type = 'success') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? '✅' : '❌';
        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        container.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 50);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    function createConfetti() {
        const emojis = ['🏆', '⚽', '⭐', '🇦🇷', '✨', '🎈'];
        for (let i = 0; i < 40; i++) {
            const particle = document.createElement('div');
            particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            particle.style.position = 'fixed';
            particle.style.left = Math.random() * 100 + 'vw';
            particle.style.top = '-5vh';
            particle.style.fontSize = Math.random() * 20 + 20 + 'px';
            particle.style.pointerEvents = 'none';
            particle.style.zIndex = '9999';
            particle.style.transition = 'transform 3s linear, opacity 3s ease';
            document.body.appendChild(particle);
            
            const destX = (Math.random() - 0.5) * 500;
            const destY = window.innerHeight + 50;
            const rotate = Math.random() * 720 - 360;
            
            setTimeout(() => {
                particle.style.transform = `translate(${destX}px, ${destY}px) rotate(${rotate}deg)`;
                particle.style.opacity = '0';
            }, 100);
            
            setTimeout(() => particle.remove(), 3000);
        }
    }

    // 5. Init: load real matches then render
    loadMatches()
        .then(() => {
            renderMatches();
        })
        .catch(() => {
            matchesContainer.innerHTML = `
                <p style="text-align: center; color: #F87171; padding: 2rem;">
                    No se pudieron cargar los partidos.<br>Revisá tu conexión e intentá de nuevo.
                </p>`;
            submitBtn.style.display = 'none';
        });
});
