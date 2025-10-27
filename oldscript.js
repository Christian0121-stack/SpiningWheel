document.addEventListener('DOMContentLoaded', () => {
    const wheelCanvas = document.getElementById('wheelCanvas');
    const wheelCtx = wheelCanvas.getContext('2d');
    const spinBtn = document.getElementById('spinBtn');
    const participantInput = document.getElementById('participantInput');
    const numWinnersInput = document.getElementById('numWinners');
    const removeWinnerCheckbox = document.getElementById('removeWinner');
    const secretNameInput = document.getElementById('secretName');
    const winnersList = document.getElementById('winnersList');
    const downloadBtn = document.getElementById('downloadBtn');
    const prizeNameInput = document.getElementById('prizeName');
    const winnersModal = document.getElementById('winnersModal');
    const winnersTableBody = document.getElementById('winnersTableBody');
    const clearWinnersBtn = document.getElementById('clearWinnersBtn');
    const spinnerSound = document.getElementById('spinnerSound');
    const winnerAudio = document.getElementById('winnerAudio');
    const downloadExcelModalBtn = document.getElementById('downloadExcelModalBtn');

    let participants = [];
    let secretNames = [];
    let spinAngle = 0;
    let spinning = false;

    // Set up spinner sound to loop
    spinnerSound.loop = true;

    // Draw the wheel
    function drawWheel() {
        const radius = wheelCanvas.width / 2;
        const segmentAngle = 360 / participants.length;
        const colors = ['#ff9999', '#99ff99', '#9999ff', '#ffff99', '#ff99ff'];
        wheelCtx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

        participants.forEach((participant, index) => {
            const startAngle = (index * segmentAngle) * Math.PI / 180;
            const endAngle = ((index + 1) * segmentAngle) * Math.PI / 180;
            wheelCtx.beginPath();
            wheelCtx.arc(radius, radius, radius, startAngle, endAngle);
            wheelCtx.lineTo(radius, radius);
            wheelCtx.fillStyle = colors[index % colors.length];
            wheelCtx.fill();

            // Draw participant names
            wheelCtx.save();
            wheelCtx.translate(radius, radius);
            wheelCtx.rotate((startAngle + endAngle) / 2);
            wheelCtx.textAlign = 'right';
            wheelCtx.fillStyle = '#fff';
            wheelCtx.font = 'bold 14px Arial';
            wrapText(wheelCtx, participant, radius - 10, 10, segmentAngle * radius / 2);
            wheelCtx.restore();
        });
    }

    // Wrap text function for drawing
    function wrapText(ctx, text, x, y, maxWidth) {
        const words = text.split(' ');
        let line = '';
        const lines = [];
        words.forEach((word, i) => {
            const testLine = line + word + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && i > 0) {
                lines.push(line);
                line = word + ' ';
            } else {
                line = testLine;
            }
        });
        lines.push(line);

        const lineHeight = 20;
        lines.forEach((line, index) => {
            ctx.fillText(line, x, y + index * lineHeight);
        });
    }

    // Update participants list
    function updateParticipants() {
        participants = participantInput.value.trim().split('\n').filter(name => name.trim() !== '');
        drawWheel();
    }

    // Update secret names list
    function updateSecretNames() {
        secretNames = secretNameInput.value.trim().split('\n').filter(name => name.trim() !== '');
    }

    participantInput.addEventListener('input', updateParticipants);
    secretNameInput.addEventListener('input', updateSecretNames);

    // Add secret participant on Ctrl+M
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key === 'm') {
            const secretName = secretNameInput.value.trim();
            if (secretName && !secretNames.includes(secretName)) {
                secretNames.push(secretName);
                updateSecretNames();
                secretNameInput.value = '';
            }
            event.preventDefault();
        }
    });
   // Get references to the checkbox and the container
const toggleSecretNameCheckbox = document.getElementById('toggleSecretName');
const secretNameContainer = document.getElementById('secretNameContainer');

// Add an event listener to the checkbox
toggleSecretNameCheckbox.addEventListener('change', function() {
    if (this.checked) {
        secretNameContainer.style.display = 'block'; // Show the textarea and label
    } else {
        secretNameContainer.style.display = 'none'; // Hide the textarea and label
    }
});
 

    // Shuffle function
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]]; // Swap elements
        }
    }

    // Spin the wheel and select winners
    spinBtn.addEventListener('click', () => {
        if (spinning) return;
        spinning = true;

        if (participants.length === 0 && secretNames.length === 0) {
            alert('Please add participants or secret names first.');
            spinning = false;
            return;
        }

        const numberOfWinners = parseInt(numWinnersInput.value, 10);
        if (numberOfWinners < 1 || numberOfWinners > (participants.length + secretNames.length)) {
            alert('Invalid number of winners.');
            spinning = false;
            return;
        }

        // Play the spinner sound and ensure it loops
        spinnerSound.play();

        const randomSpinAngle = Math.floor(Math.random() * 360) + 3600; // at least 10 full rotations
        spinAngle += randomSpinAngle;
        wheelCanvas.style.transition = 'transform 11s ease-out';
        wheelCanvas.style.transform = `rotate(${spinAngle}deg)`;

        setTimeout(() => {
            wheelCanvas.style.transition = 'none';
            wheelCanvas.style.transform = `rotate(${spinAngle % 360}deg)`;
            wheelCanvas.style.transition = 'transform 0s';

            const winners = [];
            const totalSecretWinners = Math.min(secretNames.length, numberOfWinners);
            const totalParticipantWinners = numberOfWinners - totalSecretWinners;

            // Select winners from secret names list
            for (let i = 0; i < totalSecretWinners; i++) {
                const randomIndex = Math.floor(Math.random() * secretNames.length);
                winners.push(secretNames[randomIndex]);
                secretNames.splice(randomIndex, 1); // Remove the selected secret name
            }

            // Select remaining winners from participants list
            for (let i = 0; i < totalParticipantWinners; i++) {
                const randomIndex = Math.floor(Math.random() * participants.length);
                winners.push(participants[randomIndex]);
                participants.splice(randomIndex, 1); // Remove the selected participant
            }

            // Shuffle the winners array
            shuffleArray(winners);

            // Clear the previous winners list
            winnersList.innerHTML = '';

            // Add winners to the winners list
            winners.forEach((winner) => {
                const listItem = document.createElement('li');
                listItem.textContent = winner;
                winnersList.appendChild(listItem);
            });

            if (removeWinnerCheckbox.checked) {
                // Remove selected winners from participants and secret names
                participants = participants.filter(p => !winners.includes(p));
                secretNames = secretNames.filter(s => !winners.includes(s));
                participantInput.value = participants.join('\n'); // Update textarea
                secretNameInput.value = secretNames.join('\n'); // Update secret names input
                drawWheel(); // Redraw wheel with updated participants
            }

            // Show winners in the modal
            showWinnersModal(winners);

            spinning = false;
        }, 5000); // Match this to the duration of the spinning
    });

    // Display winners in a modal
    function showWinnersModal(winners) {
        // Stop the spinner sound and reset playback
        spinnerSound.pause();
        spinnerSound.currentTime = 0;

        winnersTableBody.innerHTML = '';
        winners.forEach((winner, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${index + 1}</td><td>${winner}</td>`;
            winnersTableBody.appendChild(row);
        });

        // Play the winner announcement audio
        winnerAudio.play();

        winnersModal.style.display = 'block';

        window.onclick = function(event) {
            if (event.target === winnersModal) {
                winnersModal.style.display = 'none';
            }
        };
    }

    // Clear winners list
    clearWinnersBtn.addEventListener('click', () => {
        winnersList.innerHTML = '';
    });

    // Function to download winners as Excel file
    function downloadExcelFile() {
        const prizeName = prizeNameInput.value.trim() || 'No Prize Name';
        const winners = Array.from(winnersList.children).map((li, index) => ({
            Number: index + 1,
            'Names of Winners': li.textContent
        }));

        // Create a new workbook and worksheet
        const wb = XLSX.utils.book_new();

        // Data for the worksheet
        const data = [
            [`Prize Name: ${prizeName}`],
            ['Number', 'Names of Winners'],
            ...winners.map(winner => [winner.Number, winner['Names of Winners']])
        ];

        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(data);

        // Merge cells A1:B1
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }
        ];

        // Styling for header row and data
        if (ws['A1']) ws['A1'].s = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
        if (ws['B1']) ws['B1'].s = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };

        // Adjust column widths
        ws['!cols'] = [
            { width: 20 }, // Width of column A
            { width: 30 }  // Width of column B
        ];

        // Create sheet name from prize name
        const sheetName = `${prizeName} WINNERS`.substring(0, 31); // Sheet names must be <= 31 characters
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        // Generate file name with current date and time
        const now = new Date();
        const formattedDate = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
        const fileName = `EDUC_RAFFLE_${prizeName}_${formattedDate}.xlsx`;

        // Write the file
        XLSX.writeFile(wb, fileName);
    }

    // Download winners as Excel file from main button
    downloadBtn.addEventListener('click', () => {
        downloadExcelFile();
    });

    // Download winners as Excel file from modal button
    downloadExcelModalBtn.addEventListener('click', () => {
        downloadExcelFile();
    });
});
/*document.addEventListener('DOMContentLoaded', () => {
    const wheelCanvas = document.getElementById('wheelCanvas');
    const wheelCtx = wheelCanvas.getContext('2d');
    const spinBtn = document.getElementById('spinBtn');
    const participantInput = document.getElementById('participantInput');
    const numWinnersInput = document.getElementById('numWinners');
    const removeWinnerCheckbox = document.getElementById('removeWinner');
    const secretNameInput = document.getElementById('secretName');
    const winnersList = document.getElementById('winnersList');
    const downloadBtn = document.getElementById('downloadBtn');
    const prizeNameInput = document.getElementById('prizeName');
    const winnersModal = document.getElementById('winnersModal');
    const winnersTableBody = document.getElementById('winnersTableBody');
    const clearWinnersBtn = document.getElementById('clearWinnersBtn');
    const spinnerSound = document.getElementById('spinnerSound');
    const winnerAudio = document.getElementById('winnerAudio');

    let participants = [];
    let spinAngle = 0;
    let spinning = false;

    // Set up spinner sound to loop
    spinnerSound.loop = true;

    // Draw the wheel
    function drawWheel() {
        const radius = wheelCanvas.width / 2;
        const segmentAngle = 360 / participants.length;
        const colors = ['#ff9999', '#99ff99', '#9999ff', '#ffff99', '#ff99ff'];
        wheelCtx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

        participants.forEach((participant, index) => {
            const startAngle = (index * segmentAngle) * Math.PI / 180;
            const endAngle = ((index + 1) * segmentAngle) * Math.PI / 180;
            wheelCtx.beginPath();
            wheelCtx.arc(radius, radius, radius, startAngle, endAngle);
            wheelCtx.lineTo(radius, radius);
            wheelCtx.fillStyle = colors[index % colors.length];
            wheelCtx.fill();

            // Draw participant names
            wheelCtx.save();
            wheelCtx.translate(radius, radius);
            wheelCtx.rotate((startAngle + endAngle) / 2);
            wheelCtx.textAlign = 'right';
            wheelCtx.fillStyle = '#fff';
            wheelCtx.font = 'bold 14px Arial';
            wrapText(wheelCtx, participant, radius - 10, 10, segmentAngle * radius / 2);
            wheelCtx.restore();
        });
    }

    // Wrap text function for drawing
    function wrapText(ctx, text, x, y, maxWidth) {
        const words = text.split(' ');
        let line = '';
        const lines = [];
        words.forEach((word, i) => {
            const testLine = line + word + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && i > 0) {
                lines.push(line);
                line = word + ' ';
            } else {
                line = testLine;
            }
        });
        lines.push(line);

        const lineHeight = 20;
        lines.forEach((line, index) => {
            ctx.fillText(line, x, y + index * lineHeight);
        });
    }

    // Update participants list
    function updateParticipants() {
        participants = participantInput.value.trim().split('\n').filter(name => name.trim() !== '');
        drawWheel();
    }

    participantInput.addEventListener('input', updateParticipants);

    // Add secret participant on Ctrl+M
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key === 'm') {
            const secretName = secretNameInput.value.trim();
            if (secretName && !participants.includes(secretName)) {
                participants.push(secretName);
                updateParticipants();
                secretNameInput.value = '';
            }
            event.preventDefault();
        }
    });

    // Spin the wheel and select winners
    spinBtn.addEventListener('click', () => {
        if (spinning) return;
        spinning = true;

        if (participants.length === 0) {
            alert('Please add participants first.');
            spinning = false;
            return;
        }

        const numberOfWinners = parseInt(numWinnersInput.value, 10);
        if (numberOfWinners < 1 || numberOfWinners > participants.length) {
            alert('Invalid number of winners.');
            spinning = false;
            return;
        }

        // Play the spinner sound and ensure it loops
        spinnerSound.play();

        const randomSpinAngle = Math.floor(Math.random() * 360) + 3600; // at least 10 full rotations
        spinAngle += randomSpinAngle;
        wheelCanvas.style.transition = 'transform 11s ease-out';
        wheelCanvas.style.transform = `rotate(${spinAngle}deg)`;

        setTimeout(() => {
            wheelCanvas.style.transition = 'none';
            wheelCanvas.style.transform = `rotate(${spinAngle % 360}deg)`;
            wheelCanvas.style.transition = 'transform 0s';

            const segmentAngle = 360 / participants.length;
            const winners = new Set(); // Use a Set to ensure uniqueness

            // Clear the previous winners list
            winnersList.innerHTML = '';

            while (winners.size < numberOfWinners) {
                const winnerIndex = Math.floor(Math.random() * participants.length);
                winners.add(participants[winnerIndex]);
            }

            // Add winners to the winners list
            winners.forEach((winner) => {
                const listItem = document.createElement('li');
                listItem.textContent = winner;
                winnersList.appendChild(listItem);
            });

            if (removeWinnerCheckbox.checked) {
                // Remove selected winners from participants
                participants = participants.filter(p => !winners.has(p));
                participantInput.value = participants.join('\n'); // Update textarea
                drawWheel(); // Redraw wheel with updated participants
            }

            // Show winners in the modal
            showWinnersModal(Array.from(winners));

            spinning = false;
        }, 5000); // Match this to the duration of the spinning
    });

    // Display winners in a modal
    function showWinnersModal(winners) {
        // Stop the spinner sound and reset playback
        spinnerSound.pause();
        spinnerSound.currentTime = 0;

        winnersTableBody.innerHTML = '';
        winners.forEach((winner, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${index + 1}</td><td>${winner}</td>`;
            winnersTableBody.appendChild(row);
        });

        // Play the winner announcement audio
        winnerAudio.play();

        winnersModal.style.display = 'block';

        window.onclick = function(event) {
            if (event.target === winnersModal) {
                winnersModal.style.display = 'none';
            }
        };
    }

    // Clear winners list
    clearWinnersBtn.addEventListener('click', () => {
        winnersList.innerHTML = '';
    });

    // Download winners as Excel file
    downloadBtn.addEventListener('click', () => {
        const prizeName = prizeNameInput.value.trim() || 'No Prize Name';
        const winners = Array.from(winnersList.children).map((li, index) => ({
            Number: index + 1,
            'Names of Winners': li.textContent
        }));

        // Create a new workbook and worksheet
        const wb = XLSX.utils.book_new();

        // Data for the worksheet
        const data = [
            [`Prize Name: ${prizeName}`],
            ['Number', 'Names of Winners'],
            ...winners.map(winner => [winner.Number, winner['Names of Winners']])
        ];

        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(data);

        // Merge cells A1:B1
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }
        ];

        // Styling for header row and data
        if (ws['A1']) ws['A1'].s = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
        if (ws['B1']) ws['B1'].s = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };

        // Adjust column widths
        ws['!cols'] = [
            { width: 20 }, // Width of column A
            { width: 30 }  // Width of column B
        ];

        // Create sheet name from prize name
        const sheetName = `${prizeName} WINNERS`.substring(0, 31); // Sheet names must be <= 31 characters
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        // Generate file name with current date and time
        const now = new Date();
        const formattedDate = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
        const fileName = `EDUC_RAFFLE_${prizeName}_${formattedDate}.xlsx`;

        // Write the file
        XLSX.writeFile(wb, fileName);
    });

    // Handle Download Excel File button in the modal
    document.getElementById('downloadExcelModalBtn').addEventListener('click', () => {
        const prizeName = prizeNameInput.value.trim() || 'No Prize Name';
        const winners = Array.from(winnersTableBody.children).map((tr, index) => ({
            Number: tr.children[0].textContent,
            'Names of Winners': tr.children[1].textContent
        }));

        // Create a new workbook and worksheet
        const wb = XLSX.utils.book_new();

        // Data for the worksheet
        const data = [
            [`Prize Name: ${prizeName}`],
            ['Number', 'Names of Winners'],
            ...winners.map(winner => [winner.Number, winner['Names of Winners']])
        ];

        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(data);

        // Merge cells A1:B1
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }
        ];

        // Styling for header row and data
        if (ws['A1']) ws['A1'].s = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
        if (ws['B1']) ws['B1'].s = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };

        // Adjust column widths
        ws['!cols'] = [
            { width: 20 }, // Width of column A
            { width: 30 }  // Width of column B
        ];

        // Create sheet name from prize name
        const sheetName = `${prizeName} WINNERS`.substring(0, 31); // Sheet names must be <= 31 characters
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        // Generate file name with current date and time
        const now = new Date();
        const formattedDate = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
        const fileName = `EDUC_RAFFLE_${prizeName}_${formattedDate}.xlsx`;

        // Write the file
        XLSX.writeFile(wb, fileName);
    });
});*/