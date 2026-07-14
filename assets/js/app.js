document.addEventListener('DOMContentLoaded', () => {
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
    
    // Default Argentine League Matches
    const defaultMatches = [
        {
            id: 'partido_1',
            teamA: 'Boca Juniors',
            teamB: 'River Plate',
            teamA_flag: '🇸🇪',
            teamB_flag: '⚪🔴⚪',
            teamA_short: 'BOC',
            teamB_short: 'RIV'
        },
        {
            id: 'partido_2',
            teamA: 'Racing Club',
            teamB: 'Independiente',
            teamA_flag: '🔵⚪',
            teamB_flag: '🔴',
            teamA_short: 'RAC',
            teamB_short: 'IND'
        },
        {
            id: 'partido_3',
            teamA: 'San Lorenzo',
            teamB: 'Huracán',
            teamA_flag: '🔴🔵',
            teamB_flag: '⚪🎈',
            teamA_short: 'SLO',
            teamB_short: 'HUR'
        },
        {
            id: 'partido_4',
            teamA: 'Talleres',
            teamB: 'Belgrano',
            teamA_flag: '🔵⚪🔵',
            teamB_flag: '🩵',
            teamA_short: 'TAL',
            teamB_short: 'BEL'
        }
    ];

    // 1. Parse URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    
    // Get Username
    const username = urlParams.get('user') || 'Mariano Gobea Alcoba';
    welcomeUserEl.textContent = username;
    if (modalUserEl) modalUserEl.textContent = username;
    
    // Get Webhook URL
    const webhookUrl = urlParams.get('webhook');
    if (!webhookUrl) {
        console.warn('Advertencia: No se proporcionó un parámetro "webhook" en la URL. El envío simulará una respuesta exitosa.');
    }
    
    // Get Matches (Base64 or standard JSON encoded)
    let matches = defaultMatches;
    const matchesParam = urlParams.get('matches');
    
    if (matchesParam) {
        try {
            // Try to decode as Base64 first
            let decodedData;
            try {
                decodedData = atob(matchesParam);
            } catch (e) {
                // If not valid base64, assume it is URI encoded JSON string
                decodedData = decodeURIComponent(matchesParam);
            }
            
            const parsedMatches = JSON.parse(decodedData);
            if (Array.isArray(parsedMatches) && parsedMatches.length > 0) {
                matches = parsedMatches;
            }
        } catch (error) {
            console.error('Error al parsear los partidos de la URL, usando clásicos del fútbol argentino por defecto:', error);
            showToast('Error al cargar partidos personalizados. Usando predeterminados.', 'error');
        }
    }

    // 2. Render Matches dynamically
    function renderMatches() {
        matchesContainer.innerHTML = '';
        
        matches.forEach((match, index) => {
            const card = document.createElement('div');
            card.className = 'match-card';
            card.style.animationDelay = `${index * 0.1}s`;
            
            // Fallbacks for flags/shortnames if missing
            const flagA = match.teamA_flag || '⚽';
            const flagB = match.teamB_flag || '⚽';
            const shortA = match.teamA_short || match.teamA.substring(0, 3).toUpperCase();
            const shortB = match.teamB_short || match.teamB.substring(0, 3).toUpperCase();
            
            card.innerHTML = `
                <div class="match-header">
                    <div class="match-team team-a">
                        <span class="team-name">${match.teamA}</span>
                        <span class="team-flag">${flagA}</span>
                    </div>
                    <span class="versus">VS</span>
                    <div class="match-team team-b">
                        <span class="team-flag">${flagB}</span>
                        <span class="team-name">${match.teamB}</span>
                    </div>
                </div>
                
                <div class="prediction-inputs">
                    <div class="select-container">
                        <select class="winner-select" name="winner_${match.id}" id="winner_${match.id}" required>
                            <option value="" disabled selected>¿Quién gana?</option>
                            <option value="teamA">Gana ${match.teamA}</option>
                            <option value="draw">Empate</option>
                            <option value="teamB">Gana ${match.teamB}</option>
                        </select>
                    </div>
                    
                    <div class="scores-row">
                        <div class="score-field">
                            <span class="score-label" title="${match.teamA}">${shortA}</span>
                            <input type="number" class="score-input" name="scoreA_${match.id}" id="scoreA_${match.id}" min="0" placeholder="0" required>
                        </div>
                        <div class="score-field">
                            <span class="score-label" title="${match.teamB}">${shortB}</span>
                            <input type="number" class="score-input" name="scoreB_${match.id}" id="scoreB_${match.id}" min="0" placeholder="0" required>
                        </div>
                    </div>
                </div>
            `;
            
            matchesContainer.appendChild(card);
            
            // Set up automatic winner selection when scores are entered
            const scoreAInput = card.querySelector(`#scoreA_${match.id}`);
            const scoreBInput = card.querySelector(`#scoreB_${match.id}`);
            const winnerSelect = card.querySelector(`#winner_${match.id}`);
            
            const updateWinnerFromScores = () => {
                const valA = scoreAInput.value;
                const valB = scoreBInput.value;
                
                // Only update if both scores are filled out
                if (valA !== '' && valB !== '') {
                    const scoreA = parseInt(valA, 10);
                    const scoreB = parseInt(valB, 10);
                    
                    if (scoreA > scoreB) {
                        winnerSelect.value = 'teamA';
                    } else if (scoreB > scoreA) {
                        winnerSelect.value = 'teamB';
                    } else {
                        winnerSelect.value = 'draw';
                    }
                }
            };
            
            scoreAInput.addEventListener('input', updateWinnerFromScores);
            scoreBInput.addEventListener('input', updateWinnerFromScores);
        });
    }

    renderMatches();

    // 3. Form Submission to n8n Webhook
    prodeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Disable button and show spinner
        submitBtn.disabled = true;
        spinner.style.display = 'block';
        submitText.textContent = 'Enviando predicciones...';
        
        // Gather Predictions
        const predictions = [];
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
            
            predictions.push({
                matchId: match.id,
                teamA: match.teamA,
                teamB: match.teamB,
                winner: winner,
                scoreA: parseInt(scoreAVal, 10),
                scoreB: parseInt(scoreBVal, 10)
            });
        }
        
        if (!isValid) {
            showToast('Por favor, completa todas las predicciones y marcadores.', 'error');
            resetSubmitButton();
            return;
        }
        
        const payload = {
            user: username,
            predictions: predictions,
            timestamp: new Date().toISOString()
        };
        
        console.log('Enviando predicciones al webhook:', payload);
        
        if (!webhookUrl) {
            // Mock simulation when no webhook is provided
            setTimeout(() => {
                showSuccessModal();
                resetSubmitButton();
            }, 1500);
            return;
        }
        
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                showSuccessModal();
            } else {
                throw new Error(`Servidor respondió con código ${response.status}`);
            }
        } catch (error) {
            console.error('Error al enviar webhook a n8n:', error);
            showToast('Error al enviar las predicciones. Inténtalo de nuevo.', 'error');
        } finally {
            resetSubmitButton();
        }
    });

    // Helper functions
    function resetSubmitButton() {
        submitBtn.disabled = false;
        spinner.style.display = 'none';
        submitText.textContent = 'Enviar Mis Predicciones';
    }

    function showSuccessModal() {
        modalOverlay.classList.add('active');
        // Simple confetti effect (emoji particles in console/overlay)
        createConfetti();
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modalOverlay.classList.remove('active');
        });
    }

    // Simple toast notification system
    function showToast(message, type = 'success') {
        // Check if container exists, if not create it
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
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 50);
        
        // Remove after 4 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // Confetti particles for success celebration
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
});
