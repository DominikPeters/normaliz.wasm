/**
 * Main application logic for the Normaliz web GUI.
 */
import { createEditor, getContent, setContent } from './editor.js';
import { examples } from './examples.js';

// --- State ---
let editorView = null;
let worker = null;
let running = false;
let startTime = null;
let timerInterval = null;
let saveTimer = null;

// --- DOM references ---
const $ = (sel) => document.querySelector(sel);
const inputPanel = $('#input-editor');
const outputText = $('#output-text');
const consoleText = $('#console-text');
const runBtn = $('#run-btn');
const runLabel = $('#run-label');
const runShortcut = $('#run-shortcut');
const statusEl = $('#status');
const timerEl = $('#timer');
const examplesBtn = $('#examples-btn');
const examplesModal = $('#examples-modal');
const examplesContent = $('#examples-content');
const openBtn = $('#open-btn');
const saveInputBtn = $('#save-input-btn');
const downloadBtn = $('#download-btn');
const copyBtn = $('#copy-btn');
const outputFiles = $('#output-files');
const fileInput = $('#file-input');
const advancedToggle = $('#advanced-toggle');
const advancedPanel = $('#advanced-panel');
const inputPanelContainer = $('#input-panel');
const outputPanelContainer = $('#output-panel');
const mainContainer = $('.main');
const outputStack = $('#output-stack');
const outputPaneMain = $('#output-pane-main');
const outputPaneHeader = outputPaneMain.querySelector('.stack-header');
const mainResizer = $('#main-resizer');
const outputResizer = $('#output-resizer');

// Options
const computationSelect = $('#computation');
const algorithmSelect = $('#algorithm');
const precisionSelect = $('#precision');
const verboseCheck = $('#verbose');
const allFilesCheck = $('#all-files');
const customFlags = $('#custom-flags');

// Last result for download
let lastResult = null;
let selectedOutputFile = 'out';
const STORAGE_KEY = 'normaliz.web.state.v1';

function isMacPlatform() {
    const platform = navigator.userAgentData?.platform || navigator.platform || '';
    return /Mac|iPhone|iPad|iPod/.test(platform);
}

function setRunShortcutHint() {
    runShortcut.textContent = isMacPlatform() ? '⌘Enter' : 'Ctrl+Enter';
}

function readPersistedState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== 1) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writePersistedState() {
    if (!editorView) return;
    const state = {
        version: 1,
        input: getContent(editorView),
        options: {
            computation: computationSelect.value,
            algorithm: algorithmSelect.value,
            precision: precisionSelect.value,
            verbose: verboseCheck.checked,
            allFiles: allFilesCheck.checked,
            customFlags: customFlags.value,
        },
        layout: {
            inputWidth: inputPanelContainer.style.flexBasis || '',
            outputHeight: outputPaneMain.style.flexBasis || '',
        },
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Ignore storage failures, e.g. private browsing quota limits.
    }
}

function schedulePersist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(writePersistedState, 150);
}

function applyPersistedState(state) {
    if (!state) return;

    const { options = {}, layout = {} } = state;
    if (typeof options.computation === 'string') computationSelect.value = options.computation;
    if (typeof options.algorithm === 'string') algorithmSelect.value = options.algorithm;
    if (typeof options.precision === 'string') precisionSelect.value = options.precision;
    if (typeof options.verbose === 'boolean') verboseCheck.checked = options.verbose;
    if (typeof options.allFiles === 'boolean') allFilesCheck.checked = options.allFiles;
    if (typeof options.customFlags === 'string') customFlags.value = options.customFlags;

    if (typeof layout.inputWidth === 'string' && layout.inputWidth) {
        inputPanelContainer.style.flexBasis = layout.inputWidth;
    }
    if (typeof layout.outputHeight === 'string' && layout.outputHeight) {
        outputPaneMain.style.flexBasis = layout.outputHeight;
    }
}

// --- Worker ---
function initWorker() {
    worker = new Worker('./worker.js', { type: 'module' });
    worker.onmessage = (e) => {
        const msg = e.data;
        switch (msg.type) {
            case 'ready':
                setStatus('Ready');
                runBtn.disabled = false;
                break;
            case 'stdout':
                consoleText.textContent += msg.line + '\n';
                consoleText.scrollTop = consoleText.scrollHeight;
                break;
            case 'stderr':
                consoleText.textContent += msg.line + '\n';
                consoleText.scrollTop = consoleText.scrollHeight;
                break;
            case 'result':
                lastResult = msg;
                selectedOutputFile = msg.files.out ? 'out' : Object.keys(msg.files)[0] || 'out';
                renderOutputFiles();
                updateOutputView();
                if (msg.exitCode !== 0) {
                    setStatus('Error (exit code ' + msg.exitCode + ')');
                } else {
                    setStatus('Done');
                }
                stopTimer();
                setRunning(false);
                // Update download button
                updateDownloadOptions();
                break;
            case 'error':
                setStatus('Error: ' + msg.message);
                stopTimer();
                setRunning(false);
                break;
        }
    };
    setStatus('Loading Normaliz...');
    runBtn.disabled = true;
}

// --- Build flags from GUI options ---
function buildFlags() {
    const flags = [];

    const comp = computationSelect.value;
    if (comp) flags.push('--' + comp);

    const algo = algorithmSelect.value;
    if (algo) flags.push('--' + algo);

    const prec = precisionSelect.value;
    if (prec) flags.push('--' + prec);

    if (verboseCheck.checked) flags.push('--verbose');
    if (allFilesCheck.checked) flags.push('-a');

    // Custom flags
    const custom = customFlags.value.trim();
    if (custom) {
        flags.push(...custom.split(/\s+/));
    }

    return flags;
}

// --- Run ---
function runComputation() {
    if (running || !worker) return;
    const input = getContent(editorView);
    if (!input.trim()) return;

    const flags = buildFlags();

    // Clear output
    outputText.textContent = '';
    outputFiles.classList.remove('open');
    outputFiles.innerHTML = '';
    outputPaneHeader.textContent = 'Output';
    consoleText.textContent = '';
    lastResult = null;
    selectedOutputFile = 'out';

    setRunning(true);
    setStatus('Running...');
    startTimer();

    worker.postMessage({ type: 'run', input, flags });
}

// --- UI helpers ---
function setRunning(state) {
    running = state;
    runLabel.textContent = state ? 'Running...' : 'Run';
    runBtn.disabled = state;
}

function setStatus(text) {
    statusEl.textContent = text;
}

function startTimer() {
    startTime = Date.now();
    timerEl.textContent = '0.0s';
    timerInterval = setInterval(() => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        timerEl.textContent = elapsed + 's';
    }, 100);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateDownloadOptions() {
    if (!lastResult) return;
    const availableFiles = Object.keys(lastResult.files);
    downloadBtn.disabled = availableFiles.length === 0;
}

function renderOutputFiles() {
    if (!lastResult) {
        outputFiles.classList.remove('open');
        outputFiles.innerHTML = '';
        return;
    }

    const entries = Object.entries(lastResult.files).filter(([, content]) => typeof content === 'string');
    const hasExtraFiles = entries.some(([name]) => name !== 'out');
    if (!hasExtraFiles) {
        outputFiles.classList.remove('open');
        outputFiles.innerHTML = '';
        return;
    }

    outputFiles.innerHTML = '';
    outputFiles.classList.add('open');

    const label = document.createElement('span');
    label.className = 'output-files-label';
    label.textContent = 'Produced files';
    outputFiles.appendChild(label);

    for (const [name] of entries) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'output-file-btn';
        btn.textContent = `.${name}`;
        btn.classList.toggle('active', name === selectedOutputFile);
        btn.addEventListener('click', () => {
            selectedOutputFile = name;
            updateOutputView();
            renderOutputFiles();
        });
        outputFiles.appendChild(btn);
    }
}

function updateOutputView() {
    if (!lastResult) {
        outputText.textContent = '';
        outputPaneHeader.textContent = 'Output';
        return;
    }

    const files = lastResult.files || {};
    const content = files[selectedOutputFile] ?? lastResult.output ?? '';
    outputText.textContent = content;
    outputPaneHeader.textContent = selectedOutputFile === 'out'
        ? 'Output'
        : `Output .${selectedOutputFile}`;
}

// --- Split panes ---
function initSplitters() {
    const MIN_INPUT_WIDTH = 260;
    const MIN_OUTPUT_WIDTH = 320;
    const MIN_TOP_HEIGHT = 100;
    const MIN_BOTTOM_HEIGHT = 90;

    mainResizer.addEventListener('pointerdown', (downEvent) => {
        downEvent.preventDefault();
        document.body.classList.add('resizing');
        const mainRect = mainContainer.getBoundingClientRect();

        function onMove(moveEvent) {
            const x = moveEvent.clientX - mainRect.left;
            const maxLeft = mainRect.width - MIN_OUTPUT_WIDTH - 8;
            const nextLeft = Math.min(Math.max(x, MIN_INPUT_WIDTH), maxLeft);
            inputPanelContainer.style.flexBasis = `${nextLeft}px`;
            outputPanelContainer.style.minWidth = `${MIN_OUTPUT_WIDTH}px`;
        }

        function onUp() {
            document.body.classList.remove('resizing');
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            schedulePersist();
        }

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp, { once: true });
    });

    outputResizer.addEventListener('pointerdown', (downEvent) => {
        downEvent.preventDefault();
        document.body.classList.add('resizing-row');
        const stackRect = outputStack.getBoundingClientRect();

        function onMove(moveEvent) {
            const y = moveEvent.clientY - stackRect.top;
            const maxTop = stackRect.height - MIN_BOTTOM_HEIGHT - 8;
            const nextTop = Math.min(Math.max(y, MIN_TOP_HEIGHT), maxTop);
            outputPaneMain.style.flexBasis = `${nextTop}px`;
        }

        function onUp() {
            document.body.classList.remove('resizing-row');
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            schedulePersist();
        }

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp, { once: true });
    });
}

// --- Run button ---
runBtn.addEventListener('click', runComputation);

// Ctrl/Cmd+Enter to run
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runComputation();
    }
});

[
    computationSelect,
    algorithmSelect,
    precisionSelect,
    verboseCheck,
    allFilesCheck,
    customFlags,
].forEach((el) => {
    el.addEventListener('change', schedulePersist);
    el.addEventListener('input', schedulePersist);
});

// --- File I/O ---
openBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        setContent(editorView, reader.result);
        document.title = `Normaliz - ${file.name}`;
    };
    reader.readAsText(file);
    fileInput.value = '';
});

saveInputBtn.addEventListener('click', () => {
    const content = getContent(editorView);
    downloadFile('input.in', content);
});

downloadBtn.addEventListener('click', () => {
    if (!lastResult) return;
    // Download .out by default, or show picker if multiple files
    const files = lastResult.files;
    const keys = Object.keys(files);
    if (keys.length === 0) return;

    if (keys.length === 1 || files.out) {
        downloadFile('output.out', files.out || files[keys[0]]);
    } else {
        // Download all as separate files — for simplicity just download .out
        downloadFile('output.out', files.out || '');
    }
});

copyBtn.addEventListener('click', () => {
    const text = outputText.textContent;
    navigator.clipboard.writeText(text);
    const orig = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => copyBtn.textContent = orig, 1500);
});

function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// --- Drag and drop ---
inputPanel.addEventListener('dragover', (e) => {
    e.preventDefault();
    inputPanel.classList.add('drag-over');
});
inputPanel.addEventListener('dragleave', () => {
    inputPanel.classList.remove('drag-over');
});
inputPanel.addEventListener('drop', (e) => {
    e.preventDefault();
    inputPanel.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        setContent(editorView, reader.result);
        document.title = `Normaliz - ${file.name}`;
    };
    reader.readAsText(file);
});

// --- Examples modal ---
examplesBtn.addEventListener('click', () => {
    examplesModal.classList.toggle('open');
});
examplesModal.addEventListener('click', (e) => {
    if (e.target === examplesModal) examplesModal.classList.remove('open');
});

function buildExamplesUI() {
    examplesContent.innerHTML = '';
    for (const [category, items] of Object.entries(examples)) {
        const section = document.createElement('div');
        section.className = 'example-category';

        const header = document.createElement('h3');
        header.textContent = category;
        section.appendChild(header);

        const list = document.createElement('div');
        list.className = 'example-list';

        for (const item of items) {
            const btn = document.createElement('button');
            btn.className = 'example-item';
            btn.innerHTML = `<strong>${item.file}</strong><span>${item.description}</span>`;
            btn.addEventListener('click', () => loadExample(item.file));
            list.appendChild(btn);
        }

        section.appendChild(list);
        examplesContent.appendChild(section);
    }
}

async function loadExample(name) {
    const url = `examples/${name}.in`;
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Not found');
        const text = await resp.text();
        setContent(editorView, text);
        document.title = `Normaliz - ${name}.in`;
        examplesModal.classList.remove('open');
    } catch (e) {
        console.error('Failed to load example:', name, e);
    }
}

// --- Advanced toggle ---
advancedToggle.addEventListener('click', () => {
    const open = advancedPanel.classList.toggle('open');
    advancedToggle.textContent = open ? 'Advanced \u25BE' : 'Advanced \u25B8';
});

// --- Init ---
const defaultInput = `amb_space 2
cone 2
1 3
2 1
`;

const persistedState = readPersistedState();
applyPersistedState(persistedState);
editorView = createEditor(inputPanel, persistedState?.input || defaultInput, schedulePersist).view;
setRunShortcutHint();
initSplitters();
buildExamplesUI();
initWorker();
writePersistedState();
