document.addEventListener('DOMContentLoaded', () => {
    const wheelsGrid = document.getElementById('wheelsGrid');
    const spinBtn = document.getElementById('spinBtn');
    const participantInput = document.getElementById('participantInput');
    const numWinnersInput = document.getElementById('numWinners');
    const removeWinnerCheckbox = document.getElementById('removeWinner');
    const secretNameInput = document.getElementById('secretName');
    const toggleSecretNameCheckbox = document.getElementById('toggleSecretName');
    const secretNameContainer = document.getElementById('secretNameContainer');
    const winnersList = document.getElementById('winnersList');
    const downloadBtn = document.getElementById('downloadBtn');
    const prizeNameInput = document.getElementById('prizeName');
    const winnersModal = document.getElementById('winnersModal');
    const winnersTableBody = document.getElementById('winnersTableBody');
    const clearWinnersBtn = document.getElementById('clearWinnersBtn');
    const downloadExcelModalBtn = document.getElementById('downloadExcelModalBtn');
    const downloadScreenshotBtn = document.getElementById('downloadScreenshotBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const incrementBtn = document.getElementById('incrementBtn');
    const decrementBtn = document.getElementById('decrementBtn');
    const themeToggle = document.getElementById('themeToggle');
    const prizeDisplay = document.getElementById('prizeDisplay');
    const participantCount = document.getElementById('participantCount');
    const wheelCountBadge = document.getElementById('wheelCountBadge');
    const spinText = document.querySelector('.spin-text');
    const notificationContainer = document.getElementById('notificationContainer');
    const validationStatus = document.getElementById('validationStatus');
    const statusText = document.getElementById('statusText');
    const wheelFiltersContainer = document.getElementById('wheelFiltersContainer');
    const modalContentForScreenshot = document.getElementById('modalContentForScreenshot');

    const sheetsUrlInput = document.getElementById('sheetsUrl');
    const sheetsStatus = document.getElementById('sheetsStatus');

    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const settingsCloseBtn = document.getElementById('settingsCloseBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const resetSettingsBtn = document.getElementById('resetSettingsBtn');
    const themeSelect = document.getElementById('themeSelect');
    const soundEnabled = document.getElementById('soundEnabled');
    const soundSelect = document.getElementById('soundSelect');
    const spinDuration = document.getElementById('spinDuration');
    const spinDurationValue = document.getElementById('spinDurationValue');

    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    let participants = [];
    let secretNames = [];
    let spinning = false;
    let winners = [];
    let wheels = [];
    let isDarkTheme = localStorage.getItem('darkTheme') === 'true';
    let allWinnersData = [];
    let wheelFilters = [];

    let settings = {
        soundEnabled: localStorage.getItem('soundEnabled') !== 'false',
        soundType: localStorage.getItem('soundType') || 'whoosh',
        spinDuration: parseInt(localStorage.getItem('spinDuration')) || 3
    };

    const MAX_WHEELS = 100;
    const wheelPalette = ['#5dade2', '#a569bd', '#f7dc6f', '#82e0aa'];
    const wheelFontFamily = '"Quicksand", "Poppins", sans-serif';
    const removedNames = new Set();
    let sharedAudioContext = null;

    function getAudioContext() {
        if (!sharedAudioContext) {
            sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (sharedAudioContext.state === 'suspended') {
            sharedAudioContext.resume();
        }
        return sharedAudioContext;
    }

    if (isDarkTheme) {
        document.body.classList.add('dark-theme');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        themeSelect.value = 'dark';
    } else {
        themeSelect.value = 'light';
    }

    soundEnabled.checked = settings.soundEnabled;
    soundSelect.value = settings.soundType;
    spinDuration.value = settings.spinDuration;
    spinDurationValue.textContent = settings.spinDuration;

    let autoLoadDebounce = null;
    let autoPollInterval = null;

    sheetsUrlInput.addEventListener('input', () => {
        clearTimeout(autoLoadDebounce);
        const url = sheetsUrlInput.value.trim();

        if (!url) {
            stopAutoPoll();
            sheetsStatus.textContent = '';
            return;
        }

        sheetsStatus.textContent = 'Auto-loading in 2 seconds, then every 5s...';
        sheetsStatus.style.color = '#3b82f6';

        autoLoadDebounce = setTimeout(() => {
            autoSyncFromGoogleSheets().catch(() => {});
            startAutoPoll();
        }, 2000);
    });

    function startAutoPoll() {
        if (autoPollInterval) return;

        autoPollInterval = setInterval(() => {
            const url = sheetsUrlInput.value.trim();
            if (!url) {
                stopAutoPoll();
                return;
            }
            autoSyncFromGoogleSheets().catch(() => {});
        }, 5000); // 5000 ms = 5 seconds
    }

    function stopAutoPoll() {
        if (autoPollInterval) {
            clearInterval(autoPollInterval);
            autoPollInterval = null;
        }
    }

    window.addEventListener('beforeunload', () => {
        stopAutoPoll();
    });

    async function autoSyncFromGoogleSheets() {
        if (spinning) return;
        const url = sheetsUrlInput.value.trim();

        if (!url) {
            showNotification('Please enter a Google Sheets URL', 'error');
            sheetsStatus.textContent = 'Error: No URL provided';
            sheetsStatus.style.color = '#ef4444';
            return;
        }

        const spreadsheetIdMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        const gidMatch = url.match(/[#&]gid=([0-9]+)/);

        if (!spreadsheetIdMatch) {
            showNotification('Invalid Google Sheets URL', 'error');
            sheetsStatus.textContent = 'Error: Invalid URL format';
            sheetsStatus.style.color = '#ef4444';
            return;
        }

        const spreadsheetId = spreadsheetIdMatch[1];
        const gid = gidMatch ? gidMatch[1] : '0';

        sheetsStatus.textContent = 'Auto-fetching data from Google Sheets...';
        sheetsStatus.style.color = '#3b82f6';

        try {
            const apiUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&gid=${gid}`;
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('Network response not ok');
            const text = await response.text();

            const jsonString = text.indexOf('(') >= 0 ? text.substring(text.indexOf('(') + 1).slice(0, -2) : text;
            const data = JSON.parse(jsonString);

            const collected = [];
            (data.table.rows || []).forEach((row, rIdx) => {
                if (rIdx === 0) return; // skip header row
                (row.c || []).forEach(cell => {
                    if (!cell) return;
                    const v = (cell.v ?? cell.f);
                    if (v && String(v).trim()) collected.push(String(v).trim());
                });
            });

            const unique = [];
            const seen = new Set();
            for (const v of collected) {
                if (!seen.has(v)) { seen.add(v); unique.push(v); }
            }

            if (unique.length === 0) {
                showNotification('No data found to import from sheet', 'warning');
                sheetsStatus.textContent = 'Warning: Sheet contains no importable values';
                sheetsStatus.style.color = '#f59e0b';
                return;
            }

            const added = mergeNewParticipants(unique);
            if (added.length > 0) {
                showNotification(`Auto-imported ${added.length} new participant${added.length>1?'s':''}`, 'success');
                sheetsStatus.textContent = `✓ Auto-imported ${added.length} new participant${added.length>1?'s':''}`;
                sheetsStatus.style.color = '#10b981';
                playSuccessSound();
            } else {
                sheetsStatus.textContent = `✓ No new participants found`;
                sheetsStatus.style.color = '#6b7280';
            }
        } catch (error) {
            console.error('Error loading Google Sheets:', error);
            showNotification('Failed to auto-load data. Make sure the spreadsheet is publicly accessible.', 'error');
            sheetsStatus.textContent = 'Error: Failed to auto-load data. Check if spreadsheet is public.';
            sheetsStatus.style.color = '#ef4444';
        }
    }

    function mergeNewParticipants(newList) {
        const existingSet = new Set([...participants.map(p => p.trim()), ...secretNames.map(s => s.trim()), ...removedNames]);
        const added = [];
        for (const name of newList) {
            const n = name.trim();
            if (!n) continue;
            if (!existingSet.has(n)) {
                participants.push(n);
                existingSet.add(n);
                added.push(n);
            }
        }
        if (added.length > 0) {
            participantInput.value = participants.join('\n');
            updateParticipants();
        }
        return added;
    }

    settingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'block';
        setTimeout(() => settingsModal.classList.add('show'), 10);
    });

    settingsCloseBtn.addEventListener('click', closeSettingsModal);

    function closeSettingsModal() {
        settingsModal.classList.remove('show');
        setTimeout(() => settingsModal.style.display = 'none', 400);
    }

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettingsModal();
    });

    themeSelect.addEventListener('change', () => {
        const theme = themeSelect.value;
        isDarkTheme = theme === 'dark';
        document.body.classList.toggle('dark-theme', isDarkTheme);
        themeToggle.innerHTML = isDarkTheme ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        localStorage.setItem('darkTheme', isDarkTheme);
    });

    soundEnabled.addEventListener('change', () => {
        settings.soundEnabled = soundEnabled.checked;
        localStorage.setItem('soundEnabled', settings.soundEnabled);
    });

    soundSelect.addEventListener('change', () => {
        settings.soundType = soundSelect.value;
        localStorage.setItem('soundType', settings.soundType);
        playSpinSound(1);
    });

    spinDuration.addEventListener('input', () => {
        settings.spinDuration = parseInt(spinDuration.value);
        spinDurationValue.textContent = settings.spinDuration;
    });

    saveSettingsBtn.addEventListener('click', () => {
        localStorage.setItem('soundEnabled', settings.soundEnabled);
        localStorage.setItem('soundType', settings.soundType);
        localStorage.setItem('spinDuration', settings.spinDuration);
        showNotification('Settings saved successfully!', 'success');
        closeSettingsModal();
    });

    resetSettingsBtn.addEventListener('click', () => {
        settings = {
            soundEnabled: true,
            soundType: 'whoosh',
            spinDuration: 3
        };
        soundEnabled.checked = true;
        soundSelect.value = 'whoosh';
        spinDuration.value = 3;
        spinDurationValue.textContent = 3;
        localStorage.setItem('soundEnabled', true);
        localStorage.setItem('soundType', 'whoosh');
        localStorage.setItem('spinDuration', 3);
        showNotification('Settings reset to default', 'info');
    });

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(tabName + 'Tab').classList.add('active');
        });
    });

    themeToggle.addEventListener('click', () => {
        isDarkTheme = !isDarkTheme;
        document.body.classList.toggle('dark-theme', isDarkTheme);
        themeToggle.innerHTML = isDarkTheme ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        themeSelect.value = isDarkTheme ? 'dark' : 'light';
        localStorage.setItem('darkTheme', isDarkTheme);
        showNotification(`Switched to ${isDarkTheme ? 'dark' : 'light'} theme`, 'info');
    });

    incrementBtn.addEventListener('click', () => {
        const currentValue = parseInt(numWinnersInput.value, 10);
        const totalParticipants = participants.length + secretNames.length;

        if (currentValue < MAX_WHEELS && (currentValue < totalParticipants || totalParticipants === 0)) {
            numWinnersInput.value = currentValue + 1;
            updateWheelCountDisplay();
            createWheels();
            createWheelFilters();
            playClickSound();
            validateSpinConditions();
        } else if (currentValue >= MAX_WHEELS) {
            showNotification(`Maximum ${MAX_WHEELS} wheels allowed`, 'warning');
        } else {
            showNotification(`Maximum ${totalParticipants} winners allowed (based on participants)`, 'warning');
        }
    });

    decrementBtn.addEventListener('click', () => {
        const currentValue = parseInt(numWinnersInput.value, 10);
        if (currentValue > 1) {
            numWinnersInput.value = currentValue - 1;
            updateWheelCountDisplay();
            createWheels();
            createWheelFilters();
            playClickSound();
            validateSpinConditions();
        }
    });

    function updateWheelCountDisplay() {
        const count = parseInt(numWinnersInput.value, 10);
        wheelCountBadge.textContent = `${count} Wheel${count > 1 ? 's' : ''}`;
        spinText.textContent = `Spin the Wheel${count > 1 ? 's' : ''}!`;
    }

    function createWheelFilters() {
        const numWheels = parseInt(numWinnersInput.value, 10);
        wheelFiltersContainer.innerHTML = '';
        wheelFilters = [];

        for (let i = 0; i < numWheels; i++) {
            const filterDiv = document.createElement('div');
            filterDiv.className = 'wheel-filter';
            filterDiv.innerHTML = `
                <h4><i class="fas fa-dharmachakra"></i> Wheel ${i + 1} Filters</h4>
                <div class="filter-row">
                    <div class="filter-group">
                        <label>School Type:</label>
                        <select id="schoolType${i}">
                            <option value="all">All Schools</option>
                            <option value="private">Private School</option>
                            <option value="public">Public School</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>School Name:</label>
                        <input type="text" id="schoolName${i}" placeholder="Enter school name...">
                    </div>
                </div>
                <div class="filter-row">
                    <div class="filter-group">
                        <label>Age:</label>
                        <input type="text" id="age${i}" placeholder="Enter age or range...">
                    </div>
                    <div class="filter-row">
                        <div class="filter-group">
                            <label>Religion:</label>
                            <input type="text" id="religion${i}" placeholder="Enter religion...">
                        </div>
                    </div>
                </div>
                <div class="filter-row">
                    <div class="filter-group">
                        <label>Custom Filter:</label>
                        <input type="text" id="customFilter${i}" placeholder="Enter custom filter criteria...">
                    </div>
                </div>
            `;

            wheelFiltersContainer.appendChild(filterDiv);

            wheelFilters[i] = {
                schoolType: 'all',
                schoolName: '',
                age: '',
                religion: '',
                customFilter: ''
            };

            const schoolTypeSelect = document.getElementById(`schoolType${i}`);
            const schoolNameInput = document.getElementById(`schoolName${i}`);
            const ageInput = document.getElementById(`age${i}`);
            const religionInput = document.getElementById(`religion${i}`);
            const customFilterInput = document.getElementById(`customFilter${i}`);

            schoolTypeSelect.addEventListener('change', () => {
                wheelFilters[i].schoolType = schoolTypeSelect.value;
                applyFiltersToWheel(i);
            });

            schoolNameInput.addEventListener('input', () => {
                wheelFilters[i].schoolName = schoolNameInput.value.toLowerCase();
                applyFiltersToWheel(i);
            });

            ageInput.addEventListener('input', () => {
                wheelFilters[i].age = ageInput.value.toLowerCase();
                applyFiltersToWheel(i);
            });

            religionInput.addEventListener('input', () => {
                wheelFilters[i].religion = religionInput.value.toLowerCase();
                applyFiltersToWheel(i);
            });

            customFilterInput.addEventListener('input', () => {
                wheelFilters[i].customFilter = customFilterInput.value.toLowerCase();
                applyFiltersToWheel(i);
            });
        }
    }

    function applyFiltersToWheel(wheelIndex) {
        const filter = wheelFilters[wheelIndex];
        const activeFilters = [];

        if (filter.schoolType !== 'all') activeFilters.push(`School Type: ${filter.schoolType}`);
        if (filter.schoolName) activeFilters.push(`School: ${filter.schoolName}`);
        if (filter.age) activeFilters.push(`Age: ${filter.age}`);
        if (filter.religion) activeFilters.push(`Religion: ${filter.religion}`);
        if (filter.customFilter) activeFilters.push(`Custom: ${filter.customFilter}`);

        if (activeFilters.length > 0) {
            showNotification(`Wheel ${wheelIndex + 1} filters applied: ${activeFilters.join(', ')}`, 'info');
        }
        scheduleWheels();
    }

    function validateSpinConditions() {
        const totalParticipants = participants.length + secretNames.length;
        const numWinners = parseInt(numWinnersInput.value, 10);

        if (totalParticipants === 0) {
            spinBtn.disabled = true;
            validationStatus.className = 'validation-status invalid';
            statusText.textContent = 'Add participants to enable spinning';
        } else if (totalParticipants < numWinners) {
            spinBtn.disabled = true;
            validationStatus.className = 'validation-status invalid';
            statusText.textContent = `Need at least ${numWinners} participants (currently ${totalParticipants})`;
        } else {
            spinBtn.disabled = false;
            validationStatus.className = 'validation-status';
            statusText.textContent = `Ready to spin! ${totalParticipants} participants for ${numWinners} winner${numWinners > 1 ? 's' : ''}`;
        }
    }

    if (toggleSecretNameCheckbox) {
        toggleSecretNameCheckbox.addEventListener('change', function() {
            if (secretNameContainer) {
                secretNameContainer.style.display = this.checked ? 'flex' : 'none';
            }
            if (this.checked) {
                showNotification('Secret names enabled', 'info');
            } else {
                showNotification('Secret names disabled', 'info');
            }
        });
    }

    function playClickSound() {
        if (!settings.soundEnabled) return;
        try {
            const audioContext = getAudioContext();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);

            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch(e) {
            console.log('Audio context not available');
        }
    }

    function playSuccessSound() {
        if (!settings.soundEnabled) return;
        try {
            const audioContext = getAudioContext();

            [440, 554.37, 659.25].forEach((freq, index) => {
                setTimeout(() => {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();

                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);

                    oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.5);
                }, index * 100);
            });
        } catch(e) {
            console.log('Audio context not available');
        }
    }

    function playSpinSound(duration = settings.spinDuration) {
        if (!settings.soundEnabled) return;

        try {
            const audioContext = getAudioContext();

            switch (settings.soundType) {
                case 'whoosh':
                    playWhooshSound(audioContext, duration);
                    break;
                case 'ticking':
                    playTickingSound(audioContext, duration);
                    break;
                case 'drumroll':
                    playDrumrollSound(audioContext, duration);
                    break;
                case 'arcade':
                    playArcadeSound(audioContext, duration);
                    break;
                case 'casino':
                    playCasinoSound(audioContext, duration);
                    break;
                case 'swoosh':
                    playSwooshSound(audioContext, duration);
                    break;
                case 'mechanical':
                    playMechanicalSound(audioContext, duration);
                    break;
                case 'space':
                    playSpaceSound(audioContext, duration);
                    break;
                case 'wind':
                    playWindSound(audioContext, duration);
                    break;
                case 'digital':
                    playDigitalSound(audioContext, duration);
                    break;
                default:
                    playWhooshSound(audioContext, duration);
            }
        } catch(e) {
            console.log('Audio context not available');
        }
    }

    function playWhooshSound(audioContext, duration) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + duration);

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    }

    function playTickingSound(audioContext, duration) {
        const interval = 100;
        const ticks = Math.floor((duration * 1000) / interval);

        for (let i = 0; i < ticks; i++) {
            setTimeout(() => {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();

                osc.connect(gain);
                gain.connect(audioContext.destination);

                osc.frequency.setValueAtTime(1000, audioContext.currentTime);
                gain.gain.setValueAtTime(0.2, audioContext.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);

                osc.start(audioContext.currentTime);
                osc.stop(audioContext.currentTime + 0.05);
            }, i * interval);
        }
    }

    function playDrumrollSound(audioContext, duration) {
        const oscillator1 = audioContext.createOscillator();
        const oscillator2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator1.frequency.setValueAtTime(80, audioContext.currentTime);
        oscillator2.frequency.setValueAtTime(120, audioContext.currentTime);

        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime + duration * 0.8);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

        oscillator1.start(audioContext.currentTime);
        oscillator2.start(audioContext.currentTime);
        oscillator1.stop(audioContext.currentTime + duration);
        oscillator2.stop(audioContext.currentTime + duration);
    }

    function playArcadeSound(audioContext, duration) {
        const frequencies = [220, 330, 440, 550, 660];

        frequencies.forEach((freq, index) => {
            const startTime = audioContext.currentTime + (index * duration / 5);
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();

            osc.connect(gain);
            gain.connect(audioContext.destination);

            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.15, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

            osc.start(startTime);
            osc.stop(startTime + 0.2);
        });
    }

    function playCasinoSound(audioContext, duration) {
        const osc1 = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioContext.destination);

        osc1.frequency.setValueAtTime(200, audioContext.currentTime);
        osc2.frequency.setValueAtTime(400, audioContext.currentTime);

        const lfo = audioContext.createOscillator();
        const lfoGain = audioContext.createGain();
        lfo.frequency.setValueAtTime(5, audioContext.currentTime);
        lfoGain.gain.setValueAtTime(50, audioContext.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(osc1.frequency);
        lfoGain.connect(osc2.frequency);

        gain.gain.setValueAtTime(0.2, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

        lfo.start(audioContext.currentTime);
        osc1.start(audioContext.currentTime);
        osc2.start(audioContext.currentTime);
        lfo.stop(audioContext.currentTime + duration);
        osc1.stop(audioContext.currentTime + duration);
        osc2.stop(audioContext.currentTime + duration);
    }

    function playSwooshSound(audioContext, duration) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);

        osc.frequency.setValueAtTime(150, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + duration);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, audioContext.currentTime);
        filter.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + duration);

        gain.gain.setValueAtTime(0.25, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + duration);
    }

    function playMechanicalSound(audioContext, duration) {
        const numClicks = 20;
        const clickInterval = duration * 1000 / numClicks;

        for (let i = 0; i < numClicks; i++) {
            setTimeout(() => {
                const noise = audioContext.createBufferSource();
                const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
                const data = buffer.getChannelData(0);

                for (let j = 0; j < data.length; j++) {
                    data[j] = Math.random() * 2 - 1;
                }

                noise.buffer = buffer;
                const gain = audioContext.createGain();
                const filter = audioContext.createBiquadFilter();

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(audioContext.destination);

                filter.type = 'highpass';
                filter.frequency.setValueAtTime(2000, audioContext.currentTime);

                gain.gain.setValueAtTime(0.3, audioContext.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);

                noise.start(audioContext.currentTime);
                noise.stop(audioContext.currentTime + 0.05);
            }, i * clickInterval);
        }
    }

    function playSpaceSound(audioContext, duration) {
        const osc1 = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const delay = audioContext.createDelay();

        osc1.connect(delay);
        delay.connect(gain);
        osc2.connect(gain);
        gain.connect(audioContext.destination);

        osc1.frequency.setValueAtTime(60, audioContext.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + duration);

        osc2.frequency.setValueAtTime(120, audioContext.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + duration);

        delay.delayTime.setValueAtTime(0.3, audioContext.currentTime);

        gain.gain.setValueAtTime(0.2, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

        osc1.start(audioContext.currentTime);
        osc2.start(audioContext.currentTime);
        osc1.stop(audioContext.currentTime + duration);
        osc2.stop(audioContext.currentTime + duration);
    }

    function playWindSound(audioContext, duration) {
        const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

        frequencies.forEach((freq, index) => {
            setTimeout(() => {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();

                osc.connect(gain);
                gain.connect(audioContext.destination);

                osc.frequency.setValueAtTime(freq, audioContext.currentTime);
                gain.gain.setValueAtTime(0.15, audioContext.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);

                osc.start(audioContext.currentTime);
                osc.stop(audioContext.currentTime + 1);
            }, index * (duration * 1000 / 4));
        });
    }

    function playDigitalSound(audioContext, duration) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.type = 'square';

        const pulseCount = 8;
        const pulseInterval = duration / pulseCount;

        for (let i = 0; i < pulseCount; i++) {
            const startTime = audioContext.currentTime + (i * pulseInterval);
            const freq = 440 + (i * 55); // Ascending frequency

            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.2, startTime);
            gain.gain.setValueAtTime(0.01, startTime + 0.05);
            gain.gain.setValueAtTime(0.2, startTime + 0.1);
        }

        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + duration);
    }

    function divideParticipants(numWheels) {
        const total = participants.length;
        const base = Math.floor(total / numWheels);
        const extra = total % numWheels;
        const wheelParticipants = [];
        let cursor = 0;

        for (let i = 0; i < numWheels; i++) {
            const size = base + (i < extra ? 1 : 0);
            wheelParticipants.push(participants.slice(cursor, cursor + size));
            cursor += size;
        }

        return wheelParticipants;
    }

    function updateParticipants() {
        participants = participantInput.value.trim().split('\n').map(s => s.trim()).filter(name => name !== '');
        participantCount.textContent = participants.length;
        const totalParticipants = participants.length + secretNames.length;
        const currentWinners = parseInt(numWinnersInput.value);

        if (currentWinners > totalParticipants && totalParticipants > 0) {
            numWinnersInput.value = totalParticipants;
            showNotification(`Adjusted wheels to ${totalParticipants} based on participant count`, 'info');
        }

        updateWheelCountDisplay();
        scheduleWheels();
        validateSpinConditions();
    }

    function updateSecretNames() {
        if (secretNameInput) {
            secretNames = secretNameInput.value.trim().split('\n').map(s => s.trim()).filter(name => name !== '');
        }
        validateSpinConditions();
    }

    participantInput.addEventListener('input', updateParticipants);
    if (secretNameInput) {
        secretNameInput.addEventListener('input', updateSecretNames);
    }
    numWinnersInput.addEventListener('change', () => {
        let value = parseInt(numWinnersInput.value, 10);
        if (isNaN(value) || value < 1) value = 1;
        if (value > MAX_WHEELS) {
            value = MAX_WHEELS;
            showNotification(`Maximum ${MAX_WHEELS} wheels allowed`, 'warning');
        }
        numWinnersInput.value = value;
        updateWheelCountDisplay();
        createWheels();
        createWheelFilters();
        validateSpinConditions();
    });

    function playCelebrationEffects() {
        if (settings.soundEnabled) {
            setTimeout(() => {
                playSuccessSound();
            }, 200);

            setTimeout(() => {
                try {
                    const audioContext = getAudioContext();

                    for (let i = 0; i < 3; i++) {
                        setTimeout(() => {
                            const osc = audioContext.createOscillator();
                            const gain = audioContext.createGain();
                            const filter = audioContext.createBiquadFilter();

                            osc.connect(filter);
                            filter.connect(gain);
                            gain.connect(audioContext.destination);

                            osc.frequency.setValueAtTime(150, audioContext.currentTime);
                            osc.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.3);

                            filter.type = 'lowpass';
                            filter.frequency.setValueAtTime(2000, audioContext.currentTime);

                            gain.gain.setValueAtTime(0.3, audioContext.currentTime);
                            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

                            osc.start(audioContext.currentTime);
                            osc.stop(audioContext.currentTime + 0.4);
                        }, i * 300);
                    }
                } catch(e) {
                    console.log('Audio context not available');
                }
            }, 500);
        }

        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });

            setTimeout(() => {
                confetti({
                    particleCount: 50,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 }
                });
                confetti({
                    particleCount: 50,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 }
                });
            }, 300);

            setTimeout(() => {
                confetti({
                    particleCount: 200,
                    spread: 100,
                    startVelocity: 45,
                    origin: { x: 0.5, y: 0 }
                });
            }, 600);

            setTimeout(() => {
                confetti({
                    particleCount: 30,
                    spread: 80,
                    shapes: ['star'],
                    colors: ['#FFD700', '#FFA500', '#FF69B4', '#00CED1'],
                    origin: { y: 0.7 }
                });
            }, 900);
        }
    }

    let renderTimer = null;
    let renderPending = false;

    function scheduleWheels() {
        renderPending = true;
        clearTimeout(renderTimer);
        renderTimer = setTimeout(createWheels, 150);
    }

    function flushWheels() {
        if (renderPending) createWheels();
    }

    function segmentColor(index, total) {
        let slot = index % wheelPalette.length;
        if (slot === 0 && index > 0 && index === total - 1) {
            const prev = (index - 1) % wheelPalette.length;
            slot = [1, 2, 3].find(k => k !== prev);
        }
        return wheelPalette[slot];
    }

    function drawWheel(canvas, names) {
        const ctx = canvas.getContext('2d');
        const size = canvas.width;
        const c = size / 2;
        const R = c;
        const count = names.length;
        const seg = (Math.PI * 2) / count;
        const origin = -Math.PI / 2;

        ctx.clearRect(0, 0, size, size);

        for (let i = 0; i < count; i++) {
            const color = segmentColor(i, count);
            ctx.beginPath();
            ctx.moveTo(c, c);
            ctx.arc(c, c, R, origin + i * seg, origin + (i + 1) * seg);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        const shade = ctx.createRadialGradient(c, c, R * 0.2, c, c, R);
        shade.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
        shade.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.arc(c, c, R, 0, Math.PI * 2);
        ctx.fill();

        const inner = R * 0.24;
        const outer = R * 0.93;
        const available = outer - inner;
        const arc = 2 * (R * 0.6) * Math.sin(Math.min(seg, Math.PI) / 2);
        const baseFont = Math.min(R * 0.15, arc * 0.6);
        if (baseFont < 2) return;

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#111827';

        for (let i = 0; i < count; i++) {
            let font = baseFont;
            let label = names[i];
            ctx.font = `500 ${font}px ${wheelFontFamily}`;
            let width = ctx.measureText(label).width;

            if (width > available) {
                font = Math.max(baseFont * 0.5, font * available / width);
                ctx.font = `500 ${font}px ${wheelFontFamily}`;
                width = ctx.measureText(label).width;
            }

            if (width > available) {
                while (label.length > 1 && ctx.measureText(label + '…').width > available) {
                    label = label.slice(0, -1);
                }
                label = label.trimEnd() + '…';
            }

            ctx.save();
            ctx.translate(c, c);
            ctx.rotate(origin + (i + 0.5) * seg);
            ctx.fillText(label, outer, 0);
            ctx.restore();
        }
    }

    function redrawWheels() {
        wheels.forEach(wheel => {
            if (wheel.face) drawWheel(wheel.face, wheel.participants);
        });
    }

    if (document.fonts && document.fonts.load) {
        document.fonts.load('500 20px "Quicksand"').then(redrawWheels).catch(() => {});
    }

    function createWheels() {
        clearTimeout(renderTimer);
        renderPending = false;

        const numWheels = parseInt(numWinnersInput.value, 10) || 1;
        wheelsGrid.innerHTML = '';
        wheelsGrid.className = `wheels-grid ${numWheels > 10 ? 'wheels-many' : `wheels-${numWheels}`}`;
        wheels = [];

        if (participants.length === 0) {
            wheelsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #6b7280;">
                    <i class="fas fa-users" style="font-size: 4rem; margin-bottom: 24px; color: #3b82f6;"></i>
                    <p style="font-size: 1.3rem; font-weight: 600; margin-bottom: 12px;">Add participants to start the raffle</p>
                    <p style="font-size: 1rem; color: #9ca3af;">Enter participant names or paste Google Sheets URL above</p>
                </div>
            `;
            return;
        }

        const wheelParticipants = divideParticipants(numWheels);
        const canvasSize = numWheels <= 4 ? 800 : numWheels <= 12 ? 560 : 420;
        const fragment = document.createDocumentFragment();

        for (let wheelIndex = 0; wheelIndex < numWheels; wheelIndex++) {
            const names = wheelParticipants[wheelIndex] || [];

            const wheelContainer = document.createElement('div');
            wheelContainer.className = 'wheel-container';
            wheelContainer.setAttribute('data-wheel', wheelIndex);

            const wheelCanvas = document.createElement('div');
            wheelCanvas.className = 'wheel-canvas';
            wheelCanvas.id = `wheelCanvas${wheelIndex}`;

            const wheelLabel = document.createElement('div');
            wheelLabel.className = 'wheel-label';
            wheelLabel.innerHTML = `
                <span style="font-weight:700; letter-spacing:0.4px;">WHEEL ${wheelIndex + 1} - ${names.length} ${names.length === 1 ? 'PARTICIPANT' : 'PARTICIPANTS'}</span>
            `;

            let face = null;

            if (names.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.style.cssText = `
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    color: #6b7280;
                    font-weight: 600;
                `;
                emptyMessage.innerHTML = `
                    <i class="fas fa-filter" style="font-size: 2rem; margin-bottom: 8px; display: block;"></i>
                    <span>No participants match filters</span>
                `;
                wheelCanvas.appendChild(emptyMessage);
            } else {
                face = document.createElement('canvas');
                face.className = 'wheel-face';
                face.width = canvasSize;
                face.height = canvasSize;
                drawWheel(face, names);
                wheelCanvas.appendChild(face);
            }

            const center = document.createElement('div');
            center.className = 'wheel-center';
            wheelCanvas.appendChild(center);

            const arrow = document.createElement('div');
            arrow.className = 'wheel-arrow';
            wheelContainer.appendChild(arrow);

            wheelContainer.appendChild(wheelCanvas);
            wheelContainer.appendChild(wheelLabel);
            fragment.appendChild(wheelContainer);

            wheels.push({
                container: wheelContainer,
                canvas: wheelCanvas,
                face: face,
                participants: names,
                index: wheelIndex,
                arrow: arrow,
                rotation: 0
            });
        }

        wheelsGrid.appendChild(fragment);
    }

    async function spinWheels() {
        if (spinning) return;
        flushWheels();

        const numWheels = wheels.length;
        const allParticipants = [...participants];
        if (toggleSecretNameCheckbox && toggleSecretNameCheckbox.checked && secretNames.length > 0) {
            allParticipants.push(...secretNames);
        }
        if (numWheels === 0 || allParticipants.length < numWheels) {
            showNotification('Not enough participants for the selected number of wheels', 'error');
            validateSpinConditions();
            return;
        }

        spinning = true;
        spinBtn.disabled = true;
        winners = [];
        wheels.forEach(wheel => wheel.arrow.classList.remove('winner-selected'));

        playSpinSound();

        const baseDuration = settings.spinDuration || 3;

        const plans = wheels.map(wheel => {
            const count = wheel.participants.length;
            if (count === 0) return null;

            const segmentAngle = 360 / count;
            const winnerIndex = Math.floor(Math.random() * count);
            const landing = (winnerIndex + 0.15 + Math.random() * 0.7) * segmentAngle;
            const targetRotation = (360 - landing) % 360;
            const startRotation = wheel.rotation;
            const delta = (((targetRotation - startRotation) % 360) + 360) % 360;
            const extraSpins = 3 + Math.floor(Math.random() * 4);
            const duration = Math.max(0.9, baseDuration + (Math.random() * 0.6 - 0.3));

            return {
                wheel,
                winnerIndex,
                startRotation,
                finalRotation: startRotation + extraSpins * 360 + delta,
                duration
            };
        });

        plans.forEach(plan => {
            if (!plan) return;
            plan.wheel.canvas.style.transition = 'none';
            plan.wheel.canvas.style.transform = `rotate(${plan.startRotation}deg)`;
        });
        void wheelsGrid.offsetWidth;

        const results = await Promise.all(plans.map((plan, wheelIndex) => new Promise(resolve => {
            if (!plan) {
                resolve(null);
                return;
            }

            const { wheel, winnerIndex, finalRotation, duration } = plan;
            wheel.canvas.style.transition = `transform ${duration}s cubic-bezier(0.17, 0.67, 0.12, 0.99)`;
            wheel.canvas.style.transform = `rotate(${finalRotation}deg)`;

            setTimeout(() => {
                const settled = finalRotation % 360;
                wheel.rotation = settled;
                wheel.canvas.style.transition = 'none';
                wheel.canvas.style.transform = `rotate(${settled}deg)`;
                wheel.arrow.classList.add('winner-selected');
                resolve({ winner: wheel.participants[winnerIndex], wheel: wheelIndex + 1, index: winnerIndex });
            }, duration * 1000 + 100);
        })));

        winners = results.filter(r => r !== null);

        updateWinnersList();
        showWinnersModal();

        if (removeWinnerCheckbox && removeWinnerCheckbox.checked) {
            winners.forEach(w => {
                removedNames.add(w.winner);
                const pi = participants.indexOf(w.winner);
                if (pi > -1) participants.splice(pi, 1);
                const si = secretNames.indexOf(w.winner);
                if (si > -1) secretNames.splice(si, 1);
            });
            participantInput.value = participants.join('\n');
            if (secretNameInput) secretNameInput.value = secretNames.join('\n');
            updateParticipants();
        }

        setTimeout(() => {
            wheels.forEach(w => {
                if (w.arrow) w.arrow.classList.remove('winner-selected');
            });
        }, 1800);

        spinning = false;
        validateSpinConditions();
    }
    spinBtn.addEventListener('click', spinWheels);

    function updateWinnersList() {
        const prizeName = prizeNameInput.value.trim() || 'Grand Prize';

        winners.forEach(w => {
            allWinnersData.push({
                name: w.winner,
                prize: prizeName,
                wheel: w.wheel,
                timestamp: new Date()
            });
        });

        winnersList.innerHTML = '';
        allWinnersData.forEach((winner, index) => {
            const li = document.createElement('li');
            li.textContent = `${winner.name} - ${winner.prize} (Wheel ${winner.wheel})`;
            li.style.animationDelay = `${index * 0.1}s`;
            winnersList.appendChild(li);
        });
    }

    function showWinnersModal() {
        const prizeName = prizeNameInput.value.trim() || 'Grand Prize';
        prizeDisplay.textContent = `Prize: ${prizeName}`;

        winnersTableBody.innerHTML = '';
        winners.forEach((winner, index) => {
            const row = document.createElement('tr');
            row.style.animationDelay = `${index * 0.1}s`;
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${winner.winner}</td>
                <td>${prizeName} - Wheel ${winner.wheel}</td>
            `;
            winnersTableBody.appendChild(row);
        });

        winnersModal.style.display = 'block';
        setTimeout(() => {
            winnersModal.classList.add('show');
            playCelebrationEffects();
        }, 10);
    }

    function closeModal() {
        winnersModal.classList.remove('show');
        setTimeout(() => winnersModal.style.display = 'none', 400);
    }

    closeModalBtn.addEventListener('click', closeModal);
    modalCloseBtn.addEventListener('click', closeModal);

    winnersModal.addEventListener('click', (e) => {
        if (e.target === winnersModal) {
            closeModal();
        }
    });

    clearWinnersBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all winners?')) {
            allWinnersData = [];
            removedNames.clear();
            winnersList.innerHTML = '';
            showNotification('Winners list cleared', 'success');
        }
    });

    downloadScreenshotBtn.addEventListener('click', async () => {
        try {
            showNotification('Preparing full modal screenshot...', 'info');

            const originalModalStyle = {
                position: winnersModal.style.position,
                display: winnersModal.style.display,
                backgroundColor: winnersModal.style.backgroundColor,
                backdropFilter: winnersModal.style.backdropFilter,
                height: winnersModal.style.height,
                overflow: winnersModal.style.overflow
            };

            const originalContentStyle = {
                position: modalContentForScreenshot.style.position,
                zIndex: modalContentForScreenshot.style.zIndex,
                transform: modalContentForScreenshot.style.transform,
                opacity: modalContentForScreenshot.style.opacity,
                backgroundColor: modalContentForScreenshot.style.backgroundColor,
                borderRadius: modalContentForScreenshot.style.borderRadius,
                boxShadow: modalContentForScreenshot.style.boxShadow,
                maxHeight: modalContentForScreenshot.style.maxHeight,
                overflowY: modalContentForScreenshot.style.overflowY,
                width: modalContentForScreenshot.style.width,
                margin: modalContentForScreenshot.style.margin
            };

            winnersModal.style.position = 'static';
            winnersModal.style.display = 'block';
            winnersModal.style.backgroundColor = 'transparent';
            winnersModal.style.backdropFilter = 'none';
            winnersModal.style.height = 'auto';
            winnersModal.style.overflow = 'visible';

            modalContentForScreenshot.style.position = 'static';
            modalContentForScreenshot.style.zIndex = 'auto';
            modalContentForScreenshot.style.transform = 'none';
            modalContentForScreenshot.style.opacity = '1';
            modalContentForScreenshot.style.backgroundColor = '#ffffff';
            modalContentForScreenshot.style.borderRadius = '16px';
            modalContentForScreenshot.style.boxShadow = '0 25px 50px rgba(0,0,0,0.3)';
            modalContentForScreenshot.style.maxHeight = 'none';
            modalContentForScreenshot.style.overflowY = 'visible';
            modalContentForScreenshot.style.width = '900px';
            modalContentForScreenshot.style.margin = '0 auto';

            await new Promise(resolve => setTimeout(resolve, 300));

            const canvas = await html2canvas(modalContentForScreenshot, {
                backgroundColor: null,
                scale: 2,
                logging: false,
                useCORS: true,
                allowTaint: true,
                removeContainer: false,
                letterRendering: true,
                scrollX: 0,
                scrollY: 0,
                width: modalContentForScreenshot.scrollWidth,
                height: modalContentForScreenshot.scrollHeight,
                windowWidth: modalContentForScreenshot.scrollWidth,
                windowHeight: modalContentForScreenshot.scrollHeight
            });

            Object.assign(winnersModal.style, originalModalStyle);
            Object.assign(modalContentForScreenshot.style, originalContentStyle);

            const link = document.createElement('a');
            const prizeName = prizeNameInput.value.trim() || 'Prize';
            const timestamp = new Date().toISOString().slice(0, 10);
            const filename = `CEEDO_${prizeName.replace(/[^a-zA-Z0-9]/g, '_')}_Winners_${timestamp}.png`;

            link.download = filename;
            link.href = canvas.toDataURL('image/png', 1.0);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showNotification('Full modal screenshot saved successfully! 📸', 'success');
            playSuccessSound();

        } catch (error) {
            console.error('Error creating full modal screenshot:', error);
            showNotification('Error creating screenshot. Please try again.', 'error');

            winnersModal.style.position = '';
            winnersModal.style.display = '';
            winnersModal.style.backgroundColor = '';
            winnersModal.style.backdropFilter = '';
            winnersModal.style.height = '';
            winnersModal.style.overflow = '';
            modalContentForScreenshot.style.position = '';
            modalContentForScreenshot.style.zIndex = '';
            modalContentForScreenshot.style.transform = '';
            modalContentForScreenshot.style.backgroundColor = '';
            modalContentForScreenshot.style.borderRadius = '';
            modalContentForScreenshot.style.boxShadow = '';
            modalContentForScreenshot.style.maxHeight = '';
            modalContentForScreenshot.style.overflowY = '';
            modalContentForScreenshot.style.width = '';
            modalContentForScreenshot.style.margin = '';
        }
    });

    function downloadExcelFile() {
        if (allWinnersData.length === 0) {
            showNotification('No winners to export', 'warning');
            return;
        }

        try {
            const wb = XLSX.utils.book_new();
            const wsData = [
                ['#', 'Winner Name', 'Prize', 'Wheel', 'Date & Time']
            ];

            allWinnersData.forEach((winner, index) => {
                wsData.push([
                    index + 1,
                    winner.name,
                    winner.prize,
                    `Wheel ${winner.wheel}`,
                    winner.timestamp.toLocaleString()
                ]);
            });

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, 'Winners');

            const timestamp = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `CEEDO_Raffle_Winners_${timestamp}.xlsx`);

            showNotification('Excel file downloaded successfully! 📊', 'success');
            playSuccessSound();
        } catch (error) {
            console.error('Error creating Excel file:', error);
            showNotification('Error creating Excel file', 'error');
        }
    }

    downloadBtn.addEventListener('click', downloadExcelFile);
    downloadExcelModalBtn.addEventListener('click', downloadExcelFile);

    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const iconMap = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };

        notification.innerHTML = `
            <i class="fas ${iconMap[type]}"></i>
            <span>${message}</span>
        `;

        notificationContainer.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notificationContainer.removeChild(notification);
                }
            }, 400);
        }, 4000);
    }

    updateParticipants();
    updateWheelCountDisplay();
    createWheelFilters();
    validateSpinConditions();

    setTimeout(() => {
        if (participants.length === 0) {
            const sampleData = [
                "John Smith", "Mary Johnson", "David Brown", "Sarah Davis",
                "Michael Wilson", "Jessica Miller", "Christopher Moore", "Ashley Taylor",
                "Matthew Anderson", "Amanda Thomas", "Joshua Jackson", "Melissa White",
                "Andrew Harris", "Stephanie Martin", "Daniel Thompson", "Nicole Garcia"
            ];
            participantInput.value = sampleData.join('\n');
            updateParticipants();
            showNotification('Sample participants loaded for demonstration', 'info');
        }
    }, 1500);

    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key === 'Enter' && !spinning && !spinBtn.disabled) {
            event.preventDefault();
            spinWheels();
        }

        if (event.key === 'Escape') {
            if (winnersModal.classList.contains('show')) {
                closeModal();
            }
            if (settingsModal.classList.contains('show')) {
                closeSettingsModal();
            }
        }

        if (event.ctrlKey && event.key === 'm') {
            event.preventDefault();
            if (secretNameInput) {
                const secretValue = secretNameInput.value.trim();
                if (secretValue) {
                    const newNames = secretValue.split('\n').filter(name => name.trim() !== '');
                    if (newNames.length > 0) {
                        secretNames.push(...newNames);
                        secretNameInput.value = '';
                        updateSecretNames();
                        showNotification(`Added ${newNames.length} secret name(s)!`, 'success');
                    }
                }
            }
        }
    });

});
