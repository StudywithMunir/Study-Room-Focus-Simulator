// ===================================
// Sound Engine Class - Using Web Audio API
// ===================================
class SoundEngine {
    constructor() {
        this.audioContext = null;
        this.sounds = {
            rain: { playing: false, nodes: [] },
            alpha: { playing: false, nodes: [] },
            theta: { playing: false, nodes: [] },
            beta: { playing: false, nodes: [] },
            gamma: { playing: false, nodes: [] }
        };
        this.currentPlayingSound = null; // Track currently playing sound
    }

    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        // Resume context if suspended (required by browser autoplay policies)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    async toggleSound(soundName) {
        this.initAudioContext();
        const sound = this.sounds[soundName];

        if (sound.playing) {
            this.stopSound(soundName);
        } else {
            await this.playSound(soundName);
        }

        return sound.playing;
    }

    async playSound(soundName) {
        this.initAudioContext();
        const sound = this.sounds[soundName];

        // Create sound based on type
        if (soundName === 'rain') {
            this.createRainSound(sound);
        } else if (soundName === 'alpha') {
            this.createBinauralBeat(sound, 10); // 10Hz Alpha waves
        } else if (soundName === 'theta') {
            this.createBinauralBeat(sound, 6); // 6Hz Theta waves
        } else if (soundName === 'beta') {
            this.createBinauralBeat(sound, 20); // 20Hz Beta waves
        } else if (soundName === 'gamma') {
            this.createBinauralBeat(sound, 40); // 40Hz Gamma waves
        }

        sound.playing = true;
    }

    stopSound(soundName) {
        const sound = this.sounds[soundName];

        // Stop all nodes for this sound
        sound.nodes.forEach(node => {
            if (node.stop) {
                try {
                    node.stop();
                } catch (e) {
                    // Already stopped
                }
            }
            if (node.disconnect) {
                node.disconnect();
            }
        });

        sound.nodes = [];
        sound.playing = false;
    }

    createRainSound(sound) {
        // Create rain using multiple oscillators for a richer sound
        const volume = this.getVolume('rain') / 100;
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume * 0.3;
        gainNode.connect(this.audioContext.destination);

        // Create brown noise for rain
        const bufferSize = 4096;
        const brownNoise = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
        let lastOut = 0.0;

        brownNoise.onaudioprocess = function (e) {
            const output = e.outputBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                output[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = output[i];
                output[i] *= 3.5;
            }
        };

        brownNoise.connect(gainNode);
        sound.nodes.push(brownNoise, gainNode);
    }

    createBinauralBeat(sound, frequency) {
        // Create binaural beats for focus enhancement
        const volume = this.getVolume(sound === this.sounds.alpha ? 'alpha' : 'theta') / 100;
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume * 0.2;
        gainNode.connect(this.audioContext.destination);

        // Base frequency (carrier)
        const baseFreq = 200;

        // Create two oscillators with slight frequency difference
        const leftOsc = this.audioContext.createOscillator();
        const rightOsc = this.audioContext.createOscillator();

        leftOsc.frequency.value = baseFreq;
        rightOsc.frequency.value = baseFreq + frequency; // Binaural beat frequency

        leftOsc.type = 'sine';
        rightOsc.type = 'sine';

        // Create stereo panner for left and right channels
        const leftPanner = this.audioContext.createStereoPanner();
        const rightPanner = this.audioContext.createStereoPanner();

        leftPanner.pan.value = -1; // Left ear
        rightPanner.pan.value = 1;  // Right ear

        leftOsc.connect(leftPanner);
        rightOsc.connect(rightPanner);

        leftPanner.connect(gainNode);
        rightPanner.connect(gainNode);

        leftOsc.start();
        rightOsc.start();

        sound.nodes.push(leftOsc, rightOsc, leftPanner, rightPanner, gainNode);
    }

    setVolume(soundName, volume) {
        const sound = this.sounds[soundName];
        if (sound.playing && sound.nodes.length > 0) {
            // Find the gain node (usually the last one)
            const gainNode = sound.nodes[sound.nodes.length - 1];
            if (gainNode.gain) {
                const multiplier = soundName === 'rain' ? 0.3 : 0.2;
                gainNode.gain.value = (volume / 100) * multiplier;
            }
        }
    }

    getVolume(soundName) {
        const slider = document.getElementById(`${soundName}Volume`);
        return slider ? parseInt(slider.value) : 70;
    }

    stopAllSounds() {
        // Stop all playing sounds
        Object.keys(this.sounds).forEach(soundName => {
            if (this.sounds[soundName].playing) {
                this.stopSound(soundName);
                const status = document.getElementById(`${soundName}Status`);
                if (status) {
                    status.textContent = '';
                    status.classList.remove('playing');
                }
            }
        });
        this.currentPlayingSound = null;
    }

    pauseSounds() {
        // Pause currently playing sound (stop it but remember which one)
        Object.keys(this.sounds).forEach(soundName => {
            if (this.sounds[soundName].playing) {
                this.currentPlayingSound = soundName;
                this.stopSound(soundName);
                const status = document.getElementById(`${soundName}Status`);
                if (status) {
                    status.textContent = '';
                    status.classList.remove('playing');
                }
            }
        });
    }

    async resumeSounds() {
        // Resume the sound that was playing before pause
        if (this.currentPlayingSound) {
            const soundName = this.currentPlayingSound;
            const isPlaying = await this.toggleSound(soundName);
            const status = document.getElementById(`${soundName}Status`);
            if (status) {
                status.textContent = isPlaying ? 'Playing' : '';
                status.classList.toggle('playing', isPlaying);
            }
        }
    }
}

// ===================================
// Pomodoro Timer Class
// ===================================
class PomodoroTimer {
    constructor() {
        this.modes = {
            focus: { duration: 25 * 60, label: 'Focus Session' },
            short: { duration: 5 * 60, label: 'Short Break' },
            long: { duration: 15 * 60, label: 'Long Break' }
        };
        this.currentMode = 'focus';
        this.timeRemaining = this.modes.focus.duration;
        this.isRunning = false;
        this.interval = null;
        this.totalTime = this.modes.focus.duration;
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.interval = setInterval(() => this.tick(), 1000);
        }
    }

    pause() {
        this.isRunning = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    reset() {
        this.pause();
        this.timeRemaining = this.totalTime;
        this.updateDisplay();

        // Stop all ambient sounds when timer resets
        if (soundEngine) {
            soundEngine.stopAllSounds();
        }
    }

    tick() {
        if (this.timeRemaining > 0) {
            this.timeRemaining--;
            this.updateDisplay();
        } else {
            this.complete();
        }
    }

    complete() {
        this.pause();
        this.playNotificationSound();
        this.showNotification();
        this.showReward();

        // Stop all ambient sounds when timer completes
        if (soundEngine) {
            soundEngine.stopAllSounds();
        }

        // Update streak if focus session completed
        if (this.currentMode === 'focus') {
            streakTracker.incrementStreak();
        }

        // Auto-reset
        this.timeRemaining = this.totalTime;
        this.updateDisplay();
    }

    setMode(mode) {
        this.pause();
        this.currentMode = mode;
        this.totalTime = this.modes[mode].duration;
        this.timeRemaining = this.totalTime;
        this.updateDisplay();
    }

    setCustomDuration(minutes) {
        this.pause();
        this.totalTime = minutes * 60;
        this.timeRemaining = this.totalTime;
        this.updateDisplay();
    }

    updateDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        document.getElementById('timerDisplay').textContent = timeString;
        document.getElementById('timerMode').textContent = this.modes[this.currentMode]?.label || 'Custom Timer';

        // Update circular progress
        const progress = (this.totalTime - this.timeRemaining) / this.totalTime;
        const circumference = 2 * Math.PI * 90;
        const offset = circumference * (1 - progress);
        document.getElementById('timerProgress').style.strokeDashoffset = offset;

        // Update page title
        document.title = `${timeString} - Study Room`;
    }

    playNotificationSound() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    }

    showNotification() {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Pomodoro Complete!', {
                body: `Your ${this.modes[this.currentMode]?.label || 'timer'} has finished.`,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%23f59e0b"/></svg>'
            });
        }
    }

    showReward() {
        const messages = [
            "Amazing work! You've completed another session! 🌟",
            "Great job! Your focus is improving! 💪",
            "Excellent! Keep up the momentum! 🚀",
            "Well done! You're building great habits! 🎯",
            "Fantastic! Your dedication is paying off! ⭐"
        ];

        const overlay = document.getElementById('rewardOverlay');
        const messageEl = document.getElementById('rewardMessage');

        if (overlay && messageEl) {
            messageEl.textContent = messages[Math.floor(Math.random() * messages.length)];
            overlay.classList.add('show');

            setTimeout(() => {
                overlay.classList.remove('show');
            }, 3000);
        }
    }
}

// ===================================
// Notes Manager Class
// ===================================
class NotesManager {
    constructor() {
        this.textarea = document.getElementById('notesArea');
        this.autoSaveInterval = null;
        this.init();
    }

    init() {
        // Load saved notes
        const savedNotes = localStorage.getItem('studyNotes');
        if (savedNotes) {
            this.textarea.value = savedNotes;
        }

        // Auto-save every 2 seconds
        this.textarea.addEventListener('input', () => {
            clearTimeout(this.autoSaveInterval);
            this.autoSaveInterval = setTimeout(() => this.save(), 2000);
            this.updateStats();
        });

        this.updateStats();
    }

    save() {
        localStorage.setItem('studyNotes', this.textarea.value);
        this.updateLastSaved();
    }

    updateLastSaved() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('lastSaved').textContent = `Saved at ${timeStr}`;
    }

    clear() {
        if (confirm('Are you sure you want to clear all notes? This cannot be undone.')) {
            this.textarea.value = '';
            this.save();
            this.updateStats();
            document.getElementById('lastSaved').textContent = 'Cleared';
        }
    }

    export() {
        const text = this.textarea.value;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `study-notes-${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    insertText(text) {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const currentText = this.textarea.value;

        this.textarea.value = currentText.substring(0, start) + text + currentText.substring(end);
        this.textarea.selectionStart = this.textarea.selectionEnd = start + text.length;
        this.textarea.focus();
        this.save();
        this.updateStats();
    }

    wrapSelection(prefix, suffix = prefix) {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const selectedText = this.textarea.value.substring(start, end);

        if (selectedText) {
            const wrappedText = prefix + selectedText + suffix;
            this.textarea.value = this.textarea.value.substring(0, start) + wrappedText + this.textarea.value.substring(end);
            this.textarea.selectionStart = start + prefix.length;
            this.textarea.selectionEnd = end + prefix.length;
        } else {
            this.insertText(prefix + suffix);
            this.textarea.selectionStart = this.textarea.selectionEnd = start + prefix.length;
        }

        this.textarea.focus();
        this.save();
        this.updateStats();
    }

    addBulletPoint() {
        const start = this.textarea.selectionStart;
        const currentText = this.textarea.value;
        const lineStart = currentText.lastIndexOf('\n', start - 1) + 1;

        this.insertText('\n• ');
    }

    addChecklistItem() {
        const start = this.textarea.selectionStart;
        this.insertText('\n[ ] ');
    }

    updateStats() {
        const text = this.textarea.value;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;

        document.getElementById('wordCount').textContent = `${words} word${words !== 1 ? 's' : ''}`;
        document.getElementById('charCount').textContent = `${chars} character${chars !== 1 ? 's' : ''}`;
    }

    enableInteractiveChecklists() {
        this.textarea.addEventListener('click', (e) => {
            const cursorPos = this.textarea.selectionStart;
            const text = this.textarea.value;
            const lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
            const lineEnd = text.indexOf('\n', cursorPos);
            const line = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);

            // Check if line contains a checkbox
            const uncheckedMatch = line.match(/^\s*\[\s\]/);
            const checkedMatch = line.match(/^\s*\[x\]/);

            if (uncheckedMatch || checkedMatch) {
                const checkboxStart = lineStart + line.indexOf('[');
                const checkboxEnd = checkboxStart + 3;

                // Toggle checkbox
                const newCheckbox = uncheckedMatch ? '[x]' : '[ ]';
                this.textarea.value = text.substring(0, checkboxStart) + newCheckbox + text.substring(checkboxEnd);

                // Restore cursor position
                this.textarea.selectionStart = this.textarea.selectionEnd = cursorPos;

                this.save();
                this.updateStats();
            }
        });
    }
}

// ===================================
// Settings Manager Class
// ===================================
class SettingsManager {
    constructor() {
        this.loadSettings();
    }

    loadSettings() {
        // Load theme
        const theme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', theme);

        // Load sound volumes
        ['rain', 'alpha', 'theta', 'beta', 'gamma'].forEach(sound => {
            const volume = localStorage.getItem(`${sound}Volume`);
            if (volume) {
                const slider = document.getElementById(`${sound}Volume`);
                if (slider) {
                    slider.value = volume;
                    const valueDisplay = document.getElementById(`${sound}VolumeValue`);
                    if (valueDisplay) {
                        valueDisplay.textContent = `${volume}%`;
                    }
                }
            }
        });

        // Load timer state
        const timerMode = localStorage.getItem('timerMode');
        if (timerMode) {
            timer.setMode(timerMode);
        }
    }

    saveTheme(theme) {
        localStorage.setItem('theme', theme);
    }

    saveVolume(sound, volume) {
        localStorage.setItem(`${sound}Volume`, volume);
    }

    saveTimerMode(mode) {
        localStorage.setItem('timerMode', mode);
    }
}

// ===================================
// Theme Manager Class
// ===================================
class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('theme') || 'dark';
        this.apply();
    }

    toggle() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.apply();
        settingsManager.saveTheme(this.currentTheme);
    }

    apply() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
    }
}

// ===================================
// Streak Tracker Class
// ===================================
class StreakTracker {
    constructor() {
        this.loadStreak();
    }

    loadStreak() {
        const streakData = JSON.parse(localStorage.getItem('streakData') || '{"count": 0, "lastDate": null}');
        const today = new Date().toDateString();

        if (streakData.lastDate !== today) {
            const lastDate = new Date(streakData.lastDate);
            const daysDiff = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));

            if (daysDiff > 1) {
                streakData.count = 0; // Reset streak if more than 1 day passed
            }
        }

        this.streak = streakData.count;
        this.updateDisplay();
    }

    incrementStreak() {
        const today = new Date().toDateString();
        const streakData = JSON.parse(localStorage.getItem('streakData') || '{"count": 0, "lastDate": null}');

        if (streakData.lastDate !== today) {
            this.streak++;
            localStorage.setItem('streakData', JSON.stringify({
                count: this.streak,
                lastDate: today
            }));
            this.updateDisplay();
        }
    }

    updateDisplay() {
        document.getElementById('streakCount').textContent = this.streak;
    }
}

// ===================================
// Quote Generator Class
// ===================================
class QuoteGenerator {
    constructor() {
        this.quotes = [
            "The secret of getting ahead is getting started.",
            "Focus on being productive instead of busy.",
            "Success is the sum of small efforts repeated day in and day out.",
            "The expert in anything was once a beginner.",
            "Don't watch the clock; do what it does. Keep going.",
            "Study while others are sleeping; work while others are loafing.",
            "The only way to do great work is to love what you do.",
            "Believe you can and you're halfway there.",
            "Your limitation—it's only your imagination.",
            "Great things never come from comfort zones.",
            "Dream it. Wish it. Do it.",
            "Success doesn't just find you. You have to go out and get it.",
            "The harder you work for something, the greater you'll feel when you achieve it.",
            "Don't stop when you're tired. Stop when you're done.",
            "Wake up with determination. Go to bed with satisfaction."
        ];
        this.showRandomQuote();
        setInterval(() => this.showRandomQuote(), 30 * 60 * 1000); // Every 30 minutes
    }

    showRandomQuote() {
        const quote = this.quotes[Math.floor(Math.random() * this.quotes.length)];
        const quoteElement = document.getElementById('quoteText');
        quoteElement.style.opacity = '0';
        setTimeout(() => {
            quoteElement.textContent = `"${quote}"`;
            quoteElement.style.opacity = '1';
        }, 300);
    }
}

// ===================================
// Initialize Application
// ===================================
let soundEngine, timer, notesManager, settingsManager, themeManager, streakTracker, quoteGenerator;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all managers
    soundEngine = new SoundEngine();
    timer = new PomodoroTimer();
    notesManager = new NotesManager();
    settingsManager = new SettingsManager();
    themeManager = new ThemeManager();
    streakTracker = new StreakTracker();
    quoteGenerator = new QuoteGenerator();

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // Sound controls
    document.querySelectorAll('.sound-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const soundName = btn.dataset.sound;
            const isPlaying = await soundEngine.toggleSound(soundName);
            const status = document.getElementById(`${soundName}Status`);
            status.textContent = isPlaying ? 'Playing' : '';
            status.classList.toggle('playing', isPlaying);
        });
    });

    // Volume sliders
    ['rain', 'alpha', 'theta', 'beta', 'gamma'].forEach(sound => {
        const slider = document.getElementById(`${sound}Volume`);
        const valueDisplay = document.getElementById(`${sound}VolumeValue`);

        if (slider && valueDisplay) {
            slider.addEventListener('input', (e) => {
                const volume = e.target.value;
                valueDisplay.textContent = `${volume}%`;
                soundEngine.setVolume(sound, volume);
                settingsManager.saveVolume(sound, volume);
            });
        }
    });

    // Notes toolbar buttons
    document.getElementById('boldBtn').addEventListener('click', () => {
        notesManager.wrapSelection('**');
    });

    document.getElementById('bulletBtn').addEventListener('click', () => {
        notesManager.addBulletPoint();
    });

    document.getElementById('checklistBtn').addEventListener('click', () => {
        notesManager.addChecklistItem();
    });

    // Enable interactive checklists
    notesManager.enableInteractiveChecklists();

    // Ctrl+B for bold
    document.getElementById('notesArea').addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            notesManager.wrapSelection('**');
        }
    });

    // Timer mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.dataset.mode;
            timer.setMode(mode);
            settingsManager.saveTimerMode(mode);
        });
    });

    // Timer controls
    document.getElementById('startBtn').addEventListener('click', async () => {
        const btn = document.getElementById('startBtn');
        if (timer.isRunning) {
            // Pause timer and sounds
            timer.pause();
            soundEngine.pauseSounds();
            btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start';
        } else {
            // Check if timer was paused (resume) or starting fresh
            const wasPaused = timer.timeRemaining < timer.totalTime;

            if (wasPaused) {
                // Resume: just restart timer and sound
                timer.start();
                await soundEngine.resumeSounds();
                btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause';
            } else {
                // Starting fresh: ask user which sound to play
                const soundChoice = prompt(
                    "Which ambient sound would you like to play?\n\n" +
                    "1 - Rain 🌧️\n" +
                    "2 - Alpha Waves (10Hz) 🧠 - Relaxed focus\n" +
                    "3 - Theta Waves (6Hz) ✨ - Deep meditation\n" +
                    "4 - Beta Waves (20Hz) ⚡ - High alertness\n" +
                    "5 - Gamma Waves (40Hz) 🔥 - Peak focus\n" +
                    "0 - No sound (Silent)\n\n" +
                    "Enter number (0-5):"
                );

                // Only start timer if user made a valid choice (including 0 for silent)
                if (soundChoice !== null && soundChoice !== '') {
                    // Map choice to sound name
                    const soundMap = {
                        '1': 'rain',
                        '2': 'alpha',
                        '3': 'theta',
                        '4': 'beta',
                        '5': 'gamma'
                    };

                    // Play selected sound if valid choice (not 0)
                    if (soundMap[soundChoice]) {
                        const soundName = soundMap[soundChoice];
                        const isPlaying = await soundEngine.toggleSound(soundName);
                        const status = document.getElementById(`${soundName}Status`);
                        if (status) {
                            status.textContent = isPlaying ? 'Playing' : '';
                            status.classList.toggle('playing', isPlaying);
                        }
                        soundEngine.currentPlayingSound = soundName;
                    } else if (soundChoice === '0') {
                        // Silent mode - no sound
                        soundEngine.currentPlayingSound = null;
                    }

                    // Start timer only if valid choice was made
                    if (soundChoice === '0' || soundMap[soundChoice]) {
                        timer.start();
                        btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause';
                    }
                }
                // If user cancelled (null) or invalid input, don't start timer
            }
        }
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
        timer.reset();
        const btn = document.getElementById('startBtn');
        btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start';
    });

    document.getElementById('setCustomBtn').addEventListener('click', () => {
        const minutes = parseInt(document.getElementById('customMinutes').value);
        if (minutes && minutes > 0 && minutes <= 120) {
            timer.setCustomDuration(minutes);
            document.getElementById('customMinutes').value = '';
        }
    });

    // Notes controls
    document.getElementById('exportBtn').addEventListener('click', () => {
        notesManager.export();
    });

    document.getElementById('clearBtn').addEventListener('click', () => {
        notesManager.clear();
    });

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
        themeManager.toggle();
    });

    // Fullscreen toggle
    document.getElementById('fullscreenBtn').addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in textarea or input
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
            return;
        }

        switch (e.key.toLowerCase()) {
            case ' ':
                e.preventDefault();
                document.getElementById('startBtn').click();
                break;
            case 'r':
                e.preventDefault();
                document.getElementById('resetBtn').click();
                break;
            case 'f':
                e.preventDefault();
                document.getElementById('fullscreenBtn').click();
                break;
            case 't':
                e.preventDefault();
                themeManager.toggle();
                break;
            case 'n':
                e.preventDefault();
                document.getElementById('notesArea').focus();
                break;
        }
    });

    // Initialize timer display
    timer.updateDisplay();
});

// Save state before unload
window.addEventListener('beforeunload', () => {
    notesManager.save();
});
