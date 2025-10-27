document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
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
    
    // Google Sheets Elements
    const sheetsUrlInput = document.getElementById('sheetsUrl');
    const sheetsStatus = document.getElementById('sheetsStatus');
    
    // Settings DOM Elements
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

    // Tab Elements
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // State Variables
    let participants = [];
    let secretNames = [];
    let spinning = false;
    let winners = [];
    let wheels = [];
    let isDarkTheme = localStorage.getItem('darkTheme') === 'true';
    let participantColors = {};
    let allWinnersData = [];
    let wheelFilters = [];
    
    // Settings State
    let settings = {
        soundEnabled: localStorage.getItem('soundEnabled') !== 'false',
        soundType: localStorage.getItem('soundType') || 'whoosh',
        spinDuration: parseInt(localStorage.getItem('spinDuration')) || 3
    };

    // Enhanced color palette for professional look
    const colors = [
        '#3b82f6', '#1e40af', '#1d4ed8', '#2563eb', '#1e3a8a',
        '#fbbf24', '#f59e0b', '#d97706', '#fcd34d', '#f3bf00',
        '#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e',
        '#eab308', '#ca8a04', '#a16207', '#854d0e', '#713f12',
        '#10b981', '#059669', '#047857', '#065f46', '#064e3b',
        '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'
    ];

    // Initialize theme
    if (isDarkTheme) {
        document.body.classList.add('dark-theme');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        themeSelect.value = 'dark';
    } else {
        themeSelect.value = 'light';
    }
    
    // Initialize settings UI
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
            // stop polling if URL cleared
            stopAutoPoll();
            sheetsStatus.textContent = '';
            return;
        }

        sheetsStatus.textContent = 'Auto-loading in 2 seconds, then every 5s...';
        sheetsStatus.style.color = '#3b82f6';

        // debounce initial fetch
        autoLoadDebounce = setTimeout(() => {
            autoSyncFromGoogleSheets().catch(() => {});
            startAutoPoll();
        }, 2000);
    });

    function startAutoPoll() {
        // already polling
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

    // stop polling when leaving page
    window.addEventListener('beforeunload', () => {
        stopAutoPoll();
    });

    // --- NEW: Fetch entire sheet and merge ALL non-empty cell values (except header) into participants ---
    async function autoSyncFromGoogleSheets() {
        const url = sheetsUrlInput.value.trim();
        
        if (!url) {
            showNotification('Please enter a Google Sheets URL', 'error');
            sheetsStatus.textContent = 'Error: No URL provided';
            sheetsStatus.style.color = '#ef4444';
            return;
        }
        
        // Extract spreadsheet ID and optional gid
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
        
        // Show loading status
        sheetsStatus.textContent = 'Auto-fetching data from Google Sheets...';
        sheetsStatus.style.color = '#3b82f6';
        
        try {
            const apiUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&gid=${gid}`;
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('Network response not ok');
            const text = await response.text();
            
            // Parse GViz JSON (strip wrapper)
            const jsonString = text.indexOf('(') >= 0 ? text.substring(text.indexOf('(') + 1).slice(0, -2) : text;
            const data = JSON.parse(jsonString);
            
            // Collect all non-empty values (skip header row index 0)
            const collected = [];
            (data.table.rows || []).forEach((row, rIdx) => {
                if (rIdx === 0) return; // skip header row
                (row.c || []).forEach(cell => {
                    if (!cell) return;
                    const v = (cell.v ?? cell.f);
                    if (v && String(v).trim()) collected.push(String(v).trim());
                });
            });
            
            // Deduplicate and normalize (keep order, case-preserve)
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
            
            // Merge new names into participants (and not into secretNames)
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

    // Merge function - returns array of newly added names
    function mergeNewParticipants(newList) {
        const existingSet = new Set([...participants.map(p => p.trim()), ...secretNames.map(s => s.trim())]);
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
            // update UI and storage
            participantInput.value = participants.join('\n');
            updateParticipants();
        }
        return added;
    }
    // --- END NEW sheets sync code ---

    // Settings Modal Controls
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

    // Theme Setting
    themeSelect.addEventListener('change', () => {
        const theme = themeSelect.value;
        isDarkTheme = theme === 'dark';
        document.body.classList.toggle('dark-theme', isDarkTheme);
        themeToggle.innerHTML = isDarkTheme ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        localStorage.setItem('darkTheme', isDarkTheme);
    });

    // Sound Settings
    soundEnabled.addEventListener('change', () => {
        settings.soundEnabled = soundEnabled.checked;
        localStorage.setItem('soundEnabled', settings.soundEnabled);
    });

    soundSelect.addEventListener('change', () => {
        settings.soundType = soundSelect.value;
        localStorage.setItem('soundType', settings.soundType);
        // Play preview sound
        playSpinSound(1);
    });

    // Spin Duration Setting
    spinDuration.addEventListener('input', () => {
        settings.spinDuration = parseInt(spinDuration.value);
        spinDurationValue.textContent = settings.spinDuration;
    });

    // Save Settings
    saveSettingsBtn.addEventListener('click', () => {
        localStorage.setItem('soundEnabled', settings.soundEnabled);
        localStorage.setItem('soundType', settings.soundType);
        localStorage.setItem('spinDuration', settings.spinDuration);
        showNotification('Settings saved successfully!', 'success');
        closeSettingsModal();
    });

    // Reset Settings
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

    // Tab Functionality
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            // Remove active class from all tabs and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            button.classList.add('active');
            document.getElementById(tabName + 'Tab').classList.add('active');
        });
    });

    // Enhanced theme toggle
    themeToggle.addEventListener('click', () => {
        isDarkTheme = !isDarkTheme;
        document.body.classList.toggle('dark-theme', isDarkTheme);
        themeToggle.innerHTML = isDarkTheme ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        themeSelect.value = isDarkTheme ? 'dark' : 'light';
        localStorage.setItem('darkTheme', isDarkTheme);
        showNotification(`Switched to ${isDarkTheme ? 'dark' : 'light'} theme`, 'info');
    });

    // Enhanced number controls with animations
    incrementBtn.addEventListener('click', () => {
        const currentValue = parseInt(numWinnersInput.value, 10);
        const totalParticipants = participants.length + secretNames.length;
        
        if (currentValue < Math.min(totalParticipants, 10) || totalParticipants === 0) {
            numWinnersInput.value = currentValue + 1;
            updateWheelCountDisplay();
            createWheels();
            createWheelFilters();
            playClickSound();
            validateSpinConditions();
        } else if (currentValue >= totalParticipants && totalParticipants > 0) {
            showNotification(`Maximum ${totalParticipants} winners allowed (based on participants)`, 'warning');
        } else {
            showNotification('Maximum 10 wheels allowed', 'warning');
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

    // Update wheel count display
    function updateWheelCountDisplay() {
        const count = parseInt(numWinnersInput.value, 10);
        wheelCountBadge.textContent = `${count} Wheel${count > 1 ? 's' : ''}`;
        spinText.textContent = `Spin the Wheel${count > 1 ? 's' : ''}!`;
    }

    // Create wheel filters
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
            
            // Initialize filter object
            wheelFilters[i] = {
                schoolType: 'all',
                schoolName: '',
                age: '',
                religion: '',
                customFilter: ''
            };

            // Add event listeners for filter changes
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

    // Apply filters to specific wheel
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
        
        createWheels();
    }

    // Validation function
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

    // Toggle secret name container
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

    // Enhanced sound effects with 10 different options
    function playClickSound() {
        if (!settings.soundEnabled) return;
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Play a success chord
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

    // 10 Different Spin Sound Effects
    function playSpinSound(duration = settings.spinDuration) {
        if (!settings.soundEnabled) return;
        
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            switch (settings.soundType) {
                case 'whoosh':
                    // Original whoosh sound
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
        
        // Create wobble effect
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
        // Create mechanical ratchet sound
        const numClicks = 20;
        const clickInterval = duration * 1000 / numClicks;
        
        for (let i = 0; i < numClicks; i++) {
            setTimeout(() => {
                const noise = audioContext.createBufferSource();
                const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
                const data = buffer.getChannelData(0);
                
                // Generate white noise
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
        // Create multiple oscillators for wind chime effect
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
        
        // Create digital pulse pattern
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

    // Assign colors to participants
    function assignColors() {
        participants.forEach((participant, index) => {
            if (!participantColors[participant]) {
                participantColors[participant] = colors[index % colors.length];
            }
        });
    }

    // Divide participants among wheels with filtering
    function divideParticipants(numWheels) {
        const wheelParticipants = [];
        const participantsPerWheel = Math.ceil(participants.length / numWheels);
        
        for (let i = 0; i < numWheels; i++) {
            const start = i * participantsPerWheel;
            const end = Math.min(start + participantsPerWheel, participants.length);
            let wheelParts = participants.slice(start, end);
            
            if (wheelFilters[i]) {
                const filter = wheelFilters[i];
                if (filter.schoolType !== 'all' || filter.schoolName || filter.age || filter.religion || filter.customFilter) {
                    // Filtering placeholder - real metadata-based filtering would go here
                }
            }
            
            wheelParticipants.push(wheelParts);
        }
        
        return wheelParticipants;
    }

  

    // Helper functions
    function lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        
        return '#' + (
            0x1000000 + 
            (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + 
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + 
            (B < 255 ? B < 1 ? 0 : B : 255)
        ).toString(16).slice(1);
    }

    // Update participants
    function updateParticipants() {
        participants = participantInput.value.trim().split('\n').map(s => s.trim()).filter(name => name !== '');
        participantCount.textContent = participants.length;
        assignColors();
        
        const totalParticipants = participants.length + secretNames.length;
        const currentWinners = parseInt(numWinnersInput.value);
        
        if (currentWinners > totalParticipants && totalParticipants > 0) {
            numWinnersInput.value = totalParticipants;
            showNotification(`Adjusted wheels to ${totalParticipants} based on participant count`, 'info');
        }
        
        updateWheelCountDisplay();
        createWheels();
        validateSpinConditions();
    }

    // Update secret names
    function updateSecretNames() {
        if (secretNameInput) {
            secretNames = secretNameInput.value.trim().split('\n').map(s => s.trim()).filter(name => name !== '');
        }
        validateSpinConditions();
    }

    // Event listeners for inputs
    participantInput.addEventListener('input', updateParticipants);
    if (secretNameInput) {
        secretNameInput.addEventListener('input', updateSecretNames);
    }
    numWinnersInput.addEventListener('change', () => {
        updateWheelCountDisplay();
        createWheels();
        createWheelFilters();
        validateSpinConditions();
    });

    // Play celebration sounds and confetti when modal shows up
    function playCelebrationEffects() {
        // Play celebration sound
        if (settings.soundEnabled) {
            setTimeout(() => {
                playSuccessSound();
            }, 200);
            
            // Play fireworks sound
            setTimeout(() => {
                try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    
                    // Create explosion sound
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
        
        // Enhanced confetti effects
        if (typeof confetti !== 'undefined') {
            // Initial burst
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
            
            // Side bursts
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
            
            // Rain effect
            setTimeout(() => {
                confetti({
                    particleCount: 200,
                    spread: 100,
                    startVelocity: 45,
                    origin: { x: 0.5, y: 0 }
                });
            }, 600);
            
            // Hearts and stars
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
































































// ...existing code...
function createWheels() {
    const numWheels = parseInt(numWinnersInput.value, 10);
    wheelsGrid.innerHTML = '';
    wheelsGrid.className = `wheels-grid wheels-${numWheels}`;
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

    assignColors();
    const wheelParticipants = divideParticipants(numWheels);

    for (let wheelIndex = 0; wheelIndex < numWheels; wheelIndex++) {
        const wheelContainer = document.createElement('div');
        wheelContainer.className = 'wheel-container';
        wheelContainer.setAttribute('data-wheel', wheelIndex);

        const wheelCanvas = document.createElement('div');
        wheelCanvas.className = 'wheel-canvas';
        wheelCanvas.id = `wheelCanvas${wheelIndex}`;

        const wheelLabel = document.createElement('div');
        wheelLabel.className = 'wheel-label';

        const currentWheelParticipants = wheelParticipants[wheelIndex] || [];
        wheelLabel.innerHTML = `
            <span style="font-weight:700; letter-spacing:0.4px;">WHEEL ${wheelIndex + 1} - ${currentWheelParticipants.length} ${currentWheelParticipants.length === 1 ? 'PARTICIPANT' : 'PARTICIPANTS'}</span>
        `;

        const segmentsContainer = document.createElement('div');
        segmentsContainer.className = 'wheel-segments-container';
        wheelCanvas.appendChild(segmentsContainer);

        const namesOverlay = document.createElement('div');
        namesOverlay.className = 'wheel-names-overlay';
        wheelCanvas.appendChild(namesOverlay);

        if (currentWheelParticipants.length === 0) {
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
            const segmentAngle = 360 / currentWheelParticipants.length;

            currentWheelParticipants.forEach((participant, index) => {
                const segment = document.createElement('div');
                segment.className = 'wheel-segment';
                segment.dataset.index = index;
                segment.dataset.name = participant;
                segment.dataset.wheel = wheelIndex;

                // store original center angle (used for accurate math)
                const rotation = index * segmentAngle;
                const centerAngle = (rotation + (segmentAngle / 2)) % 360;
                segment.dataset.center = centerAngle; // NEW: original center angle

                const color = participantColors[participant];
                const lightColor = lightenColor(color, 20);

                segment.style.transform = `rotate(${rotation}deg)`;
                segment.style.background = `conic-gradient(from 0deg, ${color} 0deg, ${lightColor} ${segmentAngle}deg, transparent ${segmentAngle}deg)`;

                segmentsContainer.appendChild(segment);

                segment.addEventListener('mouseenter', () => {
                    if (!spinning) {
                        segment.style.filter = 'brightness(1.3) saturate(1.2)';
                        segment.style.transform = `rotate(${rotation}deg) scale(1.05)`;
                        segment.style.zIndex = '8';
                    }
                });

                segment.addEventListener('mouseleave', () => {
                    if (!spinning) {
                        segment.style.filter = '';
                        segment.style.transform = `rotate(${rotation}deg) scale(1)`;
                        segment.style.zIndex = '';
                    }
                });
const nameLabel = document.createElement('div');
nameLabel.className = 'wheel-segment-content';
nameLabel.title = participant; // full name sa tooltip
nameLabel.textContent = participant.length > 3 ? participant.slice(0, 3) + '…' : participant;

                nameLabel.dataset.index = index;
                nameLabel.dataset.name = participant;
                nameLabel.dataset.center = centerAngle; // keep overlay consistent

                const textAngle = rotation + (segmentAngle / 2);
                const radius = 35;
                const centerX = 50;
                const centerY = 50;
                const radian = (textAngle - 90) * Math.PI / 180;
                const x = centerX + (radius * Math.cos(radian));
                const y = centerY + (radius * Math.sin(radian));

                nameLabel.style.left = `${x}%`;
                nameLabel.style.top = `${y}%`;

                let textRotation = textAngle;
                if (textAngle > 90 && textAngle < 270) {
                    textRotation += 180;
                }
                nameLabel.style.transform = `translate(-50%, -50%) rotate(${textRotation}deg)`;

                if (currentWheelParticipants.length > 20) {
                    nameLabel.style.fontSize = '7px';
                    nameLabel.style.minWidth = '40px';
                    nameLabel.style.maxWidth = '60px';
                    nameLabel.style.padding = '2px 4px';
                } else if (currentWheelParticipants.length > 15) {
                    nameLabel.style.fontSize = '8px';
                    nameLabel.style.minWidth = '45px';
                    nameLabel.style.maxWidth = '70px';
                    nameLabel.style.padding = '3px 6px';
                } else if (currentWheelParticipants.length > 10) {
                    nameLabel.style.fontSize = '9px';
                    nameLabel.style.minWidth = '50px';
                    nameLabel.style.maxWidth = '75px';
                    nameLabel.style.padding= '4px 7px';
                } else {
                    nameLabel.style.fontSize = '10px';
                    nameLabel.style.minWidth = '55px';
                    nameLabel.style.maxWidth = '85px';
                    nameLabel.style.padding = '5px 8px';
                }

                namesOverlay.appendChild(nameLabel);
            });
        }

        const center = document.createElement('div');
        center.className = 'wheel-center';
        wheelCanvas.appendChild(center);

        const arrow = document.createElement('div');
        arrow.className = 'wheel-arrow';
        wheelContainer.appendChild(arrow);

        wheelContainer.appendChild(wheelCanvas);
        wheelContainer.appendChild(wheelLabel);
        wheelsGrid.appendChild(wheelContainer);

        wheels.push({
            container: wheelContainer,
            canvas: wheelCanvas,
            segments: segmentsContainer.querySelectorAll('.wheel-segment'),
            participants: currentWheelParticipants,
            index: wheelIndex,
            arrow: arrow
        });
    }
}
// ...existing code...

async function spinWheels() {
    if (spinning) return;
    spinning = true;
    spinBtn.disabled = true;
    winners = [];

    const numWheels = parseInt(numWinnersInput.value, 10);
    const allParticipants = [...participants];
    if (toggleSecretNameCheckbox && toggleSecretNameCheckbox.checked && secretNames.length > 0) {
        allParticipants.push(...secretNames);
    }
    if (allParticipants.length < numWheels) {
        showNotification('Not enough participants for the selected number of wheels', 'error');
        spinning = false;
        validateSpinConditions();
        return;
    }

    playSpinSound();

    const getRotationFromMatrix = (matrix) => {
        if (!matrix || matrix === 'none') return 0;
        const m = matrix.match(/matrix\(([^)]+)\)/);
        if (!m) return 0;
        const vals = m[1].split(',').map(v => parseFloat(v));
        const a = vals[0], b = vals[1];
        const angle = Math.atan2(b, a) * (180 / Math.PI);
        return (angle + 360) % 360;
    };
    const angleDistance = (a, b) => {
        const d = Math.abs(((a - b) % 360) + 360) % 360;
        return Math.min(d, 360 - d);
    };

    const spinPromises = wheels.map((wheel, wIndex) => {
        return new Promise((resolve) => {
            const wheelCanvas = wheel.canvas;
            const currentParticipants = wheel.participants || [];
            if (!currentParticipants || currentParticipants.length === 0) {
                resolve(null);
                return;
            }

            wheelCanvas.classList.remove('spinning');
            wheelCanvas.style.animation = 'none';

            const segmentAngle = 360 / currentParticipants.length;

            // compute arrow angle relative to wheel center (fallback to 270)
            let arrowAngle = 270;
            try {
                if (wheel.arrow) {
                    const wr = wheelCanvas.getBoundingClientRect();
                    const cx = wr.left + wr.width / 2;
                    const cy = wr.top + wr.height / 2;
                    const ar = wheel.arrow.getBoundingClientRect();
                    const ax = ar.left + ar.width / 2;
                    const ay = ar.top + ar.height / 2;
                    const dx = ax - cx;
                    const dy = ay - cy;
                    const rad = Math.atan2(dy, dx);
                    arrowAngle = (rad * 180 / Math.PI + 360) % 360;
                }
            } catch (e) {
                arrowAngle = 270;
            }

            const cs = window.getComputedStyle(wheelCanvas);
            const startRot = getRotationFromMatrix(cs.transform || cs.webkitTransform || 'none');

            const extraSpins = 3 + Math.floor(Math.random() * 4);
            const landingAngle = Math.random() * 360;
            const deltaRotation = extraSpins * 360 + landingAngle;
            const targetAbsRotation = startRot + deltaRotation;

            const baseDuration = (typeof settings !== 'undefined' && settings.spinDuration) ? settings.spinDuration : 3;
            const duration = Math.max(0.9, baseDuration + (Math.random() * 0.6 - 0.3));

            wheelCanvas.style.willChange = 'transform';
            wheelCanvas.style.transition = `transform ${duration}s cubic-bezier(0.17,0.67,0.12,0.99)`;
            wheelCanvas.style.transform = `rotate(${startRot}deg)`;
            void wheelCanvas.offsetWidth;

            let finished = false;
            const finalize = () => {
                if (finished) return;
                finished = true;

                const finalCS = window.getComputedStyle(wheelCanvas);
                let finalRot = getRotationFromMatrix(finalCS.transform || finalCS.webkitTransform || 'none');
                // if computed final is invalid due to immediate reset, use targetAbsRotation normalized
                if (isNaN(finalRot) || Math.abs(finalRot) < 0.0001) {
                    finalRot = ((targetAbsRotation % 360) + 360) % 360;
                }
                const normalizedFinal = ((finalRot % 360) + 360) % 360;

                // debug logging
                console.log("---- SPIN RESULT LOG ----");
                console.log("Wheel:", wIndex + 1);
                console.log("Target Abs Rotation:", targetAbsRotation.toFixed(2));
                console.log("Final Rotation (detected):", finalRot.toFixed(2));
                console.log("Normalized Final:", normalizedFinal.toFixed(2));
                console.log("Arrow Angle:", arrowAngle.toFixed(2));
                console.log("Segment Angle:", segmentAngle.toFixed(2));
                console.log("Participants:", currentParticipants);

                // compute winner: use stored original center angle for each segment
                let bestIndex = 0;
                let bestDist = Infinity;
                for (let i = 0; i < currentParticipants.length; i++) {
                    const segEl = wheel.segments[i];
                    const origCenter = parseFloat(segEl.dataset.center);
                    // rotated center after wheel rotation
                    const rotatedCenter = (origCenter + normalizedFinal) % 360;
                    const dist = angleDistance(rotatedCenter, arrowAngle);
                    console.log(`${i+1}. ${currentParticipants[i]} → origCenter:${origCenter.toFixed(2)}° rotated:${rotatedCenter.toFixed(2)}° dist:${dist.toFixed(2)}`);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestIndex = i;
                    }
                }

                // DOM fallback: prefer element physically under arrow tip
                try {
                    const ar = wheel.arrow.getBoundingClientRect();
                    const testX = ar.left + ar.width / 2;
                    const testY = ar.top + ar.height / 2;
                    const el = document.elementFromPoint(testX, testY);
                    if (el) {
                        const segEl = el.closest('.wheel-segment, .wheel-segment-content');
                        if (segEl && segEl.dataset && segEl.dataset.name) {
                            const domName = segEl.dataset.name;
                            const domIndex = Array.from(wheel.segments).findIndex(s => s.dataset && s.dataset.name === domName);
                            if (domIndex >= 0) {
                                // accept DOM result if within small tolerance
                                const domOrigCenter = parseFloat(wheel.segments[domIndex].dataset.center);
                                const domRot = (domOrigCenter + normalizedFinal) % 360;
                                const domDist = angleDistance(domRot, arrowAngle);
                                if (domDist <= bestDist + 2.0) {
                                    bestIndex = domIndex;
                                    console.log("DOM fallback winner used:", domName);
                                }
                            }
                        }
                    }
                } catch (e) {
                    // ignore
                }

                const winnerName = currentParticipants[bestIndex];
                console.log(`🎯 Arrow pointing at → ${winnerName} (segment ${bestIndex + 1})`);
                console.log("--------------------------");

                // lock visual to normalized angle for consistent UI
                const normalizedTarget = ((targetAbsRotation % 360) + 360) % 360;
                wheelCanvas.style.transition = 'none';
                wheelCanvas.style.willChange = '';
                wheelCanvas.style.animation = 'none';
                wheelCanvas.style.transform = `rotate(${normalizedTarget}deg)`;
                void wheelCanvas.offsetWidth;

                if (wheel.arrow) wheel.arrow.classList.add('winner-selected');

                setTimeout(() => resolve({ winner: winnerName, wheel: wIndex + 1, index: bestIndex }), 150);
            };

            const onEnd = (ev) => {
                if (ev && ev.propertyName && ev.propertyName !== 'transform') return;
                finalize();
            };
            wheelCanvas.addEventListener('transitionend', onEnd, { once: true });

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    wheelCanvas.style.transform = `rotate(${targetAbsRotation}deg)`;
                });
            });

            setTimeout(finalize, (duration * 1000) + 900);
        });
    });

    const results = await Promise.all(spinPromises);
    winners = results.filter(r => r !== null);

    updateWinnersList();
    showWinnersModal();

    if (removeWinnerCheckbox && removeWinnerCheckbox.checked) {
        winners.forEach(w => {
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
// ...existing code...






























































































    // Update winners list in sidebar
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

    // Show winners modal with enhanced celebrations
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
            // TRIGGER CELEBRATION EFFECTS WHEN MODAL APPEARS
            playCelebrationEffects();
        }, 10);
    }

    // Close modal functions
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

    // Clear winners
    clearWinnersBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all winners?')) {
            allWinnersData = [];
            winnersList.innerHTML = '';
            showNotification('Winners list cleared', 'success');
        }
    });

    // ENHANCED Download screenshot function - NOW CAPTURES FULL MODAL CONTENT
    downloadScreenshotBtn.addEventListener('click', async () => {
        try {
            showNotification('Preparing full modal screenshot...', 'info');
            
            // Save original modal and content styles
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
            
            // Prepare modal for full capture
            winnersModal.style.position = 'static';
            winnersModal.style.display = 'block';
            winnersModal.style.backgroundColor = 'transparent';
            winnersModal.style.backdropFilter = 'none';
            winnersModal.style.height = 'auto';
            winnersModal.style.overflow = 'visible';
            
            // Prepare modal content for full capture
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
            
            // Wait for layout to stabilize
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Capture the full modal content with high quality
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
            
            // Restore all original styles
            Object.assign(winnersModal.style, originalModalStyle);
            Object.assign(modalContentForScreenshot.style, originalContentStyle);
            
            // Create and download the image
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
            
            // Ensure styles are restored even if there's an error
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
 
    // Download Excel file
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

    // Enhanced notification system
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

    // Initialize the application
    updateParticipants();
    updateWheelCountDisplay();
    createWheelFilters();
    validateSpinConditions();
    
    // Load sample data for demonstration
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

    // Add keyboard shortcuts
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